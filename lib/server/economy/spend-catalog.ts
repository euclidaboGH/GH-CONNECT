/**
 * Server-side spend catalog — client cannot invent prices.
 * Phase 2: expanded GHC utility sinks + transparent public projection.
 */

import { BOOST_FEE_RATE, VIP_PRICE_GHC, VVIP_PRICE_GHC } from "./economic-config"
import { getMembershipGhcPrice } from "@/lib/membership-pricing"

export type SpendPurpose =
  | "boost"
  | "boost_post"
  | "boost_profile"
  | "boost_listing"
  | "feed_spotlight"
  | "community_tools_month"
  | "creator_studio_day"
  | "membership_vip_monthly"
  | "membership_vvip_monthly"
  | "membership_vip_four_months"
  | "membership_vvip_four_months"
  | "membership_vip_eight_months"
  | "membership_vvip_eight_months"
  | "membership_vip_yearly"
  | "membership_vvip_yearly"
  | "marketplace"
  | "other_capped"

export type SpendCatalogEntry = {
  purpose: SpendPurpose
  amountGhc: number
  /** Optional independent π price for dual-rail (not an FX conversion) */
  amountPi?: number
  baseGhc?: number
  feeGhc?: number
  maxAmountGhc?: number
  description: string
  category: "boost" | "membership" | "tools" | "marketplace"
  /** Hours of effect when applicable */
  durationHours?: number
}

function withFee(base: number): { baseGhc: number; feeGhc: number; amountGhc: number } {
  const feeGhc = Math.round(base * BOOST_FEE_RATE * 10000) / 10000
  return { baseGhc: base, feeGhc, amountGhc: Math.round((base + feeGhc) * 10000) / 10000 }
}

const postBoost = withFee(10)
const profileBoost = withFee(15)
const listingBoost = withFee(12)
const spotlight = withFee(25)

/** Fixed-price purposes (exact match required) */
const FIXED: Record<string, SpendCatalogEntry> = {
  boost: {
    purpose: "boost",
    ...postBoost,
    amountPi: 0.15,
    description: "Generic boost (legacy) — profile or post visibility",
    category: "boost",
    durationHours: 24,
  },
  boost_post: {
    purpose: "boost_post",
    ...postBoost,
    amountPi: 0.15,
    description: "Post boost — 24h ranking preference on your content",
    category: "boost",
    durationHours: 24,
  },
  boost_profile: {
    purpose: "boost_profile",
    ...profileBoost,
    amountPi: 0.22,
    description: "Profile boost — 24h discovery emphasis",
    category: "boost",
    durationHours: 24,
  },
  boost_listing: {
    purpose: "boost_listing",
    ...listingBoost,
    amountPi: 0.18,
    description: "Marketplace listing boost — 48h placement preference",
    category: "boost",
    durationHours: 48,
  },
  feed_spotlight: {
    purpose: "feed_spotlight",
    ...spotlight,
    amountPi: 0.35,
    description: "Feed spotlight — 12h featured placement window",
    category: "boost",
    durationHours: 12,
  },
  community_tools_month: {
    purpose: "community_tools_month",
    amountGhc: 40,
    amountPi: 0.5,
    description: "Community premium tools — 30 days (announcements, events tools)",
    category: "tools",
    durationHours: 24 * 30,
  },
  creator_studio_day: {
    purpose: "creator_studio_day",
    amountGhc: 8,
    amountPi: 0.1,
    description: "Creator studio day pass — insights & draft tools",
    category: "tools",
    durationHours: 24,
  },
  membership_vip_monthly: {
    purpose: "membership_vip_monthly",
    amountGhc: VIP_PRICE_GHC,
    description: "VIP monthly (GHC rail)",
    category: "membership",
  },
  membership_vvip_monthly: {
    purpose: "membership_vvip_monthly",
    amountGhc: VVIP_PRICE_GHC,
    description: "VVIP monthly (GHC rail)",
    category: "membership",
  },
  membership_vip_four_months: {
    purpose: "membership_vip_four_months",
    amountGhc: getMembershipGhcPrice("vip", 4).chargeGhc,
    description: "VIP 4-month subscription (GHC rail)",
    category: "membership",
  },
  membership_vvip_four_months: {
    purpose: "membership_vvip_four_months",
    amountGhc: getMembershipGhcPrice("vvip", 4).chargeGhc,
    description: "VVIP 4-month subscription (GHC rail)",
    category: "membership",
  },
  membership_vip_eight_months: {
    purpose: "membership_vip_eight_months",
    amountGhc: getMembershipGhcPrice("vip", 8).chargeGhc,
    description: "VIP 8-month subscription (GHC rail)",
    category: "membership",
  },
  membership_vvip_eight_months: {
    purpose: "membership_vvip_eight_months",
    amountGhc: getMembershipGhcPrice("vvip", 8).chargeGhc,
    description: "VVIP 8-month subscription (GHC rail)",
    category: "membership",
  },
  membership_vip_yearly: {
    purpose: "membership_vip_yearly",
    amountGhc: getMembershipGhcPrice("vip", 12).chargeGhc,
    description: "VIP yearly (GHC rail)",
    category: "membership",
  },
  membership_vvip_yearly: {
    purpose: "membership_vvip_yearly",
    amountGhc: getMembershipGhcPrice("vvip", 12).chargeGhc,
    description: "VVIP yearly (GHC rail)",
    category: "membership",
  },
}

export function listPublicSpendCatalog(): Array<{
  purpose: SpendPurpose
  amountGhc: number
  amountPi?: number
  baseGhc?: number
  feeGhc?: number
  description: string
  category: SpendCatalogEntry["category"]
  durationHours?: number
}> {
  return Object.values(FIXED).map((entry) => ({
    purpose: entry.purpose,
    amountGhc: entry.amountGhc,
    ...(entry.amountPi === undefined ? {} : { amountPi: entry.amountPi }),
    ...(entry.baseGhc === undefined ? {} : { baseGhc: entry.baseGhc }),
    ...(entry.feeGhc === undefined ? {} : { feeGhc: entry.feeGhc }),
    description: entry.description,
    category: entry.category,
    ...(entry.durationHours === undefined ? {} : { durationHours: entry.durationHours }),
  }))
}

export function getCatalogEntry(purposeRaw: string): SpendCatalogEntry | null {
  const purpose = String(purposeRaw || "").trim().toLowerCase()
  return FIXED[purpose] || null
}

/**
 * Resolve authoritative spend amount.
 * Returns error if purpose unknown or client amount mismatches fixed catalog.
 */
export function resolveSpendAmount(
  purposeRaw: string,
  clientAmount: number
): { ok: true; entry: SpendCatalogEntry; amount: number } | { ok: false; error: string } {
  const purpose = String(purposeRaw || "").trim().toLowerCase()
  if (!purpose) {
    return { ok: false, error: "PURPOSE_REQUIRED" }
  }

  const fixed = FIXED[purpose]
  if (fixed) {
    if (
      Number.isFinite(clientAmount) &&
      clientAmount > 0 &&
      Math.abs(clientAmount - fixed.amountGhc) > 0.0001
    ) {
      return { ok: false, error: "AMOUNT_MISMATCH" }
    }
    return { ok: true, entry: fixed, amount: fixed.amountGhc }
  }

  if (purpose === "marketplace") {
    return { ok: false, error: "MARKETPLACE_REQUIRES_ORDER" }
  }

  if (purpose === "other" || purpose === "other_capped") {
    return { ok: false, error: "PURPOSE_REQUIRES_AUTHORITY" }
  }

  return { ok: false, error: "UNKNOWN_PURPOSE" }
}

/** Utility sinks only (excludes membership long plans for compact UI) */
export function listUtilitySinks() {
  return listPublicSpendCatalog().filter((e) => e.category === "boost" || e.category === "tools")
}
