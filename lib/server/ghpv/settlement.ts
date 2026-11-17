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
} from "@/lib/server/ghpv/curation-power"
import type { CurationChoice, JudgmentMode } from "@/lib/server/ghpv/types"

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

/**
 * Normalize weights so no single reviewer exceeds MAX_REVIEWER_CONSENSUS_SHARE of total.
 */
export function applyAntiWhaleCap(votes: SettlementVote[]): SettlementVote[] {
  if (votes.length === 0) return []
  const total = votes.reduce((s, v) => s + Math.max(0, v.weight), 0)
  if (total <= 0) return votes.map((v) => ({ ...v, weight: 0 }))
  const cap = total * MAX_REVIEWER_CONSENSUS_SHARE
  // Cap absolute influence to maxShare of pre-cap pool (anti-whale).
  return votes.map((v) => ({
    ...v,
    weight: Math.min(Math.max(0, v.weight), cap),
  }))
}

/**
 * Deterministic consensus settlement.
 */
export function computeSettlement(input: SettlementInput): SettlementOutcome {
  const minVoters = input.minVoters ?? 3
  const minConfidence = input.minConfidence ?? 35
  const capped = applyAntiWhaleCap(
    input.votes.filter((v) => v.choice === "upvote" || v.choice === "downvote")
  )

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
