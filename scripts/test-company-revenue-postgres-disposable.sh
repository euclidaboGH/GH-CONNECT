#!/usr/bin/env bash
set -euo pipefail

# Intentionally refuses to run unless the operator explicitly identifies a disposable DB.
: "${GH_REVENUE_TEST_DATABASE_URL:?Set GH_REVENUE_TEST_DATABASE_URL to a NEW disposable PostgreSQL database URL}"
if [[ "${GH_ALLOW_DISPOSABLE_DB:-}" != "1" ]]; then
  echo "Refusing to run: set GH_ALLOW_DISPOSABLE_DB=1 only after confirming the database is disposable." >&2
  exit 2
fi
command -v psql >/dev/null || { echo "psql is required (PostgreSQL client)." >&2; exit 2; }
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Avoid accidental use of any database whose name does not clearly identify it as disposable/test.
db_name="$(psql "$GH_REVENUE_TEST_DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 -c 'SELECT current_database()')"
if [[ ! "$db_name" =~ (disposable|scratch|revenue_test|test_revenue) ]]; then
  echo "Refusing database '$db_name': name must contain disposable, scratch, revenue_test, or test_revenue." >&2
  exit 2
fi

echo "[1/4] Prepare test roles"
psql "$GH_REVENUE_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$root/scripts/postgres-tests/company-revenue-setup.sql"
echo "[2/4] Apply revenue journal migration to disposable DB"
psql "$GH_REVENUE_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$root/supabase/migrations/20261022010091_company_revenue_event_journal.sql"
echo "[3/4] Validate permissions, append-only trigger, idempotency, conflicts, amount math and verification gates"
psql "$GH_REVENUE_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$root/scripts/postgres-tests/company-revenue-assertions.sql"

echo "[4/4] Concurrent duplicate submission (two independent PostgreSQL sessions)"
key="pgtest-concurrent-$(date +%s)-$$"
event="pgtest-concurrent-event-$(date +%s)-$$"
query="SET ROLE service_role; SELECT public.gh_company_revenue_event_append('$key','paystack','$event','membership_revenue','NGN',10000,2500,300,0,'$event',now(),'{}'::jsonb);"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
run_concurrent_caller() {
  local out="$1" err="$2" result attempt=0
  while (( attempt < 2 )); do
    result="$(psql "$GH_REVENUE_TEST_DATABASE_URL" -X -q -A -t -v ON_ERROR_STOP=1 -c "$query" 2>>"$err")" || { cat "$err" >&2; return 1; }
    printf '%s' "$result" > "$out"
    if [[ "$(node -e 'const r=JSON.parse(process.argv[1]); process.stdout.write(r.error || "")' "$result")" != "REVENUE_CONCURRENT_RETRY" ]]; then
      return 0
    fi
    attempt=$((attempt + 1))
  done
  echo "Concurrent retry was still unresolved after one retry" >&2
  return 1
}
(run_concurrent_caller "$tmp/a" "$tmp/a.err") & p1=$!
(run_concurrent_caller "$tmp/b" "$tmp/b.err") & p2=$!
wait "$p1" || { cat "$tmp/a.err" >&2; cat "$tmp/b.err" >&2; exit 1; }
wait "$p2" || { cat "$tmp/a.err" >&2; cat "$tmp/b.err" >&2; exit 1; }
node - "$tmp/a" "$tmp/b" <<'NODE'
const fs = require('node:fs')
const assert = require('node:assert/strict')
const rows = process.argv.slice(2).map(p => JSON.parse(fs.readFileSync(p, 'utf8').trim()))
assert.equal(rows.length, 2)
assert.ok(rows.every(r => r.ok === true), JSON.stringify(rows))
assert.deepEqual(rows.map(r => r.duplicate).sort(), [false, true], JSON.stringify(rows))
assert.equal(rows[0].eventId, rows[1].eventId, 'concurrent callers must receive the same canonical event id')
console.log('PASS: concurrent submissions returned one canonical event; one insert and one duplicate')
NODE
count="$(psql "$GH_REVENUE_TEST_DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM public.gh_company_revenue_events WHERE idempotency_key = '$key'")"
[[ "$count" == "1" ]] || { echo "Expected one row after concurrent submissions; found $count" >&2; exit 1; }
echo "PASS: all disposable PostgreSQL revenue journal integration tests"
