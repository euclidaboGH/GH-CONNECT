/**
 * Server-side spend catalog — client cannot invent VIP/boost prices.
 * ECONOMY_VERSION 1.2 locked prices.
 */

import { BOOST_FEE_RATE, VIP_PRICE_GHC, VVIP_PRICE_GHC } from "./economic-config"

export type SpendPurpose =
  | "boost"
  | "membership_vip_monthly"
  | "membership_vvip_monthly"
  | "membership_vip_yearly"
  | "membership_vvip_yearly"
  | "marketplace"
  | "other_capped"

export type SpendCatalogEntry = {
  purpose: SpendPurpose
  /** Fixed GHC amount charged (includes fee when applicable) */
  amountGhc: number
  baseGhc?: number
  feeGhc?: number
  maxAmountGhc?: number
  description: string
}

const BOOST_BASE = 10
const BOOST_FEE = Math.round(BOOST_BASE * BOOST_FEE_RATE * 10000) / 10000
const BOOST_TOTAL = BOOST_BASE + BOOST_FEE

/** Fixed-price purposes (exact match required) */
const FIXED: Record<string, SpendCatalogEntry> = {
  boost: {
    purpose: "boost",
    amountGhc: BOOST_TOTAL,
    baseGhc: BOOST_BASE,
    feeGhc: BOOST_FEE,
    description: "Profile/post boost (base + 10% fee)",
  },
  membership_vip_monthly: {
    purpose: "membership_vip_monthly",
    amountGhc: VIP_PRICE_GHC,
    description: "VIP monthly (GHC rail)",
  },
  membership_vvip_monthly: {
    purpose: "membership_vvip_monthly",
    amountGhc: VVIP_PRICE_GHC,
    description: "VVIP monthly (GHC rail)",
  },
  membership_vip_yearly: {
    purpose: "membership_vip_yearly",
    amountGhc: VIP_PRICE_GHC * 10, // yearly package if used; adjust only via economic version
    description: "VIP yearly (GHC rail)",
  },
  membership_vvip_yearly: {
    purpose: "membership_vvip_yearly",
    amountGhc: VVIP_PRICE_GHC * 10,
    description: "VVIP yearly (GHC rail)",
  },
}

/** Marketplace / other: client may propose amount but hard-capped */
const MARKETPLACE_MAX = 5_000
const OTHER_MAX = 100

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
    // Ignore client amount for fixed purposes; optionally reject gross mismatch
    if (
      Number.isFinite(clientAmount) &&
      clientAmount > 0 &&
      Math.abs(clientAmount - fixed.amountGhc) > 0.0001
    ) {
      return { ok: false, error: "AMOUNT_mismatch" }
    }
    return { ok: true, entry: fixed, amount: fixed.amountGhc }
  }

  if (purpose === "marketplace") {
    if (!Number.isFinite(clientAmount) || clientAmount <= 0) {
      return { ok: false, error: "INVALID_AMOUNT" }
    }
    if (clientAmount > MARKETPLACE_MAX) {
      return { ok: false, error: "AMOUNT_EXCEEDS_CAP" }
    }
    return {
      ok: true,
      entry: {
        purpose: "marketplace",
        amountGhc: clientAmount,
        maxAmountGhc: MARKETPLACE_MAX,
        description: "Marketplace purchase",
      },
      amount: clientAmount,
    }
  }

  // Reject free-form "other" large spends — force catalog purposes
  if (purpose === "other" || purpose === "other_capped") {
    if (!Number.isFinite(clientAmount) || clientAmount <= 0) {
      return { ok: false, error: "INVALID_AMOUNT" }
    }
    if (clientAmount > OTHER_MAX) {
      return { ok: false, error: "AMOUNT_EXCEEDS_CAP" }
    }
    return {
      ok: true,
      entry: {
        purpose: "other_capped",
        amountGhc: clientAmount,
        maxAmountGhc: OTHER_MAX,
        description: "Capped discretionary spend",
      },
      amount: clientAmount,
    }
  }

  return { ok: false, error: "UNKNOWN_PURPOSE" }
}
