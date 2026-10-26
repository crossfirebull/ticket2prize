#!/usr/bin/env bash
# Smoke test a running deployment.
#   scripts/smoke.sh http://localhost:8080               # read-only checks
#   KIOSK_KEY=... scripts/smoke.sh https://dev.example   # plus a full redemption
set -euo pipefail

BASE=${1:?usage: smoke.sh BASE_URL}
BASE=${BASE%/}
pass() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$1"; exit 1; }
json() { python3 -c "import json,sys; print(eval(sys.argv[1], {}, {'d': json.load(sys.stdin)}))" "$1"; }

echo "Smoke testing $BASE"

# The API can take a minute to pass migrations after a fresh deploy.
for _ in $(seq 30); do
  curl -fsS "$BASE/api/categories" >/dev/null 2>&1 && break
  sleep 5
done

curl -fsS "$BASE/" | grep -q '<div id="root">' && pass "web serves the app" || fail "web"
curl -fsS "$BASE/claim/anything" | grep -q '<div id="root">' && pass "client-side routes fall back to the app" || fail "spa fallback"
count=$(curl -fsS "$BASE/api/prizes" | json 'len(d)')
[ "$count" -gt 0 ] && pass "catalog has $count prizes" || fail "empty catalog"

if [ -z "${KIOSK_KEY:-}" ]; then
  echo "KIOSK_KEY not set; skipping the redemption flow."
  exit 0
fi

code=$(curl -fsS -X POST "$BASE/api/kiosk/stubs" -H "X-Kiosk-Key: $KIOSK_KEY" \
  -H 'Content-Type: application/json' -d '{"tickets": 25, "kiosk_id": "smoke-test"}' | json 'd["code"]')
pass "kiosk issued a stub"

claim=$(curl -fsS -X POST "$BASE/api/stubs/$code/claim")
token=$(echo "$claim" | json 'd["token"]')
[ "$(echo "$claim" | json 'd["balance"]')" = 25 ] && pass "guest claimed 25 tickets" || fail "claim"

prize=$(curl -fsS "$BASE/api/prizes?in_stock=true" | json 'min(d, key=lambda p: p["ticket_cost"])["id"]')
order=$(curl -fsS -X POST "$BASE/api/orders" -H "Authorization: Bearer $token" \
  -H 'Content-Type: application/json' -d "{\"items\": [{\"prize_id\": $prize, \"quantity\": 1}]}")
order_id=$(echo "$order" | json 'd["id"]')
pass "checked out, pickup code $(echo "$order" | json 'd["pickup_code"]')"

# Put the prize back so smoke runs don't drain inventory.
curl -fsS -X POST "$BASE/api/orders/$order_id/cancel" -H "Authorization: Bearer $token" \
  | json 'd["status"]' | grep -q cancelled && pass "cancelled and refunded" || fail "cancel"
