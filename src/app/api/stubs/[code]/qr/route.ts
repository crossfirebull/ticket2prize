import QRCode from 'qrcode'
import { getDb } from '@/lib/db'
import { getEnv } from '@/lib/env'
import { previewStub } from '@/lib/stubs'

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  if (!(await previewStub(getDb(), code))) return new Response('Not found', { status: 404 })
  const svg = await QRCode.toString(`${getEnv().publicBaseUrl}/claim/${code}`, { type: 'svg', margin: 2 })
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'private, max-age=3600' } })
}
