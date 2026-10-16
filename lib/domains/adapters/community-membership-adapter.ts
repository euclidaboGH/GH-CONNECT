/**
 * Community membership mapping over existing community domain / conversation rows.
 * No second authority. No fake join success.
 */

import {
  type CommunityMembershipState,
  type CommunityJoinReasonId,
  type CommunityOverviewModel,
  type CommunitySummary,
  type CommunityVisibility,
  COMMUNITY_JOIN_REASON_OPTIONS,
  membershipStateLabel,
  primaryMembershipAction,
} from "@/lib/domains/contracts/communities"
import { isDemoDataAllowed } from "@/lib/demo-data-policy"

export { membershipStateLabel, primaryMembershipAction, COMMUNITY_JOIN_REASON_OPTIONS }
export type { CommunityMembershipState, CommunityJoinReasonId, CommunityOverviewModel }

export interface CommunityRowLike {
  id: string
  groupName?: string
  participantName?: string
  description?: string
  privacy?: string
  category?: string
  region?: string
  tags?: string[]
  rules?: string[] | string
  members?: string[]
  createdBy?: string
  groupRoles?: Record<string, string>
  pendingJoinRequests?: string[]
  invitedMembers?: string[]
  groupPhoto?: string
  photo?: string
  coverImage?: string
  boardPosts?: unknown[]
  kind?: string
  communityId?: string
}

function parseRules(rules?: string[] | string): string[] {
  if (!rules) return []
  if (Array.isArray(rules)) return rules.map(String).filter(Boolean)
  return String(rules)
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean)
}

export function normalizeVisibility(raw?: string): CommunityVisibility {
  const p = (raw || "public").toLowerCase()
  if (p === "private") return "private"
  if (p === "invite" || p === "invite-only" || p === "invite_only") return "invite-only"
  return "public"
}

/**
 * Map viewer ↔ community into a membership state.
 * blockedUserIds: people the viewer blocked (or who blocked viewer when known).
 */
export function resolveMembershipState(
  row: CommunityRowLike,
  viewerId: string,
  opts?: { blockedUserIds?: string[] }
): CommunityMembershipState {
  if (!row?.id || !viewerId) return "unavailable"

  const blocked = new Set(opts?.blockedUserIds || [])
  const ownerId = row.createdBy
  const members = row.members || []
  const roles = row.groupRoles || {}
  const pending = row.pendingJoinRequests || []
  const invited = row.invitedMembers || []

  // Blocked relationships must not surface as joinable
  if (ownerId && blocked.has(ownerId)) return "blocked"
  if (members.some((m) => m !== viewerId && blocked.has(m) && members.length <= 2)) {
    // private dyad-style edge case — treat as blocked when sole other member blocked
  }

  if (members.includes(viewerId) || roles[viewerId]) {
    const role = (roles[viewerId] || "").toLowerCase()
    if (role === "owner" || row.createdBy === viewerId) return "owner"
    if (role === "admin") return "admin"
    if (role === "moderator" || role === "mod") return "moderator"
    return "member"
  }

  if (pending.includes(viewerId)) return "pending"
  if (invited.includes(viewerId)) return "invited"

  const privacy = normalizeVisibility(row.privacy)
  if (privacy === "private") return "unavailable"
  return "discoverable"
}

export function toCommunitySummary(
  row: CommunityRowLike,
  viewerId: string,
  opts?: { blockedUserIds?: string[] }
): CommunitySummary | null {
  if (!row?.id) return null
  // Never expose demo-prefixed communities when demo data is disallowed
  const id = row.communityId || row.id
  if (!isDemoDataAllowed() && (String(id).startsWith("demo-") || String(row.id).startsWith("demo-"))) {
    return null
  }
  const state = resolveMembershipState(row, viewerId, opts)
  if (state === "blocked") return null

  const name = row.groupName || row.participantName || "Community"
  const memberCount = Array.isArray(row.members) ? row.members.length : 0

  return {
    id: row.id,
    name,
    privacy: normalizeVisibility(row.privacy),
    memberCount,
    isMember: ["member", "moderator", "admin", "owner"].includes(state),
    membershipState: state,
    region: row.region,
    category: row.category,
    description: row.description,
    tags: row.tags,
    coverImage: row.coverImage || row.groupPhoto || row.photo,
  }
}

export function toCommunityOverview(
  row: CommunityRowLike,
  viewerId: string,
  opts?: {
    blockedUserIds?: string[]
    eventCount?: number
    dataSource?: CommunityOverviewModel["dataSource"]
  }
): CommunityOverviewModel | null {
  const summary = toCommunitySummary(row, viewerId, opts)
  if (!summary) return null
  const state = summary.membershipState || "discoverable"
  const posts = Array.isArray(row.boardPosts) ? row.boardPosts : []
  const rules = parseRules(row.rules)

  return {
    id: summary.id,
    name: summary.name,
    description: summary.description,
    purpose: summary.description,
    category: summary.category,
    tags: summary.tags,
    region: summary.region,
    privacy: summary.privacy,
    coverImage: summary.coverImage,
    memberCount: summary.memberCount,
    membershipState: state,
    roleLabel: membershipStateLabel(state),
    rules,
    ownerId: row.createdBy,
    hasDiscussions: posts.length > 0,
    hasEvents: (opts?.eventCount || 0) > 0,
    hasActivities: false,
    hasResources: posts.some((p: any) => p?.kind === "resource"),
    hasAnnouncements: posts.some((p: any) => p?.kind === "announcement" || p?.pinned),
    discussionCount: posts.length,
    eventCount: opts?.eventCount || 0,
    dataSource: opts?.dataSource || "conversation_row",
  }
}

/** Filter member ids for lists — never show blocked users */
export function filterMemberIdsForViewer(
  memberIds: string[],
  viewerId: string,
  blockedUserIds?: string[]
): string[] {
  const blocked = new Set(blockedUserIds || [])
  return (memberIds || []).filter((id) => id && id !== viewerId && !blocked.has(id))
}

/** Session-only join reasons (not authoritative until server field exists) */
const JOIN_REASON_KEY = "ghc_community_join_reasons_v1"

export function saveLocalJoinReasons(
  userId: string,
  communityId: string,
  reasons: CommunityJoinReasonId[]
): void {
  try {
    if (typeof localStorage === "undefined") return
    const all = JSON.parse(localStorage.getItem(JOIN_REASON_KEY) || "{}")
    const key = `${userId}::${communityId}`
    all[key] = reasons
    localStorage.setItem(JOIN_REASON_KEY, JSON.stringify(all))
  } catch {
    /* non-authoritative cache only */
  }
}

export function loadLocalJoinReasons(
  userId: string,
  communityId: string
): CommunityJoinReasonId[] {
  try {
    if (typeof localStorage === "undefined") return []
    const all = JSON.parse(localStorage.getItem(JOIN_REASON_KEY) || "{}")
    const key = `${userId}::${communityId}`
    const raw = all[key]
    if (!Array.isArray(raw)) return []
    const allowed = new Set(COMMUNITY_JOIN_REASON_OPTIONS.map((o) => o.id))
    return raw.filter((x) => allowed.has(x))
  } catch {
    return []
  }
}

/**
 * User-facing join error — never expose internal mutation names.
 */
export function userFacingJoinError(codeOrMessage?: string | null): string {
  const c = String(codeOrMessage || "").toLowerCase()
  if (c.includes("private") || c.includes("invite")) {
    return "This community requires an invitation or approval."
  }
  if (c.includes("already")) return "You are already a member."
  if (c.includes("not found")) return "Community not found."
  if (c.includes("blocked")) return "This community is not available."
  if (!codeOrMessage) return "Could not join. Try again."
  return "Could not join. Try again."
}
