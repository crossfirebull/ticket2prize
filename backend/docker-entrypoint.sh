#!/bin/sh
set -e
# Every task migrates on boot; an advisory lock in migrations/env.py serialises them.
alembic upgrade head
if [ "${SEED_DEMO_DATA:-false}" = "true" ]; then
  python -m app.seed
fi
exec "$@"
