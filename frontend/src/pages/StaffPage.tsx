import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, formatTickets, prizeImage } from '../api'
import type { Order, Prize } from '../api'
import { useSession } from '../session'

export default function StaffPage() {
  const { token, account, reloadPrizes } = useSession()
  const [queue, setQueue] = useState<Order[]>([])
  const [lowStock, setLowStock] = useState<Prize[]>([])
  const [current, setCurrent] = useState<Order | null>(null)
  const [code, setCode] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const isStaff = account?.role === 'staff'

  const refreshLists = useCallback(
    () =>
      isStaff
        ? Promise.all([
            api<Order[]>('/api/staff/orders', { token }),
            api<Prize[]>('/api/staff/prizes/low-stock', { token }),
          ]).then(([q, low]) => {
            setQueue(q)
            setLowStock(low)
          })
        : Promise.resolve(),
    [isStaff, token],
  )

  useEffect(() => {
    refreshLists()
    const timer = setInterval(refreshLists, 15_000)
    return () => clearInterval(timer)
  }, [refreshLists])

  if (!isStaff) {
    return (
      <section className="panel narrow center">
        <h1>Prize counter</h1>
        <p>This screen is for counter staff.</p>
        <Link className="btn" to="/login?next=/staff">
          Staff sign in
        </Link>
      </section>
    )
  }

  async function lookup(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    try {
      setCurrent(await api<Order>(`/api/staff/orders/by-code/${encodeURIComponent(code.trim())}`, { token }))
    } catch (err) {
      setCurrent(null)
      setMessage((err as Error).message)
    }
  }

  async function act(order: Order, action: 'fulfill' | 'cancel') {
    try {
      const updated = await api<Order>(`/api/staff/orders/${order.id}/${action}`, { method: 'POST', token })
      setCurrent(updated)
      setMessage(action === 'fulfill' ? `Order ${updated.pickup_code} handed over.` : `Order ${updated.pickup_code} refunded.`)
      setCode('')
      await refreshLists()
      if (action === 'cancel') await reloadPrizes()
    } catch (err) {
      setMessage((err as Error).message)
    }
  }

  async function restock(prize: Prize, stock: number) {
    await api<Prize>(`/api/staff/prizes/${prize.id}/stock`, { method: 'PUT', body: { stock }, token })
    await Promise.all([refreshLists(), reloadPrizes()])
  }

  return (
    <div className="staff">
      <section className="panel">
        <h1>Prize counter</h1>
        <form onSubmit={lookup} className="lookup">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Pickup code"
            aria-label="Pickup code"
            maxLength={8}
            className="mono"
            autoFocus
          />
          <button className="btn">Find order</button>
        </form>
        {message && <p className="notice">{message}</p>}
        {current && (
          <div className="order-card">
            <p>
              <span className="mono big">{current.pickup_code}</span> · {current.status}
            </p>
            <ul className="order-items">
              {current.items.map((i) => (
                <li key={i.prize_id}>
                  <img src={prizeImage(i.prize)} alt="" />
                  {i.quantity} × {i.prize.name}
                </li>
              ))}
            </ul>
            {current.status === 'pending' && (
              <div className="actions">
                <button className="btn" onClick={() => act(current, 'fulfill')}>
                  Hand over prizes
                </button>
                <button className="btn btn-ghost" onClick={() => act(current, 'cancel')}>
                  Cancel & refund
                </button>
              </div>
            )}
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
                <button className="link" onClick={() => setCurrent(o)}>
                  <span className="mono">{o.pickup_code}</span>
                  <span>{o.items.reduce((n, i) => n + i.quantity, 0)} items</span>
                  <span>{new Date(o.created_at).toLocaleTimeString()}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>Low stock</h2>
        <ul className="queue">
          {lowStock.map((p) => (
            <li key={p.id} className="restock">
              <span>{p.name}</span>
              <span className={p.stock === 0 ? 'error' : ''}>{p.stock} left</span>
              <span className="muted">{formatTickets(p.ticket_cost)} tix</span>
              <button className="btn btn-small" onClick={() => restock(p, p.stock + 10)}>
                +10
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
