import type { Executor } from './db'
import catalog from './prizes.json'
import { prizes } from './schema'

/** Load the sample catalog. Safe to run repeatedly: existing SKUs are left alone. */
export async function seedPrizes(db: Executor): Promise<number> {
  const rows = catalog.map((p) => ({
    sku: p.sku,
    name: p.name,
    description: p.description,
    category: p.category,
    ticketCost: p.ticket_cost,
    stock: p.stock,
    image: p.image,
  }))
  const inserted = await db.insert(prizes).values(rows).onConflictDoNothing({ target: prizes.sku }).returning()
  return inserted.length
}
