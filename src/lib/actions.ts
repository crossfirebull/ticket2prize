'use server'
/**
 * Server actions: the only code the browser can call. Each one checks the session itself
 * and keeps the domain functions in src/lib free of web concerns.
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { login, register } from './accounts'
import { setStock } from './catalog'
import { getDb } from './db'
import { DomainError } from './errors'
import { log } from './log'
import { cancelOwnOrder, checkout, fulfillOrder, staffCancelOrder, type CartLine } from './orders'
import { endSession, getSession, startSession } from './session'
import { claimStub } from './stubs'

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string }

async function run<T extends object>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, ...(await fn()) }
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message }
    log('action_failed', { error: String(e) }, 'error')
    return { ok: false, error: 'Something went wrong. Please try again.' }
  }
}

// Only same-site paths, so `?next=` can't send people elsewhere.
const safeNext = (next: unknown) => (typeof next === 'string' && /^\/(?!\/)/.test(next) ? next : '/')

export async function claimAction(code: string) {
  return run(async () => {
    const session = await getSession()
    const result = await claimStub(getDb(), code, session)
    await startSession(result.walletId, result.accountId)
    return { credited: result.credited, balance: result.balance, guest: result.accountId === null }
  })
}

export async function checkoutAction(lines: CartLine[]) {
  return run(async () => {
    const session = await getSession()
    if (!session) throw new DomainError('invalid_state', 'Scan your ticket stub or sign in to check out')
    const order = await checkout(getDb(), session.walletId, lines)
    revalidatePath('/', 'layout')
    return { orderId: order.id }
  })
}

export async function cancelOrderAction(orderId: string) {
  const session = await getSession()
  if (!session) redirect('/login')
  const result = await run(() => cancelOwnOrder(getDb(), orderId, session.walletId).then(() => ({})))
  revalidatePath('/', 'layout')
  return result
}

export async function loginAction(_prev: unknown, form: FormData): Promise<ActionResult> {
  const result = await run(async () => {
    const account = await login(getDb(), String(form.get('email')), String(form.get('password')), await getSession())
    if (!account) throw new DomainError('invalid_input', 'Incorrect email or password')
    await startSession(account.walletId, account.id)
    return {}
  })
  if (result.ok) redirect(safeNext(form.get('next')))
  return result
}

export async function registerAction(_prev: unknown, form: FormData): Promise<ActionResult> {
  const result = await run(async () => {
    const account = await register(
      getDb(),
      {
        email: String(form.get('email') ?? ''),
        password: String(form.get('password') ?? ''),
        displayName: String(form.get('display_name') ?? ''),
      },
      await getSession(),
    )
    await startSession(account.walletId, account.id)
    return {}
  })
  if (result.ok) redirect(safeNext(form.get('next')))
  return result
}

export async function signOutAction() {
  await endSession()
  redirect('/')
}

// --- Staff ----------------------------------------------------------------------

async function requireStaff() {
  const session = await getSession()
  if (session?.account?.role !== 'staff') throw new DomainError('invalid_state', 'Staff only')
  return session.account
}

export async function staffOrderAction(orderId: string, action: 'fulfill' | 'cancel') {
  const result = await run(async () => {
    const staff = await requireStaff()
    const order =
      action === 'fulfill' ? await fulfillOrder(getDb(), orderId, staff.id) : await staffCancelOrder(getDb(), orderId, staff.id)
    return { message: `Order ${order.pickupCode} ${action === 'fulfill' ? 'handed over' : 'refunded'}.` }
  })
  revalidatePath('/staff')
  return result
}

export async function restockAction(prizeId: number, stock: number) {
  const result = await run(async () => {
    await requireStaff()
    await setStock(getDb(), prizeId, stock)
    return {}
  })
  revalidatePath('/', 'layout')
  return result
}
