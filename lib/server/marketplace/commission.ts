/**
 * Phase 4 — marketplace platform commission (seller proceeds).
 * Server-authoritative basis points; never trust client-reported fees.
 *
 * Until the database-backed fee policy is reconciled, the only safe policy is
 * the immutable 500 bps / 5% policy used by the proceeds snapshot migration.
 * Runtime environment overrides are deliberately ignored to prevent app/SQL drift.
 */

export type CommissionSplit = {
  grossMinor: number
  platformFeeBps: number
  platformFeeMinor: number
  sellerProceedsMinor: number
  currency: string
}

const CANONICAL_PLATFORM_FEE_BPS = 500

export function platformFeeBps(): number {
  return CANONICAL_PLATFORM_FEE_BPS
}

/**
 * Split a gross order amount into platform fee + seller proceeds.
 * Amounts are in minor units (e.g. cents) or whole units when currency has no minor —
 * callers must be consistent. For PI/GHC whole units, pass amount * 100 as minor if needed,
 * or use whole units with bps math (floor).
 */
export function splitMarketplaceCommission(input: {
  grossAmount: number
  currency: string
}): CommissionSplit | { ok: false; error: string } {
  const gross = Number(input.grossAmount)
  if (!Number.isFinite(gross) || gross < 0) {
    return { ok: false, error: "INVALID_GROSS" }
  }
  const currency = String(input.currency || "GHC").toUpperCase().slice(0, 8)
  const bps = platformFeeBps()

  // Keep the same eight-decimal scale as gh_marketplace_order_proceeds.numeric(18,8).
  // BigInt arithmetic prevents the app-side fee from rounding differently than the
  // immutable database proceeds snapshot for prices with more than four decimals.
  const grossScaled = BigInt(gross.toFixed(8).replace('.', ''))
  const feeScaled = (grossScaled * BigInt(bps)) / 10_000n
  const platformFeeScaled = grossScaled < feeScaled ? grossScaled : feeScaled
  const sellerScaled = grossScaled - platformFeeScaled

  return {
    grossMinor: Number(grossScaled) / 100_000_000,
    platformFeeBps: bps,
    platformFeeMinor: Number(platformFeeScaled) / 100_000_000,
    sellerProceedsMinor: Number(sellerScaled) / 100_000_000,
    currency,
  }
}

export function commissionPolicyPublic() {
  return {
    platformFeeBps: platformFeeBps(),
    note: "Platform fee is taken from gross marketplace order; seller receives the remainder after successful payment verification.",
    platformFeePolicy: "fixed_500_bps_until_database_policy_reconciliation",
  }
}
