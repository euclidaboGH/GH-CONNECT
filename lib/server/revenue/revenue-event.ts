/**
 * Server-only adapter for the append-only company revenue journal.
 * Call only after a provider/payment integration has independently verified settlement.
 * GHC utility ledger movements are not company revenue evidence.
 */
import { readGhcServerEnv } from "@/lib/server/economy/env"

export type CompanyRevenueEventType =
  | "marketplace_fee"
  | "membership_revenue"
  | "promotion_revenue"
  | "digital_service_revenue"
  | "creator_tip_revenue"
  | "refund"
  | "chargeback"
  | "adjustment"

export type CompanyRevenueProvider = "pi" | "paystack" | "manual" | "other"

export interface CompanyRevenueEventInput {
  idempotencyKey: string
  sourceProvider: CompanyRevenueProvider
  sourceEventId: string
  eventType: CompanyRevenueEventType
  currency: string
  grossAmountMinor: number
  companyRevenueMinor: number
  providerFeeMinor?: number
  taxMinor?: number
  sourceReference: string
  verifiedAt: string
  /** Canonical GreenHaven account ID from trusted server-side payment ownership. */
  payingUserId?: string
  /** Original verified PI source event for an eligible refund/chargeback. */
  relatedSourceEventId?: string
  /** Explicitly set only for finance-approved, verified PI revenue/refund events. */
  cashbackEligible?: boolean
  metadata?: Record<string, unknown>
}

export type CompanyRevenueAppendResult = {
  ok: boolean
  duplicate?: boolean
  eventId?: string
  error?: string
}

function boundedText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

const SAFE_METADATA_KEYS = new Set([
  "order_id",
  "payment_intent_id",
  "invoice_id",
  "product_id",
  "plan_id",
  "region",
  "provider_reference_hash",
])

function safeMetadata(value: Record<string, unknown> | undefined): Record<string, string> {
  const result: Record<string, string> = {}
  if (!value || typeof value !== "object" || Array.isArray(value)) return result
  for (const [key, raw] of Object.entries(value)) {
    if (!SAFE_METADATA_KEYS.has(key) || typeof raw !== "string") continue
    const clean = raw.trim().slice(0, 160)
    if (clean) result[key] = clean
  }
  return result
}

const REVENUE_EVENT_TYPES = new Set<CompanyRevenueEventType>([
  "marketplace_fee",
  "membership_revenue",
  "promotion_revenue",
  "digital_service_revenue",
  "creator_tip_revenue",
  "refund",
  "chargeback",
  "adjustment",
])
const REVENUE_PROVIDERS = new Set<CompanyRevenueProvider>(["pi", "paystack", "manual", "other"])

export function validateCompanyRevenueEvent(input: CompanyRevenueEventInput): string | null {
  // Runtime callers can bypass TypeScript; treat the adapter boundary as untrusted.
  if (!input || typeof input !== "object" || Array.isArray(input)) return "INVALID_REVENUE_EVENT"
  if (!REVENUE_EVENT_TYPES.has(input.eventType)) return "INVALID_EVENT_TYPE"
  if (!REVENUE_PROVIDERS.has(input.sourceProvider)) return "INVALID_PROVIDER"
  if (!boundedText(input.idempotencyKey, 200) || input.idempotencyKey.trim().length > 200) return "INVALID_IDEMPOTENCY_KEY"
  if (!boundedText(input.sourceEventId, 240) || input.sourceEventId.trim().length > 240) return "INVALID_SOURCE_EVENT_ID"
  if (!boundedText(input.sourceReference, 500) || input.sourceReference.trim().length > 500) return "INVALID_SOURCE_REFERENCE"
  if (typeof input.currency !== "string" || !/^[A-Z]{3}$/.test(input.currency.toUpperCase())) return "INVALID_CURRENCY"
  if (![input.grossAmountMinor, input.companyRevenueMinor, input.providerFeeMinor ?? 0, input.taxMinor ?? 0].every(Number.isSafeInteger)) return "AMOUNTS_MUST_BE_SAFE_INTEGER_MINOR_UNITS"
  const values = [input.grossAmountMinor, input.companyRevenueMinor, input.providerFeeMinor ?? 0, input.taxMinor ?? 0]
  if (values.every((value) => value === 0)) return "ZERO_VALUE_EVENT"
  if (!(["refund", "chargeback", "adjustment"] as CompanyRevenueEventType[]).includes(input.eventType) && ((input.providerFeeMinor ?? 0) < 0 || (input.taxMinor ?? 0) < 0)) return "INVALID_REVENUE_COSTS"
  if ((input.eventType === "refund" || input.eventType === "chargeback") && (input.grossAmountMinor > 0 || input.companyRevenueMinor > 0)) return "REVENUE_DIRECTION_MISMATCH"
  if (!(["refund", "chargeback", "adjustment"].includes(input.eventType)) && (input.grossAmountMinor < 0 || input.companyRevenueMinor < 0)) return "REVENUE_DIRECTION_MISMATCH"
  const payingUserId = typeof input.payingUserId === "string" ? input.payingUserId.trim() : ""
  if (input.cashbackEligible === true && (!payingUserId || input.sourceProvider !== "pi" || input.currency.toUpperCase() !== "PI")) return "CASHBACK_ATTRIBUTION_REQUIRED"
  if (payingUserId.length > 160) return "INVALID_PAYING_USER_ID"
  if (input.relatedSourceEventId !== undefined && (typeof input.relatedSourceEventId !== "string" || input.relatedSourceEventId.trim().length < 1 || input.relatedSourceEventId.trim().length > 240)) return "INVALID_RELATED_SOURCE_EVENT_ID"
  if (input.cashbackEligible === true && ["refund", "chargeback"].includes(input.eventType) && !input.relatedSourceEventId?.trim()) return "CASHBACK_COMPENSATION_SOURCE_REQUIRED"
  if (input.cashbackEligible !== undefined && typeof input.cashbackEligible !== "boolean") return "INVALID_CASHBACK_ELIGIBILITY"
  const verifiedAt = Date.parse(input.verifiedAt)
  if (!Number.isFinite(verifiedAt) || verifiedAt > Date.now() + 5 * 60_000) return "VERIFIED_SOURCE_REQUIRED"
  return null
}

export async function appendVerifiedCompanyRevenueEvent(
  input: CompanyRevenueEventInput
): Promise<CompanyRevenueAppendResult> {
  const invalid = validateCompanyRevenueEvent(input)
  if (invalid) return { ok: false, error: invalid }

  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return { ok: false, error: "REVENUE_STORE_UNAVAILABLE" }

  try {
    const baseUrl = env.supabaseUrl.endsWith("/") ? env.supabaseUrl.slice(0, -1) : env.supabaseUrl
    const hasAttribution = Boolean(input.payingUserId?.trim()) || input.cashbackEligible === true || Boolean(input.relatedSourceEventId?.trim())
    if (input.cashbackEligible === true && !input.payingUserId?.trim()) return { ok: false, error: "CASHBACK_ATTRIBUTION_REQUIRED" }
    const endpoint = `${baseUrl}/rest/v1/rpc/${hasAttribution ? "gh_company_revenue_event_append_attributed" : "gh_company_revenue_event_append"}`
    const body = JSON.stringify({
      p_idempotency_key: input.idempotencyKey.trim(),
      p_source_provider: input.sourceProvider,
      p_source_event_id: input.sourceEventId.trim(),
      p_event_type: input.eventType,
      p_currency: input.currency.toUpperCase(),
      p_gross_amount_minor: input.grossAmountMinor,
      p_company_revenue_minor: input.companyRevenueMinor,
      p_provider_fee_minor: input.providerFeeMinor ?? 0,
      p_tax_minor: input.taxMinor ?? 0,
      p_source_reference: input.sourceReference.trim(),
      p_verified_at: input.verifiedAt,
      ...(hasAttribution ? { p_paying_user_id: input.payingUserId?.trim() || null, p_related_source_event_id: input.relatedSourceEventId?.trim() || null, p_cashback_eligible: input.cashbackEligible === true } : {}),
      p_metadata: safeMetadata(input.metadata),
    })

    // A unique-key race can occur when two workers record the same verified event
    // concurrently. Retry once so the RPC can return the canonical idempotent row.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.supabaseServiceRoleKey,
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        },
        body,
        cache: "no-store",
        // Bound upstream latency so reconciliation can fail visibly and be retried;
        // do not leave a serverless payment request hanging indefinitely.
        signal: AbortSignal.timeout(5_000),
      })
      const data = await response.json().catch(() => null) as CompanyRevenueAppendResult | null
      if (response.ok && data?.ok === true) {
        return { ok: true, duplicate: Boolean(data.duplicate), eventId: boundedText(data.eventId, 80) || undefined }
      }
      const error = boundedText(data?.error, 120)
      if (attempt === 0 && error === "REVENUE_CONCURRENT_RETRY") continue
      return { ok: false, error: error || `REVENUE_APPEND_HTTP_${response.status}` }
    }
    return { ok: false, error: "REVENUE_APPEND_UNAVAILABLE" }
  } catch {
    return { ok: false, error: "REVENUE_APPEND_UNAVAILABLE" }
  }
}
