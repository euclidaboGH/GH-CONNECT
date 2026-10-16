/**
 * GHPV-1A — weighted judgment from session identity + server CP only.
 * Never accepts client power/reputation/balance.
 * Loads stored calibration when available; safe defaults otherwise.
 */

import { getReputationState } from "@/lib/server/reputation/store"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import {
  computeCurationPower,
  DEFAULT_INTEGRITY,
  DEFAULT_JCS,
  MAX_REVIEWER_CONSENSUS_SHARE,
} from "@/lib/server/ghpv/curation-power"
import type { CurationChoice, JudgmentMode } from "@/lib/server/ghpv/types"

export type WeightedVoteInput = {
  reviewerId: string
  choice: CurationChoice
  /** Optional account age days if known; defaults conservatively */
  accountAgeDays?: number
}

export type WeightedVoteResult = {
  reviewerId: string
  choice: CurationChoice
  curationPower: number
  /** Unit weight for this reviewer's active contribution (anti-whale applied at settlement only) */
  effectiveWeight: number
  reputationLevel: number
  jcs: number
  integrity: number
  maxConsensusShare: number
  calibrationSource: "stored" | "default"
}

async function loadStoredCalibration(
  userId: string
): Promise<{ jcs: number; integrity: number } | null> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey || !userId) return null
  try {
    const url =
      `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_curator_calibration` +
      `?user_id=eq.${encodeURIComponent(userId)}` +
      `&select=jcs,integrity_score&limit=1`
    const res = await fetch(url, {
      method: "GET",
      headers: {
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    })
    if (!res.ok) return null
    const rows = (await res.json()) as Array<{
      jcs?: number
      integrity_score?: number
    }>
    if (!Array.isArray(rows) || !rows[0]) return null
    const jcs = Number(rows[0].jcs)
    const integrity = Number(rows[0].integrity_score)
    if (!Number.isFinite(jcs) || !Number.isFinite(integrity)) return null
    return {
      jcs: Math.min(100, Math.max(0, jcs)),
      integrity: Math.min(100, Math.max(0, integrity)),
    }
  } catch {
    return null
  }
}

/**
 * Derive curation weight for one vote. Session reviewerId only.
 */
export async function resolveWeightedVote(
  input: WeightedVoteInput
): Promise<WeightedVoteResult> {
  const reviewerId = String(input.reviewerId || "").trim()
  const choice = input.choice

  let level = 1
  let jcs = DEFAULT_JCS
  let integrity = DEFAULT_INTEGRITY
  let calibrationSource: "stored" | "default" = "default"

  if (reviewerId) {
    const rep = await getReputationState(reviewerId)
    if (rep.ok) {
      level = Math.min(15, Math.max(1, Number(rep.level) || 1))
    }
    const cal = await loadStoredCalibration(reviewerId)
    if (cal) {
      jcs = cal.jcs
      integrity = cal.integrity
      calibrationSource = "stored"
    }
  }

  const curationPower = computeCurationPower({
    reputationLevel: level,
    judgmentCalibration: jcs,
    integrityScore: integrity,
    accountAgeDays: input.accountAgeDays ?? 30,
    independenceFactor: 1,
    antiAbuseFactor: integrity / 100,
  })

  // Raw unit weight for active contribution. 12% anti-whale is settlement-only.
  const effectiveWeight = curationPower

  return {
    reviewerId,
    choice,
    curationPower,
    effectiveWeight,
    reputationLevel: level,
    jcs,
    integrity,
    maxConsensusShare: MAX_REVIEWER_CONSENSUS_SHARE,
    calibrationSource,
  }
}

/** Ignore any client-forged authority fields on the request body. */
export function stripClientAuthority(body: Record<string, unknown>): void {
  void body.userId
  void body.reviewerId
  void body.reviewer_id
  void body.curationPower
  void body.curation_power
  void body.reputation
  void body.level
  void body.score
  void body.qualityScore
  void body.quality_score
  void body.balance
  void body.ghcBalance
  void body.ghc
  void body.walletBalance
  void body.jcs
  void body.integrity
  void body.integrityScore
}

export function inferJudgmentMode(meta?: {
  contentType?: string | null
}): JudgmentMode {
  const t = String(meta?.contentType || "").toLowerCase()
  if (t.includes("art") || t.includes("photo") || t.includes("music") || t.includes("poem")) {
    return "creative"
  }
  if (t.includes("opinion") || t.includes("politics")) return "opinion"
  if (t.includes("harm") || t.includes("safety")) return "harm"
  if (t.includes("fact") || t.includes("news")) return "factual"
  return "useful"
}

/**
 * Pure SET-semantics simulator for tests (mirrors migration logic without DB).
 */
export type ActiveWeightRow = {
  reviewerId: string
  choice: "upvote" | "downvote"
  weight: number
}

export function applyActiveWeightSet(
  rows: ActiveWeightRow[],
  reviewerId: string,
  choice: "upvote" | "downvote" | "neutral",
  weight: number
): {
  rows: ActiveWeightRow[]
  upvoteWeight: number
  downvoteWeight: number
  independentVoters: number
} {
  const id = String(reviewerId).trim()
  let next = rows.filter((r) => r.reviewerId !== id)
  if (choice === "upvote" || choice === "downvote") {
    next = [
      ...next,
      { reviewerId: id, choice, weight: Math.max(0, weight) },
    ]
  }
  let up = 0
  let down = 0
  for (const r of next) {
    if (r.choice === "upvote") up += r.weight
    else down += r.weight
  }
  return {
    rows: next,
    upvoteWeight: up,
    downvoteWeight: down,
    independentVoters: next.length,
  }
}
