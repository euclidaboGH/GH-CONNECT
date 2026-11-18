/**
 * Community invitations — maps conversation invitedMembers / pending lists.
 * Accept/decline must re-check domain state; notification payload is not auth.
 */

import {
  resolveMembershipState,
  type CommunityRowLike,
} from "@/lib/domains/adapters/community-membership-adapter"
import { isDemoDataAllowed } from "@/lib/demo-data-policy"

export type CommunityInviteStatus =
  | "invited"
  | "member"
  | "pending_request"
  | "none"
  | "unavailable"

export interface CommunityInvitationView {
  communityId: string
  communityName: string
  purpose?: string
  coverImage?: string
  inviterId?: string
  status: CommunityInviteStatus
  privacy?: string
}

export function listInvitationsForViewer(
  rows: CommunityRowLike[],
  viewerId: string,
  opts?: { blockedUserIds?: string[] }
): CommunityInvitationView[] {
  if (!viewerId) return []
  const blocked = new Set(opts?.blockedUserIds || [])
  const out: CommunityInvitationView[] = []

  for (const row of rows || []) {
    if (!row?.id) continue
    if (!isDemoDataAllowed() && String(row.id).startsWith("demo-")) continue
    if (row.createdBy && blocked.has(row.createdBy)) continue

    const state = resolveMembershipState(row, viewerId, opts)
    if (state === "blocked") continue

    if (state === "invited") {
      out.push({
        communityId: row.id,
        communityName: row.groupName || row.participantName || "Community",
        purpose: row.description,
        coverImage: row.coverImage || row.groupPhoto || row.photo,
        inviterId: row.createdBy,
        status: "invited",
        privacy: row.privacy,
      })
    } else if (state === "pending") {
      out.push({
        communityId: row.id,
        communityName: row.groupName || row.participantName || "Community",
        purpose: row.description,
        coverImage: row.coverImage || row.groupPhoto || row.photo,
        status: "pending_request",
        privacy: row.privacy,
      })
    }
  }
  return out
}

export function userFacingInviteError(msg?: string | null): string {
  const c = String(msg || "").toLowerCase()
  if (c.includes("no active")) return "This invitation is no longer available."
  if (c.includes("already")) return "You are already a member."
  if (c.includes("blocked")) return "You cannot join this community."
  if (c.includes("not found")) return "Community not found."
  return "Could not update invitation. Try again."
}
