import Link from 'next/link'
import { redirect } from 'next/navigation'
import StatusPill from '@/components/StatusPill'
import { signOutAction } from '@/lib/actions'
import { getDb } from '@/lib/db'
import { formatTickets } from '@/lib/format'
import { listOrders } from '@/lib/orders'
import { getSession } from '@/lib/session'

export const metadata = { title: 'Your account · Ticket2Prize' }

export default async function AccountPage() {
  const session = await getSession()
  if (!session?.account) redirect('/login?next=/account')
  const orders = await listOrders(getDb(), session.walletId)

  return (
    <section className="panel">
      <h1>Hi, {session.account.displayName}</h1>
      <p>
        You have <strong>{formatTickets(session.balance)}</strong> tickets saved.
      </p>
      {session.account.role === 'staff' && (
        <p>
          <Link href="/staff">Open the prize counter →</Link>
        </p>
      )}
      <h2>Your orders</h2>
      {orders.length === 0 ? (
        <p className="muted">No orders yet.</p>
      ) : (
        <ul className="order-list">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/orders/${o.id}`}>
                <span className="mono">{o.pickupCode}</span>
                <span>{o.items.reduce((n, i) => n + i.quantity, 0)} items</span>
                <span>{formatTickets(o.totalTickets)} tix</span>
                <StatusPill status={o.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <form action={signOutAction}>
        <button className="btn btn-ghost">Sign out</button>
      </form>
    </section>
  )
}
