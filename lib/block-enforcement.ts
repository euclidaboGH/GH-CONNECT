/**
 * GLOBAL BLOCK ENFORCEMENT — platform-wide safety policy.
 *
 * Single place for list filtering and interaction gates related to blocks.
 * Mutations stay in social-graph-domain; permissions stay in permission-engine.
 *
 * Surfaces that must use these helpers (not local if-blocked checks):
 *   Feed · Find · Matches · Profile · Messages · Stories · Comments ·
 *   Communities · Search · Marketplace · Notifications
 */

import {
  filterOutBlockedUsers as graphFilterOutBlockedUsers,
  isBlockedEitherWay as graphIsBlockedEitherWay,
  type SocialGraphSnapshot,
} from "./social-graph"
import {
  buildPermissionContext,
  canMessageUser,
  canViewProfile,
  canViewStory,
  canComment,
  canReact,
  canShare,
  canFollow,
  canConnect,
  canMatch,
  can,
  type PermissionContext,
  type PermissionAction,
} from "./permission-engine"

// ── Resolve blocked id set ────────────────────────────────────────────────

export function mergeBlockedLists(...lists: Array<string[] | undefined | null>): string[] {
  const set = new Set<string>()
  for (const list of lists) {
    if (!list) continue
    for (const id of list) if (id) set.add(id)
  }
  return [...set]
}

export function resolveBlockedIds(input: {
  blockedUsers?: string[] | null
  settingsBlocked?: string[] | null
  graph?: SocialGraphSnapshot | null
  permissionCtx?: PermissionContext | null
}): string[] {
  return mergeBlockedLists(
    input.blockedUsers,
    input.settingsBlocked,
    input.graph?.blockedUsers,
    input.permissionCtx?.blockedByMe,
    input.permissionCtx?.blockedMe
  )
}

export function isUserBlocked(
  targetId: string,
  blockedIds: string[] | undefined | null
): boolean {
  if (!targetId || !blockedIds?.length) return false
  return blockedIds.includes(targetId)
}

export function filterBlockedUsers<
  T extends { id?: string; userId?: string; authorId?: string; participantId?: string },
>(
  items: T[],
  blockedIds: string[] | undefined | null,
  idKeys: Array<"id" | "userId" | "authorId" | "participantId"> = [
    "id",
    "userId",
    "authorId",
    "participantId",
  ]
): T[] {
  if (!blockedIds?.length) return items
  const set = new Set(blockedIds)
  return items.filter((item) => {
    for (const k of idKeys) {
      const v = item[k]
      if (typeof v === "string" && set.has(v)) return false
    }
    return true
  })
}

export const filterOutBlockedUsers = graphFilterOutBlockedUsers
export const isBlockedEitherWay = graphIsBlockedEitherWay

// ── Surface filters (all delegate to the same blocked-id set) ─────────────

/** Feed / posts / comments by author (block + mute) */
export function filterFeedContent<T extends { authorId?: string; userId?: string }>(
  items: T[],
  blockedIds: string[],
  mutedIds: string[] = []
): T[] {
  const hide = new Set([...(blockedIds || []), ...(mutedIds || [])])
  if (!hide.size) return items
  return items.filter((item) => {
    const id = item.authorId || item.userId
    if (!id) return true
    return !hide.has(id)
  })
}

/** Find / discovery candidates */
export function filterDiscoveryCandidates<T extends { id: string }>(
  items: T[],
  blockedIds: string[]
): T[] {
  return filterBlockedUsers(items, blockedIds, ["id"])
}

/** Matches list */
export function filterMatchesList<T extends { userId: string }>(
  items: T[],
  blockedIds: string[]
): T[] {
  return filterBlockedUsers(items, blockedIds, ["userId"])
}

/** Private conversations / inbox — hide threads with blocked participants */
export function filterConversationsInbox<
  T extends { conversationType?: string; participantId?: string; memberIds?: string[] },
>(items: T[], blockedIds: string[], me = "current-user"): T[] {
  if (!blockedIds?.length) return items
  const set = new Set(blockedIds)
  return items.filter((c) => {
    if (c.conversationType === "private" && c.participantId && set.has(c.participantId)) {
      return false
    }
    if (Array.isArray(c.memberIds)) {
      // Keep group chats but callers should still block send to blocked members
      return true
    }
    return true
  })
}

/** Stories (block + mute) */
export function filterStoriesList<T extends { userId?: string; authorId?: string }>(
  items: T[],
  blockedIds: string[],
  mutedIds: string[] = []
): T[] {
  const hide = new Set([...(blockedIds || []), ...(mutedIds || [])])
  if (!hide.size) return items
  return items.filter((item) => {
    const id = item.userId || item.authorId
    if (!id) return true
    return !hide.has(id)
  })
}

/** Search hits (people or posts) */
export function filterSearchHits<T extends { id?: string; authorId?: string; userId?: string }>(
  items: T[],
  blockedIds: string[]
): T[] {
  return filterBlockedUsers(items, blockedIds, ["id", "authorId", "userId"])
}

/** Notifications from blocked or muted actors */
export function filterNotificationsList<
  T extends { fromUserId?: string; actorId?: string; userId?: string; data?: Record<string, unknown> },
>(items: T[], blockedIds: string[], mutedIds: string[] = []): T[] {
  const set = new Set([...(blockedIds || []), ...(mutedIds || [])])
  if (!set.size) return items
  return items.filter((n) => {
    const id =
      n.fromUserId ||
      n.actorId ||
      n.userId ||
      (typeof n.data?.fromUserId === "string" ? n.data.fromUserId : undefined) ||
      (typeof n.data?.userId === "string" ? n.data.userId : undefined)
    if (id && set.has(id)) return false
    return true
  })
}

/** Marketplace listings by seller */
export function filterMarketplaceListings<T extends { sellerId?: string; userId?: string; authorId?: string }>(
  items: T[],
  blockedIds: string[]
): T[] {
  return filterOutBlockedUsers(items, blockedIds, (item) => item.sellerId || item.userId || item.authorId)
}

/** Community member lists / suggested groups owners */
export function filterCommunityMembers<T extends { userId?: string; id?: string }>(
  items: T[],
  blockedIds: string[]
): T[] {
  return filterBlockedUsers(items, blockedIds, ["userId", "id"])
}

// ── Interaction gate (permission-engine only — no local rules) ────────────

export function mayInteractWithUser(
  ctx: PermissionContext,
  targetId: string,
  action: PermissionAction
): boolean {
  return can(ctx, action, targetId)
}

export function buildBlockAwarePermissionContext(input: {
  currentUserId?: string
  blockedUsers?: string[]
  blockedMe?: string[]
  followingIds?: string[]
  matchIds?: string[]
  friendIds?: string[]
  whoCanMessage?: PermissionContext["whoCanMessage"]
}): PermissionContext {
  return buildPermissionContext({
    currentUserId: input.currentUserId,
    blockedUsers: input.blockedUsers,
    blockedMe: input.blockedMe,
    followingIds: input.followingIds,
    matchIds: input.matchIds,
    friendIds: input.friendIds,
    whoCanMessage: input.whoCanMessage,
  })
}

/** Convenience: message allowed under global policy */
export function mayMessage(ctx: PermissionContext, targetId: string): boolean {
  return canMessageUser(ctx, targetId)
}

export function mayViewProfile(ctx: PermissionContext, targetId: string): boolean {
  return canViewProfile(ctx, targetId)
}

export function mayViewStory(ctx: PermissionContext, ownerId: string): boolean {
  return canViewStory(ctx, ownerId)
}

export function mayComment(ctx: PermissionContext, authorId: string): boolean {
  return canComment(ctx, authorId)
}

export function mayReact(ctx: PermissionContext, authorId: string): boolean {
  return canReact(ctx, authorId)
}

export function mayShare(ctx: PermissionContext, authorId?: string): boolean {
  return canShare(ctx, authorId)
}

export function mayFollow(ctx: PermissionContext, targetId: string): boolean {
  return canFollow(ctx, targetId)
}

export function mayConnect(ctx: PermissionContext, targetId: string): boolean {
  return canConnect(ctx, targetId)
}

export function mayMatch(ctx: PermissionContext, targetId: string): boolean {
  return canMatch(ctx, targetId)
}

/**
 * Apply full platform visibility pass for a session snapshot.
 * Call from composition root / hooks when building UI lists.
 */
export function applyGlobalBlockFilters<T extends Record<string, unknown>>(session: {
  blockedIds: string[]
  /** Mute: hide content/notifications; keep relationship surfaces (candidates/matches) */
  mutedIds?: string[]
  posts?: Array<{ authorId?: string; userId?: string } & T>
  candidates?: Array<{ id: string } & T>
  matches?: Array<{ userId: string } & T>
  conversations?: Array<{ conversationType?: string; participantId?: string } & T>
  stories?: Array<{ userId?: string; authorId?: string } & T>
  notifications?: Array<{ fromUserId?: string; actorId?: string; userId?: string } & T>
}): {
  posts: NonNullable<typeof session.posts>
  candidates: NonNullable<typeof session.candidates>
  matches: NonNullable<typeof session.matches>
  conversations: NonNullable<typeof session.conversations>
  stories: NonNullable<typeof session.stories>
  notifications: NonNullable<typeof session.notifications>
} {
  const ids = session.blockedIds || []
  const muted = session.mutedIds || []
  return {
    // Mute + block hide passive content
    posts: filterFeedContent(session.posts || [], ids, muted) as any,
    // Discovery / matches: block only (mute keeps relationship visible)
    candidates: filterDiscoveryCandidates(session.candidates || [], ids) as any,
    matches: filterMatchesList(session.matches || [], ids) as any,
    // Messages: block hides private threads; mute does not remove inbox
    conversations: filterConversationsInbox(session.conversations || [], ids) as any,
    stories: filterStoriesList(session.stories || [], ids, muted) as any,
    notifications: filterNotificationsList(session.notifications || [], ids, muted) as any,
  }
}
