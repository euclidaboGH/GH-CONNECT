/**
 * Canonical relationship state transitions for Social Graph.
 *
 * Blocking takes absolute precedence over normal social actions.
 * Mutations must call `assertTransition` before writing edges so
 * contradictory states (e.g. friend + block) cannot be created.
 *
 * This is not a second graph system — it is the rule layer for
 * `social-graph-domain` mutations.
 */

import type { SocialGraphSnapshot } from "../social-graph"
import {
  isBlocked,
  isFollowing,
  isFriend,
  isMatched,
  isMuted,
  isRestricted,
} from "../social-graph"

/** Named transitions (product vocabulary) */
export type GraphTransition =
  | "follow"
  | "unfollow"
  | "send_connection_request"
  | "accept_request"
  | "reject_request"
  | "cancel_request"
  | "remove_connection"
  | "match"
  | "unmatch"
  | "block"
  | "unblock"
  | "mute"
  | "unmute"
  | "restrict"
  | "unrestrict"

export interface TransitionContext {
  me: string
  other: string
  graph: SocialGraphSnapshot
  /** Incoming request from other → me */
  hasIncomingRequest?: boolean
  /** Outgoing request me → other */
  hasOutgoingRequest?: boolean
}

function selfError(me: string, other: string): string | null {
  if (!other) return "Invalid user"
  if (other === me) return "Cannot target yourself"
  return null
}

/**
 * Returns null if the transition is allowed, otherwise a human-readable error.
 * Does not mutate state.
 */
export function assertTransition(action: GraphTransition, ctx: TransitionContext): string | null {
  const self = selfError(ctx.me, ctx.other)
  if (self) return self

  const g = ctx.graph
  const other = ctx.other
  const blocked = isBlocked(g, other)
  const following = isFollowing(g, other)
  const friend = isFriend(g, other)
  const matched = isMatched(g, other)
  const muted = isMuted(g, other)
  const restricted = isRestricted(g, other)
  const incoming =
    ctx.hasIncomingRequest ?? (g.incomingRequestIds || []).includes(other)
  const outgoing =
    ctx.hasOutgoingRequest ?? (g.outgoingRequestIds || []).includes(other)

  switch (action) {
    case "follow":
      if (blocked) return "Cannot follow a blocked user"
      if (following) return "Already following"
      return null

    case "unfollow":
      if (!following) return "Not following this user"
      // Allowed even if blocked (cleanup); preferred path is still block effects
      return null

    case "send_connection_request":
      if (blocked) return "Cannot send a request to a blocked user"
      if (friend) return "Already connected"
      if (outgoing) return "Request already sent"
      if (incoming) return "Respond to their request instead"
      return null

    case "accept_request":
      if (blocked) return "Cannot accept a request from a blocked user"
      if (friend) return "Already connected"
      if (!incoming) return "No pending request from this user"
      return null

    case "reject_request":
      if (!incoming) return "No pending request from this user"
      return null

    case "cancel_request":
      if (!outgoing) return "No outgoing request to cancel"
      return null

    case "remove_connection":
      if (!friend) return "Not connected with this user"
      return null

    case "match":
      if (blocked) return "Cannot match a blocked user"
      if (matched) return "Already matched"
      return null

    case "unmatch":
      if (!matched) return "Not matched with this user"
      return null

    case "block":
      if (blocked) return "User already blocked"
      return null

    case "unblock":
      if (!blocked) return "User is not blocked"
      return null

    case "mute":
      if (blocked) return "User is blocked; unmute is not applicable — unblock first if needed"
      if (muted) return "User already muted"
      return null

    case "unmute":
      if (!muted) return "User is not muted"
      return null

    case "restrict":
      if (blocked) return "User is blocked; restrict is redundant"
      if (restricted) return "User already restricted"
      return null

    case "unrestrict":
      if (!restricted) return "User is not restricted"
      return null

    default:
      return "Unknown relationship action"
  }
}

/**
 * Whether any normal social interaction is forbidden because of block.
 * Used by permission helpers and UI gates.
 */
export function blockPreemptsInteraction(graph: SocialGraphSnapshot, otherId: string): boolean {
  return isBlocked(graph, otherId)
}

/**
 * Edges / list memberships that must be cleared when applying a block
 * so the post-state cannot stay contradictory.
 */
export function blockClearsContradictions(otherId: string): {
  removeFollow: boolean
  removeFriend: boolean
  removeMatch: boolean
  clearRequests: boolean
  removeMute: boolean
  removeRestrict: boolean
  targetId: string
} {
  return {
    targetId: otherId,
    removeFollow: true,
    removeFriend: true,
    removeMatch: true,
    clearRequests: true,
    removeMute: true,
    removeRestrict: true,
  }
}

/**
 * Human-readable matrix for docs / debugging (not used at runtime for control flow).
 */
export const GRAPH_TRANSITION_SUMMARY: Record<GraphTransition, string> = {
  follow: "Allowed if not self, not blocked, not already following",
  unfollow: "Allowed if currently following",
  send_connection_request: "Allowed if not blocked, not friends, no open request either way",
  accept_request: "Allowed if incoming request exists and not blocked",
  reject_request: "Allowed if incoming request exists",
  cancel_request: "Allowed if outgoing request exists",
  remove_connection: "Allowed if currently friends",
  match: "Allowed if not blocked and not already matched",
  unmatch: "Allowed if currently matched",
  block: "Allowed if not self and not already blocked; clears follow/friend/match/requests/mute/restrict",
  unblock: "Allowed if currently blocked",
  mute: "Allowed if not blocked and not already muted",
  unmute: "Allowed if currently muted",
  restrict: "Allowed if not blocked and not already restricted",
  unrestrict: "Allowed if currently restricted",
}
