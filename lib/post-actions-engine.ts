// Post Actions Engine - Handles all post-level interactions
import type { Post } from "@/lib/ghc-types"
import { generateId } from "@/lib/ghc-data"

export interface UserAction {
  userId: string
  postId: string
  action: "view" | "like" | "unlike" | "comment" | "share" | "bookmark" | "report" | "hide" | "not_interested" | "mute" | "block" | "follow" | "unfollow"
  timestamp: number
  metadata?: Record<string, any>
}

export interface PostActionState {
  liked: boolean
  bookmarked: boolean
  reported: boolean
  hidden: boolean
  notInterested: boolean
  muted: boolean
  blocked: boolean
  followed: boolean
  viewedAt?: number
}

export interface PostMetadata {
  viewCount: number
  uniqueViewers: string[]
  copiedCount: number
  shareLinks: Record<string, { url: string; timestamp: number }>
  reportReasons: { reason: string; count: number }[]
  hiddenByUsers: string[]
  notInterestedByUsers: string[]
}

// Track user actions on posts
export function createUserAction(
  userId: string,
  postId: string,
  action: UserAction["action"],
  metadata?: Record<string, any>
): UserAction {
  return {
    userId,
    postId,
    action,
    timestamp: Date.now(),
    metadata,
  }
}

// Manage post action state
export function createActionState(overrides?: Partial<PostActionState>): PostActionState {
  return {
    liked: false,
    bookmarked: false,
    reported: false,
    hidden: false,
    notInterested: false,
    muted: false,
    blocked: false,
    followed: false,
    ...overrides,
  }
}

export function updateActionState(
  state: PostActionState,
  action: UserAction["action"],
  value: boolean = true
): PostActionState {
  const updates: Record<string, boolean> = {}

  switch (action) {
    case "like":
      updates.liked = value
      break
    case "unlike":
      updates.liked = false
      break
    case "bookmark":
      updates.bookmarked = value
      break
    case "report":
      updates.reported = value
      break
    case "hide":
      updates.hidden = value
      break
    case "not_interested":
      updates.notInterested = value
      break
    case "mute":
      updates.muted = value
      break
    case "block":
      updates.blocked = value
      break
    case "follow":
      updates.followed = value
      break
    case "unfollow":
      updates.followed = false
      break
  }

  return { ...state, ...updates }
}

// Post metadata management
export function createPostMetadata(): PostMetadata {
  return {
    viewCount: 0,
    uniqueViewers: [],
    copiedCount: 0,
    shareLinks: {},
    reportReasons: [],
    hiddenByUsers: [],
    notInterestedByUsers: [],
  }
}

export function trackPostView(metadata: PostMetadata, userId: string): PostMetadata {
  const newViewCount = metadata.viewCount + 1
  const uniqueViewers = metadata.uniqueViewers.includes(userId)
    ? metadata.uniqueViewers
    : [...metadata.uniqueViewers, userId]

  return {
    ...metadata,
    viewCount: newViewCount,
    uniqueViewers,
  }
}

export function trackPostCopy(metadata: PostMetadata): PostMetadata {
  return {
    ...metadata,
    copiedCount: metadata.copiedCount + 1,
  }
}

export function addShareLink(
  metadata: PostMetadata,
  platform: string,
  url: string
): PostMetadata {
  return {
    ...metadata,
    shareLinks: {
      ...metadata.shareLinks,
      [platform]: { url, timestamp: Date.now() },
    },
  }
}

export function addReportReason(metadata: PostMetadata, reason: string): PostMetadata {
  const existingReason = metadata.reportReasons.find((r) => r.reason === reason)
  const newReasons = existingReason
    ? metadata.reportReasons.map((r) =>
        r.reason === reason ? { ...r, count: r.count + 1 } : r
      )
    : [...metadata.reportReasons, { reason, count: 1 }]

  return {
    ...metadata,
    reportReasons: newReasons,
  }
}

export function trackPostHide(metadata: PostMetadata, userId: string): PostMetadata {
  return {
    ...metadata,
    hiddenByUsers: metadata.hiddenByUsers.includes(userId)
      ? metadata.hiddenByUsers
      : [...metadata.hiddenByUsers, userId],
  }
}

export function trackNotInterested(metadata: PostMetadata, userId: string): PostMetadata {
  return {
    ...metadata,
    notInterestedByUsers: metadata.notInterestedByUsers.includes(userId)
      ? metadata.notInterestedByUsers
      : [...metadata.notInterestedByUsers, userId],
  }
}

// Follow/Unfollow tracking
export interface FollowAction {
  followerId: string
  followingId: string
  action: "follow" | "unfollow"
  timestamp: number
  fromPost?: string // postId where action was triggered
}

export function createFollowAction(
  followerId: string,
  followingId: string,
  action: "follow" | "unfollow",
  fromPost?: string
): FollowAction {
  return {
    followerId,
    followingId,
    action,
    timestamp: Date.now(),
    fromPost,
  }
}

// Block/Mute tracking
export interface UserRestriction {
  userId: string
  restrictedUserId: string
  type: "block" | "mute"
  reason?: string
  timestamp: number
  fromPost?: string // postId where action was triggered
}

export function createUserRestriction(
  userId: string,
  restrictedUserId: string,
  type: "block" | "mute",
  reason?: string,
  fromPost?: string
): UserRestriction {
  return {
    userId,
    restrictedUserId,
    type,
    reason,
    timestamp: Date.now(),
    fromPost,
  }
}

// Post report tracking
export interface PostReport {
  id: string
  reporterId: string
  postId: string
  reason: string
  description?: string
  timestamp: number
  status: "pending" | "reviewed" | "dismissed" | "actioned"
}

export function createPostReport(
  reporterId: string,
  postId: string,
  reason: string,
  description?: string
): PostReport {
  return {
    id: generateId(),
    reporterId,
    postId,
    reason,
    description,
    timestamp: Date.now(),
    status: "pending",
  }
}

// Copy link helper
export function copyPostLink(postId: string): string {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
  return `${baseUrl}/post/${postId}`
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text)
      return true
    } else {
      // Fallback for older browsers
      const textArea = document.createElement("textarea")
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.select()
      const success = document.execCommand("copy")
      document.body.removeChild(textArea)
      return success
    }
  } catch (error) {
    console.error("Failed to copy to clipboard:", error)
    return false
  }
}

// Bookmark collection support
export interface BookmarkCollection {
  id: string
  name: string
  description?: string
  isPublic: boolean
  createdAt: number
  updatedAt: number
}

export function createBookmarkCollection(
  name: string,
  isPublic: boolean = false,
  description?: string
): BookmarkCollection {
  return {
    id: generateId(),
    name,
    description,
    isPublic,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

// Quote repost tracking
export interface QuoteRepost {
  id: string
  originalPostId: string
  originalAuthorId: string
  quoterId: string
  quoteText: string
  createdAt: number
  shareCount: number
  likeCount: number
}

export function createQuoteRepost(
  originalPostId: string,
  originalAuthorId: string,
  quoterId: string,
  quoteText: string
): QuoteRepost {
  return {
    id: generateId(),
    originalPostId,
    originalAuthorId,
    quoterId,
    quoteText,
    createdAt: Date.now(),
    shareCount: 0,
    likeCount: 0,
  }
}
