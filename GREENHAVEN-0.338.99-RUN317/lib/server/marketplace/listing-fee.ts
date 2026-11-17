import { isPiOnlyCommerceEnabled } from "@/lib/server/economy/pi-only-commerce"
import { isTestnetProductUnlocked } from "@/lib/server/economy/testnet-unlock"

/**
 * Marketplace listing fee (platform service charge) — SEPARATE from seller product price.
 *
 * Authority chain:
 *   seller chooses listing.price (product asking price)
 *   → server validates & stores listing.price
 *   → server calculates listing fee via this module (never client)
 *   → seller may pay fee in Pi via durable payment intents (when rates approved)
 *   → listing activation may require verified fee settlement
 *
 * Final fee percentages / amounts are PRODUCT/BUSINESS APPROVAL PENDING.
 * Do not invent commercial rates here. Operators set env overrides only after approval.
 *
 * Env (optional, after business approval — not required for app safety):
 *   GHC_MARKETPLACE_LISTING_FEE_PI — fixed Pi fee (>= 0)
 *   GHC_MARKETPLACE_LISTING_FEE_BPS — basis points of seller price (0–10000)
 * If neither is set, fee is 0 and ratesApproved=false (no invented economics).
 */

export type ListingFeeInput = {
  /** Seller-declared product/service price (already validated elsewhere) */
  sellerPrice: number
  currency?: string
  category?: string
  kind?: string
  durationDays?: number
  /** Seller-selected settlement rail when both GHC and Pi fees are configured / testnet unlocked */
  preferredFeeCurrency?: "GHC" | "PI"
}

export type ListingFeeResult = {
  /** Platform listing fee amount (same numeric space as currency) */
  feeAmount: number
  /** Fee currency — Pi preferred for marketplace listing fees when configured */
  feeCurrency: "PI" | "GHC"
  /** true only when an explicit approved config source is present */
  ratesApproved: boolean
  /** Human-readable basis for UI (never trust as authority) */
  basis: "none" | "fixed_pi" | "fixed_ghc" | "bps_of_seller_price"
  /** Opaque code for clients / logs */
  code: "FEE_NOT_CONFIGURED" | "FEE_FIXED" | "FEE_BPS"
}

function readNonNegativeNumber(raw: string | undefined): number | null {
  if (raw == null || String(raw).trim() === "") return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

/**
 * Server-authoritative marketplace listing fee.
 * Client-supplied listingFee / feeAmount must be ignored by callers.
 */
export function calculateMarketplaceListingFee(input: ListingFeeInput): ListingFeeResult {
  if (isPiOnlyCommerceEnabled()) {
    input = { ...input, preferredFeeCurrency: "PI" }
  }
  const sellerPrice = Number(input.sellerPrice)
  if (!Number.isFinite(sellerPrice) || sellerPrice < 0) {
    return {
      feeAmount: 0,
      feeCurrency: "PI",
      ratesApproved: false,
      basis: "none",
      code: "FEE_NOT_CONFIGURED",
    }
  }

  const preferred =
    String(input.preferredFeeCurrency || "").toUpperCase() === "PI"
      ? "PI"
      : String(input.preferredFeeCurrency || "").toUpperCase() === "GHC"
        ? "GHC"
        : null

  const fixedGhc = readNonNegativeNumber(process.env.GHC_MARKETPLACE_LISTING_FEE_GHC)
  const fixedPi = readNonNegativeNumber(process.env.GHC_MARKETPLACE_LISTING_FEE_PI)

  // Honor seller rail when that rail has an explicit amount (or testnet unlock below).
  if (preferred === "PI" && fixedPi != null) {
    const feeAmount = Math.round(fixedPi * 1e8) / 1e8
    return {
      feeAmount,
      feeCurrency: "PI",
      ratesApproved: true,
      basis: "fixed_pi",
      code: "FEE_FIXED",
    }
  }
  if (preferred === "GHC" && fixedGhc != null) {
    const feeAmount = Math.round(fixedGhc * 1e8) / 1e8
    return {
      feeAmount,
      feeCurrency: "GHC",
      ratesApproved: true,
      basis: "fixed_ghc",
      code: "FEE_FIXED",
    }
  }

  // Prefer explicit fixed GHC fee after business approval.
  if (fixedGhc != null && preferred !== "PI") {
    const feeAmount = Math.round(fixedGhc * 1e8) / 1e8
    return {
      feeAmount,
      feeCurrency: "GHC",
      ratesApproved: true,
      basis: "fixed_ghc",
      code: "FEE_FIXED",
    }
  }

  // Prefer explicit fixed Pi fee after business approval.
  if (fixedPi != null) {
    const feeAmount = Math.round(fixedPi * 1e8) / 1e8
    return {
      feeAmount,
      feeCurrency: "PI",
      ratesApproved: true,
      basis: "fixed_pi",
      code: "FEE_FIXED",
    }
  }

  // Optional bps of seller price (still requires explicit env — not a guessed default %).
  const bps = readNonNegativeNumber(process.env.GHC_MARKETPLACE_LISTING_FEE_BPS)
  if (bps != null && bps <= 10_000) {
    const feeAmount = Math.round(sellerPrice * (bps / 10_000) * 1e8) / 1e8
    const cur = String(input.currency || "PI").toUpperCase() === "GHC" ? "GHC" : "PI"
    return {
      feeAmount,
      feeCurrency: cur,
      ratesApproved: true,
      basis: "bps_of_seller_price",
      code: "FEE_BPS",
    }
  }

  if (isTestnetProductUnlocked()) {
    if (preferred === "PI") {
      return {
        feeAmount: 0.05,
        feeCurrency: "PI",
        ratesApproved: true,
        basis: "fixed_pi",
        code: "FEE_FIXED",
      }
    }
    return {
      feeAmount: 1,
      feeCurrency: "GHC",
      ratesApproved: true,
      basis: "fixed_ghc",
      code: "FEE_FIXED",
    }
  }

  return {
    feeAmount: 0,
    feeCurrency: "PI",
    ratesApproved: false,
    basis: "none",
    code: "FEE_NOT_CONFIGURED",
  }
}

/** True when a non-zero fee must be settled before treating listing as paid-active. */
export function listingFeeRequiresSettlement(fee: ListingFeeResult): boolean {
  return fee.ratesApproved && fee.feeAmount > 0
}
