#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const sql = readFileSync('supabase/migrations/20261030010002_pi_earnings_payout_requests.sql','utf8')
const route = readFileSync('app/api/economy/earnings/withdrawals/route.ts','utf8')
const ledger = readFileSync('lib/server/earnings/unified-ledger.ts','utf8')
const reserve = readFileSync('supabase/migrations/20261029010010_gh_earnings_available_balance_phase6.sql','utf8')
const checks = [
 ['dedicated payout request table exists', /CREATE TABLE IF NOT EXISTS public\.gh_pi_earnings_payout_requests/.test(sql)],
 ['gross equals fee plus net constraint', /gross_atomic = fee_atomic \+ net_atomic/.test(sql)],
 ['idempotency unique per user', /uq_gh_pi_earnings_payout_idempotency/.test(sql)],
 ['same key different payload is conflict', /IDEMPOTENCY_CONFLICT/.test(sql)],
 ['same-user concurrent creation is serialized', /pg_advisory_xact_lock/.test(sql)],
 ['reservation is created inside request transaction', /public\.gh_earnings_reserve\(v_user,p_gross_atomic/.test(sql)],
 ['recipient is sourced from canonical Pi identity', /FROM public\.gh_pi_identities WHERE gh_user_id=v_user/.test(sql)],
 ['request table denies client access', /ENABLE ROW LEVEL SECURITY[\s\S]*?USING \(false\) WITH CHECK \(false\)[\s\S]*?REVOKE ALL ON TABLE[\s\S]*?service_role/.test(sql)],
 ['create RPC is service-role-only', /REVOKE ALL ON FUNCTION public\.gh_pi_earnings_payout_create[\s\S]*?GRANT EXECUTE ON FUNCTION public\.gh_pi_earnings_payout_create[\s\S]*?TO service_role/.test(sql)],
 ['provider payment and txid are unique', /uq_gh_pi_earnings_payout_provider_payment/.test(sql) && /uq_gh_pi_earnings_payout_provider_txid/.test(sql)],
 ['uncertain outcome retains reservation', /status='uncertain'[\s\S]*?reservationRetained',true/.test(sql)],
 ['legacy reserve duplicate path exists for review', /IF FOUND THEN[\s\S]*?'duplicate', true/.test(reserve)],
 ['no automatic release on uncertain provider outcome', !/gh_earnings_release_reserve/.test(sql)],
 ['migration does not claim to execute provider payout', /No provider transfer is initiated/.test(sql)],
 ['request API requires authenticated user', /resolveAuthenticatedUser/.test(route)],
 ['request API uses bounded JSON parsing', /readBoundedJson\(request, 8 \* 1024\)/.test(route)],
 ['request API is disabled unless explicitly enabled for Testnet', /PI_EARNINGS_PAYOUT_REQUESTS_ENABLED !== \"true\"/.test(route) && /PI_NETWORK !== \"testnet\"/.test(route)],
 ['request API calculates quote server-side', /quoteWithdrawal\(\{ userId: auth.userId, grossAtomic: body.amountAtomic \}\)/.test(route)],
 ['request API fingerprints server-derived recipient and amounts', /createHash\(\"sha256\"\)/.test(route) && /quote.recipientPiAppUid/.test(route)],
 ['request API never reports a transfer as submitted', /transferSubmitted: false/.test(route)],
 ['ledger exposes durable request RPC wrapper', /gh_pi_earnings_payout_create/.test(ledger)],
]
let failed=0
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++}
console.log(`\nPI earnings payout request lifecycle: ${checks.length-failed}/${checks.length} passed`)
assert.equal(failed,0)
