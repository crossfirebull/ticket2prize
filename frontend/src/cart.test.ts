import { addToCart, cartCount, cartLines, cartTotal, setQuantity } from './cart'
import type { Prize } from './api'

const prize = (id: number, ticket_cost: number): Prize => ({
  id,
  ticket_cost,
  sku: `T2P-${id}`,
  name: `Prize ${id}`,
  description: '',
  category: 'toys',
  stock: 10,
  image: '',
})

describe('cart', () => {
  it('adds, merges and removes lines', () => {
    let cart = addToCart({}, 1)
    cart = addToCart(cart, 1, 2)
    cart = addToCart(cart, 2)
    expect(cart).toEqual({ 1: 3, 2: 1 })
    expect(cartCount(cart)).toBe(4)
    expect(setQuantity(cart, 1, 0)).toEqual({ 2: 1 })
  })

  it('totals against the catalog and ignores prizes that no longer exist', () => {
    const prizes = [prize(1, 25), prize(2, 100)]
    const cart = { 1: 2, 2: 1, 99: 5 }
    expect(cartTotal(cart, prizes)).toBe(150)
    expect(cartLines(cart, prizes).map((l) => l.prize.id)).toEqual([1, 2])
  })
})
