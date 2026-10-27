import { listPrizes } from '@/lib/catalog'
import { getDb } from '@/lib/db'

/** Public, read-only catalog, e.g. for a lobby display or the deploy smoke test. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const prizes = await listPrizes(getDb(), {
    category: params.get('category') ?? undefined,
    q: params.get('q') ?? undefined,
    inStock: params.get('in_stock') === 'true',
  })
  return Response.json(prizes)
}
