#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const mig = read('supabase/migrations/20261029010008_pi_cashback_phase5_attribution_reconcile.sql')
const attr = read('lib/server/revenue/cashback-attribution.ts')
const rev = read('lib/server/revenue/revenue-event.ts')
const api = read('app/api/economy/rewards/pi-cashback/reconcile/route.ts')
const checks = []
const test = (n, ok) => { checks.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${n}`) }

test('Phase 5 migration exists', existsSync(join(root, 'supabase/migrations/20261029010008_pi_cashback_phase5_attribution_reconcile.sql')))
test('creator_tip_revenue is a valid revenue event type', /creator_tip_revenue/.test(mig) && /creator_tip_revenue/.test(rev))
test('Only marketplace fees are enabled until other revenue producers are verified', /CASHBACK_SUPPORTED_SOURCES[\s\S]*?\"marketplace_fee\"/.test(attr) && /CASHBACK_PENDING_SOURCES/.test(attr))
test('Refunds require related eligible source', /RELATED_SOURCE_REQUIRED_FOR_COMPENSATION/.test(mig) || /RELATED_ELIGIBLE_REVENUE_NOT_FOUND/.test(mig))
test('Reconcile period RPC exists', /gh_pi_cashback_reconcile_period/.test(mig))
test('Reconcile reports by-source breakdown and liability', /bySource/.test(mig) && /expectedCashbackLiabilityAtomic/.test(mig))
test('Liability coverage compared to period totals', /liabilityCoverageOk/.test(mig))
test('Attribution helper separates enabled and pending sources', /CASHBACK_SUPPORTED_SOURCES/.test(attr) && /CASHBACK_PENDING_SOURCES/.test(attr) && /attributeCashbackEligibleRevenue/.test(attr))
test('Cashback rate is 50 bps (0.5%)', /CASHBACK_RATE_BPS = 50/.test(attr))
test('Reconcile API requires operator key', /x-ghc-operator-key/.test(api) && /FORBIDDEN/.test(api))
test('Reconcile API does not accept client-written balances', !/request\.json\(\)/.test(api))
test('Service-role grant on reconcile RPC', /GRANT EXECUTE ON FUNCTION public\.gh_pi_cashback_reconcile_period/.test(mig))

const failed = checks.filter((x) => !x).length
console.log(`\nPhase 5 cashback attribution: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
