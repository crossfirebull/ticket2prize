import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PrizeCard from '../components/PrizeCard'
import { cartTotal } from '../cart'
import { useSession } from '../session'

const CATEGORY_LABELS: Record<string, string> = {
  candy: 'Candy',
  electronics: 'Electronics',
  fidgets: 'Fidgets & slime',
  games: 'Games',
  glow: 'Glow',
  outdoor: 'Outdoor',
  plush: 'Plush',
  sports: 'Sports',
  toys: 'Toys',
}

export default function StorePage() {
  const { token, balance, prizes, cart, add } = useSession()
  const [category, setCategory] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [affordableOnly, setAffordableOnly] = useState(false)

  const categories = useMemo(() => [...new Set(prizes.map((p) => p.category))].sort(), [prizes])
  const left = balance - cartTotal(cart, prizes)

  const shown = prizes.filter((p) => {
    if (category && p.category !== category) return false
    if (affordableOnly && p.ticket_cost > left) return false
    const q = query.trim().toLowerCase()
    return !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
  })

  return (
    <>
      {!token && (
        <section className="hero">
          <h1>Trade your tickets for prizes, skip the line.</h1>
          <p>
            Scan the QR code on your ticket stub to load your tickets, pick your prizes here, then
            grab them at the counter with your pickup code.
          </p>
          <p className="hero-hint">
            No stub handy? Print one at the <Link to="/kiosk">demo kiosk</Link>.
          </p>
        </section>
      )}

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search prizes"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search prizes"
        />
        {token && (
          <label className="toggle">
            <input type="checkbox" checked={affordableOnly} onChange={(e) => setAffordableOnly(e.target.checked)} />
            Only what I can afford
          </label>
        )}
      </div>
      <div className="chips" role="group" aria-label="Categories">
        <button className={`chip${category === null ? ' active' : ''}`} onClick={() => setCategory(null)}>
          All
        </button>
        {categories.map((c) => (
          <button key={c} className={`chip${category === c ? ' active' : ''}`} onClick={() => setCategory(c)}>
            {CATEGORY_LABELS[c] ?? c}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="empty">{prizes.length === 0 ? 'Loading prizes…' : 'No prizes match.'}</p>
      ) : (
        <div className="grid">
          {shown.map((p) => (
            <PrizeCard
              key={p.id}
              prize={p}
              inCart={cart[p.id] ?? 0}
              affordable={!token || p.ticket_cost <= left}
              onAdd={() => add(p.id)}
            />
          ))}
        </div>
      )}
    </>
  )
}
