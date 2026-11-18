/**
 * GHPV-3 — Curator calibration (JCS / reliability / maturity).
 * Server-authoritative, bounded, no GHC.
 */

import {
  DEFAULT_INTEGRITY,
  DEFAULT_JCS,
  clamp01to100,
  computeCurationPower,
  jcsDeltaForAlignment,
} from "@/lib/server/ghpv/curation-power"
import type { SettlementOutcome } from "@/lib/server/ghpv/settlement"

/** Minimum settled judgments before strong JCS effects apply */
export const MIN_SAMPLES_FOR_STRONG_CALIBRATION = 5

/** Max |JCS| change per settlement event */
export const MAX_JCS_DELTA_PER_EVENT = 2.5

/** Max |JCS| change per UTC day (cooldown/cap) */
export const MAX_JCS_DELTA_PER_DAY = 6

/** Early-vote window: votes in first N minutes get dampened calibration */
export const EARLY_VOTE_WINDOW_MS = 15 * 60 * 1000
export const EARLY_VOTE_CALIBRATION_FACTOR = 0.5

export type CuratorCalibrationState = {
  userId: string
  jcs: number
  integrityScore: number
  correctCount: number
  incorrectCount: number
  unresolvedCount: number
  sampleCount: number
  curationPower: number
  /** Running sum of |jcsDelta| applied today (UTC day key) */
  dayKey: string
  dayDeltaAbs: number
  updatedAt: string
}

export function defaultCalibration(userId: string): CuratorCalibrationState {
  const dayKey = new Date().toISOString().slice(0, 10)
  return {
    userId,
    jcs: DEFAULT_JCS,
    integrityScore: DEFAULT_INTEGRITY,
    correctCount: 0,
    incorrectCount: 0,
    unresolvedCount: 0,
    sampleCount: 0,
    curationPower: computeCurationPower({
      reputationLevel: 1,
      judgmentCalibration: DEFAULT_JCS,
      integrityScore: DEFAULT_INTEGRITY,
      accountAgeDays: 1,
      independenceFactor: 1,
      antiAbuseFactor: 1,
    }),
    dayKey,
    dayDeltaAbs: 0,
    updatedAt: new Date().toISOString(),
  }
}

export type CalibrationApplyInput = {
  state: CuratorCalibrationState
  alignment: "aligned" | "misaligned" | "protected" | "unresolved"
  confidence: number
  wasDownvote: boolean
  /** Settlement fully settled (not UNRESOLVED) */
  settled: boolean
  reputationLevel?: number
  accountAgeDays?: number
  /** Vote cast within early window after publish */
  earlyVote?: boolean
  /** Suspected ring/coordination for this reviewer on this content */
  coordinationSuspect?: boolean
  /** Self or alternate-account vote on own content */
  selfOrAltVote?: boolean
  now?: Date
}

export type CalibrationApplyResult = {
  state: CuratorCalibrationState
  appliedDelta: number
  skipped: boolean
  skipReason?: string
}

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Apply one settlement outcome to a curator. Gradual, bounded, deterministic.
 */
export function applyCalibrationEvent(
  input: CalibrationApplyInput
): CalibrationApplyResult {
  const now = input.now ?? new Date()
  let state = { ...input.state }
  const day = utcDayKey(now)
  if (state.dayKey !== day) {
    state = { ...state, dayKey: day, dayDeltaAbs: 0 }
  }

  if (input.selfOrAltVote) {
    return {
      state: {
        ...state,
        integrityScore: clamp01to100(state.integrityScore - 3),
        updatedAt: now.toISOString(),
      },
      appliedDelta: 0,
      skipped: true,
      skipReason: "SELF_OR_ALT_VOTE",
    }
  }

  if (input.coordinationSuspect) {
    return {
      state: {
        ...state,
        integrityScore: clamp01to100(state.integrityScore - 5),
        unresolvedCount: state.unresolvedCount + 1,
        updatedAt: now.toISOString(),
      },
      appliedDelta: 0,
      skipped: true,
      skipReason: "COORDINATION_SUSPECT",
    }
  }

  if (!input.settled || input.alignment === "unresolved") {
    return {
      state: {
        ...state,
        unresolvedCount: state.unresolvedCount + 1,
        updatedAt: now.toISOString(),
      },
      appliedDelta: 0,
      skipped: true,
      skipReason: "UNRESOLVED_OR_INSUFFICIENT",
    }
  }

  if (input.alignment === "protected") {
    // Subjective content: no JCS hit/boost from disagreement
    return {
      state: {
        ...state,
        sampleCount: state.sampleCount + 1,
        updatedAt: now.toISOString(),
      },
      appliedDelta: 0,
      skipped: true,
      skipReason: "PROTECTED_MODE",
    }
  }

  let delta = jcsDeltaForAlignment({
    alignment: input.alignment === "aligned" ? "aligned" : "misaligned",
    confidence: input.confidence,
    wasDownvote: input.wasDownvote,
  })

  // New reviewers: dampen until sample maturity
  if (state.sampleCount < MIN_SAMPLES_FOR_STRONG_CALIBRATION) {
    delta *= 0.35
  }

  // One-off disagreement with low confidence stays mild
  if (input.alignment === "misaligned" && input.confidence < 50) {
    delta *= 0.5
  }

  if (input.earlyVote) {
    delta *= EARLY_VOTE_CALIBRATION_FACTOR
  }

  // Bound per event
  if (delta > MAX_JCS_DELTA_PER_EVENT) delta = MAX_JCS_DELTA_PER_EVENT
  if (delta < -MAX_JCS_DELTA_PER_EVENT) delta = -MAX_JCS_DELTA_PER_EVENT

  // Daily cap
  const room = MAX_JCS_DELTA_PER_DAY - state.dayDeltaAbs
  if (room <= 0) {
    return {
      state: { ...state, updatedAt: now.toISOString() },
      appliedDelta: 0,
      skipped: true,
      skipReason: "DAILY_CAP",
    }
  }
  if (Math.abs(delta) > room) {
    delta = delta > 0 ? room : -room
  }

  const nextJcs = clamp01to100(state.jcs + delta)
  const correctCount =
    state.correctCount + (input.alignment === "aligned" ? 1 : 0)
  const incorrectCount =
    state.incorrectCount + (input.alignment === "misaligned" ? 1 : 0)
  const sampleCount = state.sampleCount + 1

  // Integrity: slow drift with accuracy; never crash on one event
  let integrity = state.integrityScore
  if (input.alignment === "aligned" && input.confidence >= 60) {
    integrity = clamp01to100(integrity + 0.15)
  } else if (input.alignment === "misaligned" && input.confidence >= 70) {
    integrity = clamp01to100(integrity - 0.25)
  }

  const curationPower = computeCurationPower({
    reputationLevel: input.reputationLevel ?? 1,
    judgmentCalibration: nextJcs,
    integrityScore: integrity,
    accountAgeDays: input.accountAgeDays ?? 30,
    independenceFactor: 1,
    antiAbuseFactor: integrity / 100,
  })

  return {
    state: {
      ...state,
      jcs: nextJcs,
      integrityScore: integrity,
      correctCount,
      incorrectCount,
      sampleCount,
      curationPower,
      dayDeltaAbs: state.dayDeltaAbs + Math.abs(delta),
      updatedAt: now.toISOString(),
    },
    appliedDelta: delta,
    skipped: false,
  }
}

/**
 * Apply settlement outcome to many reviewers (deterministic order by reviewerId).
 */
export function applySettlementToCalibrations(
  outcome: SettlementOutcome,
  states: Map<string, CuratorCalibrationState>,
  opts?: {
    reputationLevels?: Map<string, number>
    earlyReviewerIds?: Set<string>
    coordinationSuspectIds?: Set<string>
    selfOrAltIds?: Set<string>
  }
): Map<string, CuratorCalibrationState> {
  const next = new Map(states)
  const effects = [...outcome.reviewerEffects].sort((a, b) =>
    a.reviewerId.localeCompare(b.reviewerId)
  )
  for (const eff of effects) {
    const prev = next.get(eff.reviewerId) || defaultCalibration(eff.reviewerId)
    const result = applyCalibrationEvent({
      state: prev,
      alignment: eff.alignment,
      confidence: outcome.confidence,
      wasDownvote: eff.choice === "downvote",
      settled: outcome.status === "SETTLED",
      reputationLevel: opts?.reputationLevels?.get(eff.reviewerId),
      earlyVote: opts?.earlyReviewerIds?.has(eff.reviewerId),
      coordinationSuspect: opts?.coordinationSuspectIds?.has(eff.reviewerId),
      selfOrAltVote: opts?.selfOrAltIds?.has(eff.reviewerId),
    })
    next.set(eff.reviewerId, result.state)
  }
  return next
}

/** Reliability 0–100 from sample + accuracy */
export function judgmentReliability(state: CuratorCalibrationState): number {
  if (state.sampleCount < 3) return Math.min(40, state.jcs * 0.6)
  const decided = state.correctCount + state.incorrectCount
  const accuracy = decided > 0 ? state.correctCount / decided : 0.5
  const maturity = Math.min(1, state.sampleCount / 20)
  return clamp01to100(state.jcs * 0.5 + accuracy * 40 * maturity + 10)
}

export function judgmentMaturity(state: CuratorCalibrationState): number {
  return clamp01to100((state.sampleCount / 30) * 100)
}
