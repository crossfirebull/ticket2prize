import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError, formatTickets } from '../api'
import type { ClaimResult, StubPreview } from '../api'
import { useSession } from '../session'

export default function ClaimPage() {
  const { code = '' } = useParams()
  const { token, account, signIn } = useSession()
  const [stub, setStub] = useState<StubPreview | null>(null)
  const [result, setResult] = useState<ClaimResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api<StubPreview>(`/api/stubs/${encodeURIComponent(code)}`)
      .then(setStub)
      .catch((e) => setError(e instanceof ApiError && e.status === 404 ? "We couldn't find that ticket stub." : e.message))
  }, [code])

  async function claim() {
    setBusy(true)
    setError(null)
    try {
      const res = await api<ClaimResult>(`/api/stubs/${encodeURIComponent(code)}/claim`, { method: 'POST', token })
      signIn(res)
      setResult(res)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    return (
      <section className="panel center">
        <p className="eyebrow">Tickets added</p>
        <h1 className="big-number">+{formatTickets(result.credited)}</h1>
        <p>
          You now have <strong>{formatTickets(result.balance)}</strong> tickets.
        </p>
        <div className="actions">
          <Link className="btn" to="/">
            Start shopping
          </Link>
          {!result.account && (
            <Link className="btn btn-ghost" to="/register">
              Save them for next time
            </Link>
          )}
        </div>
        {!result.account && (
          <p className="muted">Shopping as a guest. Create an account to keep your tickets between visits.</p>
        )}
      </section>
    )
  }

  return (
    <section className="panel center">
      {error && <p className="error">{error}</p>}
      {!stub && !error && <p>Checking your ticket stub…</p>}
      {stub && stub.claimed && (
        <>
          <h1>Already redeemed</h1>
          <p>The {formatTickets(stub.tickets)} tickets on this stub have already been added to a wallet.</p>
          <Link className="btn" to="/">
            Browse prizes
          </Link>
        </>
      )}
      {stub && !stub.claimed && (
        <>
          <p className="eyebrow">Your ticket stub</p>
          <h1 className="big-number">{formatTickets(stub.tickets)}</h1>
          <p>tickets ready to spend</p>
          <div className="actions">
            <button className="btn" onClick={claim} disabled={busy}>
              {account ? `Add to ${account.display_name}'s account` : 'Add tickets & shop'}
            </button>
            {!account && (
              <Link className="btn btn-ghost" to={`/login?next=/claim/${code}`}>
                I have an account
              </Link>
            )}
          </div>
        </>
      )}
    </section>
  )
}
