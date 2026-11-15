import fs from "node:fs"
import assert from "node:assert/strict"

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const sql = read("supabase/migrations/20261112100001_financial_stale_hold_reaper.sql")
const route = read("app/api/economy/maintenance/release-stale-holds/route.ts")
const vercel = JSON.parse(read("vercel.json"))

// Safety: only never-started Pi reservations are auto-released
assert.match(sql, /status = 'reserved'/)
for (const col of ["provider_payment_id IS NULL", "provider_txid IS NULL", "provider_receipt IS NULL", "execution_started_at IS NULL", "execution_lease_token IS NULL", "COALESCE\\(execution_attempts, 0\\) = 0"]) {
  assert.match(sql, new RegExp(col), `Pi release must require ${col}`)
}
assert.doesNotMatch(sql, /status IN \('reserved', 'processing', 'uncertain'\)[\s\S]{0,200}gh_earnings_release_reserve/)
assert.match(sql, /piHeldForReconciliation/)
// Reuses the append-only ledger and the existing GHC status function
assert.match(sql, /gh_earnings_release_reserve\(/)
assert.match(sql, /'pi_earnings_payout:release:' \|\| r\.id::text/)
assert.match(sql, /ghc_withdrawal_set_status\(/)
assert.match(sql, /status IN \('requested', 'under_review', 'approved'\)/)
assert.match(sql, /settlement_ref IS NULL/)
assert.doesNotMatch(sql, /UPDATE public\.gh_earnings_ledger_entries|DELETE FROM public\.gh_earnings_ledger_entries/)
// Minimum age enforced, dry run default, locked down
assert.match(sql, /GREATEST\(COALESCE\(p_max_age_hours, 24\), 24\)/)
assert.match(sql, /p_dry_run boolean DEFAULT true/)
assert.match(sql, /REVOKE ALL ON FUNCTION public\.gh_financial_release_stale_holds[\s\S]*FROM PUBLIC, anon, authenticated/)
assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.gh_financial_release_stale_holds[\s\S]*TO service_role/)
// One bad row must not block the batch
assert.match(sql, /EXCEPTION WHEN OTHERS THEN/)
assert.match(sql, /'failed', v_failed/)
assert.match(route, /failed\.length/)
// Route auth + cron wiring
assert.match(route, /timingSafeEqual/)
assert.match(route, /CRON_SECRET_NOT_CONFIGURED/)
assert.match(route, /status|401/)
assert.ok(vercel.crons?.some((c) => c.path === "/api/economy/maintenance/release-stale-holds"))
console.log("Run #297 stale-hold reaper contract: PASS")
