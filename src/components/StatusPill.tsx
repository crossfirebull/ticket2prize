import type { OrderStatus } from '@/lib/schema'

const LABELS: Record<OrderStatus, string> = {
  pending: 'Ready for pickup',
  fulfilled: 'Picked up',
  cancelled: 'Cancelled',
}

export default function StatusPill({ status }: { status: OrderStatus }) {
  return <span className={`status status-${status}`}>{LABELS[status]}</span>
}
