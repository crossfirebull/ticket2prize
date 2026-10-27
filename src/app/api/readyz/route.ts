import { sql } from 'drizzle-orm'
import { getDb } from '@/lib/db'

/** Readiness: the database answers. */
export async function GET() {
  try {
    await getDb().execute(sql`SELECT 1`)
    return Response.json({ status: 'ready' })
  } catch {
    return Response.json({ status: 'database unavailable' }, { status: 503 })
  }
}
