import { sql } from 'drizzle-orm'
import { afterAll, beforeEach } from 'vitest'
import { createStaff, register } from '../lib/accounts'
import { createDb } from '../lib/db'
import { seedPrizes } from '../lib/seed'
import { prizes } from '../lib/schema'
import { claimStub, issueStub, type Principal } from '../lib/stubs'
import { TEST_DATABASE_URL } from './global-setup'

/** A database reset to the seeded catalog before every test in the file. */
export function setupTestDb() {
  const { db, pool } = createDb(TEST_DATABASE_URL)
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE prizes, wallets, accounts, ticket_stubs, ledger_entries, orders, order_items RESTART IDENTITY CASCADE`)
    await seedPrizes(db)
  })
  afterAll(() => pool.end())

  const helpers = {
    db,
    /** A guest who has just scanned a stub worth `tickets`. */
    async guestWith(tickets: number): Promise<Principal> {
      const stub = await issueStub(db, tickets)
      const { walletId } = await claimStub(db, stub.code, null)
      return { walletId, accountId: null }
    },
    async customer(email = 'sam@example.com'): Promise<Principal> {
      const account = await register(db, { email, password: 'correct-horse', displayName: 'Sam' }, null)
      return { walletId: account.walletId, accountId: account.id }
    },
    async staff() {
      await createStaff(db, 'staff@example.com', 'staff-password')
      const account = await db.query.accounts.findFirst({ where: (a, { eq }) => eq(a.email, 'staff@example.com') })
      return account!
    },
    async prize(name: string) {
      const all = await db.select().from(prizes)
      return all.find((p) => p.name === name)!
    },
  }
  return helpers
}
