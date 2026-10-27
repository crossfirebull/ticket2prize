import type { Prize } from '@/lib/schema'
import { formatTickets } from '@/lib/format'

type Props = { prize: Prize; inCart: number; affordable: boolean; onAdd: () => void }

export default function PrizeCard({ prize, inCart, affordable, onAdd }: Props) {
  const soldOut = prize.stock === 0
  return (
    <article className={`prize-card${soldOut ? ' sold-out' : ''}`}>
      <div className="prize-image">
        <img src={`/prizes/${prize.image}`} alt="" loading="lazy" />
        {soldOut && <span className="stock-flag">Out of stock</span>}
        {!soldOut && prize.stock <= 5 && <span className="stock-flag low">Only {prize.stock} left</span>}
        {inCart > 0 && <span className="in-cart">{inCart} in cart</span>}
      </div>
      <div className="prize-body">
        <h3>{prize.name}</h3>
        <p className="prize-desc">{prize.description}</p>
        <div className="prize-foot">
          <span className={`cost${affordable ? '' : ' cost-short'}`}>{formatTickets(prize.ticketCost)} tix</span>
          <button
            className="btn btn-small"
            onClick={onAdd}
            disabled={prize.stock - inCart <= 0}
            aria-label={`Add ${prize.name} to cart`}
          >
            Add
          </button>
        </div>
      </div>
    </article>
  )
}
