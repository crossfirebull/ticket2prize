import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Prize } from '../api'
import { mockApi, renderAt } from '../test-utils'
import StorePage from './StorePage'

const prizes: Prize[] = [
  { id: 1, sku: 'A', name: 'Tootsie Roll', description: 'Chewy', category: 'candy', ticket_cost: 5, stock: 200, image: 'a.jpg' },
  { id: 2, sku: 'B', name: 'Giant Plushie Bear', description: 'Huge', category: 'plush', ticket_cost: 2000, stock: 0, image: 'b.jpg' },
  { id: 3, sku: 'C', name: 'Nintendo Switch', description: 'Console', category: 'electronics', ticket_cost: 10000, stock: 3, image: 'c.jpg' },
]

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

it('shows the catalog with stock flags and filters by category', async () => {
  mockApi({ 'GET /api/prizes': prizes })
  renderAt('/', '/', <StorePage />)

  expect(await screen.findByText('Tootsie Roll')).toBeInTheDocument()
  expect(screen.getByText('Out of stock')).toBeInTheDocument()
  expect(screen.getByText('Only 3 left')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Add Giant Plushie Bear to cart' })).toBeDisabled()

  await userEvent.click(within(screen.getByRole('group', { name: 'Categories' })).getByText('Candy'))
  expect(screen.getByText('Tootsie Roll')).toBeInTheDocument()
  expect(screen.queryByText('Nintendo Switch')).not.toBeInTheDocument()
})

it('lets a signed-in customer hide what they cannot afford', async () => {
  localStorage.setItem('t2p.token', JSON.stringify('tok'))
  mockApi({ 'GET /api/prizes': prizes, 'GET /api/me': { balance: 100, account: null } })
  renderAt('/', '/', <StorePage />)

  await screen.findByText('Nintendo Switch')
  await userEvent.click(await screen.findByLabelText('Only what I can afford'))
  expect(screen.queryByText('Nintendo Switch')).not.toBeInTheDocument()
  expect(screen.getByText('Tootsie Roll')).toBeInTheDocument()
})
