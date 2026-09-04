/**
 * Server-authoritative reward evaluation + anti-abuse.
 *
 * Client may report: sourceEvent, referenceId, metadata (e.g. targetUserId).
 * Client must NEVER dictate: amount, or that a reward is due.
 *
 * Flow:
 *   event → rule lookup → anti-abuse gates → pending ledger hold
 */

import { DEFAULT_REWARD_RULES } from "@/lib/domains/reward-rules"
import type { RewardRule } from "@/lib/domains/economy-types"
import {
  computeActivityEmission,
  commitActivityEmission,
} from "@/lib/server/economy/activity-emission"
import { ECONOMY_VERSION } from "@/lib/server/economy/economic-config"
import { lagosDayKey } from "@/lib/server/economy/claim-engine"

/** Minimum account age (ms) before social rewards (follow/like/comment) */
const MIN_ACCOUNT_AGE_MS_SOCIAL = 24 * 60 * 60 * 1000
/** Minimum reputation score for high-frequency social rewards */
const MIN_REP_FOR_SOCIAL = 5
import {
  executeAuthoritativePending,
  getGhcAuthoritativeStore,
  type GhcAuthoritativeStore,
} from "@/lib/server/economy/store"

export type EvaluateRewardInput = {
  userId: string
  sourceEvent: string
  referenceId: string
  /** Optional target of the action (followee, post author, group id) */
  targetId?: string
  metadata?: Record<string, unknown>
  /** Client-suggested amount is IGNORED for credit size */
  clientSuggestedAmount?: number
}

export type EvaluateRewardResult =
  | {
      ok: true
      amount: number
      ruleId: string
      holdId: string
      requiresValidation: boolean
      idempotent?: boolean
      transaction?: unknown
      economicVersion?: string
      m?: number
      g?: number
      deniedReasons?: never
    }
  | {
      ok: false
      error: string
      deniedReasons?: string[]
    }

function ruleForEvent(sourceEvent: string): RewardRule | null {
  const key = sourceEvent.trim().toUpperCase()
  const found = DEFAULT_REWARD_RULES.find(
    (r) => r.enabled && String(r.sourceEvent).toUpperCase() === key
  )
  return found || null
}

/** Calendar day key UTC — production should use Africa/Lagos consistently with daily rewards */
function dayKey(ts = Date.now()): string {
  return new Date(ts).toISOString().slice(0, 10)
}

function storeDayCounts(
  store: GhcAuthoritativeStore,
  userId: string,
  sourceEvent: string,
  day: string
): { count: number; amountSum: number; byTarget: Map<string, number> } {
  const byTarget = new Map<string, number>()
  let count = 0
  let amountSum = 0
  const txs = store.listTransactions(userId) || []
  const list = Array.isArray(txs) ? txs : []
  for (const tx of list as Array<{
    sourceEvent?: string
    createdAt?: number
    amount?: number
    referenceId?: string
    reason?: string
    status?: string
  }>) {
    if (String(tx.sourceEvent || "").toUpperCase() !== sourceEvent.toUpperCase()) continue
    const created = Number(tx.createdAt) || 0
    if (dayKey(created) !== day) continue
    if (tx.status === "reversed" || tx.status === "cancelled") continue
    count += 1
    amountSum += Math.abs(Number(tx.amount) || 0)
    // target encoded in referenceId as event:user:target:extra
    const ref = String(tx.referenceId || "")
    const parts = ref.split(":")
    if (parts.length >= 3) {
      const t = parts[2]
      byTarget.set(t, (byTarget.get(t) || 0) + 1)
    }
  }
  return { count, amountSum, byTarget }
}

function lastEventAt(
  store: GhcAuthoritativeStore,
  userId: string,
  sourceEvent: string
): number {
  const txs = store.listTransactions(userId) || []
  const list = Array.isArray(txs) ? txs : []
  let max = 0
  for (const tx of list as Array<{ sourceEvent?: string; createdAt?: number }>) {
    if (String(tx.sourceEvent || "").toUpperCase() !== sourceEvent.toUpperCase()) continue
    const created = Number(tx.createdAt) || 0
    if (created > max) max = created
  }
  return max
}

function hasReference(
  store: GhcAuthoritativeStore,
  userId: string,
  referenceId: string
): boolean {
  const txs = store.listTransactions(userId) || []
  const list = Array.isArray(txs) ? txs : []
  return list.some(
    (tx: { referenceId?: string }) => String(tx.referenceId || "") === referenceId
  )
}

/**
 * Verify social action claims — placeholders for DB-backed checks in production.
 * Never trusts "I followed 50 people → 50 rewards" without unique referenceIds.
 */
export function verifyActionLegitimacy(input: {
  userId: string
  sourceEvent: string
  targetId?: string
  metadata?: Record<string, unknown>
}): { ok: boolean; reasons: string[] } {
  const reasons: string[] = []
  const event = input.sourceEvent.toUpperCase()
  const target = (input.targetId || "").trim()
  const meta = input.metadata || {}

  // Self-targeting
  if (target && target === input.userId) {
    reasons.push("SELF_TARGET")
  }

  // Follow farming: require explicit target; reject bulk count claims
  if (event.includes("FOLLOW") || event === "USER_FOLLOWED") {
    if (!target) reasons.push("FOLLOW_TARGET_REQUIRED")
    const bulk = Number(meta.count || meta.followCount || 0)
    if (bulk > 1) reasons.push("BULK_FOLLOW_NOT_ALLOWED")
  }

  // Like / comment spam — never accept client "count" multipliers
  if (event.includes("LIKE") || event.includes("COMMENT") || event.includes("REACT")) {
    if (!target) reasons.push("TARGET_REQUIRED")
    const bulk = Number(meta.count || meta.quantity || 0)
    if (bulk > 1) reasons.push("BULK_SOCIAL_NOT_ALLOWED")
    // Meaningful interaction: reject empty / placeholder content claims
    if (event.includes("COMMENT")) {
      const len = Number(meta.contentLength || meta.textLength || 0)
      const text = String(meta.text || meta.body || "")
      if (len > 0 && len < 8 && text.trim().length < 8) {
        reasons.push("COMMENT_TOO_SHORT")
      }
      if (meta.duplicateContent === true) reasons.push("DUPLICATE_CONTENT")
    }
  }

  // Reciprocal abuse (A likes B, B likes A in tight loop)
  if (meta.reciprocalBurst === true || meta.mutualFarm === true) {
    reasons.push("RECIPROCAL_ABUSE")
  }

  // Account age — new accounts get delayed social rewards
  const accountCreatedAt = Number(meta.accountCreatedAt || meta.accountAgeMs || 0)
  if (accountCreatedAt > 0) {
    const age =
      accountCreatedAt < 1e12 ? accountCreatedAt : Date.now() - accountCreatedAt
    // if metadata is a timestamp
    const ageMs =
      accountCreatedAt > 1e12 ? Date.now() - accountCreatedAt : accountCreatedAt
    const isSocial =
      event.includes("FOLLOW") ||
      event.includes("LIKE") ||
      event.includes("COMMENT") ||
      event.includes("REACT")
    if (isSocial && ageMs < MIN_ACCOUNT_AGE_MS_SOCIAL) {
      reasons.push("ACCOUNT_TOO_NEW")
    }
  }

  // Reputation floor for high-frequency events
  const rep = Number(meta.reputationScore)
  if (
    Number.isFinite(rep) &&
    rep < MIN_REP_FOR_SOCIAL &&
    (event.includes("LIKE") || event.includes("FOLLOW"))
  ) {
    reasons.push("REPUTATION_TOO_LOW")
  }

  // Suspicious / automated activity
  if (
    meta.suspicious === true ||
    meta.automated === true ||
    meta.botScore === true ||
    Number(meta.botScore) > 0.85
  ) {
    reasons.push("SUSPICIOUS_ACTIVITY")
  }

  // Velocity: too many actions in a short window (client hint; server also has cooldown)
  const actionsLastMin = Number(meta.actionsLastMinute || 0)
  if (actionsLastMin > 20) {
    reasons.push("VELOCITY_LIMIT")
  }

  // Blocked accounts
  if (meta.actorBlocked || meta.targetBlocked) {
    reasons.push("BLOCKED_ACCOUNT")
  }

  // Reversed / undone actions
  if (meta.reversed === true || meta.undone === true) {
    reasons.push("ACTION_REVERSED")
  }

  // Target must be real when provided
  if (meta.targetMissing === true || meta.targetNotFound === true) {
    reasons.push("TARGET_NOT_FOUND")
  }

  return { ok: reasons.length === 0, reasons }
}

export async function evaluateRewardAuthoritative(
  input: EvaluateRewardInput
): Promise<EvaluateRewardResult> {
  const sourceEvent = String(input.sourceEvent || "").trim()
  const referenceId = String(input.referenceId || "").trim()
  if (!sourceEvent) return { ok: false, error: "SOURCE_EVENT_REQUIRED" }
  if (!referenceId) return { ok: false, error: "REFERENCE_REQUIRED" }

  const rule = ruleForEvent(sourceEvent)
  if (!rule) {
    return { ok: false, error: "NO_RULE", deniedReasons: ["UNKNOWN_SOURCE_EVENT"] }
  }

  // Server base amount only — ignore clientSuggestedAmount for credit size.
  // ECONOMY_VERSION 1.2: activity-style rewards pass through cap + m × g.
  const baseAmount = Number(rule.amount)
  if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
    return { ok: false, error: "RULE_AMOUNT_INVALID" }
  }

  // Daily check-in is handled by claim-engine via /api/economy/rewards/daily
  if (sourceEvent.toUpperCase() === "DAILY_CHECKIN") {
    return {
      ok: false,
      error: "USE_DAILY_CLAIM_ENDPOINT",
      deniedReasons: ["ROUTE_TO_DAILY_CLAIM_V12"],
    }
  }

  const day = lagosDayKey()
  const emission = computeActivityEmission({
    userId: input.userId,
    baseAmountGhc: baseAmount,
    dayKey: day,
  })
  if (!emission.ok) {
    return {
      ok: false,
      error: emission.error,
      deniedReasons: [emission.error, `DAY_REM_${emission.dayRemaining}`, `WEEK_REM_${emission.weekRemaining}`],
    }
  }
  const amount = emission.grantedGhc

  const legitimacy = verifyActionLegitimacy({
    userId: input.userId,
    sourceEvent,
    targetId: input.targetId,
    metadata: input.metadata,
  })
  if (!legitimacy.ok) {
    return {
      ok: false,
      error: "ANTI_ABUSE",
      deniedReasons: legitimacy.reasons,
    }
  }

  if (rule.antiAbuse?.blockSelf && input.targetId && input.targetId === input.userId) {
    return { ok: false, error: "ANTI_ABUSE", deniedReasons: ["SELF_TARGET"] }
  }

  const store = getGhcAuthoritativeStore()

  // Idempotency by referenceId
  if (hasReference(store, input.userId, referenceId)) {
    return { ok: false, error: "ALREADY_REWARDED", deniedReasons: ["DUPLICATE_REFERENCE"] }
  }

  const dayStats = storeDayCounts(store, input.userId, sourceEvent, day)

  if (rule.dailyLimit != null && dayStats.count >= rule.dailyLimit) {
    return {
      ok: false,
      error: "DAILY_CAP",
      deniedReasons: [`DAILY_LIMIT_${rule.dailyLimit}`],
    }
  }

  const maxPerTarget = rule.antiAbuse?.maxPerTargetPerDay
  if (maxPerTarget != null && input.targetId) {
    const n = dayStats.byTarget.get(input.targetId) || 0
    if (n >= maxPerTarget) {
      return {
        ok: false,
        error: "TARGET_CAP",
        deniedReasons: [`MAX_PER_TARGET_${maxPerTarget}`],
      }
    }
  }

  const cooldown = rule.antiAbuse?.cooldownMs || 0
  if (cooldown > 0) {
    const last = lastEventAt(store, input.userId, sourceEvent)
    if (last > 0 && Date.now() - last < cooldown) {
      return {
        ok: false,
        error: "COOLDOWN",
        deniedReasons: [`COOLDOWN_MS_${cooldown}`],
      }
    }
  }

  const result = await executeAuthoritativePending(store, {
    userId: input.userId,
    amount,
    referenceId,
    reason: rule.description || sourceEvent,
    sourceEvent,
  })

  if (!result.ok) {
    return { ok: false, error: result.error || "PENDING_FAILED" }
  }

  commitActivityEmission({
    userId: input.userId,
    result: emission,
    dayKey: day,
  })

  return {
    ok: true,
    amount,
    ruleId: rule.id,
    holdId: result.tx.id,
    requiresValidation: Boolean(rule.requiresValidation),
    idempotent: result.idempotent,
    transaction: result.tx,
    economicVersion: ECONOMY_VERSION,
    m: emission.m,
    g: emission.g,
  }
}
