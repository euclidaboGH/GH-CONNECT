/**
 * Client Realtime Event Bus — single canonical event system.
 *
 * Pattern:
 *   Domain mutation → domainEvents.publish → listeners (UI, notifications, transport)
 *   Remote → transportBridge.inbound → domainEvents.emit (deduped)
 *
 * Do not create competing buses.
 */

export type DomainEventType =
  // Identity / session
  | "PROFILE_UPDATED"
  | "ONBOARDING_COMPLETED"
  | "SESSION_CLEARED"
  // Posts / feed
  | "POST_CREATED"
  | "POST_UPDATED"
  | "POST_DELETED"
  | "LIKE_ADDED"
  | "LIKE_REMOVED"
  // Comments
  | "COMMENT_CREATED"
  | "COMMENT_UPDATED"
  | "COMMENT_DELETED"
  // Relationships
  | "FOLLOW_CREATED"
  | "FOLLOW_REMOVED"
  | "BLOCK_CREATED"
  | "BLOCK_REMOVED"
  | "MUTE_CREATED"
  | "MUTE_REMOVED"
  | "RESTRICT_CREATED"
  | "RESTRICT_REMOVED"
  | "FRIEND_REQUEST_SENT"
  | "FRIEND_REQUEST_CANCELLED"
  | "FRIEND_REQUEST_REJECTED"
  | "FRIEND_ACCEPTED"
  | "FRIEND_REMOVED"
  // Matches
  | "MATCH_CREATED"
  | "MATCH_REMOVED"
  // Messaging
  | "MESSAGE_CREATED"
  | "MESSAGE_UPDATED"
  | "MESSAGE_DELETED"
  | "MESSAGE_READ"
  | "TYPING_STARTED"
  | "TYPING_STOPPED"
  | "CONVERSATION_CREATED"
  // Presence
  | "PRESENCE_CHANGED"
  // Stories
  | "STORY_CREATED"
  | "STORY_EXPIRED"
  | "STORY_VIEWED"
  | "STORY_REACTION"
  // Communities
  | "GROUP_JOINED"
  | "GROUP_LEFT"
  | "COMMUNITY_ANNOUNCEMENT"
  | "COMMUNITY_EVENT"
  | "COMMUNITY_POLL"
  | "COMMUNITY_ROLE_CHANGED"
  // Safety
  | "REPORT_CREATED"
  // Notifications (meta — rare)
  | "NOTIFICATION_CREATED"
  | "NOTIFICATION_READ"
  // Marketplace
  | "MARKETPLACE_LISTING_CREATED"
  | "MARKETPLACE_LISTING_UPDATED"
  | "MARKETPLACE_ORDER_CREATED"
  | "MARKETPLACE_ORDER_UPDATED"
  | "MARKETPLACE_ORDER_COMPLETED"
  | "MARKETPLACE_REVIEW"
  | "MARKETPLACE_LISTING_SHARED"
  // Wallet
  | "WALLET_BALANCE_UPDATED"
  | "WALLET_TRANSFER_CREATED"
  | "WALLET_TRANSFER_COMPLETED"
  | "WALLET_TRANSFER_FAILED"
  // Rewards
  | "REWARD_EARNED"
  | "REWARD_REDEEMED"
  | "REWARD_EXPIRED"
  // Premium
  | "PREMIUM_ACTIVATED"
  | "PREMIUM_EXPIRED"
  | "PREMIUM_UPDATED"
  | "REFERRAL_VERIFIED"
  | "CHALLENGE_COMPLETED"
  | "ACHIEVEMENT_UNLOCKED"
  | "REPUTATION_UPDATED"
  | "VERIFICATION_REVOKED"
  | "VERIFICATION_REJECTED"
  | "VERIFICATION_APPROVED"
  | "VERIFICATION_REQUESTED"
  | "PROFESSIONAL_MILESTONE"
  | "GHC_PURCHASED"
  | "PREMIUM_PURCHASE"
  | "MARKETPLACE_SPEND"
  | "PAYMENT_FAILED"
  | "PAYMENT_REFUNDED"
  | "PAYMENT_COMPLETED"
  | "PAYMENT_VERIFIED"
  | "PAYMENT_INITIATED"

export interface DomainEvent<T = unknown> {
  type: DomainEventType
  payload: T
  actorId: string
  at: number
  /** Correlation id for optimistic reconcile + dedup */
  requestId?: string
  /** Origin: local mutation vs remote transport */
  origin?: "local" | "remote"
}

type Listener = (event: DomainEvent) => void

const DEDUP_TTL_MS = 60_000
const DEDUP_MAX = 500

class EventBus {
  private listeners = new Map<DomainEventType | "*", Set<Listener>>()
  /** Recent event keys to prevent duplicate processing (local echo + remote) */
  private recentKeys = new Map<string, number>()

  private dedupKey(event: DomainEvent): string {
    const rid = event.requestId || ""
    const p = event.payload as Record<string, unknown> | null
    const idHint =
      (p && typeof p === "object"
        ? String(
            p.messageId ||
              p.postId ||
              p.commentId ||
              p.orderId ||
              p.listingId ||
              p.userId ||
              p.conversationId ||
              p.notificationId ||
              p.rewardId ||
              ""
          )
        : "") || ""
    return `${event.type}|${event.actorId}|${rid}|${idHint}|${Math.floor(event.at / 1000)}`
  }

  private pruneDedup(now: number) {
    if (this.recentKeys.size < DEDUP_MAX) return
    for (const [k, t] of this.recentKeys) {
      if (now - t > DEDUP_TTL_MS) this.recentKeys.delete(k)
    }
    if (this.recentKeys.size >= DEDUP_MAX) {
      // drop oldest half
      const entries = [...this.recentKeys.entries()].sort((a, b) => a[1] - b[1])
      for (let i = 0; i < Math.floor(entries.length / 2); i++) {
        this.recentKeys.delete(entries[i][0])
      }
    }
  }

  /** Returns false if this is a duplicate within TTL */
  private accept(event: DomainEvent): boolean {
    const now = Date.now()
    this.pruneDedup(now)
    const key = this.dedupKey(event)
    if (this.recentKeys.has(key)) return false
    this.recentKeys.set(key, now)
    return true
  }

  on(type: DomainEventType | "*", listener: Listener): () => void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(listener)
    return () => this.listeners.get(type)?.delete(listener)
  }

  emit(event: DomainEvent, options?: { skipDedup?: boolean }): void {
    if (!options?.skipDedup && !this.accept(event)) {
      return
    }
    const exact = this.listeners.get(event.type)
    exact?.forEach((l) => {
      try {
        l(event)
      } catch (e) {
        console.error("[EventBus]", event.type, e)
      }
    })
    const all = this.listeners.get("*")
    all?.forEach((l) => {
      try {
        l(event)
      } catch (e) {
        console.error("[EventBus]*", event.type, e)
      }
    })
  }

  /** Convenience for domain services — always origin local */
  publish(
    type: DomainEventType,
    payload: unknown,
    actorId = "current-user",
    requestId?: string
  ) {
    this.emit({
      type,
      payload,
      actorId,
      at: Date.now(),
      requestId,
      origin: "local",
    })
  }

  /** Inbound remote events */
  publishRemote(event: DomainEvent) {
    this.emit({
      ...event,
      origin: "remote",
      at: event.at || Date.now(),
    })
  }
}

/** Singleton for the client session — transport plugs in via transportBridge */
export const domainEvents = new EventBus()
