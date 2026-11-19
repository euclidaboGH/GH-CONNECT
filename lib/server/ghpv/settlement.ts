/**
 * GHPV-1B — Haven Consensus settlement (pure + optional DB apply).
 * Majority ≠ truth. Insufficient evidence → UNRESOLVED.
 * No GHC.
 */

import {
  isJudgmentProtectedMode,
  jcsDeltaForAlignment,
  MAX_REVIEWER_CONSENSUS_SHARE,
  clamp01to100,
} from "./curation-power.ts"
import type { CurationChoice, JudgmentMode } from "./types.ts"

export type SettlementVote = {
  reviewerId: string
  choice: "upvote" | "downvote"
  weight: number
}

export type SettlementInput = {
  contentId: string
  settlementEpoch: string
  judgmentMode: JudgmentMode
  votes: SettlementVote[]
  /** Minimum independent voters for a decisive settlement */
  minVoters?: number
  /** Minimum confidence (0–100) to mark SETTLED vs UNRESOLVED */
  minConfidence?: number
}

export type SettlementOutcome = {
  contentId: string
  settlementEpoch: string
  status: "SETTLED" | "UNRESOLVED"
  consensusChoice: "upvote" | "downvote" | "neutral" | "unresolved"
  confidence: number
  upWeight: number
  downWeight: number
  independentVoters: number
  qualityDelta: number
  reviewerEffects: Array<{
    reviewerId: string
    choice: CurationChoice
    alignment: "aligned" | "misaligned" | "protected" | "unresolved"
    jcsDelta: number
    effectiveWeight: number
  }>
  reason: string
}

/** Exclude every occurrence of a duplicated reviewer identity. */
export function uniqueReviewerVotes(votes: SettlementVote[]): SettlementVote[] {
  const counts = new Map<string, number>()
  for (const vote of votes) {
    const id = typeof vote.reviewerId === "string" ? vote.reviewerId.trim() : ""
    if (id) counts.set(id, (counts.get(id) || 0) + 1)
  }
  return votes.filter((vote) => {
    const id = typeof vote.reviewerId === "string" ? vote.reviewerId.trim() : ""
    return Boolean(id) && counts.get(id) === 1
      && (vote.choice === "upvote" || vote.choice === "downvote")
      && Number.isFinite(vote.weight) && vote.weight > 0
  }).map((vote) => ({ ...vote, reviewerId: vote.reviewerId.trim() }))
}

/**
 * Deterministic water-filling cap. The final normalized share, not merely the
 * pre-cap raw weight, is bounded. Excess is redistributed proportionally to
 * uncapped reviewers and the total influence is preserved.
 */
export function applyAntiWhaleCap(votes: SettlementVote[]): SettlementVote[] {
  const valid = uniqueReviewerVotes(votes)
  const count = valid.length
  if (count === 0) return []
  const total = valid.reduce((sum, vote) => sum + vote.weight, 0)
  if (!Number.isFinite(total) || total <= 0) return []

  // A 12% cap is feasible for nine or more independent reviewers. Smaller
  // panels use 1/N because a fixed 12% cap would make sum preservation impossible.
  const effectiveCapShare = Math.max(MAX_REVIEWER_CONSENSUS_SHARE, 1 / count)
  const cap = total * effectiveCapShare
  const output = new Map<string, number>()
  let active = [...valid]
  let remaining = total

  while (active.length > 0) {
    const activeTotal = active.reduce((sum, vote) => sum + vote.weight, 0)
    if (activeTotal <= 0 || remaining <= 0) break
    const over = active.filter((vote) => remaining * (vote.weight / activeTotal) > cap + 1e-12)
    if (over.length === 0) {
      for (const vote of active) output.set(vote.reviewerId, remaining * (vote.weight / activeTotal))
      break
    }
    const overIds = new Set(over.map((vote) => vote.reviewerId))
    for (const vote of over) output.set(vote.reviewerId, cap)
    remaining = Math.max(0, remaining - cap * over.length)
    active = active.filter((vote) => !overIds.has(vote.reviewerId))
  }

  // Correct floating-point residue on the final reviewer without exceeding cap.
  const result = valid.map((vote) => ({ ...vote, weight: output.get(vote.reviewerId) || 0 }))
  const sum = result.reduce((value, vote) => value + vote.weight, 0)
  const residue = total - sum
  if (Math.abs(residue) > 1e-10 && result.length > 0) {
    const target = result.find((vote) => vote.weight + residue >= 0 && vote.weight + residue <= cap + 1e-10)
    if (target) target.weight += residue
  }
  return result.filter((vote) => Number.isFinite(vote.weight) && vote.weight > 0)
}

/**
 * Deterministic consensus settlement.
 */
export function computeSettlement(input: SettlementInput): SettlementOutcome {
  const minVoters = input.minVoters ?? 3
  const minConfidence = input.minConfidence ?? 35
  const independentVotes = uniqueReviewerVotes(input.votes)
  const capped = applyAntiWhaleCap(independentVotes)

  const independentVoters = new Set(capped.map((v) => v.reviewerId)).size
  let upWeight = 0
  let downWeight = 0
  for (const v of capped) {
    if (v.choice === "upvote") upWeight += v.weight
    else downWeight += v.weight
  }
  const total = upWeight + downWeight

  if (independentVoters < minVoters || total <= 0) {
    return {
      contentId: input.contentId,
      settlementEpoch: input.settlementEpoch,
      status: "UNRESOLVED",
      consensusChoice: "unresolved",
      confidence: 0,
      upWeight,
      downWeight,
      independentVoters,
      qualityDelta: 0,
      reviewerEffects: capped.map((v) => ({
        reviewerId: v.reviewerId,
        choice: v.choice,
        alignment: "unresolved" as const,
        jcsDelta: 0,
        effectiveWeight: v.weight,
      })),
      reason: "INSUFFICIENT_PARTICIPATION",
    }
  }

  const margin = Math.abs(upWeight - downWeight) / total
  // Close race or near-even → low confidence
  let confidence = clamp01to100(margin * 100 * (0.5 + Math.min(1, independentVoters / 20) * 0.5))

  // Suspected coordination: few unique voters relative to weight concentration
  const maxW = Math.max(...capped.map((v) => v.weight), 0)
  if (total > 0 && maxW / total > MAX_REVIEWER_CONSENSUS_SHARE + 0.001) {
    confidence = Math.min(confidence, 25)
  }

  const protectedMode = isJudgmentProtectedMode(input.judgmentMode)
  if (protectedMode) {
    // Creative/opinion: distribution signal ok; calibration mostly protected
    confidence = Math.min(confidence, 40)
  }

  if (confidence < minConfidence || margin < 0.08) {
    return {
      contentId: input.contentId,
      settlementEpoch: input.settlementEpoch,
      status: "UNRESOLVED",
      consensusChoice: margin < 0.08 ? "neutral" : "unresolved",
      confidence,
      upWeight,
      downWeight,
      independentVoters,
      qualityDelta: 0,
      reviewerEffects: capped.map((v) => ({
        reviewerId: v.reviewerId,
        choice: v.choice,
        alignment: protectedMode ? ("protected" as const) : ("unresolved" as const),
        jcsDelta: 0,
        effectiveWeight: v.weight,
      })),
      reason: margin < 0.08 ? "CLOSE_CONSENSUS" : "LOW_CONFIDENCE",
    }
  }

  const consensusChoice: "upvote" | "downvote" =
    upWeight >= downWeight ? "upvote" : "downvote"
  const qualityDelta =
    consensusChoice === "upvote"
      ? Math.round((confidence / 100) * 4 * 100) / 100
      : Math.round((-confidence / 100) * 4 * 100) / 100

  const reviewerEffects = capped.map((v) => {
    let alignment: "aligned" | "misaligned" | "protected" | "unresolved" = "unresolved"
    if (protectedMode) {
      alignment = "protected"
    } else if (v.choice === consensusChoice) {
      alignment = "aligned"
    } else {
      alignment = "misaligned"
    }
    const jcsDelta = jcsDeltaForAlignment({
      alignment: alignment === "aligned" || alignment === "misaligned" || alignment === "protected" || alignment === "unresolved"
        ? alignment
        : "unresolved",
      confidence,
      wasDownvote: v.choice === "downvote",
    })
    return {
      reviewerId: v.reviewerId,
      choice: v.choice as CurationChoice,
      alignment,
      jcsDelta,
      effectiveWeight: v.weight,
    }
  })

  return {
    contentId: input.contentId,
    settlementEpoch: input.settlementEpoch,
    status: "SETTLED",
    consensusChoice,
    confidence,
    upWeight,
    downWeight,
    independentVoters,
    qualityDelta,
    reviewerEffects,
    reason: "CONSENSUS",
  }
}

/** Idempotency key for a reviewer effect on a settlement */
export function judgmentEventIdempotencyKey(
  contentId: string,
  epoch: string,
  reviewerId: string
): string {
  return `judgment:${contentId}:${epoch}:${reviewerId}`
}
