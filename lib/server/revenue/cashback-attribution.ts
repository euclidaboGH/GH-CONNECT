/**
 * Phase 5 — Cashback attribution helpers and reconciliation.
 * Only verified PI company revenue with explicit eligibility enters cashback.
 * Never trusts client amounts. Refunds/chargebacks require related source events.
 */
import {
  appendVerifiedCompanyRevenueEvent,
  type CompanyRevenueEventType,
  type CompanyRevenueAppendResult,
} from "@/lib/server/revenue/revenue-event"
import { readGhcServerEnv, hasPrivilegedDatabase } from "@/lib/server/economy/env"

/** Explicitly supported cashback revenue sources (Phase 5). */
/**
 * Only sources with a verified, authenticated payer + company-revenue producer
 * are eligible today. Do not advertise planned source types as eligible: doing
 * so would create cashback liabilities without a complete settlement/refund path.
 */
export const CASHBACK_SUPPORTED_SOURCES: readonly CompanyRevenueEventType[] = [
  "marketplace_fee",
] as const

/** Explicitly not eligible until their provider settlement and compensation paths are wired. */
export const CASHBACK_PENDING_SOURCES: readonly CompanyRevenueEventType[] = [
  "membership_revenue",
  "promotion_revenue",
  "digital_service_revenue",
  "creator_tip_revenue",
  "refund",
  "chargeback",
] as const

export const CASHBACK_RATE_BPS = 50

export function isCashbackSupportedSource(eventType: string): boolean {
  return (CASHBACK_SUPPORTED_SOURCES as readonly string[]).includes(eventType)
}

export type AttributeCashbackRevenueInput = {
  idempotencyKey: string
  sourceEventId: string
  eventType: Exclude<CompanyRevenueEventType, "adjustment">
  /** Integer minor units (for PI: atomic * scale alignment — callers use consistent minor units) */
  grossAmountMinor: number
  companyRevenueMinor: number
  providerFeeMinor?: number
  taxMinor?: number
  sourceReference: string
  verifiedAt: string
  payingUserId: string
  relatedSourceEventId?: string
  metadata?: Record<string, unknown>
}

/**
 * Attribute a verified PI revenue/compensation event as cashback-eligible.
 * Rejects unsupported types and missing payer identity.
 */
export async function attributeCashbackEligibleRevenue(
  input: AttributeCashbackRevenueInput,
): Promise<CompanyRevenueAppendResult> {
  if (!isCashbackSupportedSource(input.eventType)) {
    return { ok: false, error: "UNSUPPORTED_CASHBACK_SOURCE" }
  }
  if (!String(input.payingUserId || "").trim()) {
    return { ok: false, error: "PAYING_USER_REQUIRED" }
  }
  if (
    (input.eventType === "refund" || input.eventType === "chargeback") &&
    !String(input.relatedSourceEventId || "").trim()
  ) {
    return { ok: false, error: "RELATED_SOURCE_REQUIRED_FOR_COMPENSATION" }
  }

  return appendVerifiedCompanyRevenueEvent({
    idempotencyKey: input.idempotencyKey,
    sourceProvider: "pi",
    sourceEventId: input.sourceEventId,
    eventType: input.eventType,
    currency: "PI",
    grossAmountMinor: input.grossAmountMinor,
    companyRevenueMinor: input.companyRevenueMinor,
    providerFeeMinor: input.providerFeeMinor ?? 0,
    taxMinor: input.taxMinor ?? 0,
    sourceReference: input.sourceReference,
    verifiedAt: input.verifiedAt,
    payingUserId: input.payingUserId,
    relatedSourceEventId: input.relatedSourceEventId,
    cashbackEligible: true,
    metadata: {
      ...(input.metadata || {}),
      cashbackPolicyVersion: "phase5-v1",
      cashbackRateBps: CASHBACK_RATE_BPS, cashbackCadence: "quarterly",
    },
  })
}

export type CashbackReconcileReport = {
  ok: boolean
  error?: string
  bySource?: unknown
  eligibleNetRevenueAtomic?: number | string
  expectedCashbackLiabilityAtomic?: number | string
  periodClosed?: boolean
  periodId?: string
  payoutReservedAtomic?: number | string
  payoutPaidAtomic?: number | string
  liabilityCoverageOk?: boolean
  supportedSources?: string[]
}

export async function reconcileCashbackPeriod(input: {
  startsAt: string
  endsAt: string
}): Promise<CashbackReconcileReport> {
  if (!hasPrivilegedDatabase()) return { ok: false, error: "DATABASE_UNAVAILABLE" }
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { ok: false, error: "DATABASE_UNAVAILABLE" }
  }
  try {
    const response = await fetch(
      `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/gh_pi_cashback_reconcile_period`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.supabaseServiceRoleKey,
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        },
        body: JSON.stringify({
          p_starts_at: input.startsAt,
          p_ends_at: input.endsAt,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      },
    )
    const result = (await response.json().catch(() => null)) as CashbackReconcileReport | null
    if (!response.ok || !result) return { ok: false, error: `HTTP_${response.status}` }
    return result
  } catch {
    return { ok: false, error: "RECONCILE_UNAVAILABLE" }
  }
}

export function getCashbackAttributionPolicy() {
  return {
    rateBps: CASHBACK_RATE_BPS,
    ratePercent: 0.5,
    cadence: "quarterly",
    base: "eligible_user_pi_spend",
    currency: "PI",
    provider: "pi",
    supportedSources: [...CASHBACK_SUPPORTED_SOURCES],
    pendingSources: [...CASHBACK_PENDING_SOURCES],
    rules: [
      "cashback_eligible defaults false; only trusted server integrations may set true",
      "paying_user_id required for eligible events",
      "only marketplace_fee is currently source-enabled; other categories are pending audited settlement wiring",
      "refund/chargeback are excluded until an authenticated original-event compensation producer is deployed",
      "period close is quarterly (UTC) with 7-day reconciliation grace",
      "0.5% of eligible PI user spend; withdrawable only after quarterly entitlement + A2U path",
    ],
  }
}
