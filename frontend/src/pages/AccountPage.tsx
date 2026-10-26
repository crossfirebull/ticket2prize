import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api, formatTickets } from '../api'
import type { Order } from '../api'
import StatusPill from '../components/StatusPill'
import { useSession } from '../session'

export default function AccountPage() {
  const { token, ready, account, balance, signOut } = useSession()
  const [orders, setOrders] = useState<Order[]>([])

  useEffect(() => {
    if (token) api<Order[]>('/api/orders', { token }).then(setOrders).catch(() => setOrders([]))
  }, [token])

  if (ready && !account) return <Navigate to="/login" replace />

  return (
    <section className="panel">
      <h1>Hi, {account?.display_name}</h1>
      <p>
        You have <strong>{formatTickets(balance)}</strong> tickets saved.
      </p>
      {account?.role === 'staff' && (
        <p>
          <Link to="/staff">Open the prize counter →</Link>
        </p>
      )}
      <h2>Your orders</h2>
      {orders.length === 0 ? (
        <p className="muted">No orders yet.</p>
      ) : (
        <ul className="order-list">
          {orders.map((o) => (
            <li key={o.id}>
              <Link to={`/orders/${o.id}`}>
                <span className="mono">{o.pickup_code}</span>
                <span>{o.items.reduce((n, i) => n + i.quantity, 0)} items</span>
                <span>{formatTickets(o.total_tickets)} tix</span>
                <StatusPill status={o.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <button className="btn btn-ghost" onClick={signOut}>
        Sign out
      </button>
    </section>
  )
}
