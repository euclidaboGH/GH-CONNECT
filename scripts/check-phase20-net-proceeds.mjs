#!/usr/bin/env node
/** Source-contract checks for Phase 20 immutable marketplace proceeds and net payout allocation. */
import { readFileSync } from 'node:fs'
const read = (p) => readFileSync(p, 'utf8')
const migration = read('supabase/migrations/20261030010009_phase20_marketplace_net_proceeds.sql')
const payout = read('supabase/migrations/20261022010110_gh_lifecycle_payout_quality_foundation.sql')
const packageJson = JSON.parse(read('package.json'))
const checks = [
  ['durable per-order proceeds snapshot stores gross, commission, seller net and currency', /CREATE TABLE IF NOT EXISTS public\.gh_marketplace_order_proceeds/.test(migration) && /gross_amount/.test(migration) && /platform_commission/.test(migration) && /seller_net/.test(migration)],
  ['snapshot binds PI and GHC to distinct provider evidence shapes', /currency='PI'.*payment_method='pi'.*payment_intent_id/s.test(migration) && /currency='GHC'.*payment_method='ghc'.*ghc_spend_ref/s.test(migration)],
  ['snapshot creation requires verified payment status', /IF NEW\.payment_status <> 'verified' THEN RETURN NEW/.test(migration)],
  ['snapshot commission is captured at a fixed 500 basis points', /v_bps integer := 500/.test(migration) && /NEW\.total_amount \* v_bps \/ 10000/.test(migration)],
  ['proceeds rows reject updates and deletes', /BEFORE UPDATE OR DELETE ON public\.gh_marketplace_order_proceeds/.test(migration) && /MARKETPLACE_PROCEEDS_IMMUTABLE/.test(migration)],
  ['payout eligibility sums seller net, not order gross', /sum\(p\.seller_net\)/.test(migration) && !/sum\(o\.total_amount\)/.test(migration)],
  ['payout allocation uses seller net and requires completed verified orders', /p\.seller_net\s+FROM public\.gh_marketplace_order_proceeds/.test(migration) && /o\.status='completed' AND o\.payment_status='verified'/.test(migration)],
  ['allocation total is checked against eligible net proceeds', /PAYOUT_NET_ALLOCATION_MISMATCH/.test(migration)],
  ['service role alone can request seller payouts', /REVOKE ALL ON FUNCTION public\.gh_seller_payout_request\(text,text,numeric,text\) FROM PUBLIC,anon,authenticated/.test(migration) && /GRANT EXECUTE ON FUNCTION public\.gh_seller_payout_request\(text,text,numeric,text\) TO service_role/.test(migration)],
  ['legacy gross-based payout behavior remains visible for migration review', /sum\(o\.total_amount\)/.test(payout)],
  ['release version is synchronized', /^\d+\.\d+\.\d+$/.test(packageJson.version) && read('lib/app-release.ts').includes(`APP_RELEASE_VERSION = "${packageJson.version}"`)],
]
let failed = 0
for (const [name, pass] of checks) { console.log((pass ? 'PASS ' : 'FAIL ') + name); if (!pass) failed++ }
console.log(`\nPhase 20 net proceeds contract: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
