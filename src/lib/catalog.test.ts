import { describe, expect, it } from 'vitest'
import { setupTestDb } from '../test/db'
import { listPrizes, lowStock, setStock } from './catalog'

const t = setupTestDb()

describe('catalog', () => {
  it('lists the seeded catalog cheapest first', async () => {
    const all = await listPrizes(t.db)
    expect(all).toHaveLength(44)
    const costs = all.map((p) => p.ticketCost)
    expect(costs).toEqual([...costs].sort((a, b) => a - b))
  })

  it('filters by category, search text and stock', async () => {
    expect(new Set((await listPrizes(t.db, { category: 'candy' })).map((p) => p.category))).toEqual(new Set(['candy']))
    expect((await listPrizes(t.db, { q: 'pikachu' })).map((p) => p.name)).toEqual(['Pokemon - Pikachu Plushie'])
    const inStock = await listPrizes(t.db, { inStock: true })
    expect(inStock.every((p) => p.stock > 0)).toBe(true)
    expect(inStock.length).toBeLessThan(44)
  })

  it('reports low stock and restocks', async () => {
    expect((await lowStock(t.db))[0].stock).toBe(0)
    const bear = await t.prize('Giant Plushie Bear')
    expect((await setStock(t.db, bear.id, 4)).stock).toBe(4)
    await expect(setStock(t.db, bear.id, -1)).rejects.toMatchObject({ code: 'invalid_input' })
    await expect(setStock(t.db, 9999, 1)).rejects.toMatchObject({ code: 'not_found' })
  })
})
