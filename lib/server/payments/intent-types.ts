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
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED"

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
  /** Pi payment identifier once known */
  providerPaymentId: string | null
  purpose: PaymentPurpose
  /** Amount in provider currency units (π for Pi) */
  amount: number
  currency: "PI" | "GHC"
  status: PaymentIntentStatus
  /** Client/server correlation (order id, membership ref) */
  referenceId: string
  metadata: Record<string, unknown>
  createdAt: number
  approvedAt?: number
  submittedAt?: number
  completedAt?: number
  cancelledAt?: number
  refundedAt?: number
  /** Blockchain tx id when completed */
  txid?: string | null
  /** Last error message */
  lastError?: string | null
  audit: PaymentIntentAuditEvent[]
  /** Idempotency key from client */
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
