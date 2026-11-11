/**
 * Server-owned Phase 5 business monetization catalog.
 * This is a read-only offer registry, not checkout or payment authorization.
 * Pricing and paid activation remain unavailable until finance/product approval,
 * provider verification, and atomic revenue-event integration are complete.
 */
export type BusinessOfferId =
  | "business_profile_plus"
  | "promoted_listing"
  | "promoted_post"
  | "business_insights"

export type BusinessOffer = {
  id: BusinessOfferId
  name: string
  description: string
  delivery: "profile_entitlement" | "time_bounded_promotion" | "analytics_entitlement"
  pricingStatus: "approval_required"
  currency: "NGN"
  priceMinor: null
  purchasable: false
  requiresBusinessVerification: boolean
}

const OFFERS: readonly BusinessOffer[] = [
  {
    id: "business_profile_plus",
    name: "Business Profile Plus",
    description: "Enhanced business profile presentation and verified business details, subject to eligibility review.",
    delivery: "profile_entitlement",
    pricingStatus: "approval_required",
    currency: "NGN",
    priceMinor: null,
    purchasable: false,
    requiresBusinessVerification: true,
  },
  {
    id: "promoted_listing",
    name: "Promoted Listing",
    description: "Time-limited discovery placement for an eligible marketplace listing; placement is not guaranteed to produce sales.",
    delivery: "time_bounded_promotion",
    pricingStatus: "approval_required",
    currency: "NGN",
    priceMinor: null,
    purchasable: false,
    requiresBusinessVerification: true,
  },
  {
    id: "promoted_post",
    name: "Promoted Post",
    description: "Time-limited distribution for eligible business content, subject to moderation and advertising policy.",
    delivery: "time_bounded_promotion",
    pricingStatus: "approval_required",
    currency: "NGN",
    priceMinor: null,
    purchasable: false,
    requiresBusinessVerification: true,
  },
  {
    id: "business_insights",
    name: "Business Insights",
    description: "Aggregated performance reporting for eligible business profiles and listings; no sale of private user data.",
    delivery: "analytics_entitlement",
    pricingStatus: "approval_required",
    currency: "NGN",
    priceMinor: null,
    purchasable: false,
    requiresBusinessVerification: true,
  },
] as const

export function listBusinessMonetizationOffers(): readonly BusinessOffer[] {
  return OFFERS.map((offer) => ({ ...offer }))
}

export function getBusinessMonetizationPolicy() {
  return {
    version: "1",
    status: "pilot_preparation" as const,
    checkoutEnabled: false as const,
    paidEntitlementActivationEnabled: false as const,
    companyRevenueJournalConnected: false as const,
    offers: listBusinessMonetizationOffers(),
    disclosures: [
      "No offer can currently be purchased or activated through this catalog.",
      "Prices require explicit product and finance approval; no price or revenue is implied by this preview.",
      "Any future charge must be verified by its payment provider before entitlement activation.",
      "GHC utility balances are not payment-provider settlement evidence and cannot be used to bypass checkout controls.",
      "Promotional placement remains subject to moderation, eligibility, and clearly labelled sponsored-content rules.",
    ],
    releaseGates: [
      "Approve package scope, pricing, currency, tax treatment, refund and cancellation rules.",
      "Implement provider-verified payment intents and idempotent settlement handling.",
      "Connect settlement to the company revenue journal atomically or through a durable transactional outbox.",
      "Implement durable business entitlements, expiry, renewal and revocation rules.",
      "Verify ownership/roles, RLS, abuse limits, refunds, chargebacks and two-account Testnet flows.",
    ],
  }
}
