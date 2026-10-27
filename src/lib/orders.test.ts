import { describe, expect, it } from 'vitest'
import { setupTestDb } from '../test/db'
import { listPrizes } from './catalog'
import {
  cancelOwnOrder,
  checkout,
  findByPickupCode,
  fulfillOrder,
  getOrder,
  listOrders,
  pickupQueue,
  staffCancelOrder,
} from './orders'
import { balanceOf } from './wallets'

const t = setupTestDb()
const stockOf = async (id: number) => (await listPrizes(t.db)).find((p) => p.id === id)!.stock

describe('checkout', () => {
  it('spends tickets and stock, merging duplicate lines', async () => {
    const guest = await t.guestWith(500)
    const yoyo = await t.prize('Light Up YoYo - Red')
    const order = await checkout(t.db, guest.walletId, [
      { prizeId: yoyo.id, quantity: 1 },
      { prizeId: yoyo.id, quantity: 1 },
    ])
    expect(order).toMatchObject({ status: 'pending', totalTickets: 500 })
    expect(order.pickupCode).toMatch(/^[2-9A-HJKMNP-Z]{6}$/)
    expect(order.items.map((i) => [i.prizeId, i.quantity, i.prize.name])).toEqual([[yoyo.id, 2, yoyo.name]])
    expect(await balanceOf(t.db, guest.walletId)).toBe(0)
    expect(await stockOf(yoyo.id)).toBe(yoyo.stock - 2)
  })

  it('not enough tickets changes nothing', async () => {
    const guest = await t.guestWith(100)
    const sw = await t.prize('Nintendo Switch')
    await expect(checkout(t.db, guest.walletId, [{ prizeId: sw.id, quantity: 1 }])).rejects.toMatchObject({
      code: 'insufficient_tickets',
    })
    expect(await balanceOf(t.db, guest.walletId)).toBe(100)
    expect(await stockOf(sw.id)).toBe(sw.stock)
  })

  it('one out-of-stock item rolls back the whole order', async () => {
    const guest = await t.guestWith(5000)
    const candy = await t.prize('Tootsie Roll')
    const bear = await t.prize('Giant Plushie Bear')
    expect(bear.stock).toBe(0)
    await expect(
      checkout(t.db, guest.walletId, [
        { prizeId: candy.id, quantity: 1 },
        { prizeId: bear.id, quantity: 1 },
      ]),
    ).rejects.toThrow('Not enough stock left for Giant Plushie Bear')
    expect(await balanceOf(t.db, guest.walletId)).toBe(5000)
    expect(await stockOf(candy.id)).toBe(candy.stock)
  })

  it('rejects unknown prizes and malformed carts', async () => {
    const guest = await t.guestWith(100)
    await expect(checkout(t.db, guest.walletId, [{ prizeId: 9999, quantity: 1 }])).rejects.toMatchObject({ code: 'not_found' })
    await expect(checkout(t.db, guest.walletId, [])).rejects.toMatchObject({ code: 'invalid_input' })
    await expect(checkout(t.db, guest.walletId, [{ prizeId: 1, quantity: 0 }])).rejects.toMatchObject({ code: 'invalid_input' })
  })
})

describe('after checkout', () => {
  async function placeOrder(tickets = 100, quantity = 4) {
    const guest = await t.guestWith(tickets)
    const candy = await t.prize('Tootsie Roll')
    return { guest, candy, order: await checkout(t.db, guest.walletId, [{ prizeId: candy.id, quantity }]) }
  }

  it('customers can cancel for a refund, once', async () => {
    const { guest, candy, order } = await placeOrder()
    expect((await cancelOwnOrder(t.db, order.id, guest.walletId)).status).toBe('cancelled')
    expect(await balanceOf(t.db, guest.walletId)).toBe(100)
    expect(await stockOf(candy.id)).toBe(candy.stock)
    await expect(cancelOwnOrder(t.db, order.id, guest.walletId)).rejects.toMatchObject({ code: 'invalid_state' })
  })

  it("orders are private to the customer's wallet", async () => {
    const { order } = await placeOrder()
    const stranger = await t.customer()
    await expect(cancelOwnOrder(t.db, order.id, stranger.walletId)).rejects.toMatchObject({ code: 'not_found' })
    expect(await listOrders(t.db, stranger.walletId)).toEqual([])
  })

  it('staff find orders by pickup code and hand them over', async () => {
    const { guest, order } = await placeOrder()
    const staff = await t.staff()
    expect((await pickupQueue(t.db)).map((o) => o.id)).toEqual([order.id])
    expect((await findByPickupCode(t.db, ` ${order.pickupCode.toLowerCase()} `))?.id).toBe(order.id)

    const done = await fulfillOrder(t.db, order.id, staff.id)
    expect(done).toMatchObject({ status: 'fulfilled', fulfilledBy: staff.id })
    expect(await pickupQueue(t.db)).toEqual([])
    await expect(fulfillOrder(t.db, order.id, staff.id)).rejects.toMatchObject({ code: 'invalid_state' })
    // Picked-up prizes can't be refunded.
    await expect(cancelOwnOrder(t.db, order.id, guest.walletId)).rejects.toMatchObject({ code: 'invalid_state' })
  })

  it('staff can cancel and refund', async () => {
    const { guest, order } = await placeOrder()
    const staff = await t.staff()
    expect((await staffCancelOrder(t.db, order.id, staff.id)).status).toBe('cancelled')
    expect(await balanceOf(t.db, guest.walletId)).toBe(100)
  })

  it('unknown orders', async () => {
    const staff = await t.staff()
    expect(await findByPickupCode(t.db, 'ZZZZZZ')).toBeUndefined()
    expect(await getOrder(t.db, '00000000-0000-0000-0000-000000000000')).toBeUndefined()
    await expect(fulfillOrder(t.db, '00000000-0000-0000-0000-000000000000', staff.id)).rejects.toMatchObject({
      code: 'not_found',
    })
  })
})
