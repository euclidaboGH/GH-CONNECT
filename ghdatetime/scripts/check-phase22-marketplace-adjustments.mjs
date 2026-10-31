#!/usr/bin/env node
/** Static contract checks for append-only marketplace adjustments and payout fencing. */
import { readFileSync } from 'node:fs'
const read = (p) => readFileSync(p, 'utf8')
const sql = read('supabase/migrations/20261030010011_phase22_marketplace_adjustments_and_payout_fencing.sql')
const pkg = JSON.parse(read('package.json'))
const checks = [
 ['adjustments reference canonical order and preserve PI/GHC separation', /REFERENCES public\.gh_marketplace_orders\(id\) ON DELETE RESTRICT/.test(sql) && /currency IN \('PI','GHC'\)/.test(sql)],
 ['refund, chargeback and dispute adjustment types are explicit', /'refund','chargeback','dispute_award','dispute_reversal'/.test(sql)],
 ['gross and seller-net reductions are independently bounded', /gross_amount numeric\(18,8\) NOT NULL CHECK \(gross_amount > 0\)/.test(sql) && /seller_net_reduction numeric\(18,8\) NOT NULL CHECK \(seller_net_reduction >= 0\)/.test(sql) && /SELLER_NET_ADJUSTMENT_EXCEEDS_PROCEEDS/.test(sql)],
 ['adjustment writes are idempotent and reject payload conflicts', /UNIQUE\(order_id,idempotency_key\)/.test(sql) && /IDEMPOTENCY_PAYLOAD_CONFLICT/.test(sql)],
 ['adjustment records are append-only and inaccessible to clients', /BEFORE UPDATE OR DELETE ON public\.gh_marketplace_order_adjustments/.test(sql) && /FOR ALL USING\(false\) WITH CHECK\(false\)/.test(sql)],
 ['service-role-only adjustment RPC requires verified proceeds and evidence fingerprint', /VERIFIED_PROCEEDS_SNAPSHOT_REQUIRED/.test(sql) && /GRANT EXECUTE ON FUNCTION public\.gh_marketplace_record_adjustment/.test(sql)],
 ['post-allocation adjustments fail closed for reconciliation', /PAYOUT_ALREADY_RESERVED_RECONCILIATION_REQUIRED/.test(sql)],
 ['payout and order lifecycle changes share a seller/currency lock lane', /pg_advisory_xact_lock\(hashtext\(trim\(p_seller_id\)\),hashtext\('seller-payout:'\|\|upper\(p_currency\)\)\)/.test(sql) && /trg_gh_marketplace_order_finance_lock/.test(sql)],
 ['payout eligibility and allocations use seller net less immutable adjustments', /seller_net-COALESCE\(adj\.net_reduced,0\)/.test(sql) && /verified_order_net_less_immutable_adjustments/.test(sql)],
 ['external refunds and settlements are not falsely executed by the database RPC', /providerRefundExecuted',false/.test(sql) && /externalSettlementRequired',true/.test(sql)],
 ['release version is synchronized', /^\d+\.\d+\.\d+$/.test(pkg.version) && read('lib/app-release.ts').includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
]
let failed=0
for (const [name,ok] of checks) { console.log(`${ok?'PASS':'FAIL'} ${name}`); if(!ok) failed++ }
console.log(`\nPhase 22 marketplace adjustments: ${checks.length-failed}/${checks.length} passed`)
process.exit(failed?1:0)
