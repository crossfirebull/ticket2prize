'use client'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { claimAction } from '@/lib/actions'
import { formatTickets } from '@/lib/format'

type Props = { code: string; tickets: number; alreadyClaimed: boolean; accountName: string | null }
type Claimed = { credited: number; balance: number; guest: boolean }

export default function ClaimButton({ code, tickets, alreadyClaimed, accountName }: Props) {
  const [pending, startTransition] = useTransition()
  const [claimed, setClaimed] = useState<Claimed | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Shown after this visitor claims, even though the stub now reads as "claimed".
  if (claimed) {
    return (
      <>
        <p className="eyebrow">Tickets added</p>
        <h1 className="big-number">+{formatTickets(claimed.credited)}</h1>
        <p>
          You now have <strong>{formatTickets(claimed.balance)}</strong> tickets.
        </p>
        <div className="actions">
          <Link className="btn" href="/">
            Start shopping
          </Link>
          {claimed.guest && (
            <Link className="btn btn-ghost" href="/register">
              Save them for next time
            </Link>
          )}
        </div>
        {claimed.guest && (
          <p className="muted">Shopping as a guest. Create an account to keep your tickets between visits.</p>
        )}
      </>
    )
  }

  if (alreadyClaimed) {
    return (
      <>
        <h1>Already redeemed</h1>
        <p>The {formatTickets(tickets)} tickets on this stub have already been added to a wallet.</p>
        <Link className="btn" href="/">
          Browse prizes
        </Link>
      </>
    )
  }

  function claim() {
    setError(null)
    startTransition(async () => {
      const result = await claimAction(code)
      if (result.ok) setClaimed(result)
      else setError(result.error)
    })
  }

  return (
    <>
      <p className="eyebrow">Your ticket stub</p>
      <h1 className="big-number">{formatTickets(tickets)}</h1>
      <p>tickets ready to spend</p>
      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button className="btn" onClick={claim} disabled={pending}>
          {accountName ? `Add to ${accountName}'s account` : 'Add tickets & shop'}
        </button>
        {!accountName && (
          <Link className="btn btn-ghost" href={`/login?next=/claim/${code}`}>
            I have an account
          </Link>
        )}
      </div>
    </>
  )
}
