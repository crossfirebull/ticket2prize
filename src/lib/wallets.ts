/**
 * Balance and inventory changes.
 *
 * Every change is a single conditional UPDATE (`balance = balance - n WHERE balance >= n`),
 * so two requests racing for the last tickets or the last prize can't both win.
 */
import { and, eq, gte, sql } from 'drizzle-orm'
import type { Executor } from './db'
import { DomainError } from './errors'
import { ledgerEntries, prizes, wallets } from './schema'

export async function credit(db: Executor, walletId: string, amount: number, reason: string, reference: string) {
  await db
    .update(wallets)
    .set({ balance: sql`${wallets.balance} + ${amount}` })
    .where(eq(wallets.id, walletId))
  await db.insert(ledgerEntries).values({ walletId, delta: amount, reason, reference })
}

export async function debit(db: Executor, walletId: string, amount: number, reason: string, reference: string) {
  const updated = await db
    .update(wallets)
    .set({ balance: sql`${wallets.balance} - ${amount}` })
    .where(and(eq(wallets.id, walletId), gte(wallets.balance, amount)))
    .returning({ id: wallets.id })
  if (updated.length !== 1) throw new DomainError('insufficient_tickets', 'Not enough tickets for this order')
  await db.insert(ledgerEntries).values({ walletId, delta: -amount, reason, reference })
}

/** Returns false instead of throwing so the caller can name the prize in its error. */
export async function takeStock(db: Executor, prizeId: number, quantity: number): Promise<boolean> {
  const updated = await db
    .update(prizes)
    .set({ stock: sql`${prizes.stock} - ${quantity}` })
    .where(and(eq(prizes.id, prizeId), gte(prizes.stock, quantity)))
    .returning({ id: prizes.id })
  return updated.length === 1
}

export async function returnStock(db: Executor, prizeId: number, quantity: number) {
  await db
    .update(prizes)
    .set({ stock: sql`${prizes.stock} + ${quantity}` })
    .where(eq(prizes.id, prizeId))
}

export async function balanceOf(db: Executor, walletId: string): Promise<number> {
  const [row] = await db.select({ balance: wallets.balance }).from(wallets).where(eq(wallets.id, walletId))
  return row?.balance ?? 0
}
