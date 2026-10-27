const DEV_SESSION_SECRET = 'local-development-secret-do-not-use-in-aws'

function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  // How ECS injects RDS credentials: separate parts, password from Secrets Manager.
  if (process.env.DB_HOST) {
    const user = encodeURIComponent(process.env.DB_USER ?? 'ticket2prize')
    const password = encodeURIComponent(process.env.DB_PASSWORD ?? '')
    const port = process.env.DB_PORT ?? '5432'
    const name = process.env.DB_NAME ?? 'ticket2prize'
    return `postgres://${user}:${password}@${process.env.DB_HOST}:${port}/${name}`
  }
  return 'postgres://ticket2prize:ticket2prize@localhost:5432/ticket2prize'
}

export function getEnv() {
  const environment = process.env.ENVIRONMENT ?? 'local'
  const sessionSecret = process.env.SESSION_SECRET ?? DEV_SESSION_SECRET
  if (!['local', 'test'].includes(environment) && sessionSecret === DEV_SESSION_SECRET) {
    throw new Error('SESSION_SECRET must be set outside local development')
  }
  const publicBaseUrl = (process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  return {
    environment,
    databaseUrl: databaseUrl(),
    // RDS requires TLS; local Postgres doesn't speak it.
    databaseSsl: process.env.DB_HOST !== undefined && process.env.DB_SSL !== 'false',
    sessionSecret,
    sessionDays: 30,
    kioskKeys: new Set(
      (process.env.KIOSK_KEYS ?? 'dev-kiosk-key')
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean),
    ),
    publicBaseUrl,
    secureCookies: publicBaseUrl.startsWith('https://'),
  }
}
