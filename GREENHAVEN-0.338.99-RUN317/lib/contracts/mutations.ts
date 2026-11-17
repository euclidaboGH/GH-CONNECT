/**
 * Phase 2A — typed mutation contracts.
 * Client sends inputs only. Amounts, fees, eligibility, and settlement are server-derived.
 */

/** Common envelope for server mutation responses */
export type MutationResult<T = Record<string, unknown>> =
  | { ok: true; data: T; requestId?: string; duplicate?: boolean }
  | { ok: false; error: string; message: string; retryable?: boolean; requestId?: string }

export type RegistrationBonusClaimInput = {
  /** Intentionally empty — server derives amount from policy + ledger */
}

export type WithdrawalQuoteInput = {
  /** Preferred gross in PI decimal; server re-quotes from ledger */
  amountPi?: number
}

export type WithdrawalRequestInput = {
  amountAtomic: number
  idempotencyKey: string
}

export type MarketplaceCheckoutInput = {
  listingId: string
  quantity: number
  /** Client hint only — server recomputes price, fees, inventory */
  clientDisplayedTotal?: number
  paymentRail?: "pi" | "ghc"
}

export type MembershipActivateInput = {
  planId: string
  paymentIntentId?: string
  /** Recovery path — server validates intent ownership */
  recover?: boolean
}

export type ProfileMutationInput = {
  displayName?: string
  bio?: string
  interests?: string[]
  avatarMediaId?: string
  coverMediaId?: string
}

export type PostCreateInput = {
  content: string
  mediaIds?: string[]
  communityId?: string
  visibility?: "public" | "friends" | "private"
}

export type CommentCreateInput = {
  postId: string
  content: string
  parentCommentId?: string
  mediaIds?: string[]
}

export type ReactionInput = {
  targetType: "post" | "comment"
  targetId: string
  kind: string
}

export type SocialEdgeInput = {
  targetUserId: string
  action: "follow" | "unfollow" | "block" | "unblock" | "mute" | "unmute"
}

export type MessageSendInput = {
  conversationId: string
  text?: string
  mediaIds?: string[]
  clientMessageId: string
}

/** Labels that must never be upgraded client-side */
export const FINANCIAL_STATE_LABELS = {
  REQUESTED: "requested",
  PROCESSING: "processing",
  RESERVED: "reserved",
  PAID: "paid",
  FAILED: "failed",
  RELEASED: "released",
} as const

export type FinancialStateLabel = (typeof FINANCIAL_STATE_LABELS)[keyof typeof FINANCIAL_STATE_LABELS]

/** Client may display server status only — never promote REQUESTED→PAID locally */
export function assertFinancialLabelNotInvented(
  serverStatus: string | undefined,
  clientClaim: string | undefined,
): boolean {
  if (!clientClaim) return true
  const s = String(serverStatus || "").toLowerCase()
  const c = String(clientClaim || "").toLowerCase()
  if (c === "paid" || c === "settled" || c === "completed") {
    return s === "paid" || s === "settled" || s === "completed"
  }
  return true
}
