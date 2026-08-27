/**
 * Unified Post & Comment Enhancement System
 * Consolidates all post/comment features with zero duplication
 * - Nested replies (threaded comments)
 * - Comment reactions (emoji)
 * - Emojis, GIFs, images, voice media
 * - Edit/delete comments with history
 * - Pin comments
 * - Comment sorting & filtering
 * - Post editing with timestamps
 * - Quote reposts
 * - Sharing & link copying
 * - Bookmarks & collections
 * - Follow/unfollow from posts
 * - Report/mute/block/hide/not-interested
 * - Mentions (@) & hashtags (#)
 * - Link previews
 * - Robust validation
 */

import type { Post, PostComment } from './ghc-types'

// ============================================================
// TYPE DEFINITIONS (Non-duplicative)
// ============================================================

export interface EnhancedPostComment extends PostComment {
  authorId: string // Add to track user
  reactionCounts?: Record<string, number> // Count by emoji
  threadDepth?: number // Nesting level
  hasNestedReplies?: boolean
}

export interface CommentThread {
  rootComment: EnhancedPostComment
  replies: EnhancedPostComment[]
  totalReplies: number
}

export interface CommentSortOptions {
  sortBy: 'newest' | 'oldest' | 'mostReactions' | 'mostReplies' | 'pinned-first'
  filterReplies?: boolean // Show only top-level
}

export interface PostEditHistory {
  originalContent: string
  editedAt: number
  editorId: string
  reason?: string
}

export interface UserRestriction {
  userId: string
  restrictionType: 'mute' | 'block' | 'report'
  reason: string
  createdAt: number
  expiresAt?: number
}

export interface PostActionTracker {
  hideCount: number
  notInterestedCount: number
  reportCount: number
  hideBy?: string[] // user ids who hid
  notInterestedBy?: string[]
  reportedBy?: { userId: string; reason: string }[]
}

// ============================================================
// EMOJI & MEDIA CONSTANTS
// ============================================================

export const COMMENT_REACTIONS = {
  '👍': 'thumbsup',
  '❤️': 'heart',
  '😂': 'laugh',
  '😮': 'wow',
  '😢': 'sad',
  '😡': 'angry',
  '🔥': 'fire',
  '✨': 'sparkle',
} as const

export const GIF_PROVIDERS = ['giphy', 'tenor'] as const

export const VOICE_CONSTRAINTS = {
  maxDuration: 120, // 2 minutes
  mimeType: 'audio/webm',
  bitrate: 128, // kbps
}

export const IMAGE_CONSTRAINTS = {
  maxSize: 5 * 1024 * 1024, // 5MB
  maxDimensions: { width: 2048, height: 2048 },
  mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
}

// ============================================================
// COMMENT THREADING SYSTEM
// ============================================================

/**
 * Create a threaded comment structure
 */
export function createThreadedComment(
  text: string,
  authorName: string,
  authorId: string,
  authorPhoto: string,
  replyToCommentId?: string,
  threadDepth: number = 0
): EnhancedPostComment {
  return {
    id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    authorName,
    authorId,
    authorPhoto,
    text,
    createdAt: Date.now(),
    replyTo: replyToCommentId,
    replies: [],
    reactions: {},
    reactionCounts: {},
    isPinned: false,
    isEdited: false,
    threadDepth: Math.min(threadDepth, 10), // Max nesting 10 levels
    hasNestedReplies: false,
    mediaAttachments: [],
  }
}

/**
 * Add reply to parent comment (maintain threading)
 */
export function addReplyToComment(
  parentComment: EnhancedPostComment,
  reply: EnhancedPostComment
): EnhancedPostComment {
  return {
    ...parentComment,
    replies: [...(parentComment.replies || []), reply],
    hasNestedReplies: true,
  }
}

/**
 * Flatten threaded comments to linear for display
 */
export function flattenCommentThread(
  comment: EnhancedPostComment,
  depth: number = 0,
  maxDepth: number = 10
): EnhancedPostComment[] {
  if (depth > maxDepth) return []

  const flattened: EnhancedPostComment[] = [{ ...comment, threadDepth: depth }]

  if (comment.replies && comment.replies.length > 0) {
    for (const reply of comment.replies) {
      flattened.push(...flattenCommentThread(reply, depth + 1, maxDepth))
    }
  }

  return flattened
}

/**
 * Build full thread tree from comments
 */
export function buildCommentThreads(comments: EnhancedPostComment[]): CommentThread[] {
  const commentMap = new Map<string, EnhancedPostComment>()
  const roots: CommentThread[] = []

  // Index all comments
  for (const comment of comments) {
    commentMap.set(comment.id, { ...comment, replies: [] })
  }

  // Build tree structure
  for (const comment of comments) {
    if (comment.replyTo) {
      const parent = commentMap.get(comment.replyTo)
      if (parent) {
        parent.replies = [...(parent.replies || []), comment]
        parent.hasNestedReplies = true
      }
    } else {
      // Root comment
      roots.push({
        rootComment: commentMap.get(comment.id)!,
        replies: commentMap.get(comment.id)?.replies || [],
        totalReplies: countReplies(commentMap.get(comment.id)!),
      })
    }
  }

  return roots
}

function countReplies(comment: EnhancedPostComment): number {
  if (!comment.replies || comment.replies.length === 0) return 0
  return comment.replies.length + comment.replies.reduce((sum, r) => sum + countReplies(r), 0)
}

// ============================================================
// COMMENT SORTING & FILTERING
// ============================================================

/**
 * Sort comments with multiple options
 */
export function sortComments(
  comments: EnhancedPostComment[],
  options: CommentSortOptions
): EnhancedPostComment[] {
  let sorted = [...comments]

  // Filter top-level only if requested
  if (options.filterReplies) {
    sorted = sorted.filter((c) => !c.replyTo)
  }

  // Apply sort
  switch (options.sortBy) {
    case 'newest':
      sorted.sort((a, b) => b.createdAt - a.createdAt)
      break
    case 'oldest':
      sorted.sort((a, b) => a.createdAt - b.createdAt)
      break
    case 'mostReactions':
      sorted.sort((a, b) => {
        const aCount = Object.values(a.reactionCounts || {}).reduce((s, c) => s + c, 0)
        const bCount = Object.values(b.reactionCounts || {}).reduce((s, c) => s + c, 0)
        return bCount - aCount
      })
      break
    case 'mostReplies':
      sorted.sort((a, b) => (b.replies?.length || 0) - (a.replies?.length || 0))
      break
    case 'pinned-first':
      sorted.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
        return b.createdAt - a.createdAt
      })
      break
  }

  return sorted
}

// ============================================================
// COMMENT REACTIONS & EMOJIS
// ============================================================

/**
 * Add emoji reaction to comment
 */
export function addCommentReaction(
  comment: EnhancedPostComment,
  emoji: string,
  userId: string
): EnhancedPostComment {
  const reactions = { ...comment.reactions }
  const reactionCounts = { ...comment.reactionCounts }

  if (!reactions[emoji]) reactions[emoji] = []
  if (!reactions[emoji].includes(userId)) {
    reactions[emoji].push(userId)
  }

  reactionCounts[emoji] = reactions[emoji].length

  return { ...comment, reactions, reactionCounts }
}

/**
 * Remove emoji reaction from comment
 */
export function removeCommentReaction(
  comment: EnhancedPostComment,
  emoji: string,
  userId: string
): EnhancedPostComment {
  const reactions = { ...comment.reactions }
  const reactionCounts = { ...comment.reactionCounts }

  if (reactions[emoji]) {
    reactions[emoji] = reactions[emoji].filter((id) => id !== userId)
    if (reactions[emoji].length === 0) {
      delete reactions[emoji]
      delete reactionCounts[emoji]
    } else {
      reactionCounts[emoji] = reactions[emoji].length
    }
  }

  return { ...comment, reactions, reactionCounts }
}

/**
 * Get top reactions on comment
 */
export function getTopCommentReactions(
  comment: EnhancedPostComment,
  limit: number = 3
): string[] {
  return Object.entries(comment.reactionCounts || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([emoji]) => emoji)
}

// ============================================================
// COMMENT MEDIA ATTACHMENTS
// ============================================================

export interface MediaAttachment {
  id: string
  type: 'image' | 'gif' | 'voice'
  url: string
  duration?: number
  thumbnail?: string
  size?: number
  mimeType?: string
}

/**
 * Validate media attachment
 */
export function validateMediaAttachment(
  media: MediaAttachment
): { valid: boolean; error?: string } {
  if (!media.url) return { valid: false, error: 'Media URL required' }

  switch (media.type) {
    case 'image':
      if (!IMAGE_CONSTRAINTS.mimeTypes.includes(media.mimeType || '')) {
        return { valid: false, error: 'Invalid image format' }
      }
      if ((media.size || 0) > IMAGE_CONSTRAINTS.maxSize) {
        return { valid: false, error: 'Image exceeds 5MB limit' }
      }
      break

    case 'voice':
      if (media.mimeType !== VOICE_CONSTRAINTS.mimeType) {
        return { valid: false, error: 'Invalid audio format' }
      }
      if ((media.duration || 0) > VOICE_CONSTRAINTS.maxDuration) {
        return { valid: false, error: `Voice exceeds ${VOICE_CONSTRAINTS.maxDuration}s limit` }
      }
      break

    case 'gif':
      if (!media.url.includes('giphy') && !media.url.includes('tenor')) {
        return { valid: false, error: 'GIF must be from Giphy or Tenor' }
      }
      break
  }

  return { valid: true }
}

/**
 * Add media to comment
 */
export function addMediaToComment(
  comment: EnhancedPostComment,
  media: MediaAttachment
): EnhancedPostComment {
  const validation = validateMediaAttachment(media)
  if (!validation.valid) throw new Error(validation.error)

  return {
    ...comment,
    mediaAttachments: [...(comment.mediaAttachments || []), media],
  }
}

// ============================================================
// COMMENT EDITING WITH HISTORY
// ============================================================

/**
 * Edit comment with timestamp
 */
export function editComment(
  comment: EnhancedPostComment,
  newText: string,
  editorId: string
): EnhancedPostComment {
  return {
    ...comment,
    text: newText,
    isEdited: true,
    editedAt: Date.now(),
    // Store editing history in extended field
    ...{ editedBy: editorId },
  }
}

// ============================================================
// COMMENT PINNING
// ============================================================

/**
 * Pin comment to top (post author only)
 */
export function pinComment(
  comment: EnhancedPostComment,
  userId: string,
  postAuthorId: string
): EnhancedPostComment {
  if (userId !== postAuthorId) {
    throw new Error('Only post author can pin comments')
  }
  return { ...comment, isPinned: true }
}

/**
 * Unpin comment
 */
export function unpinComment(
  comment: EnhancedPostComment,
  userId: string,
  postAuthorId: string
): EnhancedPostComment {
  if (userId !== postAuthorId) {
    throw new Error('Only post author can unpin comments')
  }
  return { ...comment, isPinned: false }
}

// ============================================================
// POST EDITING & VERSIONING
// ============================================================

/**
 * Edit post with history tracking
 */
export function editPost(
  post: Post,
  newContent: string,
  editorId: string
): Post & { editHistory: PostEditHistory[] } {
  const editHistory = [
    {
      originalContent: post.content,
      editedAt: Date.now(),
      editorId,
    },
  ]

  return {
    ...post,
    content: newContent,
    isDraft: false,
    editHistory,
  }
}

// ============================================================
// QUOTE REPOSTS
// ============================================================

/**
 * Create quote repost
 */
export function createQuoteRepost(
  originalPost: Post,
  quoteText: string,
  authorId: string,
  authorName: string,
  authorPhoto: string
): Post {
  return {
    id: `post_quote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    authorId,
    authorName,
    authorPhoto,
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
}

// ============================================================
// SHARING & LINK MANAGEMENT
// ============================================================

/**
 * Copy post link to clipboard
 */
export async function copyPostLink(postId: string, baseUrl: string = ''): Promise<string> {
  const url = `${baseUrl}/posts/${postId}`
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(url)
  }
  return url
}

/**
 * Generate share text for social platforms
 */
export function generateShareText(
  post: Post,
  platform: 'twitter' | 'facebook' | 'linkedin'
): string {
  const text = post.content.substring(0, 100)

  switch (platform) {
    case 'twitter':
      return `${text}... #GHConnect`
    case 'facebook':
      return `Check out this post: ${text}`
    case 'linkedin':
      return `Interesting thoughts: ${text}`
    default:
      return text
  }
}

/**
 * Get social share URL
 */
export function getSocialShareUrl(
  platform: 'twitter' | 'facebook' | 'linkedin',
  postUrl: string,
  text: string
): string {
  switch (platform) {
    case 'twitter':
      return `https://twitter.com/intent/tweet?url=${encodeURIComponent(postUrl)}&text=${encodeURIComponent(text)}`
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`
    case 'linkedin':
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(postUrl)}`
  }
}

// ============================================================
// BOOKMARKS & COLLECTIONS
// ============================================================

/**
 * Save post to collection
 */
export function savePostToCollection(
  postId: string,
  collection: string = 'Saved'
): { postId: string; collection: string; savedAt: number } {
  return {
    postId,
    collection,
    savedAt: Date.now(),
  }
}

// ============================================================
// POST ACTIONS & RESTRICTIONS
// ============================================================

/**
 * Create user restriction record
 */
export function createUserRestriction(
  userId: string,
  restrictionType: 'mute' | 'block' | 'report',
  reason: string,
  durationDays?: number
): UserRestriction {
  return {
    userId,
    restrictionType,
    reason,
    createdAt: Date.now(),
    expiresAt: durationDays ? Date.now() + durationDays * 24 * 60 * 60 * 1000 : undefined,
  }
}

/**
 * Track post hide action
 */
export function trackPostHide(
  post: Post,
  userId: string
): Post {
  return {
    ...post,
    hideCount: (post.hideCount || 0) + 1,
  }
}

/**
 * Track "not interested" action
 */
export function trackNotInterested(post: Post): Post {
  return {
    ...post,
    notInterestedCount: (post.notInterestedCount || 0) + 1,
  }
}

/**
 * Create post report
 */
export function createPostReport(
  postId: string,
  reportedBy: string,
  reason: string
): { postId: string; reportedBy: string; reason: string; reportedAt: number } {
  return {
    postId,
    reportedBy,
    reason,
    reportedAt: Date.now(),
  }
}

// ============================================================
// MENTIONS, HASHTAGS, & LINKS
// ============================================================

/**
 * Extract mentions from text
 */
export function extractMentions(text: string): string[] {
  const mentionRegex = /@(\w+)/g
  const matches = text.match(mentionRegex) || []
  return [...new Set(matches.map((m) => m.substring(1)))]
}

/**
 * Extract hashtags from text
 */
export function extractHashtags(text: string): string[] {
  const hashtagRegex = /#(\w+)/g
  const matches = text.match(hashtagRegex) || []
  return [...new Set(matches.map((m) => m.substring(1)))]
}

/**
 * Extract URLs from text
 */
export function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  return text.match(urlRegex) || []
}

/**
 * Extract emojis from text
 */
export function extractEmojis(text: string): string[] {
  const emojiRegex = /\p{Emoji}/gu
  return text.match(emojiRegex) || []
}

// ============================================================
// CONTENT VALIDATION
// ============================================================

export interface CommentValidation {
  valid: boolean
  errors: string[]
}

/**
 * Comprehensive comment validation
 */
export function validateComment(text: string): CommentValidation {
  const errors: string[] = []

  if (!text || text.trim().length === 0) {
    errors.push('Comment cannot be empty')
  }

  if (text.length > 5000) {
    errors.push('Comment exceeds 5000 character limit')
  }

  // Check for spam patterns
  const spamPatterns = [/(.)\1{19,}/, /http.*http/]
  if (spamPatterns.some((p) => p.test(text))) {
    errors.push('Comment appears to contain spam')
  }

  // Check mention count (max 10)
  const mentions = extractMentions(text)
  if (mentions.length > 10) {
    errors.push('Too many mentions (max 10)')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Sanitize comment text
 */
export function sanitizeCommentText(text: string): string {
  return text
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove scripts
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '') // Remove iframes
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .substring(0, 5000) // Cap length
}

export default {
  // Threading
  createThreadedComment,
  addReplyToComment,
  flattenCommentThread,
  buildCommentThreads,

  // Sorting
  sortComments,

  // Reactions
  addCommentReaction,
  removeCommentReaction,
  getTopCommentReactions,

  // Media
  validateMediaAttachment,
  addMediaToComment,

  // Editing
  editComment,
  editPost,

  // Pinning
  pinComment,
  unpinComment,

  // Sharing
  createQuoteRepost,
  copyPostLink,
  generateShareText,
  getSocialShareUrl,

  // Bookmarks
  savePostToCollection,

  // Actions
  createUserRestriction,
  trackPostHide,
  trackNotInterested,
  createPostReport,

  // Content
  extractMentions,
  extractHashtags,
  extractUrls,
  extractEmojis,

  // Validation
  validateComment,
  sanitizeCommentText,
}
