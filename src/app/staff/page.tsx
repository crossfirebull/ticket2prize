import Link from 'next/link'
import AutoRefresh from '@/components/AutoRefresh'
import { lowStock } from '@/lib/catalog'
import { getDb } from '@/lib/db'
import { formatTickets } from '@/lib/format'
import { findByPickupCode, pickupQueue } from '@/lib/orders'
import { getSession } from '@/lib/session'
import { OrderActions, RestockButton } from './StaffControls'

export const metadata = { title: 'Prize counter · Ticket2Prize' }

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const session = await getSession()
  if (session?.account?.role !== 'staff') {
    return (
      <section className="panel narrow center">
        <h1>Prize counter</h1>
        <p>This screen is for counter staff.</p>
        <Link className="btn" href="/login?next=/staff">
          Staff sign in
        </Link>
      </section>
    )
  }

  const db = getDb()
  const code = (await searchParams).code?.trim().toUpperCase() ?? ''
  const [current, queue, low] = await Promise.all([
    code ? findByPickupCode(db, code) : undefined,
    pickupQueue(db),
    lowStock(db),
  ])

  return (
    <div className="staff">
      <AutoRefresh seconds={15} />
      <section className="panel">
        <h1>Prize counter</h1>
        {/* A plain GET form: the order lookup is just a URL, no JavaScript needed. */}
        <form className="lookup" action="/staff">
          <input
            name="code"
            defaultValue={code}
            placeholder="Pickup code"
            aria-label="Pickup code"
            maxLength={8}
            className="mono"
            autoComplete="off"
            autoFocus
          />
          <button className="btn">Find order</button>
        </form>
        {code && !current && <p className="error">No order with code {code}.</p>}
        {current && (
          <div className="order-card">
            <p>
              <span className="mono big">{current.pickupCode}</span> · {current.status}
            </p>
            <ul className="order-items">
              {current.items.map((i) => (
                <li key={i.prizeId}>
                  <img src={`/prizes/${i.prize.image}`} alt="" />
                  {i.quantity} × {i.prize.name}
                </li>
              ))}
            </ul>
            <OrderActions key={current.id} orderId={current.id} open={current.status === 'pending'} />
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Waiting for pickup ({queue.length})</h2>
        {queue.length === 0 ? (
          <p className="muted">Nobody waiting.</p>
        ) : (
          <ul className="queue">
            {queue.map((o) => (
              <li key={o.id}>
                <Link className="link" href={`/staff?code=${o.pickupCode}`}>
                  <span className="mono">{o.pickupCode}</span>
                  <span>{o.items.reduce((n, i) => n + i.quantity, 0)} items</span>
                  <span>{o.createdAt.toLocaleTimeString('en-US', { timeStyle: 'short' })}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>Low stock</h2>
        <ul className="queue">
          {low.map((p) => (
            <li key={p.id} className="restock">
              <span>{p.name}</span>
              <span className={p.stock === 0 ? 'error' : ''}>{p.stock} left</span>
              <span className="muted">{formatTickets(p.ticketCost)} tix</span>
              <RestockButton prizeId={p.id} stock={p.stock} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
