import { and, asc, eq, gt, ilike, lte, or, type SQL } from 'drizzle-orm'
import type { Executor } from './db'
import { DomainError } from './errors'
import { prizes, type Prize } from './schema'

export type PrizeFilter = { category?: string; q?: string; inStock?: boolean }

export async function listPrizes(db: Executor, filter: PrizeFilter = {}): Promise<Prize[]> {
  const where: SQL[] = []
  if (filter.category) where.push(eq(prizes.category, filter.category))
  if (filter.q) {
    const pattern = `%${filter.q.slice(0, 80)}%`
    where.push(or(ilike(prizes.name, pattern), ilike(prizes.description, pattern))!)
  }
  if (filter.inStock) where.push(gt(prizes.stock, 0))
  return db
    .select()
    .from(prizes)
    .where(and(...where))
    .orderBy(asc(prizes.ticketCost), asc(prizes.name))
}

export async function lowStock(db: Executor, threshold = 5): Promise<Prize[]> {
  return db.select().from(prizes).where(lte(prizes.stock, threshold)).orderBy(asc(prizes.stock), asc(prizes.name))
}

export async function setStock(db: Executor, prizeId: number, stock: number): Promise<Prize> {
  if (!Number.isInteger(stock) || stock < 0 || stock > 100_000) {
    throw new DomainError('invalid_input', 'Stock must be a whole number from 0 to 100,000')
  }
  const [prize] = await db.update(prizes).set({ stock }).where(eq(prizes.id, prizeId)).returning()
  if (!prize) throw new DomainError('not_found', 'Prize not found')
  return prize
}
