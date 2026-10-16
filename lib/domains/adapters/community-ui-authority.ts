/**
 * Community UI authority helpers (Step 1 — authority consolidation).
 *
 * Production membership truth: domain row (members / roles / owner) via
 * resolveMembershipState — never localStorage alone.
 *
 * localJoined / localBoard are Class D caches for Studio/offline UX only.
 */

import { isDemoDataAllowed } from "@/lib/demo-data-policy"
import {
  resolveMembershipState,
  type CommunityRowLike,
} from "@/lib/domains/adapters/community-membership-adapter"

const MEMBER_STATES = new Set(["member", "moderator", "admin", "owner"])

/** Studio/demo may mirror joins locally; production must not. */
export function communityLocalCacheAllowed(): boolean {
  return isDemoDataAllowed()
}

/**
 * Authoritative membership check for UI.
 * Does not consult localJoined — pass domain row only.
 */
export function isCommunityMemberDomain(
  row: CommunityRowLike | null | undefined,
  viewerId: string
): boolean {
  if (!row?.id || !viewerId) return false
  try {
    const state = resolveMembershipState(row, viewerId)
    if (MEMBER_STATES.has(String(state))) return true
  } catch {
    /* fall through to explicit fields */
  }
  const members = row.members || []
  if (members.includes(viewerId)) return true
  if (row.createdBy && row.createdBy === viewerId) return true
  const role = row.groupRoles?.[viewerId]
  if (role && MEMBER_STATES.has(String(role).toLowerCase()) || role === "mod") return true
  return false
}

/**
 * Studio-only: allow Class D cache to extend membership display when domain
 * row has not rehydrated yet after a successful join.
 */
export function isCommunityMemberWithOptionalCache(
  row: CommunityRowLike | null | undefined,
  viewerId: string,
  localJoinedIds: string[] | undefined
): boolean {
  if (isCommunityMemberDomain(row, viewerId)) return true
  // Creator / owner markers (handles current-user → Pi uid drift after create)
  if (row?.createdBy && (row.createdBy === viewerId || row.createdBy === "current-user")) {
    return true
  }
  if (row?.groupRoles) {
    const r = row.groupRoles[viewerId] || row.groupRoles["current-user"]
    if (r && MEMBER_STATES.has(String(r).toLowerCase())) return true
  }
  // Allow localJoined so "My communities" updates immediately after create
  // (not Studio-only — creator session needs this when identity id drifts).
  if (!row?.id || !localJoinedIds?.length) return false
  return localJoinedIds.includes(row.id)
}

/** Production must not invent board posts when domain create fails. */
export function allowLocalBoardFallback(): boolean {
  return communityLocalCacheAllowed()
}
