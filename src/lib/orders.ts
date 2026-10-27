import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { newPickupCode } from './codes'
import type { Db, Executor } from './db'
import { DomainError } from './errors'
import { log } from './log'
import { orderItems, orders, prizes, type OrderStatus } from './schema'
import { credit, debit, returnStock, takeStock } from './wallets'

export type CartLine = { prizeId: number; quantity: number }

const withItems = { items: { with: { prize: true } } } as const

export type OrderView = NonNullable<Awaited<ReturnType<typeof getOrder>>>

export async function getOrder(db: Db, orderId: string) {
  return db.query.orders.findFirst({ where: eq(orders.id, orderId), with: withItems })
}

export async function checkout(db: Db, walletId: string, lines: CartLine[]): Promise<OrderView> {
  if (lines.length === 0 || lines.length > 50) throw new DomainError('invalid_input', 'Your cart is empty')
  const quantities = new Map<number, number>()
  for (const { prizeId, quantity } of lines) {
    if (!Number.isInteger(prizeId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      throw new DomainError('invalid_input', 'Invalid cart')
    }
    quantities.set(prizeId, (quantities.get(prizeId) ?? 0) + quantity)
  }
  const ids = [...quantities.keys()].sort((a, b) => a - b)

  const orderId = await db.transaction(async (tx) => {
    const found = new Map((await tx.select().from(prizes).where(inArray(prizes.id, ids))).map((p) => [p.id, p]))
    if (found.size !== ids.length) throw new DomainError('not_found', 'Some prizes in your cart no longer exist')

    const id = randomUUID()
    const total = ids.reduce((sum, pid) => sum + found.get(pid)!.ticketCost * quantities.get(pid)!, 0)
    await debit(tx, walletId, total, 'order', id)
    // Sorted so concurrent checkouts lock prize rows in the same order (no deadlocks).
    for (const pid of ids) {
      if (!(await takeStock(tx, pid, quantities.get(pid)!))) {
        throw new DomainError('out_of_stock', `Not enough stock left for ${found.get(pid)!.name}`)
      }
    }
    await tx.insert(orders).values({ id, walletId, pickupCode: await uniquePickupCode(tx), totalTickets: total })
    await tx.insert(orderItems).values(
      ids.map((pid) => ({ orderId: id, prizeId: pid, quantity: quantities.get(pid)!, unitCost: found.get(pid)!.ticketCost })),
    )
    log('checkout', { tickets: total, items: ids.length })
    return id
  })
  return (await getOrder(db, orderId))!
}

async function uniquePickupCode(tx: Executor): Promise<string> {
  for (;;) {
    const code = newPickupCode()
    const [taken] = await tx.select({ id: orders.id }).from(orders).where(eq(orders.pickupCode, code))
    if (!taken) return code
  }
}

export async function listOrders(db: Db, walletId: string) {
  return db.query.orders.findMany({
    where: eq(orders.walletId, walletId),
    orderBy: desc(orders.createdAt),
    limit: 50,
    with: withItems,
  })
}

/**
 * Close a pending order. `walletId` restricts a customer to their own orders; staff pass null.
 * The status check is part of the UPDATE, so an order can't be both fulfilled and refunded.
 */
async function closeOrder(db: Db, orderId: string, to: OrderStatus, opts: { walletId?: string; staffId?: string }) {
  await db.transaction(async (tx) => {
    const [order] = await tx
      .update(orders)
      .set({ status: to, closedAt: new Date(), fulfilledBy: to === 'fulfilled' ? opts.staffId : null })
      .where(
        and(
          eq(orders.id, orderId),
          eq(orders.status, 'pending'),
          opts.walletId ? eq(orders.walletId, opts.walletId) : undefined,
        ),
      )
      .returning()
    if (!order) {
      const [current] = await tx.select().from(orders).where(eq(orders.id, orderId))
      if (!current || (opts.walletId && current.walletId !== opts.walletId)) {
        throw new DomainError('not_found', 'Order not found')
      }
      throw new DomainError('invalid_state', `Order is already ${current.status}`)
    }
    if (to === 'cancelled') {
      for (const item of await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId))) {
        await returnStock(tx, item.prizeId, item.quantity)
      }
      await credit(tx, order.walletId, order.totalTickets, opts.staffId ? 'staff_refund' : 'refund', order.id)
    }
    log(to === 'fulfilled' ? 'order_fulfilled' : 'order_cancelled', { tickets: order.totalTickets, by: opts.staffId ? 'staff' : 'customer' })
  })
  return (await getOrder(db, orderId))!
}

export const cancelOwnOrder = (db: Db, orderId: string, walletId: string) =>
  closeOrder(db, orderId, 'cancelled', { walletId })

export const staffCancelOrder = (db: Db, orderId: string, staffId: string) =>
  closeOrder(db, orderId, 'cancelled', { staffId })

export const fulfillOrder = (db: Db, orderId: string, staffId: string) =>
  closeOrder(db, orderId, 'fulfilled', { staffId })

export async function pickupQueue(db: Db) {
  return db.query.orders.findMany({
    where: eq(orders.status, 'pending'),
    orderBy: asc(orders.createdAt),
    limit: 100,
    with: withItems,
  })
}

export async function findByPickupCode(db: Db, code: string) {
  return db.query.orders.findFirst({ where: eq(orders.pickupCode, code.trim().toUpperCase()), with: withItems })
}
