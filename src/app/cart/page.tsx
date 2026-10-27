import { listPrizes } from '@/lib/catalog'
import { getDb } from '@/lib/db'
import { getSession } from '@/lib/session'
import CartView from './CartView'

export const metadata = { title: 'Cart · Ticket2Prize' }

export default async function CartPage() {
  const [prizes, session] = await Promise.all([listPrizes(getDb()), getSession()])
  return <CartView prizes={prizes} balance={session?.balance ?? null} />
}
