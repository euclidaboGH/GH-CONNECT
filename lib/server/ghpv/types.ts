/**
 * GHPV — Proof-of-Value types (server-side only).
 * Clients must never submit these as authoritative values.
 */

export type JudgmentMode =
  | "factual"
  | "useful"
  | "creative"
  | "opinion"
  | "harm"

export type CurationChoice = "upvote" | "downvote" | "neutral"

export type SettlementAlignment =
  | "aligned"
  | "misaligned"
  | "neutral"
  | "unresolved"
  | "protected"

/** Five-score model — informational dimensions, not ledger balances */
export type GhpvScoreBundle = {
  creatorQuality: number // 0–100 CQS
  judgmentCalibration: number // 0–100 JCS
  communityIntegrity: number // 0–100 CIS
  economicValue: number // 0–100 EVS (descriptive)
  growthXp: number // non-negative
}

export type CurationPowerInput = {
  reputationLevel: number // 1–15
  judgmentCalibration: number // 0–100
  integrityScore: number // 0–100
  accountAgeDays: number
  independenceFactor: number // 0–1
  antiAbuseFactor: number // 0–1
}
