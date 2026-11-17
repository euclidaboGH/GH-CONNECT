/**
 * Economy integrity & anti-abuse — configurable policy layer.
 * Prefer tuning these values over hardcoding one-off checks in UI.
 */

import type { EconomyLimits, GhcTransaction, RewardRecord } from "./economy-types"
import { DEFAULT_ECONOMY_LIMITS } from "./economy-types"

/** Extends base limits with anti-abuse knobs (all configurable) */
export interface EconomyAntiAbusePolicy {
  limits: EconomyLimits
  /** Minimum account age (ms) before earning rewards (0 = no gate) */
  minAccountAgeMsForEarn: number
  /** Minimum reputation score to earn (0 = no gate) */
  minReputationForEarn: number
  /** Higher-value rewards that always stay pending until validation */
  highValueRewardThreshold: number
  /** Max reward evaluations per user per minute (bot throttle) */
  maxRewardEvalsPerMinute: number
  /** Max spend mutations per minute */
  maxSpendPerMinute: number
  /** Block creditPurchase without server authority marker in production */
  requireServerAuthorityForPurchaseCredit: boolean
  /** Reject duplicate referenceId within this window */
  idempotencyWindowMs: number
  /** Referral: max verified credits per day */
  maxReferralCreditsPerDay: number
  /** Marketplace: block self-trade reward */
  blockMarketplaceSelfTrade: boolean
}

export const DEFAULT_ANTI_ABUSE_POLICY: EconomyAntiAbusePolicy = {
  limits: { ...DEFAULT_ECONOMY_LIMITS },
  minAccountAgeMsForEarn: 0, // raise in production e.g. 24h
  minReputationForEarn: 0,
  highValueRewardThreshold: 50,
  maxRewardEvalsPerMinute: 20,
  maxSpendPerMinute: 30,
  requireServerAuthorityForPurchaseCredit: true,
  idempotencyWindowMs: 24 * 3600_000,
  maxReferralCreditsPerDay: 5,
  blockMarketplaceSelfTrade: true,
}

/** In-memory rate windows (per process / session) */
const rateBuckets = new Map<string, number[]>()

export function hitRateLimit(
  key: string,
  maxPerWindow: number,
  windowMs: number
): { ok: true } | { ok: false; error: string } {
  const now = Date.now()
  const arr = (rateBuckets.get(key) || []).filter((t) => now - t < windowMs)
  if (arr.length >= maxPerWindow) {
    return { ok: false, error: "Rate limit exceeded — try again shortly" }
  }
  arr.push(now)
  rateBuckets.set(key, arr)
  return { ok: true }
}

/**
 * Idempotency: same referenceId + sourceEvent + kind must not double-post.
 */
export function findDuplicateTransaction(
  txs: GhcTransaction[],
  input: {
    userId: string
    sourceEvent: string
    referenceId?: string
    kind: string
    amount: number
  },
  windowMs: number
): GhcTransaction | undefined {
  if (!input.referenceId) return undefined
  const since = Date.now() - windowMs
  return txs.find(
    (t) =>
      t.userId === input.userId &&
      t.referenceId === input.referenceId &&
      t.sourceEvent === input.sourceEvent &&
      t.kind === input.kind &&
      t.status === "posted" &&
      t.createdAt >= since &&
      Math.abs(t.amount - input.amount) < 1e-9
  )
}

export function findDuplicateReward(
  rewards: RewardRecord[],
  input: { ruleId: string; referenceId?: string; sourceEvent: string }
): RewardRecord | undefined {
  if (input.referenceId) {
    return rewards.find(
      (r) =>
        r.ruleId === input.ruleId &&
        r.referenceId === input.referenceId &&
        r.sourceEvent === input.sourceEvent &&
        r.validationStatus !== "rejected"
    )
  }
  return undefined
}

export interface EarnEligibilityContext {
  accountCreatedAt?: number
  reputationScore?: number
  isVerified?: boolean
  /** Client-reported — never trusted alone for credit */
  clientClaimed?: boolean
}

export function checkEarnEligibility(
  policy: EconomyAntiAbusePolicy,
  ctx: EarnEligibilityContext
): { ok: true } | { ok: false; error: string } {
  if (ctx.clientClaimed) {
    return { ok: false, error: "Client cannot authorize GHC credits" }
  }
  if (policy.minAccountAgeMsForEarn > 0 && ctx.accountCreatedAt) {
    if (Date.now() - ctx.accountCreatedAt < policy.minAccountAgeMsForEarn) {
      return { ok: false, error: "Account too new to earn rewards yet" }
    }
  }
  if (
    policy.minReputationForEarn > 0 &&
    typeof ctx.reputationScore === "number" &&
    ctx.reputationScore < policy.minReputationForEarn
  ) {
    return { ok: false, error: "Reputation too low for this reward path" }
  }
  return { ok: true }
}

/** Integrity findings for audit report */
export type IntegritySeverity = "ok" | "warn" | "fail"

export interface IntegrityFinding {
  id: string
  severity: IntegritySeverity
  path: string
  message: string
}

export function auditLedgerIntegrity(
  userId: string,
  txs: GhcTransaction[],
  rewards: RewardRecord[]
): IntegrityFinding[] {
  const findings: IntegrityFinding[] = []

  // Every posted earn/spend should have reason + sourceEvent
  for (const tx of txs) {
    if (!tx.reason?.trim()) {
      findings.push({
        id: `tx-reason-${tx.id}`,
        severity: "fail",
        path: "ledger",
        message: `Transaction ${tx.id} missing reason`,
      })
    }
    if (!tx.sourceEvent?.trim()) {
      findings.push({
        id: `tx-source-${tx.id}`,
        severity: "fail",
        path: "ledger",
        message: `Transaction ${tx.id} missing sourceEvent`,
      })
    }
  }

  // Paid rewards must reference a ledger tx
  for (const r of rewards) {
    if (r.validationStatus === "paid" && !r.transactionId) {
      findings.push({
        id: `rwd-paid-${r.id}`,
        severity: "fail",
        path: "rewards",
        message: `Paid reward ${r.id} has no transactionId`,
      })
    }
    if (r.validationStatus === "paid" && r.transactionId) {
      const tx = txs.find((t) => t.id === r.transactionId)
      if (!tx) {
        findings.push({
          id: `rwd-orphan-${r.id}`,
          severity: "fail",
          path: "rewards",
          message: `Reward ${r.id} points to missing transaction`,
        })
      }
    }
  }

  // Duplicate referenceIds (double-credit risk)
  const refMap = new Map<string, string[]>()
  for (const tx of txs) {
    if (!tx.referenceId || tx.status !== "posted") continue
    const key = `${tx.kind}:${tx.sourceEvent}:${tx.referenceId}`
    const list = refMap.get(key) || []
    list.push(tx.id)
    refMap.set(key, list)
  }
  for (const [key, ids] of refMap) {
    if (ids.length > 1) {
      findings.push({
        id: `dup-${key}`,
        severity: "fail",
        path: "idempotency",
        message: `Duplicate posted txs for ${key}: ${ids.join(", ")}`,
      })
    }
  }

  // Reversals should reference originals via metadata or referenceId
  for (const tx of txs) {
    if (tx.kind === "reversed" || (tx.metadata as any)?.reverses) {
      const origId = (tx.metadata as any)?.reverses || tx.referenceId
      if (origId && !txs.some((t) => t.id === origId)) {
        findings.push({
          id: `rev-${tx.id}`,
          severity: "warn",
          path: "reversal",
          message: `Reversal ${tx.id} may not link to original`,
        })
      }
    }
  }

  if (!findings.length) {
    findings.push({
      id: "integrity-ok",
      severity: "ok",
      path: "ledger",
      message: "No integrity violations detected in local ledger snapshot",
    })
  }

  return findings
}

export function summarizeIntegrity(findings: IntegrityFinding[]) {
  return {
    ok: findings.every((f) => f.severity !== "fail"),
    fails: findings.filter((f) => f.severity === "fail").length,
    warns: findings.filter((f) => f.severity === "warn").length,
    findings,
  }
}
