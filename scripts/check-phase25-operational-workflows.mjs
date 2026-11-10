#!/usr/bin/env node
/** Static source-contract checks only; not a PostgreSQL execution test. */
import { readFileSync } from 'node:fs'
const read = p => readFileSync(p, 'utf8')
const sql = read('supabase/migrations/20261030010014_phase25_operational_financial_workflows.sql')
const pkg = JSON.parse(read('package.json'))
const release = read('lib/app-release.ts')
const checks = [
 ['refund operation links canonical marketplace order and adjustment', /REFERENCES public\.gh_marketplace_orders\(id\)/.test(sql) && /REFERENCES public\.gh_marketplace_order_adjustments\(id\)/.test(sql)],
 ['provider refund evidence and idempotency are required', /provider_refund_id text NOT NULL/.test(sql) && /evidence_fingerprint text NOT NULL/.test(sql) && /gh_refund_idempotency_unique/.test(sql)],
 ['refund recorder is service-role gated and binds provider payment to canonical order', /GRANT EXECUTE ON FUNCTION public\.gh_marketplace_record_provider_refund[\s\S]*TO service_role/.test(sql) && /PROVIDER_PAYMENT_BINDING_MISMATCH/.test(sql) && /VERIFIED/.test(sql)],
 ['confirmed refund records adjustment before marking canonical order refunded', /gh_marketplace_record_adjustment/.test(sql) && /UPDATE public\.gh_marketplace_orders SET payment_status='refunded'/.test(sql)],
 ['dispute decisions preserve evidence, reason, approval and idempotency', /gh_marketplace_dispute_decisions/.test(sql) && /approval_ref text NOT NULL/.test(sql) && /evidence_fingerprint text NOT NULL/.test(sql)],
 ['historical payout corrections require approval evidence and remain separate from allocation mutation', /gh_seller_payout_correction_approvals/.test(sql) && /approved_by text NOT NULL/.test(sql) && /does not silently mutate/.test(sql)],
 ['membership renewal locks canonical payment and entitlement records', /ghc_membership_renew_from_verified_intent/.test(sql) && /FOR UPDATE/.test(sql) && /membership-renewal/.test(sql)],
 ['membership renewal requires completed payment and catalog/currency verification', /VERIFIED_COMPLETED_PAYMENT_REQUIRED/.test(sql) && /CANONICAL_CATALOG_VERIFICATION_REQUIRED/.test(sql)],
 ['operational journals reject mutation', (sql.match(/FINANCIAL_OPERATION_JOURNAL_IMMUTABLE/g)||[]).length >= 1 && /BEFORE UPDATE OR DELETE ON public\.gh_marketplace_refund_operations/.test(sql) && /BEFORE UPDATE OR DELETE ON public\.gh_marketplace_dispute_decisions/.test(sql)],
 ['release version is synchronized', /^\d+\.\d+\.\d+$/.test(pkg.version) && release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
]
let failed=0; for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++}
console.log(`\nPhase 25 operational workflow contracts: ${checks.length-failed}/${checks.length} passed`)
process.exit(failed?1:0)
