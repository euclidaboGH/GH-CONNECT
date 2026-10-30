/**
 * GET /api/admin/treasury/summary
 * Read-only operator snapshot for the current UTC quarter (or a bounded window).
 * Reports only evidence-backed cashback reconciliation and A2U exceptions. It does
 * not infer seller liabilities, GHC balances, or payout completion from missing data.
 */
import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { reconcileCashbackPeriod } from "@/lib/server/revenue/cashback-attribution"
import { listOpenA2uReviews, listStuckA2uJobs } from "@/lib/server/payments/a2u-orchestration"
import { getTreasuryFinancialReport, getMembershipReconciliationReport, listTreasuryCases } from "@/lib/server/revenue/treasury-operations"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const noStore = { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" }
function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStore })
}

function authorized(request: Request): boolean {
  const expectedRaw = String(
    process.env.GHC_OPERATOR_RECONCILE_KEY || process.env.GHC_ADMIN_API_KEY || process.env.GHC_A2U_ADMIN_KEY || "",
  ).trim()
  if (Buffer.byteLength(expectedRaw, "utf8") < 32) return false
  const expected = Buffer.from(expectedRaw, "utf8")
  const supplied = Buffer.from(String(request.headers.get("x-ghc-operator-key") || ""), "utf8")
  if (expected.length !== supplied.length) return false
  try { return timingSafeEqual(expected, supplied) } catch { return false }
}

function utcQuarterWindow(now: Date): { startsAt: string; endsAt: string } {
  const quarterMonth = Math.floor(now.getUTCMonth() / 3) * 3
  const startsAt = new Date(Date.UTC(now.getUTCFullYear(), quarterMonth, 1))
  const endsAt = new Date(Date.UTC(now.getUTCFullYear(), quarterMonth + 3, 1))
  return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() }
}

function parseWindow(url: URL): { startsAt: string; endsAt: string } | null {
  const startRaw = url.searchParams.get("startsAt")
  const endRaw = url.searchParams.get("endsAt")
  if (!startRaw && !endRaw) return utcQuarterWindow(new Date())
  if (!startRaw || !endRaw || startRaw.length > 40 || endRaw.length > 40) return null
  const startMs = Date.parse(startRaw)
  const endMs = Date.parse(endRaw)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null
  // Bound operator-supplied windows to 93 days; all reporting uses UTC timestamps.
  if (endMs - startMs > 93 * 24 * 60 * 60 * 1000) return null
  return { startsAt: new Date(startMs).toISOString(), endsAt: new Date(endMs).toISOString() }
}

export async function GET(request: Request) {
  if (!authorized(request)) return reply({ ok: false, error: "FORBIDDEN" }, 403)
  const url = new URL(request.url)
  const window = parseWindow(url)
  if (!window) return reply({ ok: false, error: "INVALID_REPORTING_WINDOW" }, 400)
  const olderThanMinutes = Math.min(24 * 60, Math.max(5, Number(url.searchParams.get("olderThanMinutes") || 30) || 30))

  const [cashback, reviews, stuck, financialReport, operatorCases, membershipReconciliation] = await Promise.all([
    reconcileCashbackPeriod(window),
    listOpenA2uReviews(50).catch(() => null),
    listStuckA2uJobs(olderThanMinutes).catch(() => null),
    getTreasuryFinancialReport(window.startsAt, window.endsAt).catch(() => null),
    listTreasuryCases(100).catch(() => null),
    getMembershipReconciliationReport(100).catch(() => null),
  ])

  const reviewItems = reviews?.ok === true && Array.isArray(reviews.items) ? reviews.items : null
  const stuckItems = stuck?.ok === true && Array.isArray(stuck.cashback) && Array.isArray(stuck.seller) ? stuck : null
  const caseItems = operatorCases?.ok === true && Array.isArray(operatorCases.items) ? operatorCases.items as Array<{ status?: string }> : null
  const openCaseCount = caseItems?.filter((item) => item.status === "open" || item.status === "investigating").length || 0
  const exceptionCount = (reviewItems?.length || 0)
    + (stuckItems?.cashback?.length || 0)
    + (stuckItems?.seller?.length || 0) + openCaseCount
  const cashbackHealthy = cashback.ok === true && cashback.liabilityCoverageOk !== false
  const exceptionsAvailable = reviewItems !== null && stuckItems !== null && operatorCases?.ok === true
  const status = !cashback.ok || !exceptionsAvailable || financialReport?.ok !== true
    ? "degraded"
    : (!cashbackHealthy || exceptionCount > 0 ? "attention" : "healthy")

  return reply({
    ok: true,
    generatedAt: new Date().toISOString(),
    status,
    reportingWindow: window,
    assets: {
      pi: {
        cashback: cashback.ok ? cashback : { ok: false, error: cashback.error || "CASHBACK_RECONCILIATION_UNAVAILABLE" },
      },
      ghc: { status: "not_included", reason: "GHC utility ledger is a separate asset and is not company PI revenue." },
    },
    financialReport: financialReport?.ok ? financialReport : { ok: false, error: "TREASURY_FINANCIAL_REPORT_UNAVAILABLE" },
    operatorCases: caseItems,
    communityMembershipReconciliation: membershipReconciliation?.ok === true ? membershipReconciliation : { ok: false, error: "MEMBERSHIP_RECONCILIATION_UNAVAILABLE" },
    exceptions: {
      available: exceptionsAvailable,
      openA2uReviews: reviewItems,
      stuckA2uJobs: stuckItems,
      count: exceptionsAvailable ? exceptionCount : null,
      openOperatorCases: caseItems ? openCaseCount : null,
    },
    coverage: {
      companyRevenueJournal: "cashback-eligible PI events only",
      cashbackLiabilityAndPayouts: cashback.ok ? "reconciled" : "unavailable",
      sellerPayables: financialReport?.ok ? "payout_requests_and_unallocated_completed_orders_reported; not_full_balance_sheet" : "unavailable",
      generalEarningsReservations: financialReport?.ok ? "pi_payout_reservations_and_settlements_reported" : "unavailable",
      bankSettlements: "not_included",
      ghcUtilityLedger: "separate_asset_not_included",
      communityMemberships: membershipReconciliation?.ok === true ? "completed_payment_intents_compared_with_canonical_entitlement_links;_read_only" : "unavailable",
    },
    controls: [
      "Read-only report; no payout, ledger, entitlement, or reservation mutations",
      "Financial aggregates come from service-role reporting RPCs; PI and GHC assets are not combined",
      "Operator case notes are durable audit metadata and do not override source payment evidence",
      "Missing source data is reported as unavailable, never as zero",
      "A2U requests are not considered paid without provider completion and receipt verification",
      "PI and GHC are reported as separate assets",
    ],
  })
}
