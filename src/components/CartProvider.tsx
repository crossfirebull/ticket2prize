'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { addToCart, setQuantity, type Cart } from '@/lib/cart'

const KEY = 't2p.cart'

type CartStore = {
  cart: Cart
  add: (prizeId: number) => void
  setQty: (prizeId: number, quantity: number) => void
  clear: () => void
}

const CartContext = createContext<CartStore | null>(null)

/** The cart lives in the browser until checkout; localStorage keeps it across reloads. */
export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart>({})

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring from storage after hydration
      if (saved) setCart(JSON.parse(saved))
    } catch {
      // Storage blocked (private mode); the cart just won't persist.
    }
  }, [])

  const update = useCallback((fn: (c: Cart) => Cart) => {
    setCart((current) => {
      const next = fn(current)
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }, [])

  const store = useMemo<CartStore>(
    () => ({
      cart,
      add: (id) => update((c) => addToCart(c, id)),
      setQty: (id, q) => update((c) => setQuantity(c, id, q)),
      clear: () => update(() => ({})),
    }),
    [cart, update],
  )
  return <CartContext.Provider value={store}>{children}</CartContext.Provider>
}

export function useCart(): CartStore {
  const store = useContext(CartContext)
  if (!store) throw new Error('useCart must be used inside <CartProvider>')
  return store
}
