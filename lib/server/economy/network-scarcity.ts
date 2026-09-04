/**
 * ECONOMY_VERSION 1.2 — Network scarcity controller.
 *
 * Primary: Curve E multiplier m(eligibleEconomicUsers)
 * Secondary: global safety governor g = min(1, budget / demand_after_m)
 *
 * Never reduces historical balances — only scales FUTURE emission.
 */

import {
  CURVE_E,
  GLOBAL_BUDGET_ALPHA,
  GLOBAL_BUDGET_BASE_PER_USER,
  getEconomicConfig,
} from "@/lib/server/economy/economic-config"

export type EconomicPopulationMetrics = {
  registeredUsers: number
  verifiedUsers: number
  eligibleEconomicUsers: number
  activeEconomicUsers: number
  suspendedUsers: number
  suspectedDuplicateUsers: number
}

/**
 * Curve E: soft early decay, floor 0.18.
 * m = floor + scale / (1 + logCoef * log10(N/10))^power
 */
export function curveEMultiplier(eligibleEconomicUsers: number): number {
  const n = Math.max(1, Math.floor(Number(eligibleEconomicUsers) || 0))
  const x = Math.max(n, 10)
  const z = Math.log10(x / 10)
  const denom = Math.pow(1 + CURVE_E.logCoef * z, CURVE_E.power)
  const m = CURVE_E.floor + CURVE_E.scale / denom
  return Math.max(CURVE_E.floor, Math.min(1, m))
}

/** GLOBAL_DAILY_BUDGET = 8 × N^0.85 */
export function globalDailyBudget(eligibleEconomicUsers: number): number {
  const n = Math.max(1, Math.floor(Number(eligibleEconomicUsers) || 0))
  const cfg = getEconomicConfig()
  return (
    cfg.globalBudgetBasePerUser *
    Math.pow(n, cfg.globalBudgetAlpha)
  )
}

/**
 * g is a safety governor only — must stay 1.0 under normal demand.
 */
export function safetyGovernorG(
  demandAfterM: number,
  eligibleEconomicUsers: number
): number {
  const demand = Math.max(0, Number(demandAfterM) || 0)
  if (demand <= 0) return 1
  const budget = globalDailyBudget(eligibleEconomicUsers)
  if (demand <= budget) return 1
  return budget / demand
}

export function emissionFactor(
  eligibleEconomicUsers: number,
  demandAfterM: number
): { m: number; g: number; factor: number; budget: number } {
  const m = curveEMultiplier(eligibleEconomicUsers)
  const g = safetyGovernorG(demandAfterM, eligibleEconomicUsers)
  return {
    m,
    g,
    factor: m * g,
    budget: globalDailyBudget(eligibleEconomicUsers),
  }
}

/**
 * Apply scarcity to a base gross amount (GHC).
 * base is pre-control (e.g. claim day gross or activity base).
 */
export function applyNetworkEmission(
  baseGhc: number,
  eligibleEconomicUsers: number,
  demandAfterM: number
): {
  baseGhc: number
  m: number
  g: number
  grossGhc: number
  budget: number
} {
  const base = Math.max(0, Number(baseGhc) || 0)
  const { m, g, factor, budget } = emissionFactor(
    eligibleEconomicUsers,
    demandAfterM
  )
  return {
    baseGhc: base,
    m,
    g,
    grossGhc: base * factor,
    budget,
  }
}

/**
 * Sync cache of last resolved eligible count (for pure math helpers).
 * Authoritative resolution is async via population.resolveEligibleEconomicUsers().
 * Production must not rely on env alone — see population.ts.
 */
let _eligibleEconomicUsersCache = 10

export function setEligibleEconomicUsersForProcess(n: number): void {
  _eligibleEconomicUsersCache = Math.max(1, Math.floor(Number(n) || 1))
}

/** @deprecated Prefer resolveEligibleEconomicUsers() from population.ts in request paths */
export function getEligibleEconomicUsers(): number {
  return _eligibleEconomicUsersCache
}

export function cacheEligibleEconomicUsers(n: number): void {
  _eligibleEconomicUsersCache = Math.max(1, Math.floor(Number(n) || 1))
}

/**
 * Rolling demand tracker (process memory) for governor input.
 * Production: replace with shared store / Redis daily aggregate.
 */
type DayDemand = { dayKey: string; demandGhc: number }

let _dayDemand: DayDemand = { dayKey: "", demandGhc: 0 }

export function resetDayDemandForTests(): void {
  _dayDemand = { dayKey: "", demandGhc: 0 }
}

export function recordEmissionDemand(dayKey: string, amountGhc: number): void {
  const amt = Math.max(0, Number(amountGhc) || 0)
  if (_dayDemand.dayKey !== dayKey) {
    _dayDemand = { dayKey, demandGhc: amt }
    return
  }
  _dayDemand.demandGhc += amt
}

export function getCurrentDayDemand(dayKey: string): number {
  if (_dayDemand.dayKey !== dayKey) return 0
  return _dayDemand.demandGhc
}

// Silence unused import warning path for GLOBAL constants re-export consumers
export const NETWORK_SCARCITY_CONST = {
  GLOBAL_BUDGET_BASE_PER_USER,
  GLOBAL_BUDGET_ALPHA,
} as const
