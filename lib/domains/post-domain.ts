/**
 * PostDomain — create / edit / soft-delete / like / comment
 * via the golden mutation pipeline.
 */

import { runMutation, type MutationResult } from "./mutation-pipeline"
import { softDeletePost, isSoftDeleted } from "../social-graph"
import type { Post, PostComment } from "../ghc-types"
import { assertSafeMediaRefsForStorage } from "../media-pipeline"
import {
  canDeletePost,
  canLike,
  canComment,
  buildPermissionContext,
} from "../permission-engine"

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function createPostDomain(deps: {
  getPosts: () => Post[]
  getBlockedUsers: () => string[]
  getProfile: () => { displayName: string; photos: string[] }
  currentUserId?: string
}) {
  const actorId = deps.currentUserId || "current-user"

  function permCtx() {
    return buildPermissionContext({
      currentUserId: actorId,
      blockedUsers: deps.getBlockedUsers(),
    })
  }

  return {
    find(postId: string) {
      return deps.getPosts().find((p) => p.id === postId)
    },

    async createPost(input: {
      content: string
      visibility?: NonNullable<Post["visibility"]>
      images?: string[]
      video?: string | null
      pdf?: string | null
      pdfName?: string | null
      listingId?: string
      listingKind?: Post["listingKind"]
      contentType?: Post["contentType"]
      communityId?: string
      communityName?: string
    }): Promise<MutationResult<Post>> {
      return runMutation({
        name: "post.create",
        actorId,
        input,
        validate: (i) => {
          const t = (i.content || "").trim()
          const hasMedia = Boolean(
            (i.images && i.images.length) || i.video || i.pdf,
          )
          if (!t && !hasMedia) return "Post cannot be empty"
          if (t.length > 5000) return "Post is too long"
          const vis = i.visibility || "public"
          if (!["public", "followers", "mutuals", "private"].includes(vis)) {
            return "Invalid audience"
          }
          const mediaErr = assertSafeMediaRefsForStorage(i.images || [])
          if (mediaErr) return mediaErr
          return null
        },
        mutate: (i) => {
          const profile = deps.getProfile()
          const visibility = (i.visibility || "public") as NonNullable<Post["visibility"]>
          const post: Post = {
            id: genId("post"),
            authorId: actorId,
            authorName: profile.displayName || "You",
            authorPhoto: profile.photos?.[0] || "/placeholder.svg?width=40&height=40",
            content: (i.content || "").trim(),
            images: i.images || [],
            video: i.video ?? null,
            pdf: i.pdf ?? null,
            pdfName: i.pdfName ?? null,
            createdAt: Date.now(),
            likes: 0,
            comments: [],
            visibility,
            // Legacy mirror for older feed filters
            visibleTo:
              visibility === "public"
                ? "everyone"
                : visibility === "followers"
                  ? "followers"
                  : visibility === "mutuals"
                    ? "mutuals"
                    : "private",
            engagement: {
              likes: 0,
              comments: 0,
              shares: 0,
              views: 0,
              saves: 0,
              clicks: 0,
              avgEngagementTime: 0,
            },
            listingId: i.listingId,
            listingKind: i.listingKind,
            communityId: i.communityId,
            communityName: i.communityName,
            contentType: i.contentType || (i.listingId ? "marketplace_listing" : "standard"),
          } as Post
          return post
        },
        eventType: "POST_CREATED",
        eventPayload: (post) => ({ postId: post.id, visibility: post.visibility }),
      })
    },

    async editPost(postId: string, content: string): Promise<MutationResult<{ postId: string; content: string }>> {
      return runMutation({
        name: "post.edit",
        actorId,
        input: { postId, content },
        validate: (i) => {
          if (!(i.content || "").trim()) return "Content cannot be empty"
          if (i.content.length > 5000) return "Content is too long"
          return null
        },
        authorize: (i) => {
          const post = deps.getPosts().find((p) => p.id === i.postId)
          if (!post || isSoftDeleted(post as any)) return "Post not found"
          if (post.authorId !== actorId) return "You can only edit your own posts"
          return null
        },
        mutate: (i) => ({ postId: i.postId, content: i.content.trim() }),
        eventType: "POST_UPDATED",
        eventPayload: (d) => d,
      })
    },

    async deletePost(postId: string): Promise<MutationResult<{ post: Post }>> {
      return runMutation({
        name: "post.delete",
        actorId,
        input: { postId },
        authorize: (i) => {
          const post = deps.getPosts().find((p) => p.id === i.postId)
          if (!post || isSoftDeleted(post as any)) return "Post not found"
          if (!canDeletePost(permCtx(), post.authorId)) return "Not allowed to delete this post"
          return null
        },
        mutate: (i) => {
          const post = deps.getPosts().find((p) => p.id === i.postId)!
          return { post: softDeletePost(post, actorId) as Post }
        },
        eventType: "POST_DELETED",
        eventPayload: (_d, i) => ({ postId: i.postId }),
      })
    },

    async addComment(
      postId: string,
      text: string,
      replyToCommentId?: string
    ): Promise<MutationResult<PostComment>> {
      return runMutation({
        name: "post.comment",
        actorId,
        input: { postId, text, replyToCommentId },
        validate: (i) => {
          if (!(i.text || "").trim()) return "Comment cannot be empty"
          if ((i.text || "").length > 500) return "Comment is too long"
          return null
        },
        authorize: (i) => {
          const post = deps.getPosts().find((p) => p.id === i.postId)
          if (!post || isSoftDeleted(post as any)) return "Post not found"
          if (!canComment(permCtx(), post.authorId)) return "You can't comment on this post"
          // Soft: invalid reply target → still allow as top-level (mutate clears replyTo)
          return null
        },
        mutate: (i) => {
          const profile = deps.getProfile()
          const post = deps.getPosts().find((p) => p.id === i.postId)
          const parentOk =
            !i.replyToCommentId ||
            Boolean(post?.comments?.some((c) => c.id === i.replyToCommentId))
          const comment: PostComment = {
            id: genId("cmt"),
            authorId: actorId,
            authorName: (profile.displayName || "You").trim() || "You",
            authorPhoto: profile.photos?.[0] || "/placeholder.svg?width=32&height=32",
            text: (i.text || "").trim(),
            createdAt: Date.now(),
            replyTo: parentOk ? i.replyToCommentId : undefined,
            replies: [],
            reactions: {},
            reactionCounts: {},
            isPinned: false,
            isEdited: false,
          }
          return comment
        },
        eventType: "COMMENT_CREATED",
        eventPayload: (c, i) => ({ postId: i.postId, commentId: c.id, replyTo: i.replyToCommentId }),
      })
    },

    async toggleLike(postId: string): Promise<MutationResult<{ postId: string; liked: boolean }>> {
      return runMutation({
        name: "post.like",
        actorId,
        input: { postId },
        authorize: (i) => {
          const post = deps.getPosts().find((p) => p.id === i.postId)
          if (!post || isSoftDeleted(post as any)) return "Post not found"
          if (!canLike(permCtx(), post.authorId)) return "You can't like this post"
          return null
        },
        mutate: (i) => {
          // Caller tracks liked set; we signal intent
          return { postId: i.postId, liked: true }
        },
        eventType: "LIKE_ADDED",
        eventPayload: (d) => d,
      })
    },

    async editComment(
      postId: string,
      commentId: string,
      text: string
    ): Promise<MutationResult<{ postId: string; commentId: string; text: string }>> {
      return runMutation({
        name: "post.editComment",
        actorId,
        input: { postId, commentId, text },
        validate: (i) => {
          if (!(i.text || "").trim()) return "Comment cannot be empty"
          if (i.text.length > 1000) return "Comment is too long"
          return null
        },
        authorize: (i) => {
          const post = deps.getPosts().find((p) => p.id === i.postId)
          if (!post || isSoftDeleted(post as any)) return "Post not found"
          const comment = post.comments?.find((c) => c.id === i.commentId)
          if (!comment) return "Comment not found"
          if (comment.authorId !== actorId) return "You can only edit your own comments"
          return null
        },
        mutate: (i) => ({
          postId: i.postId,
          commentId: i.commentId,
          text: i.text.trim(),
        }),
        eventType: "COMMENT_UPDATED",
        eventPayload: (d) => d,
      })
    },

    async deleteComment(
      postId: string,
      commentId: string
    ): Promise<MutationResult<{ postId: string; commentId: string }>> {
      return runMutation({
        name: "post.deleteComment",
        actorId,
        input: { postId, commentId },
        authorize: (i) => {
          const post = deps.getPosts().find((p) => p.id === i.postId)
          if (!post || isSoftDeleted(post as any)) return "Post not found"
          const comment = post.comments?.find((c) => c.id === i.commentId)
          if (!comment) return "Comment not found"
          const isPostOwner = post.authorId === actorId
          const isCommentOwner = comment.authorId === actorId
          if (!isPostOwner && !isCommentOwner) return "Not allowed to delete this comment"
          return null
        },
        mutate: (i) => ({ postId: i.postId, commentId: i.commentId }),
        eventType: "COMMENT_DELETED",
        eventPayload: (d) => d,
      })
    },

    async reactToComment(
      postId: string,
      commentId: string,
      emoji: string
    ): Promise<MutationResult<{ postId: string; commentId: string; emoji: string; reactions: Record<string, string[]> }>> {
      return runMutation({
        name: "post.reactComment",
        actorId,
        input: { postId, commentId, emoji },
        validate: (i) => (!(i.emoji || "").trim() ? "Missing reaction" : null),
        authorize: (i) => {
          const post = deps.getPosts().find((p) => p.id === i.postId)
          if (!post || isSoftDeleted(post as any)) return "Post not found"
          if (!canComment(permCtx(), post.authorId)) return "Not allowed"
          const comment = post.comments?.find((c) => c.id === i.commentId)
          if (!comment) return "Comment not found"
          if (comment.authorId && deps.getBlockedUsers().includes(comment.authorId)) {
            return "Comment unavailable"
          }
          return null
        },
        mutate: (i) => {
          const post = deps.getPosts().find((p) => p.id === i.postId)!
          const comment = post.comments!.find((c) => c.id === i.commentId)!
          const reactions = { ...(comment.reactions || {}) }
          const key = i.emoji.trim()
          const users = new Set(reactions[key] || [])
          if (users.has(actorId)) users.delete(actorId)
          else users.add(actorId)
          reactions[key] = [...users]
          if (reactions[key].length === 0) delete reactions[key]
          return {
            postId: i.postId,
            commentId: i.commentId,
            emoji: key,
            reactions,
          }
        },
        eventType: "COMMENT_UPDATED",
        eventPayload: (d) => d,
      })
    },

    /**
     * Block-aware comment list for a post (flat top-level + one reply level).
     * Does not deep-nest UI trees — callers render replyTo links.
     */
    visibleComments(postId: string): PostComment[] {
      const post = deps.getPosts().find((p) => p.id === postId)
      if (!post || isSoftDeleted(post as any)) return []
      const blocked = new Set(deps.getBlockedUsers())
      return (post.comments || []).filter((c) => {
        if (c.authorId && blocked.has(c.authorId)) return false
        return true
      })
    },
  }
}

export type PostDomain = ReturnType<typeof createPostDomain>
