import type { Prize } from './api'

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

export function cartTotal(cart: Cart, prizes: Prize[]): number {
  return cartLines(cart, prizes).reduce((sum, l) => sum + l.prize.ticket_cost * l.quantity, 0)
}

export function cartCount(cart: Cart): number {
  return Object.values(cart).reduce((sum, q) => sum + q, 0)
}
