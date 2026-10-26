import { useState } from 'react'
import type { FormEvent } from 'react'
import { api, formatTickets } from '../api'
import type { IssuedStub } from '../api'

const PRESETS = [50, 250, 1000, 5000]

/** Stand-in for the ticket-counting machine, which would call the same endpoint. */
export default function KioskPage() {
  const [kioskKey, setKioskKey] = useState(import.meta.env.DEV ? 'dev-kiosk-key' : '')
  const [tickets, setTickets] = useState(250)
  const [stub, setStub] = useState<IssuedStub | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function issue(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      setStub(
        await api<IssuedStub>('/api/kiosk/stubs', {
          body: { tickets, kiosk_id: 'web-demo' },
          headers: { 'X-Kiosk-Key': kioskKey },
        }),
      )
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="kiosk">
      <section className="panel">
        <p className="eyebrow">Demo kiosk</p>
        <h1>Count my tickets</h1>
        <p className="muted">
          In the arcade, a ticket counting machine prints this stub. Here you can print one by hand
          to try the customer flow.
        </p>
        <form onSubmit={issue} className="form">
          <label>
            Tickets counted
            <input
              type="number"
              min={1}
              max={1000000}
              value={tickets}
              onChange={(e) => setTickets(Number(e.target.value))}
              required
            />
          </label>
          <div className="chips">
            {PRESETS.map((n) => (
              <button type="button" key={n} className={`chip${tickets === n ? ' active' : ''}`} onClick={() => setTickets(n)}>
                {formatTickets(n)}
              </button>
            ))}
          </div>
          <label>
            Kiosk key
            <input value={kioskKey} onChange={(e) => setKioskKey(e.target.value)} required />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn btn-wide">Print stub</button>
        </form>
      </section>

      {stub && (
        <section className="stub" aria-label="Ticket stub">
          <p className="stub-title">TICKET2PRIZE</p>
          <p className="stub-count">{formatTickets(stub.tickets)}</p>
          <p>TICKETS</p>
          <img src={stub.qr_url} alt="QR code to claim these tickets" width={180} height={180} />
          <p className="stub-small">Scan to shop for prizes</p>
          <a href={stub.claim_url} className="stub-link">
            {stub.claim_url}
          </a>
        </section>
      )}
    </div>
  )
}
