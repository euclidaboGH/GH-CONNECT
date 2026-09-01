/**
 * GreenHaven Economy types.
 *
 * GHC (GreenHaven Coin) = in-app utility / reward credit.
 * Not an external cryptocurrency or investment product in this phase.
 * Not Pi — Pi is settled only via GH Pay (external). There is no 1 π = X GHC rate.
 * Room left for future compliant Pi / chain integration only under a governed product.
 */

/** Transaction kinds — every balance change is one of these */
export type GhcTransactionKind =
  | "earned"
  | "spent"
  | "purchased"
  | "pending"
  | "reversed"
  | "expired"
  | "adjusted"
  /** Peer transfer out (debit) */
  | "transfer_out"
  /** Peer transfer in (credit) */
  | "transfer_in"
  /** Peer request created (memo only until fulfilled) */
  | "transfer_request"

export type GhcTransactionStatus = "pending" | "posted" | "reversed" | "expired" | "failed"

export interface GhcTransaction {
  id: string
  userId: string
  kind: GhcTransactionKind
  status: GhcTransactionStatus
  /** Signed amount in GHC units (positive credit, negative debit when posted) */
  amount: number
  /** Human-readable reason (required) */
  reason: string
  /** Domain event or system source that caused this */
  sourceEvent: string
  /** Optional correlation (orderId, rewardId, …) */
  referenceId?: string
  metadata?: Record<string, unknown>
  createdAt: number
  postedAt?: number
  expiresAt?: number
  /** Admin adjustment actor when kind === adjusted */
  adjustedBy?: string
}

export interface GhcWalletSnapshot {
  userId: string
  /** Posted, spendable balance — never negative under current rules */
  balance: number
  pending: number
  lifetimeEarned: number
  lifetimeSpent: number
  lifetimePurchased: number
  updatedAt: number
}

export type RewardCategory =
  | "social"
  | "community"
  | "achievement"
  | "marketplace"
  | "challenge"
  | "referral"
  | "creator"
  | "professional"

export type RewardValidationStatus =
  | "eligible"
  | "pending_validation"
  | "approved"
  | "rejected"
  | "paid"
  | "blocked"

export interface RewardRule {
  id: string
  category: RewardCategory
  /** Domain event type or logical source key */
  sourceEvent: string
  description: string
  amount: number
  /** Max awards per user per rolling day */
  dailyLimit: number
  /** Require pending validation before posting to ledger */
  requiresValidation: boolean
  /** Block self-interaction / same-target spam */
  antiAbuse: {
    blockSelf: boolean
    cooldownMs: number
    maxPerTargetPerDay?: number
  }
  enabled: boolean
}

export interface RewardRecord {
  id: string
  userId: string
  ruleId: string
  category: RewardCategory
  sourceEvent: string
  amount: number
  validationStatus: RewardValidationStatus
  transactionId?: string
  referenceId?: string
  reason: string
  createdAt: number
  resolvedAt?: number
}

export type PremiumPlanId = "monthly" | "yearly" | "lifetime"

export interface PremiumMembership {
  userId: string
  planId: PremiumPlanId | null
  active: boolean
  startedAt?: number
  expiresAt?: number
  lastPurchaseTxId?: string
}

export interface EconomyLimits {
  /** Max GHC that can be earned per calendar day (all rewards) */
  maxDailyEarn: number
  /** Max pending rewards outstanding */
  maxPendingRewards: number
  /** Min balance (0 = no negative) */
  minBalance: number
  /** P2P transfer controls — separate from earning caps */
  minimumTransferAmount: number
  maximumTransferAmount: number
  /** Max posted transfer_out amount per UTC day for the sender */
  dailySendLimit: number
  /** Max posted transfer_in amount per UTC day for the recipient */
  dailyReceiveLimit: number
  /** Max transfer_request creates per UTC day */
  dailyRequestLimit: number
  /** Max open (PENDING) outgoing requests at once */
  maximumOpenRequests: number
  /** Open request TTL in ms (default 7 days) */
  requestExpiryMs: number
}

export const DEFAULT_ECONOMY_LIMITS: EconomyLimits = {
  maxDailyEarn: 500,
  maxPendingRewards: 50,
  minBalance: 0,
  minimumTransferAmount: 1,
  maximumTransferAmount: 5_000,
  dailySendLimit: 2_000,
  dailyReceiveLimit: 5_000,
  dailyRequestLimit: 20,
  maximumOpenRequests: 10,
  requestExpiryMs: 7 * 24 * 3600_000,
}


/**
 * Transfer request lifecycle (ledger kind: transfer_request).
 * Creating a request never moves spendable GHC.
 */
export type GhcTransferRequestStatus =
  | "PENDING"
  | "ACCEPTED"
  | "DECLINED"
  | "CANCELLED"
  | "EXPIRED"

/** Peer-to-peer GHC transfer metadata (internal utility only — not external crypto) */
export type GhcPeerTransferStatus =
  | GhcTransferRequestStatus
  | "completed"
  | "failed"
  /** @deprecated use PENDING */
  | "pending_request"
  /** @deprecated use ACCEPTED */
  | "accepted"
  /** @deprecated use DECLINED */
  | "declined"
  /** @deprecated use CANCELLED */
  | "cancelled"

export interface GhcPeerTransferMeta {
  counterpartyId: string
  counterpartyName?: string
  direction: "send" | "receive" | "request"
  transferStatus: GhcPeerTransferStatus
  note?: string
  /** Shared idempotency / request id for both ledger legs */
  requestId?: string
  /** Who must pay (for requests): the counterparty when current user is requester */
  payerId?: string
  requesterId?: string
}

/** Domain-facing open request view */
export interface GhcTransferRequest {
  id: string
  referenceId: string
  amount: number
  status: GhcTransferRequestStatus
  requesterId: string
  payerId: string
  counterpartyName: string
  note?: string
  createdAt: number
  expiresAt?: number
  direction: "incoming" | "outgoing"
}

