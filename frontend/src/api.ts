export type Prize = {
  id: number
  sku: string
  name: string
  description: string
  category: string
  ticket_cost: number
  stock: number
  image: string
}

export type Account = {
  id: string
  email: string
  display_name: string
  role: 'customer' | 'staff'
}

export type Session = { token: string; balance: number; account: Account | null }
export type ClaimResult = Session & { credited: number }
export type Me = { balance: number; account: Account | null }
export type StubPreview = { tickets: number; claimed: boolean }
export type IssuedStub = { code: string; tickets: number; claim_url: string; qr_url: string }

export type OrderStatus = 'pending' | 'fulfilled' | 'cancelled'
export type Order = {
  id: string
  pickup_code: string
  status: OrderStatus
  total_tickets: number
  created_at: string
  closed_at: string | null
  items: { prize_id: number; quantity: number; unit_cost: number; prize: Prize }[]
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type Options = { method?: string; body?: unknown; token?: string | null; headers?: HeadersInit }

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const headers = new Headers(opts.headers)
  if (opts.body !== undefined) headers.set('Content-Type', 'application/json')
  if (opts.token) headers.set('Authorization', `Bearer ${opts.token}`)
  const res = await fetch(path, {
    method: opts.method ?? (opts.body === undefined ? 'GET' : 'POST'),
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  })
  if (!res.ok) {
    let message = res.statusText || 'Something went wrong'
    try {
      const data = await res.json()
      if (typeof data.detail === 'string') message = data.detail
      else if (Array.isArray(data.detail)) message = data.detail.map((d: { msg: string }) => d.msg).join('; ')
    } catch {
      // Non-JSON error body; keep the status text.
    }
    throw new ApiError(res.status, message)
  }
  return (res.status === 204 ? undefined : await res.json()) as T
}

export const prizeImage = (prize: Prize) => `/prizes/${prize.image}`

export const formatTickets = (n: number) => n.toLocaleString('en-US')
