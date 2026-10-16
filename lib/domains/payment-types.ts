/**
 * Payment abstraction types — provider-agnostic.
 *
 * GHC is only credited after authoritative server verification,
 * never because the client reports success.
 *
 * Pi balances (if any) stay separate from GHC.
 */

export type PaymentProviderId =
  | "internal_ghc"
  | "external_card"
  | "external_mobile_money"
  | "pi_network"
  | "manual_admin"
  | "unknown"

export type PaymentLifecycleStatus =
  | "initiated"
  | "pending"
  | "verified"
  | "completed"
  | "failed"
  | "cancelled"
  | "refunded"

export type PaymentPurpose =
  | "ghc_topup"
  | "premium_membership"
  | "marketplace_order"
  | "marketplace_promotion"
  | "other"

export interface PaymentIntent {
  id: string
  userId: string
  provider: PaymentProviderId
  purpose: PaymentPurpose
  /** Amount in provider units (e.g. fiat minor units or Pi amount as reported by provider) */
  amount: number
  currency: string
  /** Expected GHC to credit only after verification — null if not a top-up */
  ghcCredit?: number
  status: PaymentLifecycleStatus
  /** Opaque provider reference (set by server after initiate) */
  providerRef?: string
  /** Client may attach metadata; server must re-validate */
  metadata?: Record<string, unknown>
  referenceId?: string
  createdAt: number
  updatedAt: number
  verifiedAt?: number
  completedAt?: number
  failureReason?: string
  /** Ledger tx id after GHC credit (if any) */
  economyTxId?: string
  /**
   * Authority flag: only true after server-side verification webhook/callback.
   * Client must never set this to true.
   */
  serverVerified: boolean
}

export interface InitiatePaymentInput {
  provider: PaymentProviderId
  purpose: PaymentPurpose
  amount: number
  currency: string
  ghcCredit?: number
  referenceId?: string
  metadata?: Record<string, unknown>
}

/**
 * Server-side verification payload shape (backend contract).
 * Client SDKs must not forge this; only trusted backend may call verify.
 */
export interface ServerPaymentVerification {
  paymentIntentId: string
  providerRef: string
  verified: boolean
  amount: number
  currency: string
  /** Optional signed attestation from provider — validated server-side only */
  providerPayload?: unknown
  verifiedAt: number
}

/**
 * Pi Network readiness — architecture only.
 * Does not call undocumented Pi APIs or implement chain logic.
 */
export interface PiPaymentReadinessNotes {
  /** GHC and any future Pi balance are separate ledgers */
  separateBalances: true
  /** Intended flow when platform + Pi policies allow */
  intendedFlow: [
    "pi_payment_initiated",
    "pi_transaction_verification_server_side",
    "backend_confirmation",
    "economy_transaction_created",
    "ghc_credited_if_supported",
  ]
  /** What this client must never do */
  clientMustNot: [
    "credit_ghc_on_client_reported_success",
    "assume_exchange_rate_or_wallet_apis",
    "implement_speculative_blockchain",
  ]
}

export const PI_PAYMENT_READINESS: PiPaymentReadinessNotes = {
  separateBalances: true,
  intendedFlow: [
    "pi_payment_initiated",
    "pi_transaction_verification_server_side",
    "backend_confirmation",
    "economy_transaction_created",
    "ghc_credited_if_supported",
  ],
  clientMustNot: [
    "credit_ghc_on_client_reported_success",
    "assume_exchange_rate_or_wallet_apis",
    "implement_speculative_blockchain",
  ],
}
