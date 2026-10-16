/**
 * GH Reputation — 15 levels (product constants).
 * Scoring engine / snapshots are later phases; this module is the single source of level metadata.
 * Influence is NOT derived from GHC balance.
 */

export interface ReputationLevelDef {
  level: number
  id: string
  name: string
  /** Minimum cumulative reputation points (placeholder scale; engine TBD) */
  minPoints: number
  /** Level 7 opens larger creator programs when platform revenue rails are live */
  sustainabilityGate: boolean
}

export const REPUTATION_LEVELS: readonly ReputationLevelDef[] = [
  { level: 1, id: "seed", name: "Seed", minPoints: 0, sustainabilityGate: false },
  { level: 2, id: "sprout", name: "Sprout", minPoints: 25, sustainabilityGate: false },
  { level: 3, id: "root", name: "Root", minPoints: 75, sustainabilityGate: false },
  { level: 4, id: "branch", name: "Branch", minPoints: 150, sustainabilityGate: false },
  { level: 5, id: "canopy", name: "Canopy", minPoints: 300, sustainabilityGate: false },
  { level: 6, id: "grove", name: "Grove", minPoints: 500, sustainabilityGate: false },
  { level: 7, id: "haven", name: "Haven", minPoints: 800, sustainabilityGate: true },
  { level: 8, id: "steward", name: "Steward", minPoints: 1200, sustainabilityGate: true },
  { level: 9, id: "artisan", name: "Artisan", minPoints: 1800, sustainabilityGate: true },
  { level: 10, id: "mentor", name: "Mentor", minPoints: 2500, sustainabilityGate: true },
  { level: 11, id: "beacon", name: "Beacon", minPoints: 3500, sustainabilityGate: true },
  { level: 12, id: "pillar", name: "Pillar", minPoints: 5000, sustainabilityGate: true },
  { level: 13, id: "architect", name: "Architect", minPoints: 7000, sustainabilityGate: true },
  { level: 14, id: "guardian", name: "Guardian", minPoints: 10000, sustainabilityGate: true },
  { level: 15, id: "legend", name: "Legend", minPoints: 15000, sustainabilityGate: true },
] as const

export const HAVEN_LEVEL = 7

export function levelFromPoints(points: number): ReputationLevelDef {
  const p = Math.max(0, Math.floor(points || 0))
  let current = REPUTATION_LEVELS[0]
  for (const row of REPUTATION_LEVELS) {
    if (p >= row.minPoints) current = row
    else break
  }
  return current
}

/** Large creator reward pools require Haven+ AND operator-enabled revenue flag */
export function isCreatorProgramEligible(
  level: number,
  platformRevenueRailsLive: boolean
): boolean {
  return level >= HAVEN_LEVEL && platformRevenueRailsLive === true
}
