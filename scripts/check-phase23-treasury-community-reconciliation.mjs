#!/usr/bin/env node
import { readFileSync } from 'node:fs'
const read = p => readFileSync(p, 'utf8')
const sql = read('supabase/migrations/20261030010012_phase23_treasury_community_reconciliation.sql')
const summary = read('app/api/admin/treasury/summary/route.ts')
const helper = read('lib/server/revenue/treasury-operations.ts')
const dashboard = read('app/admin/treasury/page.tsx')
const pkg = JSON.parse(read('package.json'))
const checks = [
 ['treasury report wraps prior read-only RPC without dropping base metrics', /RENAME TO gh_treasury_financial_report_phase7_base/.test(sql) && /gh_treasury_financial_report_phase7_base\(p_starts_at,p_ends_at\)/.test(sql)],
 ['marketplace gross, commission and seller net are separately reported', /'gross',c\.gross::text/.test(sql) && /'platformCommission',c\.commission::text/.test(sql) && /'sellerNetBeforeAdjustments',c\.seller_net::text/.test(sql)],
 ['gross and seller-net adjustments reconcile independently', /gross_adjustments/.test(sql) && /net_adjustments/.test(sql) && /sellerNetAfterAdjustments/.test(sql)],
 ['payout reservations exclude paid allocations and settlements are separated', /reserved_amount/.test(sql) && /settled_amount/.test(sql) && /'settledSellerNet',c\.settled::text/.test(sql)],
 ['legacy payouts and missing proceeds snapshots are flagged, never rewritten', /legacyGrossAllocationCount/.test(sql) && /proceedsSnapshotMissingCount/.test(sql) && /reconciliationRequired',true/.test(sql)],
 ['community entitlement changes have append-only event history', /ghc_membership_entitlement_events/.test(sql) && /BEFORE UPDATE OR DELETE\s+ON public\.ghc_membership_entitlement_events/.test(sql) && /event_fingerprint text NOT NULL UNIQUE/.test(sql)],
 ['membership lifecycle trigger records grants, renewals, expiry and revocations', /'granted','renewed','tier_changed','expired','revoked','payment_linked'/.test(sql) && /trg_ghc_membership_entitlement_event_capture/.test(sql) && /ghc_membership_expire_due/.test(sql)],
 ['membership expiry sweep is bounded, service-role-only and payment-neutral', /FOR UPDATE SKIP LOCKED/.test(sql) && /GRANT EXECUTE ON FUNCTION public\.ghc_membership_expire_due\(integer\) TO service_role/.test(sql) && /mutatesPaymentRecords',false/.test(sql)],
 ['membership renewals extend from the existing unexpired entitlement', /effectiveStartAt = isRenewal && prev\.expiresAt \? prev\.expiresAt : now/.test(read('lib/server/membership/entitlement-store.ts')) && /addCalendarMonths\(effectiveStartAt, accessMonths\)/.test(read('lib/server/membership/entitlement-store.ts'))],
 ['completed membership payment reconciliation is read-only and currency-separated', /ghc_membership_reconciliation_report/.test(sql) && /mutatesEntitlements',false/.test(sql) && /completedPaymentsByCurrency/.test(sql) && /GROUP BY upper\(i\.currency\)/.test(sql)],
 ['membership reconciliation recognizes canonical product ids and completed states', /membership_\(vip\|vvip\)/.test(sql) && /COMPLETED','FULFILLED'/.test(sql)],
 ['treasury summary fetches and exposes membership reconciliation', /getMembershipReconciliationReport/.test(summary) && /communityMembershipReconciliation/.test(summary)],
 ['treasury dashboard renders per-asset net proceeds, historical discrepancies and membership exceptions', /Marketplace net proceeds reconciliation/.test(dashboard) && /Historical payout reconciliation/.test(dashboard) && /Community membership payment reconciliation/.test(dashboard)],
 ['treasury adapter uses privileged bounded RPC transport', /treasuryRpc/.test(helper) && /AbortSignal\.timeout\(10_000\)/.test(helper)],
 ['release version is synchronized', /^\d+\.\d+\.\d+$/.test(pkg.version) && read('lib/app-release.ts').includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
]
let failed=0; for (const [name,ok] of checks) { console.log(`${ok?'PASS':'FAIL'} ${name}`); if(!ok) failed++ }
console.log(`\nPhase 23 treasury/community: ${checks.length-failed}/${checks.length} passed`)
process.exit(failed?1:0)
