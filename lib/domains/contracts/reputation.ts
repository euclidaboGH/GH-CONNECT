/**
 * Reputation / Trust domain contract.
 *
 * HARD SEPARATION:
 * - GHC = utility / transaction ledger (economy domain)
 * - Reputation = behavioral / community trust signal
 * - Identity verification = identity trust signal
 * - Membership = entitlement (VIP/VVIP)
 * - Pi = external payment rail
 *
 * Never store or display GHC balance inside reputation.
 */

import type { DomainResult, DomainEmptyState } from "./types"

export type TrustSignalKind =
  | "identity_verified"
  | "community_standing"
  | "helpful_participation"
  | "report_clean"
  | "account_age"
  | "endorsement"

export interface TrustSignal {
  kind: TrustSignalKind
  label: string
  level?: "low" | "medium" | "high"
  detail?: string
}

export interface ReputationSnapshot {
  userId: string
  signals: TrustSignal[]
  /** Ordinal participation score — NOT convertible to GHC or Pi */
  participationScore: number
}

export interface ReputationDomainContract {
  getSnapshot(userId: string): DomainResult<ReputationSnapshot>
  emptyState(): DomainEmptyState
}

export function reputationEmptyState(): DomainEmptyState {
  return {
    title: "Build trust through participation",
    description:
      "Helpful posts, community involvement, and verified identity strengthen trust. This is separate from GHC balance.",
  }
}

/** Guard: reputation modules must never import economy balance mutators */
export const REPUTATION_ISOLATION_NOTE =
  "Reputation is not GHC. Do not credit, debit, or display wallet balances from this domain."
