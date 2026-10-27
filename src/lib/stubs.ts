import { and, eq, isNull } from 'drizzle-orm'
import { newStubCode } from './codes'
import type { Db, Executor } from './db'
import { DomainError } from './errors'
import { log } from './log'
import { ticketStubs, wallets } from './schema'
import { balanceOf, credit } from './wallets'

export type Principal = { walletId: string; accountId: string | null }

export async function issueStub(db: Executor, tickets: number, kioskId = 'kiosk-1') {
  if (!Number.isInteger(tickets) || tickets <= 0 || tickets > 1_000_000) {
    throw new DomainError('invalid_input', 'tickets must be a whole number from 1 to 1,000,000')
  }
  const [stub] = await db
    .insert(ticketStubs)
    .values({ code: newStubCode(), tickets, kioskId: kioskId.slice(0, 64) })
    .returning()
  log('stub_issued', { tickets, kiosk_id: stub.kioskId })
  return stub
}

export async function previewStub(db: Executor, code: string) {
  const [stub] = await db.select().from(ticketStubs).where(eq(ticketStubs.code, code))
  return stub ? { tickets: stub.tickets, claimed: stub.claimedAt !== null } : null
}

/** Credit a stub's tickets to the principal's wallet, or to a new guest wallet. */
export async function claimStub(db: Db, code: string, principal: Principal | null) {
  return db.transaction(async (tx) => {
    const [stub] = await tx.select().from(ticketStubs).where(eq(ticketStubs.code, code))
    if (!stub) throw new DomainError('not_found', "We couldn't find that ticket stub.")

    const walletId = principal?.walletId ?? (await tx.insert(wallets).values({}).returning())[0].id

    // Conditional update so a stub can only ever be claimed once, even under races.
    const claimed = await tx
      .update(ticketStubs)
      .set({ claimedAt: new Date(), walletId })
      .where(and(eq(ticketStubs.id, stub.id), isNull(ticketStubs.claimedAt)))
      .returning({ id: ticketStubs.id })
    if (claimed.length !== 1) {
      throw new DomainError('already_claimed', 'This ticket stub has already been claimed')
    }
    await credit(tx, walletId, stub.tickets, 'stub', stub.code)
    log('stub_claimed', { tickets: stub.tickets, guest: principal === null })
    return {
      walletId,
      accountId: principal?.accountId ?? null,
      credited: stub.tickets,
      balance: await balanceOf(tx, walletId),
    }
  })
}
