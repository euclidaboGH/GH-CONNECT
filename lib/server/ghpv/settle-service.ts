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

export function parseSnapshot(data: unknown): SettlementSnapshot | { ok: false; error: string } {
  const row = data as Record<string, unknown> | null
  if (!row || row.ok === false) {
    return { ok: false, error: String(row?.error || "SNAPSHOT_FAILED") }
  }
  const modeRaw = String(row.judgmentMode || "useful")
  const mode = (MODES.has(modeRaw) ? modeRaw : "useful") as JudgmentMode
  const votesRaw = Array.isArray(row.votes) ? row.votes : []
  const votes: SettlementSnapshotVote[] = []
  for (const item of votesRaw) {
    const v = item as Record<string, unknown>
    const choice = String(v.choice || "")
    const reviewerId = String(v.reviewerId || "").trim()
    const weight = Number(v.weight)
    if (!reviewerId) continue
    if (choice !== "upvote" && choice !== "downvote") continue
    if (!Number.isFinite(weight) || weight < 0) continue
    votes.push({ reviewerId, choice, weight })
  }
  return {
    ok: true,
    contentId: String(row.contentId || ""),
    authorId: String(row.authorId || ""),
    judgmentMode: mode,
    settlementStatus: String(row.settlementStatus || "open"),
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

async function loadCalibrationMap(reviewerIds: string[]): Promise<Map<string, CuratorCalibrationState>> {
  const map = new Map<string, CuratorCalibrationState>()
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey || reviewerIds.length === 0) return map
  const list = reviewerIds.map((id) => `"${id.replace(/"/g, "")}"`).join(",")
  const url =
    `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_curator_calibration` +
    `?user_id=in.(${encodeURIComponent(list)})` +
    `&select=user_id,jcs,integrity_score,correct_count,incorrect_count,unresolved_count,curation_power`
  try {
    const res = await fetch(url, {
      headers: {
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    })
    if (!res.ok) return map
    const rows = (await res.json()) as Array<Record<string, unknown>>
    for (const row of rows) {
      const userId = String(row.user_id || "")
      if (!userId) continue
      const base = defaultCalibration(userId)
      map.set(userId, {
        ...base,
        jcs: Number(row.jcs ?? base.jcs),
        integrityScore: Number(row.integrity_score ?? base.integrityScore),
        correctCount: Number(row.correct_count ?? 0),
        incorrectCount: Number(row.incorrect_count ?? 0),
        unresolvedCount: Number(row.unresolved_count ?? 0),
        sampleCount: Number(row.correct_count ?? 0) + Number(row.incorrect_count ?? 0),
        curationPower: Number(row.curation_power ?? base.curationPower),
      })
    }
  } catch {
    return map
  }
  return map
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

  const snapRes = await socialRpc("gh_ghpv_settlement_snapshot", { p_content_id: contentId })
  const snapshot = parseSnapshot(snapRes.data)
  if (!snapshot.ok) {
    return { ok: false, error: snapshot.error, ghcMutated: false }
  }

  const epoch = input.settlementEpoch || settlementEpochFor()
  const outcome = computeSettlement({
    contentId,
    settlementEpoch: epoch,
    judgmentMode: snapshot.judgmentMode,
    votes: snapshot.votes,
  })

  const selfOrAlt = new Set<string>()
  if (snapshot.authorId) selfOrAlt.add(snapshot.authorId)

  const prior = await loadCalibrationMap(snapshot.votes.map((v) => v.reviewerId))
  const next = applySettlementToCalibrations(outcome, prior, { selfOrAltIds: selfOrAlt })

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
