import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderAt } from '../test-utils'
import ClaimPage from './ClaimPage'

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

it('claims a stub as a guest and stores the session', async () => {
  const fetchMock = mockApi({
    'GET /api/prizes': [],
    'GET /api/stubs/abc': { tickets: 350, claimed: false },
    'POST /api/stubs/abc/claim': { token: 'guest-token', balance: 350, account: null, credited: 350 },
  })
  renderAt('/claim/abc', '/claim/:code', <ClaimPage />)

  expect(await screen.findByText('350')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Add tickets & shop' }))

  expect(await screen.findByText('+350')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Save them for next time' })).toBeInTheDocument()
  expect(JSON.parse(localStorage.getItem('t2p.token')!)).toBe('guest-token')
  expect(fetchMock).toHaveBeenCalledWith('/api/stubs/abc/claim', expect.objectContaining({ method: 'POST' }))
})

it('explains when a stub was already used', async () => {
  mockApi({ 'GET /api/prizes': [], 'GET /api/stubs/used': { tickets: 50, claimed: true } })
  renderAt('/claim/used', '/claim/:code', <ClaimPage />)
  expect(await screen.findByText('Already redeemed')).toBeInTheDocument()
})

it('handles unknown stubs', async () => {
  mockApi({ 'GET /api/prizes': [] })
  renderAt('/claim/nope', '/claim/:code', <ClaimPage />)
  expect(await screen.findByText("We couldn't find that ticket stub.")).toBeInTheDocument()
})
