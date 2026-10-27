import { eq } from 'drizzle-orm'
import { jwtVerify, SignJWT } from 'jose'
import { cookies } from 'next/headers'
import { getDb } from './db'
import { getEnv } from './env'
import { accounts, wallets, type Account } from './schema'
import type { Principal } from './stubs'

const COOKIE = 't2p_session'
const key = () => new TextEncoder().encode(getEnv().sessionSecret)

export type Session = Principal & { balance: number; account: Account | null }

/** Sign the visitor in as a wallet (guest) or an account. HTTP-only, so scripts can't read it. */
export async function startSession(walletId: string, accountId: string | null) {
  const env = getEnv()
  const token = await new SignJWT(accountId ? { acct: accountId } : {})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(walletId)
    .setIssuedAt()
    .setExpirationTime(`${env.sessionDays}d`)
    .sign(key())
  ;(await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.secureCookies,
    path: '/',
    maxAge: env.sessionDays * 24 * 60 * 60,
  })
}

export async function endSession() {
  ;(await cookies()).delete(COOKIE)
}

/** The current visitor, or null. A stale or tampered cookie counts as signed out. */
export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return null
  let walletId: string, accountId: string | null
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'] })
    walletId = payload.sub!
    accountId = typeof payload.acct === 'string' ? payload.acct : null
  } catch {
    return null
  }
  const db = getDb()
  const [wallet] = await db.select().from(wallets).where(eq(wallets.id, walletId))
  if (!wallet) return null
  let account: Account | null = null
  if (accountId) {
    ;[account = null] = await db.select().from(accounts).where(eq(accounts.id, accountId))
    if (!account || account.walletId !== walletId) return null
  }
  return { walletId, accountId, balance: wallet.balance, account }
}
