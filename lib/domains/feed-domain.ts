/**
 * FeedDomain — authoritative owner of feed presentation over a single post store.
 *
 * Owns:
 *   - Feed modes (For You, Following, Friends, Communities, Trending, …)
 *   - Visibility (block/mute/soft-delete)
 *   - Ranking strategy selection (delegates to feed-ranking-engine)
 *   - Comment visibility helpers (delegates mutations to post-domain)
 *
 * Does NOT create a second posts array — always reads from the same session/post store.
 */

import {
  canDeletePost,
  canEditPost,
  canLike,
  canComment,
  type PermissionContext,
} from "../permission-engine"
import { softDeletePost, isSoftDeleted } from "../social-graph"
import { filterFeedContent, resolveBlockedIds } from "../block-enforcement"
import { domainEvents } from "../realtime/event-bus"
import {
  rankFeed,
  type FeedContext,
  type RankedPost,
} from "../feed-ranking-engine"
import type { FeedFilter, Post, PostComment, Profile } from "../ghc-types"

export type CanonicalFeedMode =
  | "for-you"
  | "following"
  | "friends"
  | "communities"
  | "trending"

export const CANONICAL_FEED_MODES: CanonicalFeedMode[] = [
  "for-you",
  "following",
  "friends",
  "communities",
  "trending",
]

export function createFeedDomain(
  getCtx: () =>
    PermissionContext & {
      blockedUsers?: string[]
      mutedUsers?: string[]
      posts?: Post[]
      profile?: Profile
      followingIds?: string[]
      friendIds?: string[]
      communityIds?: string[]
      userInterests?: string[]
      savedPostIds?: string[]
    }
) {
  function blockedIds() {
    const c = getCtx()
    return resolveBlockedIds({
      blockedUsers: c.blockedUsers || c.blockedByMe,
      permissionCtx: c,
    })
  }

  function mutedIds(): string[] {
    return getCtx().mutedUsers || getCtx().mutedIds || []
  }

  function buildRankingContext(): FeedContext {
    const c = getCtx()
    const profile = c.profile || ({ displayName: "User", interests: [] } as any)
    return {
      userProfile: profile,
      userInterests: c.userInterests || profile.interests || [],
      recentlyEngagedPostIds: [],
      blockedUserIds: blockedIds(),
      mutedUserIds: mutedIds(),
      followingIds: c.followingIds || [],
      friendIds: c.friendIds || [],
      communityIds: c.communityIds || [],
      savedPostIds: c.savedPostIds || [],
      viewedPostIds: [],
    }
  }

  return {
    canLike(authorId: string) {
      return canLike(getCtx(), authorId)
    },
    canComment(authorId: string) {
      return canComment(getCtx(), authorId)
    },
    canDelete(authorId: string) {
      return canDeletePost(getCtx(), authorId)
    },
    canEdit(authorId: string) {
      return canEditPost(getCtx(), authorId)
    },

    softDeletePostEntity<T extends { id: string; authorId: string; deletedAt?: number }>(
      post: T,
      actorId: string
    ): { post: T } | { error: string } {
      if (!canDeletePost(getCtx(), post.authorId)) {
        return { error: "You can only delete your own posts" }
      }
      const next = softDeletePost(post, actorId)
      domainEvents.publish("POST_DELETED", { postId: post.id }, actorId)
      return { post: next }
    },

    visiblePosts<T extends { deletedAt?: number | null }>(posts: T[]) {
      return posts.filter((p) => !isSoftDeleted(p))
    },

    feedVisiblePosts<T extends { deletedAt?: number | null; authorId?: string; userId?: string }>(
      posts: T[]
    ): T[] {
      const notDeleted = posts.filter((p) => !isSoftDeleted(p))
      return filterFeedContent(notDeleted, blockedIds(), mutedIds())
    },

    /**
     * Single content system: same posts array, mode selects rank/filter strategy.
     * Pagination: callers slice the returned list (preserves existing load-more patterns).
     */
    getFeed(
      mode: FeedFilter | CanonicalFeedMode,
      posts?: Post[],
      options?: {
        offset?: number
        limit?: number
        rankingContext?: Partial<FeedContext>
      }
    ): { items: RankedPost[]; total: number; mode: FeedFilter } {
      const source = posts ?? getCtx().posts ?? []
      const baseCtx = buildRankingContext()
      const ctx: FeedContext = { ...baseCtx, ...(options?.rankingContext || {}) }
      const ranked = rankFeed(source, mode as FeedFilter, ctx)
      const total = ranked.length
      const offset = options?.offset ?? 0
      const limit = options?.limit
      const items =
        typeof limit === "number" ? ranked.slice(offset, offset + limit) : ranked.slice(offset)
      return { items, total, mode: mode as FeedFilter }
    },

    /** Block-aware comments for a post (flat list; replies via replyTo, depth not forced deep) */
    visibleComments(post: Post): PostComment[] {
      const blocked = new Set(blockedIds())
      return (post.comments || []).filter((c) => {
        if (c.authorId && blocked.has(c.authorId)) return false
        return true
      })
    },

    /**
     * Build shallow comment threads: top-level + direct replies only (max depth 1).
     * Avoids deep visual nesting while preserving reply relationships.
     */
    commentThreads(post: Post): Array<{ root: PostComment; replies: PostComment[] }> {
      const visible = this.visibleComments(post)
      const roots = visible.filter((c) => !c.replyTo)
      const byParent = new Map<string, PostComment[]>()
      for (const c of visible) {
        if (!c.replyTo) continue
        const list = byParent.get(c.replyTo) || []
        list.push(c)
        byParent.set(c.replyTo, list)
      }
      return roots.map((root) => ({
        root,
        replies: byParent.get(root.id) || [],
      }))
    },
  }
}

export type FeedDomain = ReturnType<typeof createFeedDomain>
