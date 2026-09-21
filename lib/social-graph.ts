/**
 * Social Graph — single foundation for Follow / Block / Mute / Match
 * Roadmap: every module asks the same graph before rendering or interacting.
 */

import type { Conversation, MatchEntry } from "./ghc-types"

export interface SocialGraphSnapshot {
  blockedUsers: string[]
  followingIds: string[]
  followersIds?: string[]
  mutedIds?: string[]
  restrictedIds?: string[]
  matchIds: string[]
  friendIds: string[]
  outgoingRequestIds?: string[]
  incomingRequestIds?: string[]
}

export function isFollowing(graph: SocialGraphSnapshot, userId: string): boolean {
  return graph.followingIds.includes(userId)
}

export function isFollower(graph: SocialGraphSnapshot, userId: string): boolean {
  return (graph.followersIds || []).includes(userId)
}

export function isFriend(graph: SocialGraphSnapshot, userId: string): boolean {
  return graph.friendIds.includes(userId)
}

export function isBlocked(graph: SocialGraphSnapshot, userId: string): boolean {
  return graph.blockedUsers.includes(userId)
}

export function isMuted(graph: SocialGraphSnapshot, userId: string): boolean {
  return (graph.mutedIds || []).includes(userId)
}

export function isRestricted(graph: SocialGraphSnapshot, userId: string): boolean {
  return (graph.restrictedIds || []).includes(userId)
}

export function isMatched(graph: SocialGraphSnapshot, userId: string): boolean {
  return graph.matchIds.includes(userId)
}

/**
 * Suppressor for strong interaction limits (block or restrict).
 * Mute is intentionally excluded — mute only hides content/notifications.
 */
export function isSuppressed(graph: SocialGraphSnapshot, userId: string): boolean {
  return isBlocked(graph, userId) || isRestricted(graph, userId)
}

/** Passive content should be hidden (block or mute) */
export function shouldHideAuthorContent(graph: SocialGraphSnapshot, authorId: string): boolean {
  return isBlocked(graph, authorId) || isMuted(graph, authorId)
}

/**
 * Effects of BLOCK — system-wide, not just "remove from array".
 * Returns next state slices callers should apply.
 */
export function applyBlockEffects(input: {
  userId: string
  blockedUsers: string[]
  candidates: { id: string }[]
  matches: MatchEntry[]
  conversations: Conversation[]
  followingIds?: string[]
}): {
  blockedUsers: string[]
  candidates: { id: string }[]
  matches: MatchEntry[]
  conversations: Conversation[]
  followingIds?: string[]
} {
  const userId = input.userId
  const blockedUsers = Array.from(new Set([...(input.blockedUsers || []), userId]))

  return {
    blockedUsers,
    candidates: input.candidates.filter((c) => c.id !== userId),
    matches: input.matches.filter((m) => m.userId !== userId),
    // Keep conversation records for audit, but hide private chats with blocked user from inbox
    conversations: input.conversations.map((c) => {
      if (c.conversationType === "private" && c.participantId === userId) {
        return { ...c, isArchived: true, unread: false, unreadCount: 0 }
      }
      return c
    }),
    followingIds: input.followingIds?.filter((id) => id !== userId),
  }
}

/**
 * Private vs group separation — UI must never guess.
 */
export function isPrivateConversation(c: Conversation): boolean {
  return c.conversationType === "private"
}

export function isGroupConversation(c: Conversation): boolean {
  return c.conversationType === "group"
}

export function filterPrivateConversations(conversations: Conversation[]): Conversation[] {
  return conversations.filter(isPrivateConversation)
}

export function filterGroupConversations(conversations: Conversation[]): Conversation[] {
  return conversations.filter(isGroupConversation)
}

/**
 * Soft-delete helpers — keep record for moderation / audit
 */
export function softDeletePost<T extends { id: string; deletedAt?: number; deletedBy?: string }>(
  post: T,
  actorId: string
): T {
  return {
    ...post,
    deletedAt: Date.now(),
    deletedBy: actorId,
  }
}

export function isSoftDeleted(entity: { deletedAt?: number | null }): boolean {
  return typeof entity.deletedAt === "number" && entity.deletedAt > 0
}

export function visiblePosts<T extends { deletedAt?: number | null }>(posts: T[]): T[] {
  return posts.filter((p) => !isSoftDeleted(p))
}

/** Soft-delete a message for me or for everyone (within policy window enforced by caller). */
export function softDeleteMessage<
  T extends { id: string; deletedAt?: number; deletedBy?: string; hiddenFor?: string[] }
>(message: T, actorId: string, mode: "me" | "everyone"): T {
  if (mode === "everyone") {
    return {
      ...message,
      deletedAt: Date.now(),
      deletedBy: actorId,
      text: (message as any).text !== undefined ? "" : (message as any).text,
    }
  }
  const hiddenFor = Array.from(new Set([...(message.hiddenFor || []), actorId]))
  return { ...message, hiddenFor }
}

/** True if actor should not see the message */
export function isMessageHiddenFor(
  message: { deletedAt?: number | null; hiddenFor?: string[] },
  userId: string
): boolean {
  if (typeof message.deletedAt === "number" && message.deletedAt > 0) return true
  return (message.hiddenFor || []).includes(userId)
}

/**
 * System-wide block filter — apply on feed, discovery, comments, matches, search.
 * Never show content from blocked users.
 */
export function filterOutBlockedUsers<T>(
  items: T[],
  blockedIds: string[],
  getUserId: (item: T) => string | undefined | null
): T[] {
  if (!blockedIds?.length) return items
  const blocked = new Set(blockedIds)
  return items.filter((item) => {
    const id = getUserId(item)
    if (!id) return true
    return !blocked.has(id)
  })
}

/** True if either party has blocked the other (when both lists known). */
export function isBlockedEitherWay(
  meBlocked: string[],
  blockedMe: string[] | undefined,
  otherId: string
): boolean {
  if (meBlocked.includes(otherId)) return true
  if (blockedMe?.includes(otherId)) return true
  return false
}
