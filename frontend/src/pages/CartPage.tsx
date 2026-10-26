import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, formatTickets, prizeImage } from '../api'
import type { Order } from '../api'
import { cartLines, cartTotal } from '../cart'
import { useSession } from '../session'

export default function CartPage() {
  const { token, balance, prizes, cart, setQty, clearCart, refresh, reloadPrizes } = useSession()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const lines = cartLines(cart, prizes)
  const total = cartTotal(cart, prizes)
  const short = total - balance

  async function checkout() {
    setBusy(true)
    setError(null)
    try {
      const order = await api<Order>('/api/orders', {
        token,
        body: { items: lines.map((l) => ({ prize_id: l.prize.id, quantity: l.quantity })) },
      })
      clearCart()
      await Promise.all([refresh(), reloadPrizes()])
      navigate(`/orders/${order.id}`)
    } catch (e) {
      setError((e as Error).message)
      void reloadPrizes()
    } finally {
      setBusy(false)
    }
  }

  if (lines.length === 0) {
    return (
      <section className="panel center">
        <h1>Your cart is empty</h1>
        <Link className="btn" to="/">
          Browse prizes
        </Link>
      </section>
    )
  }

  return (
    <section className="panel">
      <h1>Your cart</h1>
      <ul className="cart-lines">
        {lines.map(({ prize, quantity }) => (
          <li key={prize.id}>
            <img src={prizeImage(prize)} alt="" />
            <div className="cart-name">
              <strong>{prize.name}</strong>
              <span className="muted">{formatTickets(prize.ticket_cost)} tix each</span>
            </div>
            <div className="stepper">
              <button onClick={() => setQty(prize.id, quantity - 1)} aria-label={`Remove one ${prize.name}`}>
                −
              </button>
              <span>{quantity}</span>
              <button
                onClick={() => setQty(prize.id, quantity + 1)}
                disabled={quantity >= prize.stock}
                aria-label={`Add one ${prize.name}`}
              >
                +
              </button>
            </div>
            <span className="cart-sub">{formatTickets(prize.ticket_cost * quantity)}</span>
          </li>
        ))}
      </ul>
      <dl className="totals">
        <dt>Total</dt>
        <dd>{formatTickets(total)} tix</dd>
        {token && (
          <>
            <dt>Your balance</dt>
            <dd>{formatTickets(balance)} tix</dd>
            <dt>{short > 0 ? 'Still needed' : 'Left after checkout'}</dt>
            <dd className={short > 0 ? 'error' : ''}>{formatTickets(Math.abs(short))} tix</dd>
          </>
        )}
      </dl>
      {error && <p className="error">{error}</p>}
      {token ? (
        <button className="btn btn-wide" onClick={checkout} disabled={busy || short > 0}>
          {short > 0 ? 'Not enough tickets' : 'Check out'}
        </button>
      ) : (
        <p className="muted">Scan the QR code on your ticket stub, or sign in, to check out.</p>
      )}
    </section>
  )
}
