/**
 * Resolve search-result actions from membership state.
 * Does not implement join itself — callers use existing membership domain.
 */

import {
  primaryMembershipAction,
  type CommunityMembershipState,
} from "@/lib/domains/contracts/communities"
import { resolveMembershipState, type CommunityRowLike } from "./community-membership-adapter"

export type CommunitySearchAction = "join" | "request" | "pending" | "accept_invite" | "open" | "none"

export function resolveCommunitySearchAction(
  row: CommunityRowLike | null | undefined,
  viewerId: string,
  opts?: { blockedUserIds?: string[]; privacy?: string }
): { state: CommunityMembershipState; action: CommunitySearchAction; label: string } {
  if (!row?.id) {
    return { state: "unavailable", action: "none", label: "" }
  }
  const privacy = String(opts?.privacy || row.privacy || "public").toLowerCase()
  if (privacy === "private" || privacy === "secret") {
    return { state: "unavailable", action: "none", label: "" }
  }

  const state = resolveMembershipState(row, viewerId, {
    blockedUserIds: opts?.blockedUserIds,
  })
  let action = primaryMembershipAction(state) as CommunitySearchAction

  if (state === "discoverable" && (privacy === "invite-only" || privacy === "invite_only")) {
    action = "request"
  }

  const labels: Record<CommunitySearchAction, string> = {
    join: "Join",
    request: "Request",
    pending: "Pending",
    accept_invite: "Accept",
    open: "Open",
    none: "",
  }

  return { state, action, label: labels[action] }
}
