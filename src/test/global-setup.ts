import path from 'node:path'
import { Client } from 'pg'
import { runMigrations } from '../lib/migrate'

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://ticket2prize:ticket2prize@localhost:5432/ticket2prize_test'

/** Create the test database if needed and bring it to the latest migration. */
export default async function setup() {
  const url = new URL(TEST_DATABASE_URL)
  const name = url.pathname.slice(1)
  const admin = new Client({ connectionString: Object.assign(new URL(url), { pathname: '/postgres' }).toString() })
  await admin.connect()
  const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name])
  if (!rowCount) await admin.query(`CREATE DATABASE "${name}"`)
  await admin.end()
  await runMigrations(TEST_DATABASE_URL, path.resolve('drizzle'))
}
