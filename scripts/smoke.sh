#!/usr/bin/env bash
# Quick read-only checks against a running deployment (the full customer journey is
# covered by the Playwright suite in e2e/).
#   scripts/smoke.sh http://localhost:3000
#   KIOSK_KEY=... scripts/smoke.sh https://dev.example   # also prints a stub
set -euo pipefail

BASE=${1:?usage: smoke.sh BASE_URL}
BASE=${BASE%/}
pass() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$1"; exit 1; }

echo "Smoke testing $BASE"

# A fresh deploy can take a minute to finish migrating.
for _ in $(seq 30); do
  curl -fsS "$BASE/api/readyz" >/dev/null 2>&1 && break
  sleep 5
done

curl -fsS "$BASE/api/readyz" | grep -q ready && pass "app is up and reaches the database" || fail "readyz"
curl -fsS "$BASE/" | grep -q 'Ticket<span>2</span>Prize' && pass "store page renders" || fail "store page"
count=$(curl -fsS "$BASE/api/prizes" | grep -o '"sku"' | wc -l)
[ "$count" -gt 0 ] && pass "catalog has $count prizes" || fail "empty catalog"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/kiosk/stubs" -H 'X-Kiosk-Key: wrong' -d '{}')
[ "$code" = 401 ] && pass "kiosk API rejects a bad key" || fail "kiosk auth returned $code"

if [ -n "${KIOSK_KEY:-}" ]; then
  stub=$(curl -fsS -X POST "$BASE/api/kiosk/stubs" -H "X-Kiosk-Key: $KIOSK_KEY" \
    -H 'Content-Type: application/json' -d '{"tickets": 5, "kiosk_id": "smoke-test"}')
  qr=$(echo "$stub" | sed -E 's/.*"qr_url":"([^"]+)".*/\1/')
  curl -fsS "$BASE$qr" | grep -q '<svg' && pass "kiosk printed a stub with a QR code" || fail "stub QR"
fi
