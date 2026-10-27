import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

// Arbitrary constant. Every app task migrates on boot; this Postgres advisory lock
// makes sure only one of them does it at a time.
const MIGRATION_LOCK_ID = 7_202_306

export async function runMigrations(url: string, migrationsFolder: string, ssl = false) {
  const pool = new Pool({ connectionString: url, max: 1, ssl: ssl ? { rejectUnauthorized: false } : undefined })
  const client = await pool.connect()
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID])
    try {
      await migrate(drizzle({ client }), { migrationsFolder })
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID])
    }
  } finally {
    client.release()
    await pool.end()
  }
}
