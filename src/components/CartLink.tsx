'use client'
import Link from 'next/link'
import { cartCount } from '@/lib/cart'
import { useCart } from './CartProvider'

export default function CartLink() {
  const items = cartCount(useCart().cart)
  return (
    <Link href="/cart" className="nav-link">
      Cart{items > 0 && <span className="badge">{items}</span>}
    </Link>
  )
}
