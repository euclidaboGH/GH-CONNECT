/**
 * Pilot fee schedule for marketplace listing and community creation.
 * Amounts are proposals until GHC_*_FEE_* env activates ratesApproved.
 * Never trust client-supplied fee amounts.
 */

export type FeeCurrency = "GHC" | "PI"

export type PilotFeeQuote = {
  feature: "marketplace_listing" | "community_create"
  feeAmount: number
  feeCurrency: FeeCurrency
  ratesApproved: boolean
  code: string
  basis: string
}

function readNum(name: string): number | null {
  const raw = process.env[name]
  if (raw == null || String(raw).trim() === "") return null
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** Proposed pilot: 5 GHC or 0.05 Pi per new listing (env activates). */
export function quoteMarketplaceListingFee(preferred?: FeeCurrency): PilotFeeQuote {
  const ghc = readNum("GHC_MARKETPLACE_LISTING_FEE_GHC")
  const pi = readNum("GHC_MARKETPLACE_LISTING_FEE_PI")
  // Prefer explicit preferred currency when both set
  if (preferred === "GHC" && ghc != null) {
    return { feature: "marketplace_listing", feeAmount: ghc, feeCurrency: "GHC", ratesApproved: ghc > 0, code: "FEE_FIXED_GHC", basis: "env_ghc" }
  }
  if (preferred === "PI" && pi != null) {
    return { feature: "marketplace_listing", feeAmount: pi, feeCurrency: "PI", ratesApproved: pi > 0, code: "FEE_FIXED_PI", basis: "env_pi" }
  }
  if (ghc != null) {
    return { feature: "marketplace_listing", feeAmount: ghc, feeCurrency: "GHC", ratesApproved: ghc > 0, code: "FEE_FIXED_GHC", basis: "env_ghc" }
  }
  if (pi != null) {
    return { feature: "marketplace_listing", feeAmount: pi, feeCurrency: "PI", ratesApproved: pi > 0, code: "FEE_FIXED_PI", basis: "env_pi" }
  }
  // Documented pilot defaults for display only — not approved until env set
  return {
    feature: "marketplace_listing",
    feeAmount: 5,
    feeCurrency: "GHC",
    ratesApproved: false,
    code: "FEE_PILOT_DISPLAY_ONLY",
    basis: "pilot_proposal_5_ghc_or_0_05_pi",
  }
}

/** Proposed pilot: 50 GHC or 0.5 Pi per community creation (env activates). */
export function quoteCommunityCreateFee(preferred?: FeeCurrency): PilotFeeQuote {
  const ghc = readNum("GHC_COMMUNITY_CREATE_FEE_GHC")
  const pi = readNum("GHC_COMMUNITY_CREATE_FEE_PI")
  if (preferred === "GHC" && ghc != null) {
    return { feature: "community_create", feeAmount: ghc, feeCurrency: "GHC", ratesApproved: ghc > 0, code: "FEE_FIXED_GHC", basis: "env_ghc" }
  }
  if (preferred === "PI" && pi != null) {
    return { feature: "community_create", feeAmount: pi, feeCurrency: "PI", ratesApproved: pi > 0, code: "FEE_FIXED_PI", basis: "env_pi" }
  }
  if (ghc != null) {
    return { feature: "community_create", feeAmount: ghc, feeCurrency: "GHC", ratesApproved: ghc > 0, code: "FEE_FIXED_GHC", basis: "env_ghc" }
  }
  if (pi != null) {
    return { feature: "community_create", feeAmount: pi, feeCurrency: "PI", ratesApproved: pi > 0, code: "FEE_FIXED_PI", basis: "env_pi" }
  }
  return {
    feature: "community_create",
    feeAmount: 50,
    feeCurrency: "GHC",
    ratesApproved: false,
    code: "FEE_PILOT_DISPLAY_ONLY",
    basis: "pilot_proposal_50_ghc_or_0_5_pi",
  }
}

export function feesRequireSettlement(q: PilotFeeQuote): boolean {
  return q.ratesApproved && q.feeAmount > 0
}
