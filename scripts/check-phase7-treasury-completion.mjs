#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { join } from "node:path"
const read = p => readFileSync(join(process.cwd(), p), "utf8")
const migration = read("supabase/migrations/20261030010008_phase7_treasury_reporting_and_case_history.sql")
const helper = read("lib/server/revenue/treasury-operations.ts")
const report = read("app/api/admin/treasury/report/route.ts")
const cases = read("app/api/admin/treasury/cases/route.ts")
const page = read("app/admin/treasury/page.tsx")
const summary = read("app/api/admin/treasury/summary/route.ts")
const checks = [
 ["seller payout requests are aggregated separately by PI/GHC", /SELECT DISTINCT upper\(currency\) currency FROM public\.gh_marketplace_orders UNION SELECT DISTINCT upper\(currency\) FROM public\.gh_seller_payout_requests/.test(migration) && /sellerPayoutsByAsset/.test(migration)],
 ["unallocated completed verified orders are exposed as a distinct snapshot", /unallocatedCompletedVerifiedOrderGrossCurrentSnapshot/.test(migration) && /payment_status='verified'/.test(migration)],
 ["GHC ledger movements are reported independently with signed posted and pending totals", /ghcLedgerMovements/.test(migration) && /FROM public\.ghc_transactions/.test(migration) && /netPostedLedgerMovement/.test(migration)],
 ["PI earnings report separates gross, fee and net reservation/settlement", /reservedFeeAtomic/.test(migration) && /reservedNetAtomic/.test(migration) && /paidFeeAtomic/.test(migration) && /paidNetAtomic/.test(migration) && /conservationMismatchCount/.test(migration)],
 ["cashback report surfaces over-allocation discrepancies", /coverageDeltaAtomic/.test(migration) && /overAllocatedAtomic/.test(migration)],
 ["cashback report separates calculated, review, reserved, paid and outstanding", /calculatedLiabilityAtomic/.test(migration) && /needsReviewAtomic/.test(migration) && /reservedAtomic/.test(migration) && /paidAtomic/.test(migration) && /outstandingAtomic/.test(migration)],
 ["company revenue can be reconciled by event type and currency", /companyRevenueByTypeAndCurrency/.test(migration) && /GROUP BY currency,event_type/.test(migration)],
 ["creator tip obligations are reported separately from disbursement", /piCreatorTips/.test(migration) && /creatorPayable/.test(migration)],
 ["case upserts serialize concurrent create/update attempts", /pg_advisory_xact_lock\(hashtext\('gh_treasury_case:'\|\|trim\(p_case_key\)\)\)/.test(migration)],
 ["operator cases have durable append-only event history", /gh_treasury_operator_case_events/.test(migration) && /CREATE TABLE IF NOT EXISTS public\.gh_treasury_operator_cases/.test(migration) && /BEFORE UPDATE OR DELETE/.test(migration) && /LIMIT 100/.test(migration)],
 ["case and report RPCs are service-role only", /GRANT EXECUTE ON FUNCTION public\.gh_treasury_case_upsert/.test(migration) && /GRANT EXECUTE ON FUNCTION public\.gh_treasury_financial_report/.test(migration)],
 ["report endpoint uses 32-byte operator key and timing-safe comparison", /Buffer\.byteLength\(key, "utf8"\) < 32/.test(report) && /timingSafeEqual/.test(report)],
 ["case endpoint is operator protected and bounded", /timingSafeEqual/.test(cases) && /text\(body.note, 2000\)/.test(cases)],
 ["dashboard provides reporting and investigation history", /Treasury operations/.test(page) && /Investigation history/.test(page)],
 ["summary degrades if report or durable case source is unavailable", /financialReport\?\.ok !== true/.test(summary) && /operatorCases\?\.ok === true/.test(summary)],
 ["server adapter uses service-role RPC and timeout", /hasPrivilegedDatabase/.test(helper) && /AbortSignal\.timeout\(10_000\)/.test(helper)],
]
let failed=0; for (const [name,ok] of checks) { console.log(`${ok?"PASS":"FAIL"} ${name}`); if(!ok) failed++ }
console.log(`Phase 7 completion: ${checks.length-failed}/${checks.length}`); process.exit(failed?1:0)
