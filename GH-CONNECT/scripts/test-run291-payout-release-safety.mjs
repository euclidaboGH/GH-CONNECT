#!/usr/bin/env node
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const migration = read('supabase/migrations/20261111120001_pi_earnings_release_stale_incomplete.sql')
const cancelRoute = read('app/api/economy/earnings/withdrawals/cancel/route.ts')
const policy = read('lib/wallet/withdrawal-reservation-policy.ts')
const packageJson = JSON.parse(read('package.json'))

const predicate = migration.match(/v_can_release := \(([\s\S]*?)\n    \);/)
const releasePredicate = predicate?.[1] ?? ''
const checks = []
const check = (label, condition) => {
  checks.push(Boolean(condition))
  console.log(`${condition ? 'PASS' : 'FAIL'} ${label}`)
}

check('self-service release predicate exists and is isolated', Boolean(predicate))
check('only never-started reserved requests can be released', /v_row\.status = 'reserved'/.test(releasePredicate) && !/processing|uncertain/.test(releasePredicate))
check('release is restricted to Pi Testnet', /v_row\.network = 'Pi Testnet'/.test(releasePredicate) && /network = 'Pi Testnet'/.test(migration))
check('all provider evidence fields block release', /provider_payment_id IS NULL/.test(releasePredicate) && /provider_txid IS NULL/.test(releasePredicate) && /provider_receipt IS NULL/.test(releasePredicate) && /provider_verified_at IS NULL/.test(releasePredicate))
check('execution must never have started', /execution_started_at IS NULL/.test(releasePredicate) && /COALESCE\(v_row\.execution_attempts, 0\) = 0/.test(releasePredicate))
check('both lease token and expiry must be absent', /execution_lease_token IS NULL/.test(releasePredicate) && /execution_lease_expires_at IS NULL/.test(releasePredicate))
check('stale timestamps are never treated as proof of provider non-execution', !/v_stale_cutoff|execution_started_at\s*</.test(migration))
check('processing and uncertain requests remain held for provider reconciliation', /v_row\.status IN \('processing', 'uncertain'\)/.test(migration) && /PROVIDER_OUTCOME_UNKNOWN/.test(migration))
check('active worker lease is explicitly distinguished', /execution_lease_token IS NOT NULL[\s\S]*execution_lease_expires_at > now\(\)/.test(migration) && /PROVIDER_EXECUTION_IN_PROGRESS/.test(migration))
check('release uses the atomic earnings reserve-release function', /gh_earnings_release_reserve\(/.test(migration) && /'pi_earnings_payout:release:'/.test(migration))
check('released rows clear both lease fields', /execution_lease_token = NULL,[\s\S]*execution_lease_expires_at = NULL/.test(migration))
check('SECURITY DEFINER function pins search_path and grants only service_role', /SECURITY DEFINER[\s\S]*SET search_path = pg_catalog, public/.test(migration) && /REVOKE ALL ON FUNCTION public\.gh_pi_earnings_payout_cancel_unstarted\(text\) FROM PUBLIC, anon, authenticated/.test(migration) && /GRANT EXECUTE ON FUNCTION public\.gh_pi_earnings_payout_cancel_unstarted\(text\) TO service_role/.test(migration))
check('user route authenticates and applies durable fail-closed rate limiting', /if \(!auth\)/.test(cancelRoute) && /checkDurableRateLimit/.test(cancelRoute) && /onUnavailable: "deny"/.test(cancelRoute))
check('wallet copy explains provider reconciliation instead of promising release after a timeout', /provider execution never started/.test(policy) && /provider outcome is reconciled/.test(policy) && !/15 minutes/.test(policy))
check('postbuild footprint diagnostics are wired', packageJson.scripts?.postbuild === 'node scripts/report-build-footprint.mjs')

const passed = checks.filter(Boolean).length
console.log(`\nRun 291 payout release safety: ${passed}/${checks.length} passed`)
if (passed !== checks.length) process.exit(1)
