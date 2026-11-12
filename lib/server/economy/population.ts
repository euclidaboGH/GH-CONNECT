/**
 * ECONOMY_VERSION 1.2 — eligibleEconomicUsers source of truth.
 *
 * Production: database RPC ghc_economic_population_stats
 * Development/test override: GHC_ELIGIBLE_ECONOMIC_USERS (never silent production default)
 * Memory-only studio without DB: process default (10) for early-network m≈1
 */

import {
  rpcEconomicPopulationStats,
  type EconomicPopulationStats,
} from "@/lib/server/economy/db"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { isDatabaseConfigured } from "@/lib/server/economy/http"

/** Process default only when DB is absent (studio / local). */
let _memoryEligibleFallback = 10

export function setMemoryEligibleEconomicUsersForTests(n: number): void {
  _memoryEligibleFallback = Math.max(1, Math.floor(Number(n) || 1))
}

/**
 * Explicit non-production override.
 * In production, this is ignored unless GHC_ALLOW_ELIGIBLE_OVERRIDE=1 (emergency only).
 */
function envOverrideEligible(): number | null {
  const raw = process.env.GHC_ELIGIBLE_ECONOMIC_USERS
  if (raw == null || raw === "") return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) return null
  const env = readGhcServerEnv()
  if (env.isProduction && process.env.GHC_ALLOW_ELIGIBLE_OVERRIDE !== "1") {
    return null
  }
  return Math.floor(n)
}

export async function resolveEconomicPopulation(): Promise<
  EconomicPopulationStats & { usedOverride: boolean }
> {
  const override = envOverrideEligible()
  if (isDatabaseConfigured()) {
    const stats = await rpcEconomicPopulationStats()
    if (stats.ok && stats.source === "database") {
      // Emergency override only when explicitly allowed in production
      if (override != null) {
        return {
          ...stats,
          eligibleEconomicUsers: override,
          usedOverride: true,
        }
      }
      return { ...stats, usedOverride: false }
    }
    // DB configured but RPC unavailable — do not invent large N; use override or 1
    return {
      ok: false,
      registeredUsers: 0,
      verifiedUsers: 0,
      eligibleEconomicUsers: override ?? 1,
      activeEconomicUsers: 0,
      suspendedUsers: 0,
      suspectedDuplicateUsers: 0,
      source: "unavailable",
      usedOverride: override != null,
    }
  }

  // No DB: studio / memory path
  return {
    ok: true,
    registeredUsers: 0,
    verifiedUsers: 0,
    eligibleEconomicUsers: override ?? _memoryEligibleFallback,
    activeEconomicUsers: 0,
    suspendedUsers: 0,
    suspectedDuplicateUsers: 0,
    source: "unavailable",
    usedOverride: override != null,
  }
}

export async function resolveEligibleEconomicUsers(): Promise<number> {
  const pop = await resolveEconomicPopulation()
  return Math.max(1, pop.eligibleEconomicUsers)
}
