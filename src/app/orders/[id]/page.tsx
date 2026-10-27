import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import AutoRefresh from '@/components/AutoRefresh'
import StatusPill from '@/components/StatusPill'
import { getDb } from '@/lib/db'
import { formatTickets } from '@/lib/format'
import { getOrder } from '@/lib/orders'
import { getSession } from '@/lib/session'
import CancelButton from './CancelButton'

export const metadata = { title: 'Your order · Ticket2Prize' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect('/login')
  const order = UUID.test(id) ? await getOrder(getDb(), id) : undefined
  if (!order || order.walletId !== session.walletId) notFound()

  return (
    <section className="panel center">
      {/* Keep the page live while the customer walks to the counter. */}
      {order.status === 'pending' && <AutoRefresh seconds={10} />}
      <StatusPill status={order.status} />
      {order.status === 'pending' && (
        <>
          <p className="eyebrow">Show this at the prize counter</p>
          <p className="pickup-code" aria-label="Pickup code">
            {order.pickupCode}
          </p>
        </>
      )}
      {order.status === 'fulfilled' && <h1>Enjoy your prizes!</h1>}
      {order.status === 'cancelled' && <h1>Order cancelled, tickets refunded</h1>}
      <ul className="order-items">
        {order.items.map((item) => (
          <li key={item.prizeId}>
            {item.quantity} × {item.prize.name}
            <span>{formatTickets(item.unitCost * item.quantity)}</span>
          </li>
        ))}
        <li className="order-total">
          Total <span>{formatTickets(order.totalTickets)} tix</span>
        </li>
      </ul>
      <div className="actions">
        <Link className="btn" href="/">
          Keep shopping
        </Link>
        {order.status === 'pending' && <CancelButton orderId={order.id} />}
      </div>
    </section>
  )
}
