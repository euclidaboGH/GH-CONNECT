/**
 * GHPV-1B settlement service.
 *
 * Snapshot is loaded only from server tables via gh_ghpv_settlement_snapshot.
 * computeSettlement() is pure and receives that validated snapshot only.
 * Persist uses gh_ghpv_commit_settlement (idempotent per content+epoch).
 *
 * Not called from the user vote request.
 * Does not mint, credit, or transfer GHC.
 *
 * RAW CURATION POWER is stored on the active weight row.
 * SETTLEMENT CONSENSUS SHARE is capped at MAX_REVIEWER_CONSENSUS_SHARE (0.12)
 * only inside computeSettlement / applyAntiWhaleCap. The stored power is not replaced.
 */

import { socialRpc } from "@/lib/server/social/rpc"
import { computeSettlement, judgmentEventIdempotencyKey } from "@/lib/server/ghpv/settlement"
import { supabaseRpc, supabaseRest } from "@/lib/server/supabase/rest-client"
import {
  applySettlementToCalibrations,
  defaultCalibration,
  type CuratorCalibrationState,
} from "@/lib/server/ghpv/calibration"
import type { JudgmentMode } from "@/lib/server/ghpv/types"
import { readGhcServerEnv } from "@/lib/server/economy/env"

export type SettlementSnapshotVote = {
  reviewerId: string
  choice: "upvote" | "downvote"
  weight: number
}

export type SettlementSnapshot = {
  ok: true
  contentId: string
  authorId: string
  judgmentMode: JudgmentMode
  settlementStatus: string
  votes: SettlementSnapshotVote[]
}

const MODES = new Set(["factual", "useful", "creative", "opinion", "harm"])
const SAFE_SETTLEMENT_ID = /^[A-Za-z0-9._:-]{1,128}$/

export function parseSnapshot(data: unknown): SettlementSnapshot | { ok: false; error: string } {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, error: "SNAPSHOT_INVALID" }
  }
  const row = data as Record<string, unknown>
  if (row.ok === false) return { ok: false, error: String(row.error || "SNAPSHOT_FAILED") }

  const contentId = typeof row.contentId === "string" ? row.contentId.trim() : ""
  const authorId = typeof row.authorId === "string" ? row.authorId.trim() : ""
  if (!SAFE_SETTLEMENT_ID.test(contentId) || !SAFE_SETTLEMENT_ID.test(authorId)) {
    return { ok: false, error: "SNAPSHOT_IDENTITY_INVALID" }
  }
  if (typeof row.judgmentMode !== "string" || !MODES.has(row.judgmentMode)) {
    return { ok: false, error: "SNAPSHOT_JUDGMENT_MODE_INVALID" }
  }
  if (row.settlementStatus != null && !["open", "settled", "unresolved"].includes(String(row.settlementStatus))) {
    return { ok: false, error: "SNAPSHOT_STATUS_INVALID" }
  }
  if (!Array.isArray(row.votes)) return { ok: false, error: "SNAPSHOT_VOTES_INVALID" }
  if (row.votes.length > 500) return { ok: false, error: "SNAPSHOT_VOTE_LIMIT_EXCEEDED" }

  const votes: SettlementSnapshotVote[] = []
  for (const item of row.votes) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, error: "INVALID_SNAPSHOT_VOTE" }
    }
    const vote = item as Record<string, unknown>
    const reviewerId = typeof vote.reviewerId === "string" ? vote.reviewerId.trim() : ""
    const choice = vote.choice
    const weight = vote.weight
    if (!SAFE_SETTLEMENT_ID.test(reviewerId)
      || (choice !== "upvote" && choice !== "downvote")
      || typeof weight !== "number" || !Number.isFinite(weight) || weight <= 0 || weight > 25) {
      return { ok: false, error: "INVALID_SNAPSHOT_VOTE" }
    }
    votes.push({ reviewerId, choice, weight })
  }
  return {
    ok: true,
    contentId,
    authorId,
    judgmentMode: row.judgmentMode as JudgmentMode,
    settlementStatus: typeof row.settlementStatus === "string" ? row.settlementStatus : "open",
    votes,
  }
}

/** UTC week epoch — deterministic, not client-supplied. */
export function settlementEpochFor(date = new Date()): string {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = utc.getUTCDay() || 7
  utc.setUTCDate(utc.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`
}

async function loadCalibrationMap(reviewerIds: string[]): Promise<
  | { ok: true; map: Map<string, CuratorCalibrationState> }
  | { ok: false; error: string }
> {
  const map = new Map<string, CuratorCalibrationState>()
  const uniqueIds = [...new Set(reviewerIds.map((id) => id.trim()).filter(Boolean))]
  if (uniqueIds.length === 0) return { ok: true, map }
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { ok: false, error: "CALIBRATION_STATE_UNAVAILABLE" }
  }
  const list = uniqueIds.map((id) => `"${id.replace(/"/g, "")}"`).join(",")
  const path = `gh_curator_calibration?user_id=in.(${encodeURIComponent(list)})&select=user_id,jcs,integrity_score,correct_count,incorrect_count,unresolved_count,curation_power`
  const result = await supabaseRest<Array<Record<string, unknown>>>(path, {
    timeoutMs: 8_000,
    maxResponseBytes: 512 * 1024,
  })
  if (!result.ok || !Array.isArray(result.data)) {
    return { ok: false, error: "CALIBRATION_STATE_UNAVAILABLE" }
  }
  const seenCalibrationIds = new Set<string>()
  for (const row of result.data) {
    const userId = typeof row.user_id === "string" ? row.user_id.trim() : ""
    if (!SAFE_SETTLEMENT_ID.test(userId) || !uniqueIds.includes(userId) || seenCalibrationIds.has(userId)) {
      return { ok: false, error: "CALIBRATION_STATE_INVALID" }
    }
    seenCalibrationIds.add(userId)
    const numeric = [row.jcs, row.integrity_score, row.correct_count, row.incorrect_count, row.unresolved_count, row.curation_power]
    if (numeric.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
      return { ok: false, error: "CALIBRATION_STATE_INVALID" }
    }
    const base = defaultCalibration(userId)
    const jcs = Number(row.jcs ?? base.jcs)
    const integrityScore = Number(row.integrity_score ?? base.integrityScore)
    const correctCount = Number(row.correct_count ?? 0)
    const incorrectCount = Number(row.incorrect_count ?? 0)
    const unresolvedCount = Number(row.unresolved_count ?? 0)
    const curationPower = Number(row.curation_power ?? base.curationPower)
    if (jcs < 0 || jcs > 100 || integrityScore < 0 || integrityScore > 100
      || [correctCount, incorrectCount, unresolvedCount].some((n) => !Number.isSafeInteger(n) || n < 0)
      || curationPower < 0 || curationPower > 25) {
      return { ok: false, error: "CALIBRATION_STATE_INVALID" }
    }
    map.set(userId, {
      ...base, jcs, integrityScore, correctCount, incorrectCount, unresolvedCount,
      sampleCount: correctCount + incorrectCount, curationPower,
    })
  }
  // New reviewers may legitimately have no calibration row. Existing rows may
  // never be replaced by defaults after a failed or malformed read. The current
  // deployed table does not persist dayKey/dayDeltaAbs; defaultCalibration's
  // daily JCS counter is therefore NOT a durable cross-settlement cap. RUN376
  // records this as a separate migration/operator gate; do not claim otherwise.
  for (const id of uniqueIds) if (!map.has(id)) map.set(id, defaultCalibration(id))
  return { ok: true, map }
}

export async function settleContentEpoch(input: {
  contentId: string
  settlementEpoch?: string
}): Promise<{
  ok: boolean
  error?: string
  idempotent?: boolean
  status?: string
  consensus?: string
  confidence?: number
  reason?: string
  independentVoters?: number
  ghcMutated: false
}> {
  const contentId = String(input.contentId || "").trim()
  if (!contentId) return { ok: false, error: "CONTENT_REQUIRED", ghcMutated: false }
  if (process.env.GH_GHPV_CALIBRATION_DAILY_CAP_V2_ENABLED !== "true") {
    return { ok: false, error: "CALIBRATION_DAILY_CAP_MIGRATION_REQUIRED", ghcMutated: false }
  }

  const snapRes = await socialRpc("gh_ghpv_settlement_snapshot", { p_content_id: contentId })
  const snapshot = parseSnapshot(snapRes.data)
  if (!snapshot.ok) {
    return { ok: false, error: snapshot.error, ghcMutated: false }
  }

  if (snapshot.contentId !== contentId) {
    return { ok: false, error: "SNAPSHOT_CONTENT_MISMATCH", ghcMutated: false }
  }
  const epoch = input.settlementEpoch || settlementEpochFor()
  if (!/^\d{4}-W\d{2}$/.test(epoch)) {
    return { ok: false, error: "INVALID_SETTLEMENT_EPOCH", ghcMutated: false }
  }
  const outcome = computeSettlement({
    contentId,
    settlementEpoch: epoch,
    judgmentMode: snapshot.judgmentMode,
    votes: snapshot.votes,
  })

  const selfOrAlt = new Set<string>()
  if (snapshot.authorId) selfOrAlt.add(snapshot.authorId)

  const calibration = await loadCalibrationMap(snapshot.votes.map((v) => v.reviewerId))
  if (!calibration.ok) {
    return { ok: false, error: calibration.error, ghcMutated: false }
  }
  const next = applySettlementToCalibrations(outcome, calibration.map, { selfOrAltIds: selfOrAlt })

  const effects = outcome.reviewerEffects.map((eff) => {
    const state = next.get(eff.reviewerId) || defaultCalibration(eff.reviewerId)
    return {
      reviewerId: eff.reviewerId,
      choice: eff.choice,
      alignment: eff.alignment,
      jcsDelta: eff.jcsDelta,
      nextJcs: state.jcs,
      nextIntegrity: state.integrityScore,
      correctCount: state.correctCount,
      incorrectCount: state.incorrectCount,
      unresolvedCount: state.unresolvedCount,
      curationPower: state.curationPower,
      idempotencyKey: judgmentEventIdempotencyKey(contentId, epoch, eff.reviewerId),
    }
  })

  const commit = await socialRpc("gh_ghpv_commit_settlement", {
    p_content_id: contentId,
    p_settlement_epoch: epoch,
    p_status: outcome.status === "SETTLED" ? "settled" : "unresolved",
    p_consensus: outcome.consensusChoice,
    p_confidence: outcome.confidence,
    p_quality_delta: outcome.qualityDelta,
    p_effects: effects,
  })
  const data = commit.data as { ok?: boolean; error?: string; idempotent?: boolean } | null
  if (!commit.ok || data?.ok === false) {
    return { ok: false, error: data?.error || commit.error || "COMMIT_FAILED", ghcMutated: false }
  }

  return {
    ok: true,
    idempotent: Boolean(data?.idempotent),
    status: outcome.status,
    consensus: outcome.consensusChoice,
    confidence: outcome.confidence,
    reason: outcome.reason,
    independentVoters: outcome.independentVoters,
    ghcMutated: false,
  }
}
