/**
 * Pilot fee schedule for marketplace listing and community creation.
 * Env activates ratesApproved. Under testnet unlock, documented pilot amounts
 * are treated as approved so the full product can be exercised before mainnet.
 * Never trust client-supplied fee amounts.
 */

import { isTestnetProductUnlocked } from "@/lib/server/economy/testnet-unlock"

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

export function feesRequireSettlement(fee: PilotFeeQuote): boolean {
  return fee.ratesApproved && fee.feeAmount > 0
}

export function quoteMarketplaceListingFee(preferred?: FeeCurrency): PilotFeeQuote {
  const ghc = readNum("GHC_MARKETPLACE_LISTING_FEE_GHC")
  const pi = readNum("GHC_MARKETPLACE_LISTING_FEE_PI")
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
  const unlock = isTestnetProductUnlocked()
  return {
    feature: "marketplace_listing",
    feeAmount: unlock ? 1 : 5,
    feeCurrency: "GHC",
    ratesApproved: unlock,
    code: unlock ? "FEE_TESTNET_UNLOCK" : "FEE_PILOT_DISPLAY_ONLY",
    basis: unlock ? "testnet_unlock_1_ghc" : "pilot_proposal_5_ghc_or_0_05_pi",
  }
}

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
  const unlock = isTestnetProductUnlocked()
  if (unlock) {
    if (preferred === "PI") {
      return { feature: "community_create", feeAmount: 0.1, feeCurrency: "PI", ratesApproved: true, code: "FEE_TESTNET_UNLOCK", basis: "testnet_unlock_0_1_pi" }
    }
    return { feature: "community_create", feeAmount: 5, feeCurrency: "GHC", ratesApproved: true, code: "FEE_TESTNET_UNLOCK", basis: "testnet_unlock_5_ghc" }
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
