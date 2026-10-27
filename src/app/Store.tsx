'use client'
import { useMemo, useState } from 'react'
import { useCart } from '@/components/CartProvider'
import PrizeCard from '@/components/PrizeCard'
import { cartTotal } from '@/lib/cart'
import { CATEGORY_LABELS } from '@/lib/format'
import type { Prize } from '@/lib/schema'

/** Filtering happens in the browser: the whole catalog is small and already on the page. */
export default function Store({ prizes, balance }: { prizes: Prize[]; balance: number | null }) {
  const { cart, add } = useCart()
  const [category, setCategory] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [affordableOnly, setAffordableOnly] = useState(false)

  const categories = useMemo(() => [...new Set(prizes.map((p) => p.category))].sort(), [prizes])
  const left = (balance ?? 0) - cartTotal(cart, prizes)
  const q = query.trim().toLowerCase()
  const shown = prizes.filter(
    (p) =>
      (!category || p.category === category) &&
      (!affordableOnly || p.ticketCost <= left) &&
      (!q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)),
  )

  return (
    <>
      <div className="toolbar">
        <input
          type="search"
          placeholder="Search prizes"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search prizes"
        />
        {balance !== null && (
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
        <p className="empty">No prizes match.</p>
      ) : (
        <div className="grid">
          {shown.map((p) => (
            <PrizeCard
              key={p.id}
              prize={p}
              inCart={cart[p.id] ?? 0}
              affordable={balance === null || p.ticketCost <= left}
              onAdd={() => add(p.id)}
            />
          ))}
        </div>
      )}
    </>
  )
}
