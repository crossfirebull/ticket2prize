import { getDb } from '@/lib/db'
import { getEnv } from '@/lib/env'
import { DomainError } from '@/lib/errors'
import { issueStub } from '@/lib/stubs'

/**
 * Called by the ticket-counting kiosk, which prints the response as a QR on the stub.
 *   curl -X POST /api/kiosk/stubs -H 'X-Kiosk-Key: …' -d '{"tickets": 250}'
 */
export async function POST(request: Request) {
  const env = getEnv()
  const key = request.headers.get('x-kiosk-key')
  if (!key || !env.kioskKeys.has(key)) return Response.json({ error: 'Invalid kiosk key' }, { status: 401 })

  const body = await request.json().catch(() => null)
  try {
    const stub = await issueStub(getDb(), Number(body?.tickets), String(body?.kiosk_id ?? 'kiosk-1'))
    return Response.json(
      {
        code: stub.code,
        tickets: stub.tickets,
        claim_url: `${env.publicBaseUrl}/claim/${stub.code}`,
        qr_url: `/api/stubs/${stub.code}/qr`,
      },
      { status: 201 },
    )
  } catch (e) {
    if (e instanceof DomainError) return Response.json({ error: e.message }, { status: 422 })
    throw e
  }
}
