/**
 * Connections / Social Graph domain contract.
 * Friendship, follow, block, mute — not GHC transfers.
 */

import type { ConnectionIntentId } from "@/lib/connection-intents"
import type { DomainResult, DomainEmptyState, ExplainableReason } from "./types"

export type ConnectionRelation =
  | "none"
  | "following"
  | "follower"
  | "friend"
  | "match"
  | "blocked"
  | "muted"
  | "restricted"

export interface ConnectionEdge {
  userId: string
  relation: ConnectionRelation
  intents?: ConnectionIntentId[]
  reasons?: ExplainableReason[]
  updatedAt?: string
}

export interface ConnectionsSummary {
  friendsCount: number
  followingCount: number
  followersCount: number
  pendingRequestsCount: number
}

export interface ConnectionsDomainContract {
  getSummary(): DomainResult<ConnectionsSummary>
  listFriends(): DomainResult<ConnectionEdge[]>
  listFollowing(): DomainResult<ConnectionEdge[]>
  emptyNetworkState(): DomainEmptyState
}

export function defaultNetworkEmptyState(): DomainEmptyState {
  return {
    title: "Your network starts here",
    description: "Discover people who share your interests and connection goals.",
    primaryAction: { label: "Discover people", tab: "discover" },
  }
}
