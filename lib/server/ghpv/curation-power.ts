/**
 * GHPV Curation Power — server-only formula.
 * GHC balance is intentionally excluded (coefficient = 0).
 */

import type { CurationPowerInput } from "./types"

/** Max share of a single reviewer's weight in one post consensus (anti-whale). */
export const MAX_REVIEWER_CONSENSUS_SHARE = 0.12

/** Starting JCS for new curators */
export const DEFAULT_JCS = 50

/** Starting integrity */
export const DEFAULT_INTEGRITY = 70

/**
 * Compute curation power. Never uses wallet/GHC fields.
 */
export function computeCurationPower(input: CurationPowerInput): number {
  const level = Math.min(15, Math.max(1, Math.floor(input.reputationLevel) || 1))
  const jcs = clamp01to100(input.judgmentCalibration)
  const integrity = clamp01to100(input.integrityScore)
  const maturity = Math.min(1, Math.max(0, input.accountAgeDays) / 180)
  const independence = clamp01(input.independenceFactor)
  const antiAbuse = clamp01(input.antiAbuseFactor)

  // Level factor: gentle curve; Haven (7+) gains more influence
  const levelFactor = 0.35 + (level / 15) * 0.65
  const jcsFactor = 0.4 + (jcs / 100) * 0.6
  const integrityFactor = 0.5 + (integrity / 100) * 0.5
  const maturityFactor = 0.55 + maturity * 0.45

  const raw =
    levelFactor *
    jcsFactor *
    integrityFactor *
    maturityFactor *
    (0.5 + independence * 0.5) *
    antiAbuse

  // Floor for brand-new users; soft cap to reduce outlier dominance
  return Math.round(Math.min(25, Math.max(0.25, raw * 8)) * 1e6) / 1e6
}

/**
 * Creative/opinion modes: misaligned votes often "protected" (no JCS hit).
 */
export function isJudgmentProtectedMode(mode: string): boolean {
  return mode === "creative" || mode === "opinion"
}

export function clamp01to100(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, n))
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
}

/**
 * Bounded JCS delta from settlement confidence (never extreme single-event swings).
 */
export function jcsDeltaForAlignment(opts: {
  alignment: "aligned" | "misaligned" | "protected" | "unresolved"
  confidence: number
  wasDownvote: boolean
}): number {
  const c = clamp01to100(opts.confidence) / 100
  if (opts.alignment === "protected" || opts.alignment === "unresolved") return 0
  if (opts.alignment === "aligned") {
    return Math.round((0.4 + c * 1.6) * 100) / 100 // +0.4 .. +2.0
  }
  // misaligned: downvotes that suppress good content penalize slightly more
  const base = opts.wasDownvote ? -2.2 : -1.4
  return Math.round((base * (0.3 + c * 0.7)) * 100) / 100
}
