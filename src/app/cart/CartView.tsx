'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useCart } from '@/components/CartProvider'
import { checkoutAction } from '@/lib/actions'
import { cartLines, cartTotal } from '@/lib/cart'
import { formatTickets } from '@/lib/format'
import type { Prize } from '@/lib/schema'

export default function CartView({ prizes, balance }: { prizes: Prize[]; balance: number | null }) {
  const { cart, setQty, clear } = useCart()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const lines = cartLines(cart, prizes)
  const total = cartTotal(cart, prizes)
  const short = total - (balance ?? 0)

  function checkout() {
    setError(null)
    startTransition(async () => {
      const result = await checkoutAction(lines.map((l) => ({ prizeId: l.prize.id, quantity: l.quantity })))
      if (result.ok) {
        clear()
        router.push(`/orders/${result.orderId}`)
      } else {
        setError(result.error)
        router.refresh() // pick up current stock
      }
    })
  }

  if (lines.length === 0) {
    return (
      <section className="panel center">
        <h1>Your cart is empty</h1>
        <Link className="btn" href="/">
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
            <img src={`/prizes/${prize.image}`} alt="" />
            <div className="cart-name">
              <strong>{prize.name}</strong>
              <span className="muted">{formatTickets(prize.ticketCost)} tix each</span>
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
            <span className="cart-sub">{formatTickets(prize.ticketCost * quantity)}</span>
          </li>
        ))}
      </ul>
      <dl className="totals">
        <dt>Total</dt>
        <dd>{formatTickets(total)} tix</dd>
        {balance !== null && (
          <>
            <dt>Your balance</dt>
            <dd>{formatTickets(balance)} tix</dd>
            <dt>{short > 0 ? 'Still needed' : 'Left after checkout'}</dt>
            <dd className={short > 0 ? 'error' : ''}>{formatTickets(Math.abs(short))} tix</dd>
          </>
        )}
      </dl>
      {error && <p className="error">{error}</p>}
      {balance !== null ? (
        <button className="btn btn-wide" onClick={checkout} disabled={pending || short > 0}>
          {short > 0 ? 'Not enough tickets' : pending ? 'Checking out…' : 'Check out'}
        </button>
      ) : (
        <p className="muted">
          Scan the QR code on your ticket stub, or <Link href="/login?next=/cart">sign in</Link>, to check out.
        </p>
      )}
    </section>
  )
}
