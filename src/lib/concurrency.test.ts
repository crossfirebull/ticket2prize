import { describe, expect, it } from 'vitest'
import { setupTestDb } from '../test/db'
import { setStock } from './catalog'
import { checkout } from './orders'
import { claimStub, issueStub } from './stubs'

const t = setupTestDb()

const outcomes = (results: PromiseSettledResult<unknown>[]) =>
  results.map((r) => (r.status === 'fulfilled' ? 'ok' : (r.reason as { code?: string }).code)).sort()

describe('races', () => {
  it('the last prize goes to exactly one of 8 simultaneous buyers', async () => {
    const bear = await t.prize('Giant Plushie Bear')
    await setStock(t.db, bear.id, 1)
    const shoppers = await Promise.all(Array.from({ length: 8 }, () => t.guestWith(2000)))

    const results = await Promise.allSettled(
      shoppers.map((s) => checkout(t.db, s.walletId, [{ prizeId: bear.id, quantity: 1 }])),
    )
    expect(outcomes(results)).toEqual(['ok', ...Array(7).fill('out_of_stock')])
  })

  it('a stub scanned 8 times at once is credited once', async () => {
    const stub = await issueStub(t.db, 100)
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => claimStub(t.db, stub.code, null)))
    expect(outcomes(results)).toEqual([...Array(7).fill('already_claimed'), 'ok'])
  })

  it('one wallet double-spending from two tabs only pays once', async () => {
    const guest = await t.guestWith(750)
    const pikachu = await t.prize('Pokemon - Pikachu Plushie')
    const results = await Promise.allSettled(
      [1, 2].map(() => checkout(t.db, guest.walletId, [{ prizeId: pikachu.id, quantity: 1 }])),
    )
    expect(outcomes(results)).toEqual(['insufficient_tickets', 'ok'])
  })
})
