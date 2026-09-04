/**
 * Server-side Payment Intent — binds Pi callbacks to authenticated orders.
 * Separate from GHC ledger balances; π settlement only.
 */

export type PaymentIntentStatus =
  | "CREATED"
  | "APPROVAL_PENDING"
  | "APPROVED"
  | "USER_SUBMITTED"
  | "COMPLETION_PENDING"
  | "COMPLETED"
  | "FULFILLED"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED"
  | "INCOMPLETE"

/** Allowed forward transitions (invalid backwards blocked in store) */
export const PAYMENT_STATUS_RANK: Record<PaymentIntentStatus, number> = {
  CREATED: 0,
  APPROVAL_PENDING: 1,
  APPROVED: 2,
  USER_SUBMITTED: 3,
  COMPLETION_PENDING: 4,
  INCOMPLETE: 4,
  COMPLETED: 5,
  FULFILLED: 6,
  FAILED: 90,
  CANCELLED: 91,
  REFUNDED: 92,
}

export type PaymentProvider = "pi" | "ghc_internal" | "manual"

export type PaymentPurpose =
  | "membership"
  | "marketplace"
  | "boost"
  | "donation"
  | "sponsored_listing"
  | "digital_product"
  | "premium_feature"
  | "service"
  | "verification"
  | "seller_payout"
  | "creator_earning"
  | "refund"
  | "reward_payout"
  | "other"

export interface PaymentIntentAuditEvent {
  at: number
  action: string
  actor?: string
  detail?: string
  meta?: Record<string, unknown>
}

export interface PaymentIntent {
  id: string
  userId: string
  provider: PaymentProvider
  providerPaymentId: string | null
  purpose: PaymentPurpose
  amount: number
  currency: "PI" | "GHC"
  status: PaymentIntentStatus
  referenceId: string
  metadata: Record<string, unknown>
  createdAt: number
  approvedAt?: number
  submittedAt?: number
  completedAt?: number
  fulfilledAt?: number
  cancelledAt?: number
  refundedAt?: number
  txid?: string | null
  lastError?: string | null
  audit: PaymentIntentAuditEvent[]
  idempotencyKey?: string | null
}

export interface CreatePaymentIntentInput {
  userId: string
  purpose: PaymentPurpose
  amount: number
  currency?: "PI" | "GHC"
  referenceId: string
  metadata?: Record<string, unknown>
  idempotencyKey?: string
  provider?: PaymentProvider
}
