import { eq } from 'drizzle-orm'
import type { Db, Executor } from './db'
import { DomainError } from './errors'
import { hashPassword, verifyPassword } from './passwords'
import { accounts, orders, wallets, type Account } from './schema'
import type { Principal } from './stubs'
import { balanceOf, credit, debit } from './wallets'

export type RegisterInput = { email: string; password: string; displayName: string }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(input: RegisterInput): RegisterInput {
  const email = input.email.trim().toLowerCase()
  const displayName = input.displayName.trim()
  if (!EMAIL.test(email) || email.length > 254) throw new DomainError('invalid_input', 'Enter a valid email address')
  if (input.password.length < 8 || input.password.length > 128) {
    throw new DomainError('invalid_input', 'Passwords need at least 8 characters')
  }
  if (!displayName || displayName.length > 80) throw new DomainError('invalid_input', 'Enter your name')
  return { email, displayName, password: input.password }
}

const isUniqueViolation = (e: unknown) =>
  (e as { code?: string })?.code === '23505' || (e as { cause?: { code?: string } })?.cause?.code === '23505'

/** A guest who signs up keeps their wallet, and so the tickets already in it. */
export async function register(db: Db, input: RegisterInput, guest: Principal | null): Promise<Account> {
  const { email, password, displayName } = validate(input)
  const passwordHash = await hashPassword(password)
  try {
    return await db.transaction(async (tx) => {
      const walletId =
        guest && !guest.accountId ? guest.walletId : (await tx.insert(wallets).values({}).returning())[0].id
      const [account] = await tx.insert(accounts).values({ email, displayName, passwordHash, walletId }).returning()
      return account
    })
  } catch (e) {
    if (isUniqueViolation(e)) throw new DomainError('email_taken', 'An account with that email already exists')
    throw e
  }
}

/** Returns the account, after moving any guest tickets and orders onto it. */
export async function login(db: Db, email: string, password: string, guest: Principal | null): Promise<Account | null> {
  const [account] = await db.select().from(accounts).where(eq(accounts.email, email.trim().toLowerCase()))
  // Hash anyway when the email is unknown, so response time doesn't reveal which emails exist.
  const ok = await verifyPassword(password, account?.passwordHash ?? (await hashPassword('timing-equaliser')))
  if (!account || !ok) return null
  if (guest && !guest.accountId && guest.walletId !== account.walletId) {
    await db.transaction((tx) => mergeWallet(tx, guest.walletId, account.walletId))
  }
  return account
}

async function mergeWallet(tx: Executor, from: string, into: string) {
  const amount = await balanceOf(tx, from)
  if (amount > 0) {
    await debit(tx, from, amount, 'merge', into)
    await credit(tx, into, amount, 'merge', from)
  }
  await tx.update(orders).set({ walletId: into }).where(eq(orders.walletId, from))
}

export async function createStaff(db: Db, email: string, password: string, displayName = 'Counter Staff') {
  const normalized = email.trim().toLowerCase()
  const passwordHash = await hashPassword(password)
  const [existing] = await db.select().from(accounts).where(eq(accounts.email, normalized))
  if (existing) {
    await db.update(accounts).set({ passwordHash, role: 'staff' }).where(eq(accounts.id, existing.id))
    return
  }
  await db.transaction(async (tx) => {
    const [wallet] = await tx.insert(wallets).values({}).returning()
    await tx.insert(accounts).values({ email: normalized, displayName, passwordHash, role: 'staff', walletId: wallet.id })
  })
}
