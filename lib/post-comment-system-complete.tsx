/**
 * UNIFIED POST-COMMENT SYSTEM
 * Master integration coordinating all post/comment enhancements
 * Reuses existing logic, removes duplicates, preserves architecture
 */

import type { Post, PostComment } from "./ghc-types"

// ============================================================================
// TYPES (Unified, no duplication)
// ============================================================================

export type CommentSortOption = "newest" | "oldest" | "top-reactions" | "top-replies"
export type MediaType = "image" | "gif" | "voice"

export interface MediaAttachment {
  id: string
  type: MediaType
  url: string
  duration?: number // seconds, for voice
  thumbnail?: string
  size?: number // bytes
  mimeType?: string
}

export interface CommentReaction {
  emoji: string
  count: number
  reactedByUser: boolean
  userNames: string[] // max 3, then count overflow
}

export interface UserRestriction {
  userId: string
  type: "mute" | "block"
  createdAt: number
  reason?: string
}

export interface QuoteRepost {
  originalPostId: string
  quoteText: string
  quoteAuthor: string
  quoteAuthorId: string
  createdAt: number
}

export interface PostShare {
  platform: "twitter" | "facebook" | "linkedin" | "copy"
  url: string
  text: string
  timestamp: number
}

export interface EnhancedComment extends PostComment {
  replyCount: number
  replies: EnhancedComment[]
  reactions: Record<string, string[]>
  reactionCounts: Record<string, number>
  mediaAttachments: MediaAttachment[]
  mentions: string[]
  hashtags: string[]
  isPinned: boolean
  isEdited: boolean
  editedAt?: number
  editedBy?: string
  threadDepth: number
}

export interface CommentThread {
  rootComment: EnhancedComment
  replies: EnhancedComment[]
  depth: number
  pinnedComment?: EnhancedComment
}

// ============================================================================
// NESTED REPLIES & THREADING
// ============================================================================

export function createNestedComment(
  text: string,
  authorName: string,
  authorPhoto: string,
  authorId: string,
  replyToId?: string
): EnhancedComment {
  return {
    id: generateId(),
    text,
    authorName,
    authorPhoto,
    authorId,
    createdAt: Date.now(),
    replyTo: replyToId,
    replyCount: 0,
    replies: [],
    reactions: {},
    reactionCounts: {},
    mediaAttachments: [],
    mentions: extractMentions(text),
    hashtags: extractHashtags(text),
    isPinned: false,
    isEdited: false,
    threadDepth: replyToId ? 1 : 0,
  }
}

export function addReplyToComment(
  parentComment: EnhancedComment,
  reply: EnhancedComment
): EnhancedComment {
  const maxDepth = 10
  if (reply.threadDepth >= maxDepth) return parentComment

  return {
    ...parentComment,
    replyCount: parentComment.replyCount + 1,
    replies: [...(parentComment.replies || []), { ...reply, threadDepth: (parentComment.threadDepth || 0) + 1 }],
  }
}

export function buildCommentThreads(comments: EnhancedComment[]): CommentThread[] {
  const rootComments = comments.filter((c) => !c.replyTo)
  const repliesMap = new Map<string, EnhancedComment[]>()

  comments.forEach((comment) => {
    if (comment.replyTo) {
      if (!repliesMap.has(comment.replyTo)) repliesMap.set(comment.replyTo, [])
      repliesMap.get(comment.replyTo)?.push(comment)
    }
  })

  return rootComments.map((root) => ({
    rootComment: root,
    replies: repliesMap.get(root.id) || [],
    depth: Math.max(...(repliesMap.get(root.id)?.map((r) => r.threadDepth || 0) || [0])),
    pinnedComment: root.isPinned ? root : undefined,
  }))
}

export function flattenCommentThread(thread: CommentThread): EnhancedComment[] {
  const result = [thread.rootComment]
  const addReplies = (comments: EnhancedComment[], depth: number) => {
    comments.forEach((comment) => {
      result.push({ ...comment, threadDepth: depth })
      if (comment.replies?.length) addReplies(comment.replies, depth + 1)
    })
  }
  if (thread.replies.length) addReplies(thread.replies, 1)
  return result
}

// ============================================================================
// COMMENT SORTING & FILTERING
// ============================================================================

export function sortComments(comments: EnhancedComment[], option: CommentSortOption): EnhancedComment[] {
  const sorted = [...comments]
  switch (option) {
    case "newest":
      return sorted.sort((a, b) => b.createdAt - a.createdAt)
    case "oldest":
      return sorted.sort((a, b) => a.createdAt - b.createdAt)
    case "top-reactions":
      return sorted.sort((a, b) => {
        const aCount = Object.values(a.reactionCounts || {}).reduce((s, c) => s + c, 0)
        const bCount = Object.values(b.reactionCounts || {}).reduce((s, c) => s + c, 0)
        return bCount - aCount
      })
    case "top-replies":
      return sorted.sort((a, b) => b.replyCount - a.replyCount)
    default:
      return sorted
  }
}

// ============================================================================
// REACTIONS (Unified)
// ============================================================================

export function addReactionToComment(
  comment: EnhancedComment,
  emoji: string,
  userId: string
): EnhancedComment {
  const reactions = { ...comment.reactions }
  if (!reactions[emoji]) reactions[emoji] = []
  if (!reactions[emoji].includes(userId)) {
    reactions[emoji].push(userId)
  }

  const reactionCounts = { ...comment.reactionCounts }
  reactionCounts[emoji] = (reactions[emoji] || []).length

  return { ...comment, reactions, reactionCounts }
}

export function removeReactionFromComment(
  comment: EnhancedComment,
  emoji: string,
  userId: string
): EnhancedComment {
  const reactions = { ...comment.reactions }
  if (reactions[emoji]) {
    reactions[emoji] = reactions[emoji].filter((id) => id !== userId)
    if (reactions[emoji].length === 0) delete reactions[emoji]
  }

  const reactionCounts = { ...comment.reactionCounts }
  reactionCounts[emoji] = reactions[emoji]?.length || 0
  if (reactionCounts[emoji] === 0) delete reactionCounts[emoji]

  return { ...comment, reactions, reactionCounts }
}

export function getTopCommentReactions(comment: EnhancedComment, limit: number = 3): CommentReaction[] {
  const sorted = Object.entries(comment.reactionCounts || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)

  return sorted.map(([emoji, count]) => ({
    emoji,
    count,
    reactedByUser: false, // Set by caller with userId context
    userNames: (comment.reactions?.[emoji] || []).slice(0, 3),
  }))
}

// ============================================================================
// MEDIA ATTACHMENTS (Images, GIFs, Voice)
// ============================================================================

export function validateMediaAttachment(media: MediaAttachment): { valid: boolean; error?: string } {
  if (!media.url) return { valid: false, error: "Media URL required" }
  if (!["image", "gif", "voice"].includes(media.type)) return { valid: false, error: "Invalid media type" }
  if (media.type === "voice" && (!media.duration || media.duration > 60)) {
    return { valid: false, error: "Voice must be 1-60 seconds" }
  }
  if (media.size && media.size > 50 * 1024 * 1024) return { valid: false, error: "Media too large (>50MB)" }
  return { valid: true }
}

export function addMediaToComment(
  comment: EnhancedComment,
  media: MediaAttachment
): EnhancedComment | null {
  const validation = validateMediaAttachment(media)
  if (!validation.valid) return null

  const attachments = [...(comment.mediaAttachments || []), media]
  if (attachments.length > 10) return null // Max 10 attachments

  return { ...comment, mediaAttachments: attachments }
}

// ============================================================================
// EDITING & HISTORY
// ============================================================================

export function editComment(
  comment: EnhancedComment,
  newText: string,
  editorId: string
): EnhancedComment {
  if (!newText.trim()) return comment
  return {
    ...comment,
    text: sanitizeCommentText(newText),
    isEdited: true,
    editedAt: Date.now(),
    editedBy: editorId,
    mentions: extractMentions(newText),
    hashtags: extractHashtags(newText),
  }
}

export function editPost(
  post: Post,
  newContent: string,
  editorId: string
): Post {
  if (!newContent.trim()) return post
  const editHistory = post.editHistory || []
  editHistory.push({
    originalContent: post.content,
    editedAt: Date.now(),
    editorId,
  })
  return {
    ...post,
    content: sanitizePostText(newContent),
    isEdited: true,
    editedAt: Date.now(),
    editHistory: editHistory.slice(-5), // Keep last 5 edits
  }
}

// ============================================================================
// PIN/UNPIN COMMENTS
// ============================================================================

export function pinComment(comment: EnhancedComment): EnhancedComment {
  return { ...comment, isPinned: true }
}

export function unpinComment(comment: EnhancedComment): EnhancedComment {
  return { ...comment, isPinned: false }
}

export function getPinnedComment(comments: EnhancedComment[]): EnhancedComment | null {
  return comments.find((c) => c.isPinned) || null
}

// ============================================================================
// MENTIONS & HASHTAGS
// ============================================================================

export function extractMentions(text: string): string[] {
  const matches = text.match(/@[a-zA-Z0-9_-]+/g) || []
  return [...new Set(matches.map((m) => m.slice(1)))] // Remove @ and dedupe
}

export function extractHashtags(text: string): string[] {
  const matches = text.match(/#[a-zA-Z0-9_]+/g) || []
  return [...new Set(matches.map((m) => m.slice(1)))] // Remove # and dedupe
}

export function validateMentions(mentions: string[], validUsers: string[]): boolean {
  return mentions.every((m) => validUsers.includes(m))
}

export function validateHashtags(hashtags: string[]): boolean {
  return hashtags.every((h) => h.length > 0 && h.length <= 50)
}

// ============================================================================
// LINK PREVIEW & URL EXTRACTION
// ============================================================================

export function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  return text.match(urlRegex) || []
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

// ============================================================================
// QUOTE REPOSTS
// ============================================================================

export function createQuoteRepost(
  originalPost: Post,
  quoteText: string,
  quoteAuthorId: string,
  quoteAuthorName: string
): Post {
  const newPost: Post = {
    id: generateId(),
    authorId: quoteAuthorId,
    authorName: quoteAuthorName,
    authorPhoto: "",
    content: quoteText,
    images: [],
    video: null,
    pdf: null,
    pdfName: null,
    likes: 0,
    comments: [],
    createdAt: Date.now(),
    quoteOf: originalPost.id,
  }
  return newPost
}

// ============================================================================
// SHARING & COPYING
// ============================================================================

export function generateShareText(post: Post, platform: string): string {
  const truncated = post.content.substring(0, 100) + (post.content.length > 100 ? "..." : "")
  switch (platform) {
    case "twitter":
      return `Check this out: "${truncated}"\n#GHConnect`
    case "facebook":
      return truncated
    case "linkedin":
      return `Shared from GreenHaven: ${truncated}`
    default:
      return truncated
  }
}

export function getSocialShareUrl(post: Post, platform: string, postUrl: string): string {
  const text = encodeURIComponent(generateShareText(post, platform))
  const url = encodeURIComponent(postUrl)

  switch (platform) {
    case "twitter":
      return `https://twitter.com/intent/tweet?text=${text}&url=${url}`
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${url}`
    case "linkedin":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${url}`
    default:
      return ""
  }
}

export function copyPostLink(postUrl: string): Promise<boolean> {
  return navigator.clipboard
    .writeText(postUrl)
    .then(() => true)
    .catch(() => false)
}

// ============================================================================
// BOOKMARKS & COLLECTIONS
// ============================================================================

export function savePostToCollection(post: Post, collectionName: string): Post {
  const collections = [...(post.collections || []), collectionName]
  const bookmarks = [...(post.bookmarkedBy || []), collectionName]
  return { ...post, collections: [...new Set(collections)], bookmarkedBy: [...new Set(bookmarks)] }
}

export function removePostFromCollection(post: Post, collectionName: string): Post {
  return {
    ...post,
    collections: (post.collections || []).filter((c) => c !== collectionName),
    bookmarkedBy: (post.bookmarkedBy || []).filter((b) => b !== collectionName),
  }
}

// ============================================================================
// POST ACTIONS (Hide, Not Interested, Report, etc.)
// ============================================================================

export function hidePost(post: Post, userId: string): Post {
  const hideBy = [...(post.hideBy || []), userId]
  return { ...post, hideBy: [...new Set(hideBy)], hideCount: hideBy.length }
}

export function trackNotInterested(post: Post, userId: string): Post {
  const notInterestedBy = [...(post.notInterestedBy || []), userId]
  return { ...post, notInterestedBy: [...new Set(notInterestedBy)], notInterestedCount: notInterestedBy.length }
}

export function reportPost(
  post: Post,
  userId: string,
  reason: string
): Post {
  const reportedBy = [...(post.reportedBy || []), { userId, reason }]
  return { ...post, reportedBy, reportCount: reportedBy.length }
}

// ============================================================================
// FOLLOW/UNFOLLOW FROM POSTS
// ============================================================================

export interface FollowAction {
  userId: string
  followedAt: number
}

export function createFollowAction(userId: string): FollowAction {
  return { userId, followedAt: Date.now() }
}

// ============================================================================
// USER RESTRICTIONS (Mute, Block)
// ============================================================================

export function muteUser(userId: string, reason?: string): UserRestriction {
  return { userId, type: "mute", createdAt: Date.now(), reason }
}

export function blockUser(userId: string, reason?: string): UserRestriction {
  return { userId, type: "block", createdAt: Date.now(), reason }
}

// ============================================================================
// VALIDATION (Unified, no duplication)
// ============================================================================

export function validateCommentText(text: string): { valid: boolean; error?: string } {
  if (!text || !text.trim()) return { valid: false, error: "Comment cannot be empty" }
  if (text.length > 5000) return { valid: false, error: "Comment too long (>5000 chars)" }
  if (text.trim().length < 1) return { valid: false, error: "Comment must have content" }
  return { valid: true }
}

export function validatePostContent(content: string): { valid: boolean; error?: string } {
  if (!content || !content.trim()) return { valid: false, error: "Post cannot be empty" }
  if (content.length > 10000) return { valid: false, error: "Post too long (>10000 chars)" }
  if (content.trim().length < 1) return { valid: false, error: "Post must have content" }
  return { valid: true }
}

export function detectSpamContent(text: string): boolean {
  const spamPatterns = [
    /(?:http|https):\/\/[^\s]+/gi, // Too many links
    /\$\d+/g, // Dollar amounts
    /(?:click|buy|call|visit|contact|subscribe|now){2,}/gi, // Marketing words
  ]

  let spamScore = 0
  const linkCount = (text.match(/(http|https):\/\//g) || []).length
  if (linkCount > 3) spamScore += 2
  if (/(click here|buy now|call now|subscribe now)/gi.test(text)) spamScore += 1

  return spamScore >= 2
}

export function sanitizeCommentText(text: string): string {
  return text
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .trim()
    .slice(0, 5000)
}

export function sanitizePostText(text: string): string {
  return sanitizeCommentText(text).slice(0, 10000)
}

// ============================================================================
// UTILITIES (Reusable helpers)
// ============================================================================

function generateId(): string {
  return Math.random().toString(36).substring(2, 11)
}

export function findCommentById(comments: EnhancedComment[], id: string): EnhancedComment | null {
  for (const comment of comments) {
    if (comment.id === id) return comment
    if (comment.replies?.length) {
      const found = findCommentById(comment.replies, id)
      if (found) return found
    }
  }
  return null
}

export function flattenComments(comments: EnhancedComment[]): EnhancedComment[] {
  const result: EnhancedComment[] = []
  const flatten = (arr: EnhancedComment[]) => {
    arr.forEach((c) => {
      result.push(c)
      if (c.replies?.length) flatten(c.replies)
    })
  }
  flatten(comments)
  return result
}
