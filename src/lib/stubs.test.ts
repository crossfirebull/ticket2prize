import { describe, expect, it } from 'vitest'
import { setupTestDb } from '../test/db'
import { claimStub, issueStub, previewStub } from './stubs'
import { balanceOf } from './wallets'

const t = setupTestDb()

describe('ticket stubs', () => {
  it('issues unguessable one-time codes', async () => {
    const a = await issueStub(t.db, 350)
    const b = await issueStub(t.db, 350)
    expect(a.code).toMatch(/^[\w-]{16}$/)
    expect(a.code).not.toBe(b.code)
    expect(await previewStub(t.db, a.code)).toEqual({ tickets: 350, claimed: false })
  })

  it('rejects silly ticket counts', async () => {
    for (const n of [0, -5, 1.5, 2_000_000]) {
      await expect(issueStub(t.db, n)).rejects.toMatchObject({ code: 'invalid_input' })
    }
  })

  it('a guest claim creates a wallet', async () => {
    const stub = await issueStub(t.db, 120)
    const result = await claimStub(t.db, stub.code, null)
    expect(result).toMatchObject({ credited: 120, balance: 120, accountId: null })
    expect(await previewStub(t.db, stub.code)).toEqual({ tickets: 120, claimed: true })
  })

  it('a stub can only be claimed once', async () => {
    const stub = await issueStub(t.db, 50)
    await claimStub(t.db, stub.code, null)
    await expect(claimStub(t.db, stub.code, null)).rejects.toMatchObject({ code: 'already_claimed' })
  })

  it('claims accumulate on an account', async () => {
    const sam = await t.customer()
    for (const n of [100, 250]) await claimStub(t.db, (await issueStub(t.db, n)).code, sam)
    expect(await balanceOf(t.db, sam.walletId)).toBe(350)
  })

  it('unknown stubs', async () => {
    expect(await previewStub(t.db, 'nope')).toBeNull()
    await expect(claimStub(t.db, 'nope', null)).rejects.toMatchObject({ code: 'not_found' })
  })
})
