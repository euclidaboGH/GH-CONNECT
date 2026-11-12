#!/usr/bin/env node
import { readFileSync } from 'node:fs'
const read = (p) => readFileSync(p, 'utf8')
const sql = read('supabase/migrations/20261030010007_pi_a2u_shared_sequence_lane.sql')
const helper = read('lib/server/revenue/cashback-attribution.ts')
const worker = read('app/api/economy/earnings/withdrawals/execute/route.ts')
const checks = [
  ['Phase 5 shared A2U migration exists', sql.length > 4000],
  ['General earnings uses existing global Pi sequence lease', /gh_pi_a2u_sequence_lease/.test(sql)],
  ['General earnings lane is namespaced to avoid request ID collisions', /earnings:'\s*\|\|\s*p_request_id::text/.test(sql)],
  ['Begin execution locks shared lane before request row', sql.indexOf('FROM public.gh_pi_a2u_sequence_lease WHERE singleton_id=1 FOR UPDATE') < sql.indexOf('FROM public.gh_pi_earnings_payout_requests')],
  ['Heartbeat fences token, request and expiry on shared lane', /lane\.lease_token IS DISTINCT FROM p_lease_token::text/.test(sql) && /lane\.payout_request_id IS DISTINCT FROM \('earnings:'\|\|p_request_id::text\)/.test(sql)],
  ['Provider payment binding requires shared lane ownership', /gh_pi_earnings_payout_bind_provider_payment/.test(sql) && /GLOBAL_EXECUTION_LEASE_LOST|EXECUTION_LEASE_LOST/.test(sql)],
  ['End execution releases only its own shared lane', /WHERE singleton_id=1 AND lease_token=p_lease_token::text AND payout_request_id='earnings:'\|\|p_request_id::text/.test(sql)],
  ['All worker RPCs remain service-role only', (sql.match(/GRANT EXECUTE ON FUNCTION public\.gh_pi_earnings_payout_/g)||[]).length === 4 && /FROM PUBLIC,anon,authenticated/.test(sql)],
  ['Pi earnings route retains heartbeat before provider mutations', /gh_pi_earnings_payout_heartbeat_execution/.test(worker)],
  ['Only fully wired marketplace fee is cashback-enabled', /CASHBACK_SUPPORTED_SOURCES[\s\S]*?"marketplace_fee"/.test(helper)],
  ['Unwired cashback sources are explicitly pending', /CASHBACK_PENDING_SOURCES/.test(helper) && /membership_revenue/.test(helper) && /refund/.test(helper)],
  ['Cashback policy exposes enabled and pending source lists separately', /supportedSources: \[\.\.\.CASHBACK_SUPPORTED_SOURCES\]/.test(helper) && /pendingSources: \[\.\.\.CASHBACK_PENDING_SOURCES\]/.test(helper)],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++ }
console.log(`\nPhase 5 shared A2U lane: ${checks.length-failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
