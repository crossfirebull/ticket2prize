import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { getEnv } from './env'
import * as schema from './schema'

export type Db = NodePgDatabase<typeof schema>
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
/** Anything queries can run on: the pool or an open transaction. */
export type Executor = Db | Tx

export function createDb(url: string, ssl = false): { db: Db; pool: Pool } {
  const pool = new Pool({ connectionString: url, max: 10, ssl: ssl ? { rejectUnauthorized: false } : undefined })
  return { db: drizzle({ client: pool, schema, casing: 'snake_case' }), pool }
}

// One pool per server process, kept across hot reloads in development.
const globalForDb = globalThis as unknown as { t2pDb?: Db }

export function getDb(): Db {
  if (!globalForDb.t2pDb) {
    const env = getEnv()
    globalForDb.t2pDb = createDb(env.databaseUrl, env.databaseSsl).db
  }
  return globalForDb.t2pDb
}
