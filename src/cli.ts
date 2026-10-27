/**
 * Admin commands. In the container: node dist/cli.mjs <command>; locally: npm run cli -- <command>
 *   migrate                                 apply database migrations
 *   seed                                    load the sample prize catalog
 *   create-staff <email> <password> [name]  create a staff account, or promote one
 */
import path from 'node:path'
import { createStaff } from './lib/accounts'
import { createDb } from './lib/db'
import { getEnv } from './lib/env'
import { runMigrations } from './lib/migrate'
import { seedPrizes } from './lib/seed'

async function main() {
  const [command, ...args] = process.argv.slice(2)
  const env = getEnv()

  if (command === 'migrate') {
    await runMigrations(env.databaseUrl, process.env.MIGRATIONS_DIR ?? path.resolve('drizzle'), env.databaseSsl)
    console.log('Migrations applied')
    return
  }

  const { db, pool } = createDb(env.databaseUrl, env.databaseSsl)
  try {
    if (command === 'seed') {
      console.log(`Seeded ${await seedPrizes(db)} prizes`)
    } else if (command === 'create-staff' && args.length >= 2) {
      await createStaff(db, args[0], args[1], args[2])
      console.log(`${args[0]} is now staff`)
    } else {
      console.error('usage: cli <migrate | seed | create-staff EMAIL PASSWORD [NAME]>')
      process.exitCode = 2
    }
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
