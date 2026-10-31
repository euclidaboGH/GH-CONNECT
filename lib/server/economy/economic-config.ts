/**
 * ECONOMY_VERSION 1.2 — versioned server-side economic configuration.
 *
 * Do not scatter magic numbers across routes.
 * Historical ledger rows are never rewritten when this version changes.
 */

export const ECONOMY_VERSION = "1.2" as const

/** Integer micro-GHC (1 GHC = 1_000_000 micro) for deterministic settlement */
export const GHC_MICRO = 1_000_000 as const

/** Approved base 7-day gross claim schedule (GHC) — ECONOMY_VERSION 1.2 */
export const CLAIM_GROSS_BY_DAY: readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number
] = [0.39, 0.62, 0.86, 1.09, 1.33, 1.56, 1.96]

export const CLAIM_USER_SHARE = 0.8 as const
export const CLAIM_PROTOCOL_RESERVE_SHARE = 0.2 as const

/** Activity pre-control caps (before m × g) */
export const ACTIVITY_DAILY_CAP_GHC = 0.5 as const
export const ACTIVITY_WEEKLY_CAP_GHC = 2.5 as const

/** Product sinks (unchanged commercial prices) */
export const VIP_PRICE_GHC = 150 as const
export const VVIP_PRICE_GHC = 300 as const
export const BOOST_FEE_RATE = 0.1 as const

/** Internal reference benchmark only — not a market or redemption rate */
export const REFERENCE_GHC_PER_PI = 100 as const

/** Global daily budget: BASE_PER_USER × N^α */
export const GLOBAL_BUDGET_BASE_PER_USER = 8 as const
export const GLOBAL_BUDGET_ALPHA = 0.85 as const

/** Curve E parameters (smooth hybrid) */
export const CURVE_E = {
  floor: 0.18,
  scale: 0.82,
  logCoef: 0.2,
  power: 1.15,
} as const

export type EconomicConfigV12 = {
  version: typeof ECONOMY_VERSION
  claimGrossByDay: readonly number[]
  claimUserShare: number
  claimProtocolReserveShare: number
  activityDailyCapGhc: number
  activityWeeklyCapGhc: number
  vipPriceGhc: number
  vvipPriceGhc: number
  boostFeeRate: number
  referenceGhcPerPi: number
  globalBudgetBasePerUser: number
  globalBudgetAlpha: number
  curveE: typeof CURVE_E
  /** Immutable rule: network growth must never reduce historical balances */
  immutableHistoricalBalances: true
}

export function getEconomicConfig(): EconomicConfigV12 {
  return {
    version: ECONOMY_VERSION,
    claimGrossByDay: CLAIM_GROSS_BY_DAY,
    claimUserShare: CLAIM_USER_SHARE,
    claimProtocolReserveShare: CLAIM_PROTOCOL_RESERVE_SHARE,
    activityDailyCapGhc: ACTIVITY_DAILY_CAP_GHC,
    activityWeeklyCapGhc: ACTIVITY_WEEKLY_CAP_GHC,
    vipPriceGhc: VIP_PRICE_GHC,
    vvipPriceGhc: VVIP_PRICE_GHC,
    boostFeeRate: BOOST_FEE_RATE,
    referenceGhcPerPi: REFERENCE_GHC_PER_PI,
    globalBudgetBasePerUser: GLOBAL_BUDGET_BASE_PER_USER,
    globalBudgetAlpha: GLOBAL_BUDGET_ALPHA,
    curveE: CURVE_E,
    immutableHistoricalBalances: true,
  }
}

export function toMicro(ghc: number): number {
  return Math.round(Number(ghc) * GHC_MICRO)
}

export function fromMicro(micro: number): number {
  return Number(micro) / GHC_MICRO
}

/**
 * Deterministic 80/20 split in micro-units.
 * User gets floor(gross * 80%); residual goes to protocol reserve.
 */
export function splitClaimGrossMicro(grossMicro: number): {
  userMicro: number
  reserveMicro: number
} {
  const g = Math.max(0, Math.trunc(grossMicro))
  const userMicro = Math.floor((g * 80) / 100)
  const reserveMicro = g - userMicro
  return { userMicro, reserveMicro }
}
