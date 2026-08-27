import type { Post, PostComment } from "@/lib/ghc-types"
import { generateId } from "@/lib/ghc-data"

// Comment Enhancement Types
export interface EnhancedComment extends PostComment {
  replyCount?: number
  replies?: EnhancedComment[]
  reactions?: Record<string, string[]> // emoji -> user ids
  isPinned?: boolean
  isEdited?: boolean
  editedAt?: number
  mediaAttachments?: CommentMedia[]
  mentions?: string[]
  replyTo?: string // id of parent comment
}

export interface CommentMedia {
  id: string
  type: "image" | "gif" | "voice"
  url: string
  duration?: number // for voice notes
  thumbnail?: string // for GIFs
}

export interface PostEnhancement {
  isEdited?: boolean
  editedAt?: number
  isPinned?: boolean
  quotedPost?: { id: string; authorName: string; content: string }
  sharedCount?: number
  shareLinks?: Record<string, string> // platform -> share url
  copies?: number
  hideCount?: number
  notInterestedCount?: number
}

// Validation functions
export function validateCommentText(text: string, maxLength: number = 5000): { valid: boolean; error?: string } {
  const trimmed = text.trim()
  if (!trimmed) return { valid: false, error: "Comment cannot be empty" }
  if (trimmed.length > maxLength) return { valid: false, error: `Comment exceeds ${maxLength} characters` }
  return { valid: true }
}

export function validateMentions(text: string, validUserIds: string[]): string[] {
  const mentionRegex = /@(\w+)/g
  const mentions: string[] = []
  let match
  while ((match = mentionRegex.exec(text)) !== null) {
    const mention = match[1]
    if (validUserIds.includes(mention)) {
      mentions.push(mention)
    }
  }
  return [...new Set(mentions)] // deduplicate
}

export function validateHashtags(text: string): string[] {
  const hashtagRegex = /#(\w+)/g
  const hashtags: string[] = []
  let match
  while ((match = hashtagRegex.exec(text)) !== null) {
    hashtags.push(match[1])
  }
  return [...new Set(hashtags)] // deduplicate
}

// Comment creation and editing
export function createComment(
  authorName: string,
  authorPhoto: string,
  text: string,
  replyToId?: string,
  media?: CommentMedia[]
): EnhancedComment {
  return {
    id: generateId(),
    authorName,
    authorPhoto,
    text,
    createdAt: Date.now(),
    replyTo: replyToId,
    replies: [],
    reactions: {},
    isPinned: false,
    isEdited: false,
    mediaAttachments: media || [],
  }
}

export function editComment(comment: EnhancedComment, newText: string): EnhancedComment {
  return {
    ...comment,
    text: newText,
    isEdited: true,
    editedAt: Date.now(),
  }
}

// Comment reactions
export function addReactionToComment(
  comment: EnhancedComment,
  emoji: string,
  userId: string
): EnhancedComment {
  const reactions = { ...comment.reactions }
  if (!reactions[emoji]) {
    reactions[emoji] = []
  }
  if (!reactions[emoji].includes(userId)) {
    reactions[emoji].push(userId)
  }
  return { ...comment, reactions }
}

export function removeReactionFromComment(
  comment: EnhancedComment,
  emoji: string,
  userId: string
): EnhancedComment {
  const reactions = { ...comment.reactions }
  if (reactions[emoji]) {
    reactions[emoji] = reactions[emoji].filter((id) => id !== userId)
    if (reactions[emoji].length === 0) {
      delete reactions[emoji]
    }
  }
  return { ...comment, reactions }
}

export function getReactionCount(reactions: Record<string, string[]>, emoji: string): number {
  return reactions[emoji]?.length || 0
}

// Nested comment management
export function addReplyToComment(
  comment: EnhancedComment,
  reply: EnhancedComment
): EnhancedComment {
  return {
    ...comment,
    replies: [...(comment.replies || []), reply],
    replyCount: (comment.replyCount || 0) + 1,
  }
}

export function findCommentById(comments: EnhancedComment[], id: string): EnhancedComment | null {
  for (const comment of comments) {
    if (comment.id === id) return comment
    if (comment.replies) {
      const found = findCommentById(comment.replies, id)
      if (found) return found
    }
  }
  return null
}

export function flattenComments(comments: EnhancedComment[]): EnhancedComment[] {
  const flattened: EnhancedComment[] = []
  for (const comment of comments) {
    flattened.push(comment)
    if (comment.replies) {
      flattened.push(...flattenComments(comment.replies))
    }
  }
  return flattened
}

// Comment sorting
export type CommentSort = "newest" | "oldest" | "mostReacted" | "pinned"

export function sortComments(comments: EnhancedComment[], sortType: CommentSort): EnhancedComment[] {
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
    default:
      return sorted
  }
}

// Post enhancements
export function createQuoteRepost(originalPost: Post, quoteText: string, authorName: string, authorPhoto: string): Post {
  return {
    ...originalPost,
    id: generateId(),
    authorName,
    authorPhoto,
    content: quoteText,
    createdAt: Date.now(),
    quoteOf: originalPost.id,
    comments: [],
    likes: 0,
  }
}

export function editPost(post: Post, newContent: string): Post {
  return {
    ...post,
    content: newContent,
    isDraft: false,
    isScheduled: false,
  }
}

export function generateShareLink(postId: string, platform: "twitter" | "facebook" | "linkedin" | "copy"): string {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
  const postUrl = `${baseUrl}/post/${postId}`

  switch (platform) {
    case "twitter":
      return `https://twitter.com/intent/tweet?url=${encodeURIComponent(postUrl)}&text=${encodeURIComponent("Check this out!")}`
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`
    case "linkedin":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(postUrl)}`
    case "copy":
      return postUrl
    default:
      return postUrl
  }
}

// Post interaction tracking
export interface PostInteraction {
  userId: string
  postId: string
  type: "like" | "comment" | "share" | "view" | "hide" | "notInterested" | "report"
  timestamp: number
  metadata?: Record<string, any>
}

export function trackPostInteraction(
  userId: string,
  postId: string,
  type: PostInteraction["type"],
  metadata?: Record<string, any>
): PostInteraction {
  return {
    userId,
    postId,
    type,
    timestamp: Date.now(),
    metadata,
  }
}

// Post action handlers
export function hidePost(post: Post): Post {
  return {
    ...post,
    hideCount: (post.hideCount || 0) + 1,
  }
}

export function markNotInterested(post: Post): Post {
  return {
    ...post,
    notInterestedCount: (post.notInterestedCount || 0) + 1,
  }
}

export function pinComment(comment: EnhancedComment): EnhancedComment {
  return {
    ...comment,
    isPinned: true,
  }
}

export function unpinComment(comment: EnhancedComment): EnhancedComment {
  return {
    ...comment,
    isPinned: false,
  }
}

// Link preview extraction (mock - in production, would call backend service)
export function extractLinkPreview(url: string): { url: string; domain: string } {
  try {
    const urlObj = new URL(url)
    return {
      url,
      domain: urlObj.hostname,
    }
  } catch {
    return {
      url,
      domain: url,
    }
  }
}

// GIF handling
export interface GifMedia extends CommentMedia {
  type: "gif"
  thumbnail: string
  url: string
}

export function createGifMedia(gifUrl: string, thumbnail: string): GifMedia {
  return {
    id: generateId(),
    type: "gif",
    url: gifUrl,
    thumbnail,
  }
}

// Voice note handling
export interface VoiceMedia extends CommentMedia {
  type: "voice"
  url: string
  duration: number
}

export function createVoiceMedia(voiceUrl: string, duration: number): VoiceMedia {
  return {
    id: generateId(),
    type: "voice",
    url: voiceUrl,
    duration,
  }
}
