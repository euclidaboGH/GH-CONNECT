#!/usr/bin/env node
/** Source contract checks for bounded, read-only payout and membership reconciliation details. */
import { readFileSync } from 'node:fs'
const read = p => readFileSync(p, 'utf8')
const sql = read('supabase/migrations/20261030010013_phase24_financial_exception_detail.sql')
const pkg = JSON.parse(read('package.json'))
const checks = [
 ['payout detail joins canonical payout requests, allocations and proceeds snapshots', /gh_seller_payout_allocations/.test(sql) && /gh_seller_payout_requests/.test(sql) && /gh_marketplace_order_proceeds/.test(sql)],
 ['payout detail reports gross, commission, net and adjustment evidence', /verified_gross/.test(sql) && /platform_commission/.test(sql) && /seller_net_adjustments/.test(sql)],
 ['legacy missing snapshots and allocation mismatches are classified without mutation', /MISSING_PROCEEDS_SNAPSHOT/.test(sql) && /ALLOCATION_DIFFERS_FROM_CURRENT_NET/.test(sql) && /historicalRowsRewritten',false/.test(sql)],
 ['payout reconciliation is bounded and service-role-only', /least\(1000,greatest\(1,coalesce\(p_limit,250\)\)\)/.test(sql) && /GRANT EXECUTE ON FUNCTION public\.gh_treasury_payout_reconciliation_detail\(integer\) TO service_role/.test(sql)],
 ['membership exception report joins payment intents to canonical entitlement links', /ghc_payment_intents/.test(sql) && /ghc_membership_entitlements/.test(sql) && /e\.payment_intent_id IS DISTINCT FROM i\.id/.test(sql)],
 ['membership exception report checks user, purpose, product, completion and expiry', /ENTITLEMENT_USER_MISMATCH/.test(sql) && /PURPOSE_OR_PRODUCT_NOT_CANONICAL/.test(sql) && /PAYMENT_NOT_COMPLETED/.test(sql) && /PAID_ENTITLEMENT_EXPIRED/.test(sql)],
 ['membership diagnostics do not grant or renew access', /grantsAccess',false/.test(sql) && /Does not grant or renew access/.test(sql)],
 ['both reports are read-only bounded service-role RPCs', (sql.match(/SECURITY DEFINER SET search_path=pg_catalog,public/g)||[]).length===2 && (sql.match(/REVOKE ALL ON FUNCTION public\.(gh_treasury_payout_reconciliation_detail|ghc_membership_payment_exception_detail)\(integer\) FROM PUBLIC,anon,authenticated/g)||[]).length===2],
 ['release version is synchronized', pkg.version === '0.202.0' && read('lib/app-release.ts').includes('APP_RELEASE_VERSION = "0.202.0"')],
]
let failed=0; for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++}
console.log(`\nPhase 24 financial exception detail: ${checks.length-failed}/${checks.length} passed`)
process.exit(failed?1:0)
