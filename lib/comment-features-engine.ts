// Comment Features Engine - Advanced comment interactions
// Extends post-comment-engine.ts with nested replies, sorting, and moderation

import type { PostComment } from "@/lib/ghc-types"
import { generateId } from "@/lib/ghc-data"
import { extractMentions, extractHashtags, detectSpam } from "@/lib/post-validation"

// Enhanced comment interface (matches PostComment from ghc-types)
export interface EnhancedCommentData extends PostComment {
  replyCount?: number
  replies?: EnhancedCommentData[]
  reactions?: Record<string, string[]>
  isPinned?: boolean
  isEdited?: boolean
  editedAt?: number
  mediaAttachments?: CommentMediaData[]
  mentions?: string[]
  replyTo?: string
}

export interface CommentMediaData {
  id: string
  type: "image" | "gif" | "voice"
  url: string
  duration?: number
  thumbnail?: string
}

// Nested reply management
export interface NestedReply {
  id: string
  parentCommentId: string
  content: string
  authorId: string
  authorName: string
  authorPhoto: string
  createdAt: number
  isEdited?: boolean
  editedAt?: number
  reactions?: Record<string, string[]>
}

export function createNestedReply(
  parentCommentId: string,
  content: string,
  authorId: string,
  authorName: string,
  authorPhoto: string
): NestedReply {
  return {
    id: generateId(),
    parentCommentId,
    content,
    authorId,
    authorName,
    authorPhoto,
    createdAt: Date.now(),
  }
}

export function addReplyToComment(
  comment: EnhancedCommentData,
  reply: EnhancedCommentData
): EnhancedCommentData {
  const updatedReplies = [...(comment.replies || []), reply]
  return {
    ...comment,
    replies: updatedReplies,
    replyCount: (comment.replyCount || 0) + 1,
  }
}

export function removeReplyFromComment(
  comment: EnhancedCommentData,
  replyId: string
): EnhancedCommentData {
  const updatedReplies = (comment.replies || []).filter((r) => r.id !== replyId)
  return {
    ...comment,
    replies: updatedReplies,
    replyCount: Math.max((comment.replyCount || 1) - 1, 0),
  }
}

// Find comment by ID (recursive search)
export function findCommentById(
  comments: EnhancedCommentData[],
  id: string
): EnhancedCommentData | null {
  for (const comment of comments) {
    if (comment.id === id) return comment
    if (comment.replies) {
      const found = findCommentById(comment.replies, id)
      if (found) return found
    }
  }
  return null
}

// Find parent comment of a reply
export function findParentComment(
  comments: EnhancedCommentData[],
  childId: string
): EnhancedCommentData | null {
  for (const comment of comments) {
    if (comment.replies?.some((r) => r.id === childId)) {
      return comment
    }
    if (comment.replies) {
      const found = findParentComment(comment.replies, childId)
      if (found) return found
    }
  }
  return null
}

// Comment sorting types
export type CommentSortType = "newest" | "oldest" | "mostReacted" | "pinned" | "relevance"

export function sortComments(
  comments: EnhancedCommentData[],
  sortType: CommentSortType
): EnhancedCommentData[] {
  const sorted = [...comments]

  switch (sortType) {
    case "newest":
      return sorted.sort((a, b) => b.createdAt - a.createdAt)

    case "oldest":
      return sorted.sort((a, b) => a.createdAt - b.createdAt)

    case "mostReacted":
      return sorted.sort((a, b) => {
        const aReactions = Object.values(a.reactions || {}).reduce((sum, arr) => sum + arr.length, 0)
        const bReactions = Object.values(b.reactions || {}).reduce((sum, arr) => sum + arr.length, 0)
        return bReactions - aReactions
      })

    case "pinned":
      return sorted.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1
        if (!a.isPinned && b.isPinned) return 1
        return b.createdAt - a.createdAt
      })

    case "relevance":
      // Sort by reactions + replies
      return sorted.sort((a, b) => {
        const aScore =
          Object.values(a.reactions || {}).reduce((sum, arr) => sum + arr.length, 0) * 2 +
          (a.replyCount || 0)
        const bScore =
          Object.values(b.reactions || {}).reduce((sum, arr) => sum + arr.length, 0) * 2 +
          (b.replyCount || 0)
        return bScore - aScore
      })

    default:
      return sorted
  }
}

// Flatten comments (for display in list)
export function flattenComments(comments: EnhancedCommentData[]): EnhancedCommentData[] {
  const flattened: EnhancedCommentData[] = []

  for (const comment of comments) {
    flattened.push(comment)
    if (comment.replies) {
      flattened.push(...flattenComments(comment.replies))
    }
  }

  return flattened
}

// Get all nested replies for a comment
export function getAllReplies(comment: EnhancedCommentData): EnhancedCommentData[] {
  if (!comment.replies || comment.replies.length === 0) return []

  const all: EnhancedCommentData[] = [...comment.replies]
  for (const reply of comment.replies) {
    all.push(...getAllReplies(reply))
  }
  return all
}

// Comment reaction management
export function addReactionToComment(
  comment: EnhancedCommentData,
  emoji: string,
  userId: string
): EnhancedCommentData {
  const reactions = { ...(comment.reactions || {}) }

  if (!reactions[emoji]) {
    reactions[emoji] = []
  }

  if (!reactions[emoji].includes(userId)) {
    reactions[emoji].push(userId)
  }

  return { ...comment, reactions }
}

export function removeReactionFromComment(
  comment: EnhancedCommentData,
  emoji: string,
  userId: string
): EnhancedCommentData {
  const reactions = { ...(comment.reactions || {}) }

  if (reactions[emoji]) {
    reactions[emoji] = reactions[emoji].filter((id) => id !== userId)
    if (reactions[emoji].length === 0) {
      delete reactions[emoji]
    }
  }

  return { ...comment, reactions }
}

export function getReactionCount(reactions: Record<string, string[]> | undefined, emoji: string): number {
  return reactions?.[emoji]?.length || 0
}

export function getTotalReactions(reactions: Record<string, string[]> | undefined): number {
  if (!reactions) return 0
  return Object.values(reactions).reduce((sum, arr) => sum + arr.length, 0)
}

export function hasUserReacted(
  reactions: Record<string, string[]> | undefined,
  emoji: string,
  userId: string
): boolean {
  return reactions?.[emoji]?.includes(userId) || false
}

// Pin/Unpin comments
export function pinComment(comment: EnhancedCommentData): EnhancedCommentData {
  return {
    ...comment,
    isPinned: true,
  }
}

export function unpinComment(comment: EnhancedCommentData): EnhancedCommentData {
  return {
    ...comment,
    isPinned: false,
  }
}

export function getPinnedComments(comments: EnhancedCommentData[]): EnhancedCommentData[] {
  return comments.filter((c) => c.isPinned)
}

// Edit comment
export function editComment(
  comment: EnhancedCommentData,
  newText: string
): EnhancedCommentData {
  return {
    ...comment,
    text: newText,
    isEdited: true,
    editedAt: Date.now(),
  }
}

// Comment mention extraction and validation
export function extractMentionsFromComment(text: string): string[] {
  return extractMentions(text)
}

// Comment hashtag extraction
export function extractHashtagsFromComment(text: string): string[] {
  return extractHashtags(text)
}

// Comment statistics
export interface CommentStats {
  totalComments: number
  totalReplies: number
  averageRepliesPerComment: number
  totalReactions: number
  averageReactionsPerComment: number
  editedComments: number
  pinnedComments: number
}

export function calculateCommentStats(comments: EnhancedCommentData[]): CommentStats {
  const flattened = flattenComments(comments)
  let totalReplies = 0
  let totalReactions = 0
  let editedComments = 0
  let pinnedComments = 0

  for (const comment of comments) {
    totalReplies += comment.replyCount || 0
    totalReactions += getTotalReactions(comment.reactions)
    if (comment.isEdited) editedComments++
    if (comment.isPinned) pinnedComments++
  }

  return {
    totalComments: comments.length,
    totalReplies,
    averageRepliesPerComment: comments.length > 0 ? totalReplies / comments.length : 0,
    totalReactions,
    averageReactionsPerComment: comments.length > 0 ? totalReactions / comments.length : 0,
    editedComments,
    pinnedComments,
  }
}

// Comment threading
export interface CommentThread {
  rootComment: EnhancedCommentData
  depth: number
  totalInThread: number
}

export function getCommentThread(
  comments: EnhancedCommentData[],
  commentId: string
): EnhancedCommentData[] {
  const comment = findCommentById(comments, commentId)
  if (!comment) return []

  const thread: EnhancedCommentData[] = [comment]

  if (comment.replies) {
    thread.push(...flattenComments(comment.replies))
  }

  return thread
}

export function getCommentDepth(
  comments: EnhancedCommentData[],
  commentId: string,
  currentDepth: number = 0
): number {
  for (const comment of comments) {
    if (comment.id === commentId) {
      return currentDepth
    }
    if (comment.replies) {
      const depth = getCommentDepth(comment.replies, commentId, currentDepth + 1)
      if (depth !== -1) return depth
    }
  }
  return -1
}

// Comment visibility/moderation
export interface CommentModeration {
  commentId: string
  hidden: boolean
  reason?: string
  hiddenBy: string // userId
  hiddenAt: number
}

export function hideComment(
  comment: EnhancedCommentData,
  reason?: string
): { comment: EnhancedCommentData; moderation: CommentModeration } {
  return {
    comment: { ...comment, text: "[Comment hidden by moderator]" },
    moderation: {
      commentId: comment.id,
      hidden: true,
      reason,
      hiddenBy: "moderator",
      hiddenAt: Date.now(),
    },
  }
}

// Spam detection for comments (consolidated from post-validation)
export function detectSpamInComment(text: string): boolean {
  const spamCheck = detectSpam(text)
  return spamCheck.isSpam
}

// Get comment activity summary
export interface CommentActivity {
  commentId: string
  reactionActivity: { emoji: string; count: number }[]
  replyActivity: { time: number; count: number }[]
  lastActivityTime: number
}

export function getCommentActivity(comment: EnhancedCommentData): CommentActivity {
  const reactionActivity = Object.entries(comment.reactions || {}).map(([emoji, users]) => ({
    emoji,
    count: users.length,
  }))

  return {
    commentId: comment.id,
    reactionActivity: reactionActivity.sort((a, b) => b.count - a.count),
    replyActivity: [], // Would be populated from time-series data
    lastActivityTime: comment.editedAt || comment.createdAt,
  }
}
