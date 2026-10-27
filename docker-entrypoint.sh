#!/bin/sh
set -e
# Every task migrates on boot; a Postgres advisory lock (src/lib/migrate.ts) serialises them.
node cli.mjs migrate
if [ "${SEED_DEMO_DATA:-false}" = "true" ]; then
  node cli.mjs seed
fi
exec "$@"
