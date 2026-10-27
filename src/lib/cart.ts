import type { Prize } from './schema'

/** prize id -> quantity */
export type Cart = Record<number, number>

export function addToCart(cart: Cart, prizeId: number, quantity = 1): Cart {
  return setQuantity(cart, prizeId, (cart[prizeId] ?? 0) + quantity)
}

export function setQuantity(cart: Cart, prizeId: number, quantity: number): Cart {
  const next = { ...cart }
  if (quantity <= 0) delete next[prizeId]
  else next[prizeId] = quantity
  return next
}

export function cartLines(cart: Cart, prizes: Prize[]) {
  const byId = new Map(prizes.map((p) => [p.id, p]))
  return Object.entries(cart)
    .map(([id, quantity]) => ({ prize: byId.get(Number(id)), quantity }))
    .filter((line): line is { prize: Prize; quantity: number } => line.prize !== undefined)
}

export const cartTotal = (cart: Cart, prizes: Prize[]) =>
  cartLines(cart, prizes).reduce((sum, l) => sum + l.prize.ticketCost * l.quantity, 0)

export const cartCount = (cart: Cart) => Object.values(cart).reduce((sum, q) => sum + q, 0)
