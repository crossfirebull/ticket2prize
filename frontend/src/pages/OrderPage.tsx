import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, formatTickets } from '../api'
import type { Order } from '../api'
import StatusPill from '../components/StatusPill'
import { useSession } from '../session'

export default function OrderPage() {
  const { id = '' } = useParams()
  const { token, refresh, reloadPrizes } = useSession()
  const [order, setOrder] = useState<Order | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    () =>
      api<Order>(`/api/orders/${id}`, { token })
        .then(setOrder)
        .catch((e) => setError(e.message)),
    [id, token],
  )

  useEffect(() => {
    void load()
    // Keep the page live while the customer walks to the counter.
    const timer = setInterval(load, 10_000)
    return () => clearInterval(timer)
  }, [load])

  async function cancel() {
    try {
      setOrder(await api<Order>(`/api/orders/${id}/cancel`, { method: 'POST', token }))
      await Promise.all([refresh(), reloadPrizes()])
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (error) return <p className="error panel">{error}</p>
  if (!order) return <p className="panel">Loading order…</p>

  return (
    <section className="panel center">
      <StatusPill status={order.status} />
      {order.status === 'pending' && (
        <>
          <p className="eyebrow">Show this at the prize counter</p>
          <p className="pickup-code" aria-label="Pickup code">
            {order.pickup_code}
          </p>
        </>
      )}
      {order.status === 'fulfilled' && <h1>Enjoy your prizes!</h1>}
      {order.status === 'cancelled' && <h1>Order cancelled, tickets refunded</h1>}
      <ul className="order-items">
        {order.items.map((item) => (
          <li key={item.prize_id}>
            {item.quantity} × {item.prize.name}
            <span>{formatTickets(item.unit_cost * item.quantity)}</span>
          </li>
        ))}
        <li className="order-total">
          Total <span>{formatTickets(order.total_tickets)} tix</span>
        </li>
      </ul>
      <div className="actions">
        <Link className="btn" to="/">
          Keep shopping
        </Link>
        {order.status === 'pending' && (
          <button className="btn btn-ghost" onClick={cancel}>
            Cancel & refund
          </button>
        )}
      </div>
    </section>
  )
}
