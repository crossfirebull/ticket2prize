import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, ApiError } from './api'
import type { Account, Me, Prize, Session } from './api'
import { addToCart, setQuantity } from './cart'
import type { Cart } from './cart'
import { load, save } from './storage'

type Store = {
  token: string | null
  balance: number
  account: Account | null
  /** True once we know whether the stored token is still valid. */
  ready: boolean
  prizes: Prize[]
  cart: Cart
  signIn: (session: Session) => void
  signOut: () => void
  refresh: () => Promise<void>
  add: (prizeId: number, quantity?: number) => void
  setQty: (prizeId: number, quantity: number) => void
  clearCart: () => void
  reloadPrizes: () => Promise<void>
}

const SessionContext = createContext<Store | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => load('t2p.token', null))
  const [me, setMe] = useState<Me>({ balance: 0, account: null })
  const [ready, setReady] = useState(token === null)
  const [prizes, setPrizes] = useState<Prize[]>([])
  const [cart, setCart] = useState<Cart>(() => load('t2p.cart', {}))

  useEffect(() => save('t2p.token', token), [token])
  useEffect(() => save('t2p.cart', cart), [cart])

  const signOut = useCallback(() => {
    setToken(null)
    setMe({ balance: 0, account: null })
    setCart({})
  }, [])

  const fetchMe = useCallback(
    () =>
      token
        ? api<Me>('/api/me', { token }).then(setMe, (e) => {
            if (e instanceof ApiError && e.status === 401) signOut()
          })
        : Promise.resolve(),
    [token, signOut],
  )

  const refresh = useCallback(() => fetchMe(), [fetchMe])

  const reloadPrizes = useCallback(
    () => api<Prize[]>('/api/prizes').then(setPrizes, () => setPrizes([])),
    [],
  )

  useEffect(() => {
    fetchMe().finally(() => setReady(true))
  }, [fetchMe])

  useEffect(() => {
    reloadPrizes()
  }, [reloadPrizes])

  const value = useMemo<Store>(
    () => ({
      token,
      balance: me.balance,
      account: me.account,
      ready,
      prizes,
      cart,
      signIn: (s) => {
        setToken(s.token)
        setMe({ balance: s.balance, account: s.account })
        setReady(true)
      },
      signOut,
      refresh,
      add: (id, q = 1) => setCart((c) => addToCart(c, id, q)),
      setQty: (id, q) => setCart((c) => setQuantity(c, id, q)),
      clearCart: () => setCart({}),
      reloadPrizes,
    }),
    [token, me, ready, prizes, cart, signOut, refresh, reloadPrizes],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSession(): Store {
  const store = useContext(SessionContext)
  if (!store) throw new Error('useSession must be used inside <SessionProvider>')
  return store
}
