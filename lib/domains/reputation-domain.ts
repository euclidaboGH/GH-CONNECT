/**
 * ReputationDomain — trust / quality / contribution score.
 *
 * Separate from GHC, VIP/VVIP, and Verification.
 * Cannot be purchased with GHC.
 */

import { runMutation, type MutationResult } from "./mutation-pipeline"
import { domainEvents } from "../realtime/event-bus"

export type ReputationSignalKind =
  | "successful_interaction"
  | "community_contribution"
  | "marketplace_transaction"
  | "seller_review"
  | "content_quality"
  | "verified_achievement"
  | "report_violation"
  | "positive_moderation"
  | "helpful_comment"
  | "leadership"

export interface ReputationEvent {
  id: string
  userId: string
  kind: ReputationSignalKind
  /** Signed delta applied to score */
  delta: number
  reason: string
  sourceEvent: string
  referenceId?: string
  createdAt: number
}

export interface ReputationSnapshot {
  userId: string
  score: number
  tier: ReputationTier
  signals: number
  positive: number
  negative: number
  updatedAt: number
}

export type ReputationTier =
  | "new"
  | "emerging"
  | "trusted"
  | "established"
  | "exemplary"

const STORAGE_KEY = "ghc_reputation_v1"

/** Weights — not buyable; no GHC coupling */
export const REPUTATION_WEIGHTS: Record<ReputationSignalKind, number> = {
  successful_interaction: 1,
  community_contribution: 3,
  marketplace_transaction: 4,
  seller_review: 5,
  content_quality: 2,
  verified_achievement: 8,
  report_violation: -15,
  positive_moderation: 4,
  helpful_comment: 2,
  leadership: 6,
}

export function tierFromScore(score: number): ReputationTier {
  if (score >= 500) return "exemplary"
  if (score >= 200) return "established"
  if (score >= 80) return "trusted"
  if (score >= 20) return "emerging"
  return "new"
}

function genId() {
  return `rep_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function loadEvents(userId: string): ReputationEvent[] {
  try {
    if (typeof localStorage === "undefined") return []
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const all = JSON.parse(raw) as Record<string, ReputationEvent[]>
    return all[userId] || []
  } catch {
    return []
  }
}

function saveEvents(userId: string, events: ReputationEvent[]) {
  try {
    if (typeof localStorage === "undefined") return
    const raw = localStorage.getItem(STORAGE_KEY)
    const all = raw ? JSON.parse(raw) : {}
    all[userId] = events.slice(-400)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    /* */
  }
}

export function computeReputation(userId: string, events: ReputationEvent[]): ReputationSnapshot {
  let score = 0
  let positive = 0
  let negative = 0
  for (const e of events) {
    score += e.delta
    if (e.delta > 0) positive += e.delta
    else negative += Math.abs(e.delta)
  }
  // Floor at 0 for display stability (violations still reduce)
  if (score < 0) score = 0
  return {
    userId,
    score,
    tier: tierFromScore(score),
    signals: events.length,
    positive,
    negative,
    updatedAt: Date.now(),
  }
}

/** Map domain events → reputation signal (no GHC) */
export function mapDomainEventToReputationSignal(
  eventType: string,
  payload: Record<string, unknown>
): { kind: ReputationSignalKind; delta: number; reason: string } | null {
  switch (eventType) {
    case "FRIEND_ACCEPTED":
    case "MATCH_CREATED":
      return {
        kind: "successful_interaction",
        delta: REPUTATION_WEIGHTS.successful_interaction,
        reason: "Successful connection",
      }
    case "GROUP_JOINED":
    case "COMMUNITY_ANNOUNCEMENT":
      return {
        kind: "community_contribution",
        delta: REPUTATION_WEIGHTS.community_contribution,
        reason: "Community participation",
      }
    case "COMMUNITY_ROLE_CHANGED":
      return {
        kind: "leadership",
        delta: REPUTATION_WEIGHTS.leadership,
        reason: "Community leadership",
      }
    case "MARKETPLACE_ORDER_COMPLETED":
      return {
        kind: "marketplace_transaction",
        delta: REPUTATION_WEIGHTS.marketplace_transaction,
        reason: "Completed marketplace transaction",
      }
    case "COMMENT_CREATED":
      return {
        kind: "helpful_comment",
        delta: REPUTATION_WEIGHTS.helpful_comment,
        reason: "Community comment",
      }
    case "ACHIEVEMENT_UNLOCKED":
      return {
        kind: "verified_achievement",
        delta: REPUTATION_WEIGHTS.verified_achievement,
        reason: "Verified achievement",
      }
    case "REPORT_CREATED":
      // Reporter doesn't lose reputation; target may via moderation path
      return null
    case "POST_CREATED":
      return {
        kind: "content_quality",
        delta: REPUTATION_WEIGHTS.content_quality,
        reason: "Published content",
      }
    default:
      return null
  }
}

let repBridgeUnsub: (() => void) | null = null

export function createReputationDomain(deps: { currentUserId?: string }) {
  const userId = deps.currentUserId || "current-user"

  return {
    getSnapshot(forUserId = userId): ReputationSnapshot {
      return computeReputation(forUserId, loadEvents(forUserId))
    },

    getHistory(limit = 50, forUserId = userId): ReputationEvent[] {
      return loadEvents(forUserId)
        .slice()
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit)
    },

    /**
     * Record a signal. Explicitly rejects any attempt to buy reputation with GHC.
     */
    async recordSignal(input: {
      kind: ReputationSignalKind
      reason: string
      sourceEvent: string
      referenceId?: string
      /** Override delta only for authorized moderation paths */
      deltaOverride?: number
      targetUserId?: string
    }): Promise<MutationResult<{ event: ReputationEvent; snapshot: ReputationSnapshot }>> {
      return runMutation({
        name: "reputation.recordSignal",
        actorId: userId,
        input,
        validate: (i) => {
          if (!i.reason?.trim()) return "Reason required"
          if (!i.sourceEvent?.trim()) return "Source event required"
          // Guard: never accept GHC purchase as reputation source
          if (
            /ghc|purchase|buy.?rep|wallet.?spend/i.test(i.sourceEvent) ||
            /bought reputation|paid for reputation/i.test(i.reason)
          ) {
            return "Reputation cannot be purchased with GHC"
          }
          return null
        },
        mutate: (i) => {
          const target = i.targetUserId || userId
          const base =
            i.deltaOverride !== undefined
              ? i.deltaOverride
              : REPUTATION_WEIGHTS[i.kind]
          const event: ReputationEvent = {
            id: genId(),
            userId: target,
            kind: i.kind,
            delta: base,
            reason: i.reason.trim(),
            sourceEvent: i.sourceEvent.trim(),
            referenceId: i.referenceId,
            createdAt: Date.now(),
          }
          const events = loadEvents(target)
          events.push(event)
          saveEvents(target, events)
          const snapshot = computeReputation(target, events)
          domainEvents.publish(
            "REPUTATION_UPDATED",
            { userId: target, score: snapshot.score, tier: snapshot.tier, eventId: event.id },
            userId,
            event.id
          )
          return { event, snapshot }
        },
      })
    },

    /** Apply a verified violation penalty (moderation) */
    async applyViolation(
      targetUserId: string,
      reason: string,
      severity: "low" | "medium" | "high" = "medium"
    ) {
      const mult = severity === "high" ? 2 : severity === "low" ? 0.5 : 1
      return this.recordSignal({
        kind: "report_violation",
        reason,
        sourceEvent: "MODERATION_VIOLATION",
        targetUserId,
        deltaOverride: Math.round(REPUTATION_WEIGHTS.report_violation * mult),
      })
    },

    startEventBridge(): () => void {
      if (repBridgeUnsub) return repBridgeUnsub
      repBridgeUnsub = domainEvents.on("*", (event) => {
        try {
          if (event.type === "REPUTATION_UPDATED") return
          // Only credit the actor for positive contribution events (not self-spam loops)
          const mapped = mapDomainEventToReputationSignal(
            event.type,
            (event.payload || {}) as Record<string, unknown>
          )
          if (!mapped) return
          if (mapped.delta < 0) return // violations via explicit moderation API
          void this.recordSignal({
            kind: mapped.kind,
            reason: mapped.reason,
            sourceEvent: event.type,
            referenceId:
              (event.payload as any)?.postId ||
              (event.payload as any)?.orderId ||
              event.requestId,
            targetUserId: event.actorId || userId,
          })
        } catch {
          /* */
        }
      })
      return () => {
        repBridgeUnsub?.()
        repBridgeUnsub = null
      }
    },

    stopEventBridge() {
      repBridgeUnsub?.()
      repBridgeUnsub = null
    },
  }
}

export type ReputationDomain = ReturnType<typeof createReputationDomain>
