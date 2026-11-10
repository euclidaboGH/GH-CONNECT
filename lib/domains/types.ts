/**
 * Canonical domain entity shapes (roadmap §2).
 * Client state should converge on these; backend becomes source of truth later.
 */

export type Visibility = "public" | "friends" | "private" | "matches-only"

export interface DomainUser {
  id: string
  username?: string
  displayName: string
  avatar?: string
  coverPhoto?: string
  bio?: string
  location?: string
  verified?: boolean
  createdAt?: number
}

export interface DomainPost {
  id: string
  authorId: string
  content: string
  media?: { id: string; url: string; type: string }[]
  visibility: Visibility
  createdAt: number
  editedAt?: number
  deletedAt?: number
  deletedBy?: string
  likeCount?: number
  commentCount?: number
}

export interface DomainMessage {
  id: string
  conversationId: string
  senderId: string
  text: string
  replyToId?: string
  createdAt: number
  editedAt?: number
  deletedAt?: number
  deletedBy?: string
  status?: "sending" | "sent" | "delivered" | "read" | "failed"
  hiddenFor?: string[]
}

export interface DomainConversation {
  id: string
  type: "private" | "group"
  createdAt: number
  createdBy?: string
  lastMessageId?: string
  metadata?: Record<string, unknown>
}

export interface DomainConversationMember {
  conversationId: string
  userId: string
  role: "owner" | "admin" | "moderator" | "member"
  muted?: boolean
  archived?: boolean
  pinned?: boolean
  lastReadMessageId?: string
  joinedAt: number
}

export interface DomainReport {
  id: string
  reporterId: string
  targetType: "user" | "post" | "comment" | "message" | "story" | "group"
  targetId: string
  reason: string
  details?: string
  createdAt: number
  status: "open" | "reviewing" | "resolved" | "dismissed"
}
