/**
 * GHPV-2 — Creator Quality Index (CQI). Trust/distribution signal only.
 * Never uses GHC balance or tip amount as quality multiplier.
 */

export type CreatorQualitySignals = {
  qualifiedViews: number
  completions: number
  saves: number
  shares: number
  /** Sum of settled positive quality deltas on creator content */
  positiveJudgmentScore: number
  /** Absolute sum of settled negative quality deltas */
  negativeJudgmentScore: number
  /** Average settlement confidence 0–100 */
  avgConfidence: number
  /** Days since content/activity peak for decay */
  ageDays: number
  /** 0–1 coordination/abuse penalty (1 = clean) */
  integrityFactor: number
  /** Subjective/creative share 0–1 — reduces hard negative impact */
  subjectiveShare: number
}

/**
 * CQI on 0–100 scale. Sustained quality beats viral empty reach.
 */
export function computeCreatorQualityIndex(s: CreatorQualitySignals): number {
  const qv = Math.max(0, s.qualifiedViews)
  const completionRate = qv > 0 ? Math.min(1, Math.max(0, s.completions) / qv) : 0
  const saveRate = qv > 0 ? Math.min(1, Math.max(0, s.saves) / qv) : 0
  const shareRate = qv > 0 ? Math.min(1, Math.max(0, s.shares) / qv) : 0

  // Attention quality (not raw volume): log dampens viral burst
  const volumeComponent = Math.min(30, Math.log10(1 + qv) * 10)
  const satisfaction =
    completionRate * 25 + saveRate * 15 + shareRate * 10

  const pos = Math.max(0, s.positiveJudgmentScore)
  const neg = Math.max(0, s.negativeJudgmentScore)
  const conf = Math.min(100, Math.max(0, s.avgConfidence)) / 100
  let judgmentNet = (pos - neg) * conf
  // Subjective content: soften negative judgment impact
  const subj = Math.min(1, Math.max(0, s.subjectiveShare))
  if (judgmentNet < 0) {
    judgmentNet = judgmentNet * (1 - subj * 0.6)
  }
  const judgmentComponent = Math.max(-20, Math.min(20, judgmentNet))

  // Time decay: old peaks fade unless sustained (caller should pass recent windows)
  const ageDays = Math.max(0, s.ageDays)
  const decay = ageDays <= 14 ? 1 : Math.max(0.55, 1 - (ageDays - 14) / 180)

  const integrity = Math.min(1, Math.max(0.2, s.integrityFactor))

  const raw =
    (volumeComponent + satisfaction + judgmentComponent) * decay * integrity

  return Math.round(Math.min(100, Math.max(0, raw)) * 100) / 100
}

/**
 * Minimal ranking boost factor from CQI for feed (1.0 = neutral).
 * Does not rewrite feed — optional multiplier only.
 */
export function distributionFactorFromCqi(cqi: number): number {
  const x = Math.min(100, Math.max(0, cqi))
  // 0.85 .. 1.20
  return Math.round((0.85 + (x / 100) * 0.35) * 1000) / 1000
}
