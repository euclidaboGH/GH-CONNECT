/** Pure membership renewal policy shared by server workflows and tests. */
import type { MembershipBillingPeriod } from "@/lib/membership-pricing"

export type MembershipProduct = {
  tier: "vip" | "vvip"
  billingPeriod: MembershipBillingPeriod
}

const ACCESS_MONTHS: Record<MembershipBillingPeriod, number> = {
  monthly: 2,
  four_months: 5,
  eight_months: 9,
  yearly: 13,
}

/** Only canonical catalog product IDs are accepted for a paid renewal. */
export function parseMembershipProductId(value: unknown): MembershipProduct | null {
  if (typeof value !== "string") return null
  const match = value.trim().toLowerCase().match(/^membership_(vip|vvip)_(monthly|four_months|eight_months|yearly)$/)
  if (!match) return null
  return {
    tier: match[1] as MembershipProduct["tier"],
    billingPeriod: match[2] as MembershipBillingPeriod,
  }
}

/**
 * Access duration includes the catalog's one bonus month. This is derived from
 * the verified product ID, never from a client-supplied duration.
 */
export function membershipAccessMonths(period: MembershipBillingPeriod): number {
  return ACCESS_MONTHS[period]
}

export function durationForBillingPeriod(period: MembershipBillingPeriod): string {
  return `${membershipAccessMonths(period)} months`
}

export const MEMBERSHIP_RENEWAL_CONTINUITY_GRACE_MS = 72 * 60 * 60 * 1000

/**
 * A 72-hour renewal-continuity window preserves the prepaid term boundary when
 * a verified renewal completes shortly after expiry. It does NOT preserve
 * premium access during the gap; entitlement parsing still expires at expiresAt.
 */
export function membershipRenewalStartAt(input: {
  tier: "free" | "vip" | "vvip"
  active: boolean
  expiresAt?: number
  now: number
  graceMs?: number
}): number {
  const expiry = input.expiresAt
  if (input.tier === "free" || input.active !== true || !Number.isFinite(expiry)) return input.now
  const graceMs = Math.max(0, Math.min(input.graceMs ?? MEMBERSHIP_RENEWAL_CONTINUITY_GRACE_MS, MEMBERSHIP_RENEWAL_CONTINUITY_GRACE_MS))
  if (Number(expiry) >= input.now - graceMs) return Number(expiry)
  return input.now
}


/** A membership grant must be backed by the exact completed Pi membership rail.
 * Missing provider/currency/purpose values are invalid, not legacy-compatible.
 */
export function isVerifiedPiMembershipIntent(intent: {
  provider?: unknown
  currency?: unknown
  purpose?: unknown
  status?: unknown
  providerPaymentId?: unknown
}): boolean {
  return intent.provider === "pi"
    && intent.currency === "PI"
    && intent.purpose === "membership"
    && typeof intent.providerPaymentId === "string"
    && intent.providerPaymentId.trim().length > 0
    && (intent.status === "COMPLETED" || intent.status === "FULFILLED")
}
