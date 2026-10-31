/**
 * Phase 4 — marketplace platform commission (seller proceeds).
 * Server-authoritative basis points; never trust client-reported fees.
 *
 * Env:
 *   GHC_MARKETPLACE_PLATFORM_FEE_BPS — 0–10000 (default 500 = 5%)
 *   GHC_MARKETPLACE_MIN_PLATFORM_FEE_MINOR — optional floor in minor units (default 0)
 */

export type CommissionSplit = {
  grossMinor: number
  platformFeeBps: number
  platformFeeMinor: number
  sellerProceedsMinor: number
  currency: string
}

function clampBps(raw: unknown): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return 500
  return Math.min(10_000, Math.floor(n))
}

export function platformFeeBps(): number {
  return clampBps(process.env.GHC_MARKETPLACE_PLATFORM_FEE_BPS ?? 500)
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
  /** Override bps for tests; production uses env */
  feeBps?: number
}): CommissionSplit | { ok: false; error: string } {
  const gross = Number(input.grossAmount)
  if (!Number.isFinite(gross) || gross < 0) {
    return { ok: false, error: "INVALID_GROSS" }
  }
  const currency = String(input.currency || "GHC").toUpperCase().slice(0, 8)
  const bps = input.feeBps !== undefined ? clampBps(input.feeBps) : platformFeeBps()

  // Work in 1e4 scale to avoid float drift, then floor fee
  const grossMinor = Math.round(gross * 10000)
  const feeMinor = Math.floor((grossMinor * bps) / 10_000)
  const minFeeEnv = Number(process.env.GHC_MARKETPLACE_MIN_PLATFORM_FEE_MINOR || 0)
  const minFee = Number.isFinite(minFeeEnv) && minFeeEnv > 0 ? Math.floor(minFeeEnv) : 0
  const platformFeeMinorScaled = Math.min(grossMinor, Math.max(feeMinor, minFee > 0 ? minFee * 100 : feeMinor))
  const sellerMinorScaled = grossMinor - platformFeeMinorScaled

  return {
    grossMinor: grossMinor / 10000,
    platformFeeBps: bps,
    platformFeeMinor: platformFeeMinorScaled / 10000,
    sellerProceedsMinor: sellerMinorScaled / 10000,
    currency,
  }
}

export function commissionPolicyPublic() {
  return {
    platformFeeBps: platformFeeBps(),
    note: "Platform fee is taken from gross marketplace order; seller receives the remainder after successful payment verification.",
    envKey: "GHC_MARKETPLACE_PLATFORM_FEE_BPS",
  }
}
