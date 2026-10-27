import { describe, expect, it } from 'vitest'
import { setupTestDb } from '../test/db'
import { login, register } from './accounts'
import { checkout, listOrders } from './orders'
import { balanceOf } from './wallets'

const t = setupTestDb()
const sam = { email: 'sam@example.com', password: 'correct-horse', displayName: 'Sam' }

describe('accounts', () => {
  it('registers and logs in, case-insensitively', async () => {
    const account = await register(t.db, sam, null)
    expect(account.role).toBe('customer')
    expect((await login(t.db, 'SAM@example.com', 'correct-horse', null))?.id).toBe(account.id)
  })

  it('stores a salted hash, not the password', async () => {
    const account = await register(t.db, sam, null)
    expect(account.passwordHash).toMatch(/^scrypt\$/)
    expect(account.passwordHash).not.toContain('correct-horse')
  })

  it('rejects duplicates, bad input and wrong passwords', async () => {
    await register(t.db, sam, null)
    await expect(register(t.db, { ...sam, password: 'another-pass' }, null)).rejects.toMatchObject({ code: 'email_taken' })
    await expect(register(t.db, { ...sam, email: 'a@b.co', password: 'short' }, null)).rejects.toMatchObject({ code: 'invalid_input' })
    await expect(register(t.db, { ...sam, email: 'not-an-email' }, null)).rejects.toMatchObject({ code: 'invalid_input' })
    expect(await login(t.db, 'sam@example.com', 'nope', null)).toBeNull()
    expect(await login(t.db, 'nobody@example.com', 'nope', null)).toBeNull()
  })

  it('a guest who registers keeps their tickets', async () => {
    const guest = await t.guestWith(400)
    const account = await register(t.db, sam, guest)
    expect(account.walletId).toBe(guest.walletId)
    expect(await balanceOf(t.db, account.walletId)).toBe(400)
  })

  it('a guest who logs in brings their tickets and orders along', async () => {
    const account = await register(t.db, sam, null)
    const guest = await t.guestWith(300)
    const candy = await t.prize('Tootsie Roll')
    const order = await checkout(t.db, guest.walletId, [{ prizeId: candy.id, quantity: 2 }])

    await login(t.db, 'sam@example.com', 'correct-horse', guest)
    expect(await balanceOf(t.db, account.walletId)).toBe(290)
    expect(await balanceOf(t.db, guest.walletId)).toBe(0)
    expect((await listOrders(t.db, account.walletId)).map((o) => o.id)).toEqual([order.id])
  })
})
