/**
 * Connection graph adapter — normalizes existing graph/match data into contracts.
 * Does not create a second relationship store.
 */

import type { ConnectionIntentId } from "@/lib/connection-intents"
import type { ConnectionEdge, ConnectionRelation } from "@/lib/domains/contracts/connections"
import type { ExplainableReason } from "@/lib/domains/contracts/types"

/** Product-facing connection states (normalized) */
export type ConnectionUiState =
  | "none"
  | "suggested"
  | "outgoing_pending"
  | "incoming_pending"
  | "connected"
  | "mutual"
  | "matched_opportunity"
  | "blocked"
  | "declined"

export interface GraphSnapshotInput {
  currentUserId: string
  friends?: string[]
  following?: string[]
  followers?: string[]
  blockedUsers?: string[]
  outgoingFriendRequestIds?: string[]
  incomingFriendRequestIds?: string[]
  /** Match recommendations — opportunity only, NOT automatic connections */
  matchIds?: string[]
  declinedIds?: string[]
}

export function normalizeConnectionState(
  targetUserId: string,
  snap: GraphSnapshotInput
): ConnectionUiState {
  const id = targetUserId
  if (!id || id === snap.currentUserId) return "none"
  if ((snap.blockedUsers || []).includes(id)) return "blocked"
  if ((snap.declinedIds || []).includes(id)) return "declined"
  if ((snap.friends || []).includes(id)) return "connected"
  if ((snap.incomingFriendRequestIds || []).includes(id)) return "incoming_pending"
  if ((snap.outgoingFriendRequestIds || []).includes(id)) return "outgoing_pending"
  const following = (snap.following || []).includes(id)
  const follower = (snap.followers || []).includes(id)
  if (following && follower) return "mutual"
  if ((snap.matchIds || []).includes(id)) return "matched_opportunity"
  if (following) return "suggested"
  return "none"
}

export function toConnectionRelation(state: ConnectionUiState): ConnectionRelation {
  switch (state) {
    case "connected":
    case "mutual":
      return "friend"
    case "outgoing_pending":
    case "incoming_pending":
      return "none" // pending is request-level; relation remains none until accepted
    case "blocked":
      return "blocked"
    case "matched_opportunity":
    case "suggested":
    case "declined":
    case "none":
    default:
      return "none"
  }
}

export function edgeFromSnapshot(
  targetUserId: string,
  snap: GraphSnapshotInput,
  extra?: { intents?: ConnectionIntentId[]; reasons?: ExplainableReason[] }
): ConnectionEdge {
  const state = normalizeConnectionState(targetUserId, snap)
  return {
    userId: targetUserId,
    relation: toConnectionRelation(state),
    intents: extra?.intents,
    reasons: extra?.reasons,
    updatedAt: new Date().toISOString(),
  }
}

/** Actions the UI may offer — only if state allows (client must still call real domain mutations) */
export type ConnectionCardAction =
  | "connect"
  | "accept"
  | "decline"
  | "message"
  | "view_profile"
  | "invite"
  | "save"

export function eligibleConnectionActions(state: ConnectionUiState): ConnectionCardAction[] {
  switch (state) {
    case "blocked":
      return ["view_profile"]
    case "connected":
    case "mutual":
      return ["message", "view_profile"]
    case "incoming_pending":
      return ["accept", "decline", "view_profile"]
    case "outgoing_pending":
      return ["view_profile"]
    case "matched_opportunity":
      return ["connect", "view_profile", "message"]
    case "suggested":
    case "none":
    case "declined":
      return ["connect", "view_profile", "save"]
    default:
      return ["view_profile"]
  }
}

export function connectionStateLabel(state: ConnectionUiState): string {
  switch (state) {
    case "connected":
      return "Connected"
    case "mutual":
      return "Mutual connection"
    case "outgoing_pending":
      return "Request pending"
    case "incoming_pending":
      return "Wants to connect"
    case "matched_opportunity":
      return "Match opportunity"
    case "suggested":
      return "Suggested"
    case "blocked":
      return "Blocked"
    case "declined":
      return "Declined"
    default:
      return "Not connected"
  }
}

/**
 * Product model:
 * Match = recommendation/opportunity
 * Connection = accepted relationship
 * Never auto-promote match → connection.
 */
export const MATCH_VS_CONNECTION_COPY = {
  matchTitle: "Match opportunity",
  matchBody:
    "A match is a recommendation. Choose how you want to connect, then send a request. You are connected only after mutual acceptance.",
  connectCta: "Choose intent & connect",
} as const

/** Optional intent payload for a connection request (backward compatible when omitted) */
export interface ConnectionRequestContext {
  intents?: ConnectionIntentId[]
  note?: string
  source?: "discover" | "match" | "profile" | "search" | "community"
}
