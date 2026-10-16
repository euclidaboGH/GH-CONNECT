/**
 * Backend service contracts.
 * Today implementations use Pi SDK user-state + local engines.
 * Swap implementations for a real HTTP API without changing UI code.
 */

import type {
  Profile,
  Post,
  Candidate,
  Conversation,
  Message,
  MatchEntry,
  Settings,
} from "@/lib/ghc-types"

export type BackendResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string }

export type ModerationReason =
  | "spam"
  | "harassment"
  | "hate"
  | "sexual"
  | "violence"
  | "scam"
  | "underage"
  | "other"

export type ReportTarget = {
  type: "user" | "post" | "message" | "story"
  targetId: string
  reason: ModerationReason
  details?: string
}

export interface ModerationService {
  report(target: ReportTarget, reporterId: string): Promise<BackendResult<{ reportId: string }>>
  blockUser(userId: string, blockerId: string): Promise<BackendResult<void>>
  muteUser(userId: string, muterId: string): Promise<BackendResult<void>>
  checkContent(text: string): Promise<BackendResult<{ allowed: boolean; flags: string[] }>>
}

export interface MatchingService {
  getCandidates(viewer: Profile, limit?: number): Promise<BackendResult<Candidate[]>>
  swipe(
    viewerId: string,
    targetId: string,
    action: "like" | "pass"
  ): Promise<BackendResult<{ matched: boolean; match?: MatchEntry }>>
  getMatches(userId: string): Promise<BackendResult<MatchEntry[]>>
}

export interface MessagingService {
  listConversations(userId: string): Promise<BackendResult<Conversation[]>>
  sendMessage(
    conversationId: string,
    senderId: string,
    text: string
  ): Promise<BackendResult<Message>>
  markRead(conversationId: string, userId: string): Promise<BackendResult<void>>
}

export interface ProfileService {
  getProfile(userId: string): Promise<BackendResult<Profile>>
  updateProfile(userId: string, updates: Partial<Profile>): Promise<BackendResult<Profile>>
  getSettings(userId: string): Promise<BackendResult<Settings>>
  updateSettings(userId: string, updates: Partial<Settings>): Promise<BackendResult<Settings>>
}

export interface FeedService {
  listPosts(viewerId: string, mode?: "for-you" | "following"): Promise<BackendResult<Post[]>>
  createPost(
    authorId: string,
    content: string,
    media?: { images?: string[]; video?: string | null }
  ): Promise<BackendResult<Post>>
  likePost(postId: string, userId: string): Promise<BackendResult<void>>
}
