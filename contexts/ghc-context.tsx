"use client"

import { broadcastPostEngagement, normalizeEngagementMetrics, POST_ENGAGEMENT_EVENT } from "@/lib/engagement/post-engagement"
import { broadcastPostSync } from "@/lib/social/post-sync"
import { emitSocialMutation, SOCIAL_MUTATION_EVENT } from "@/lib/social/social-events"
import { isLikelyServerUserId } from "@/lib/social/is-server-user-id"
import {
  fetchServerProfile,
  persistServerProfile,
} from "@/lib/profile/server-profile-sync"
import { sanitizeProfileMediaPartial, durableOnlyProfileMedia } from "@/lib/profile/sanitize-profile-media"
import { mergePhotos, mergeCover } from "@/lib/profile/merge-profile-media"

import { useMemo, createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef, startTransition } from "react"
import type { Profile, Settings, Post, StoryItem, Tab, Toast, Candidate, MatchEntry, Conversation, Like, FriendRequest, Message } from "@/lib/ghc-types"
import { socialGraphStore } from "@/lib/social-graph-store"
import { resolveBlockedIds, applyGlobalBlockFilters } from "@/lib/block-enforcement"
import {
  applyGraphPatch,
  patchFromFollow,
  patchFromBlock,
  patchFromUnblock,
  patchFromMute,
  patchFromRestrict,
  patchFromFriendRemoved,
  patchFromMatchIds,
  syncSessionEdgesToStore,
} from "@/lib/domains/graph-session-adapter"
import { defaultProfile, DEFAULT_SETTINGS, coerceStoredProfile, sanitizeStories, sanitizeStory, STORAGE_KEYS, generateId } from "@/lib/ghc-data"
import {
  bootstrapPosts,
  bootstrapStories,
  bootstrapCandidates,
  bootstrapLikes,
} from "@/lib/domains/adapters/session-bootstrap"
import { canFollowUser as privacyCanFollow, canMessageUser as privacyCanMessage } from "@/lib/privacy-controls"
import {
  type LocalProfileRecord,
  readLocalProfiles,
  writeLocalProfile,
  profileToLocalCandidate,
  getActiveLocalProfileId,
  setActiveLocalProfileId,
  findLocalProfile,
} from "@/lib/local-profiles"
import { usePiAuth } from "./pi-auth-context"
import { IdentityService } from "@/lib/identity/identity-service"
import {
  findCompletedLocalProfileForUser,
  isCompletedProfileShape,
  hasLocalOnboardingStampForUser,
  stampLocalOnboardingComplete,
  isStrongCompletedProfileShape,
} from "@/lib/onboarding-local"
import { validation } from "@/lib/validation"
import { messageLimiter, postLimiter, spamDetection } from "@/lib/rate-limiter"
import { analytics } from "@/lib/analytics"
import { notificationSystem } from "@/lib/notifications"
import { emitCommunityNotification } from "@/lib/domains/adapters/community-notification"
import {
  appendModerationLog,
  createCommunityReport,
} from "@/lib/domains/adapters/community-governance"
import { offlineSupport } from "@/lib/offline"
import { offlineQueue, connectionMonitor, withRetry } from "@/lib/network-resilience"
import { ensureConversation } from "@/lib/messaging/ensure-conversation"
import { sanitizeText, sanitizeDisplayName, sanitizeHtml } from "@/lib/sanitizer"
import { getCsrfToken, getCsrfHeader } from "@/lib/csrf-protection"
import { isRateLimited, recordAuthAttempt, getRemainingAttempts } from "@/lib/auth-rate-limiter"
import { errorLogger, NetworkError, OfflineError } from "@/lib/error-recovery"
import { backupRecoveryManager } from "@/lib/backup-recovery"
import { dataConsistencyChecker } from "@/lib/data-consistency"
import { transactionManager } from "@/lib/transactions"
// Profile enhancements - achievements, analytics, privacy controls, etc.
import {
  calculateProfileCompletionMetrics,
  evaluateAchievements,
  createPinnedPostsManager,
  calculateProfileAnalytics,
  calculateFollowerInsights,
  DEFAULT_PRIVACY_SETTINGS,
  type ProfileCompletionMetrics,
  type EnhancedProfileState,
} from "@/lib/profile-enhancements"
// Master unified messaging engine (all message/chat features consolidated here, no duplicates)
import {
  filterConversationList,
  prepareMessageForSending,
  handleMessageEdit,
  handleMessageDeletion,
  handleMessageReaction,
  handleMessageForwarding,
  handleMessageRead,
  TypingIndicatorManager,
  searchMessages as searchMessagesInThread,
  toggleConversationPin,
  toggleConversationArchive,
  toggleConversationMute,
  createVoiceNoteMessage,
  ScheduledMessageQueue,
  updateGroupRole,
  removeGroupMember as applyRemoveGroupMember,
  draftStorage,
  analyzeMessageThreadData,
  type ConversationListFilter,
  type MessageOperation,
  type MessageSearchOptions,
  type MediaUploadProgress,
  type DraftMessage,
  type MessageAnalytics,
  type GroupRole,
} from "@/lib/unified-messaging-engine"
import { domainEvents } from "@/lib/realtime/event-bus"
import { subscribeDomainCache } from "@/lib/realtime/use-domain-events"
import { transportBridge } from "@/lib/realtime/transport-bridge"
import { createDomainServices, bindDomainServices, type DomainServices } from "@/lib/domains"
import { getBoundDomainServices } from "@/lib/domains/compat"
import { isDurableMessagingEnabled } from "@/lib/messaging/durable-flag"
import {
  loadPersistedCommunities,
  persistCommunityConversation,
  markJoined,
  markLeft,
  mergeCommunityConversations,
} from "@/lib/domains/community-persistence"
// Master unified post/comment system (all features consolidated here, no duplicates)
import {
  createNestedComment,
  addReplyToComment,
  buildCommentThreads,
  flattenCommentThread,
  sortComments,
  addReactionToComment,
  removeReactionFromComment,
  getTopCommentReactions,
  validateMediaAttachment,
  addMediaToComment,
  editComment,
  editPost,
  pinComment,
  unpinComment,
  getPinnedComment,
  extractMentions,
  extractHashtags,
  extractUrls,
  isValidUrl,
  validateMentions,
  validateHashtags,
  createQuoteRepost,
  generateShareText,
  getSocialShareUrl,
  copyPostLink,
  savePostToCollection,
  removePostFromCollection,
  hidePost,
  trackNotInterested,
  reportPost,
  createFollowAction,
  muteUser,
  blockUser,
  validateCommentText,
  validatePostContent,
  detectSpamContent,
  sanitizeCommentText,
  sanitizePostText,
  findCommentById,
  flattenComments,
  type EnhancedComment,
  type CommentThread,
  type CommentSortOption,
  type MediaAttachment,
  type CommentReaction,
  type UserRestriction,
  type QuoteRepost,
  type PostShare,
} from "@/lib/post-comment-system-complete"

interface GHCContextType {
  ready: boolean
  profile: Profile
  settings: Settings
  posts: Post[]
  stories: StoryItem[]
  publishStory: (story: StoryItem) => Promise<{ ok: boolean; durable?: boolean; error?: string }>
  /** Canonical durable feed refresh (server when online; preserves local feed on failure) */
  refreshFeed: (opts?: { before?: number; beforeId?: string; append?: boolean; limit?: number }) => Promise<{ ok: boolean; durable?: boolean; error?: string; appended?: number }>
  /** Opens/creates private chat with story owner via Messaging domain */
  replyToStory: (storyId: string) => Promise<string | null>
  tab: Tab
  toasts: Toast[]
  candidates: Candidate[]
  matches: MatchEntry[]
  /** Transient mutual-match confirmation (UI only) */
  matchCelebration: null | { userId: string; userName: string; userPhoto: string }
  likes: Like[]
  conversations: Conversation[]
  friendRequests: FriendRequest[]
  following: string[]
  /** Mutual connections (explicit friends graph) */
  friends: string[]
  shares: import("@/lib/share-types").ShareRecord[]
  reposts: import("@/lib/share-types").RepostFeedItem[]
  likedPostIds: string[]
  isOnline: boolean
  networkQuality: "excellent" | "good" | "fair" | "poor" | "offline"
  dataIntegrity: "verified" | "suspected_corruption" | "unknown"
  
  // Backup & Recovery
  createBackup: () => void
  restoreFromBackup: () => Promise<boolean>

  // Profile actions
  updateProfile: (updates: Partial<Profile>) => Promise<void>
  completeOnboarding: () => Promise<void>
  localProfiles: Array<LocalProfileRecord>
  switchLocalProfile: (localId: string) => void
  createLocalProfile: (profile: Partial<Profile>) => void

  // Posts
  createPost: (
    content: string,
    images: string[],
    video: string | null,
    pdf: string | null,
    pdfName: string | null,
    audience?: "public" | "followers" | "mutuals" | "private",
    community?: { id: string; name: string } | null,
  ) => Promise<boolean>
  likePost: (postId: string) => Promise<void>
  reactToPost: (postId: string, reaction?: string) => Promise<void>
  deletePost: (postId: string) => Promise<void>
  editPost: (postId: string, newContent: string, media?: { images?: string[]; video?: string | null }) => Promise<void>
  archivePost: (postId: string) => Promise<void>
  unarchivePost: (postId: string) => Promise<void>
  addComment: (postId: string, text: string, replyToCommentId?: string, mediaAttachments?: Array<{ id?: string; type: "image" | "video" | "file"; url: string; fileName?: string }>) => Promise<void>
  loadPostComments: (postId: string) => Promise<{ ok: boolean; count: number; durable?: boolean; error?: string }>
  editComment: (postId: string, commentId: string, newText: string) => Promise<void>
  deleteComment: (postId: string, commentId: string) => Promise<void>
  addCommentReaction: (postId: string, commentId: string, emoji: string) => Promise<void>
  removeCommentReaction: (postId: string, commentId: string, emoji: string) => Promise<void>
  pinComment: (postId: string, commentId: string) => Promise<void>
  unpinComment: (postId: string, commentId: string) => Promise<void>
  createQuoteRepost: (originalPostId: string, quoteText: string) => Promise<void>
  sharePost: (postId: string, platform: "twitter" | "facebook" | "linkedin" | "copy" | "timeline" | "story" | "private" | "group") => Promise<string>
  applyShareResult: (result: any) => void
  savePost: (postId: string, collection?: string) => Promise<void>
  unsavePost: (postId: string) => Promise<void>
  hidePost: (postId: string) => Promise<void>
  markNotInterested: (postId: string) => Promise<void>
  reportPost: (postId: string, reason: string) => Promise<void>
  reportContent: (targetType: "user" | "post" | "comment" | "message" | "story" | "group", targetId: string, reason: string, details?: string) => Promise<void>
  muteUser: (userId: string) => Promise<void>
  unmuteUser: (userId: string) => Promise<void>
  restrictUser: (userId: string) => Promise<void>
  unrestrictUser: (userId: string) => Promise<void>
  followFromPost: (userId: string) => Promise<void>
  unfollowFromPost: (userId: string) => Promise<void>

  // Settings
  updateSettings: (updates: Partial<Settings>) => Promise<void>
  canViewProfile: (userId: string) => boolean
  canMessageUser: (userId: string) => boolean
  canViewStory: (ownerId: string) => boolean
  canSeeOnlineStatus: (userId: string) => boolean

  // Discovery
  swipe: (candidateId: string, action: "like" | "pass" | "superlike") => Promise<void>
  dismissMatchCelebration: () => void
  followUser: (userId: string) => Promise<void>
  addFriend: (userId: string) => Promise<void>
  reportUser: (userId: string, reason: string) => Promise<void>
  blockUser: (userId: string) => Promise<void>
  unblockUser: (userId: string) => Promise<void>
  /** Merged block list for UI filters (state + settings) */
  blockedUsers: string[]
  /** Merged mute list for UI filters (state + settings) */
  mutedUsers: string[]
  /** Returns conversation id when opened/found, or null if blocked by privacy */
  startConversation: (userId: string, userName: string, userPhoto: string) => Promise<string | null>

  // Match actions
  acceptMatch: (userId: string) => Promise<void>
  rejectMatch: (userId: string) => Promise<void>

  // Messages - unified for both private chats and group chats
  sendMessage: (conversationId: string, text: string, replyToMessageId?: string, sharedPostId?: string) => Promise<boolean>
  loadConversationMessages: (conversationId: string) => Promise<{ ok: boolean; count: number; durable?: boolean }>
  editMessage: (conversationId: string, messageId: string, newText: string) => Promise<void>
  deleteMessage: (conversationId: string, messageId: string, deleteForEveryone?: boolean) => Promise<void>
  replyToMessage: (conversationId: string, replyToMessageId: string, text: string) => Promise<boolean>
  forwardMessage: (conversationId: string, messageId: string) => Promise<void>
  addMessageReaction: (conversationId: string, messageId: string, emoji: string) => Promise<void>
  removeMessageReaction: (conversationId: string, messageId: string, emoji: string) => Promise<void>
  pinMessage: (conversationId: string, messageId: string) => Promise<void>
  unpinMessage: (conversationId: string, messageId: string) => Promise<void>
  sendVoiceNote: (conversationId: string, audioBlob: Blob, waveform: number[]) => Promise<void>
  sendMediaMessage: (conversationId: string, mediaUrl: string, type: "image" | "file" | "video", fileName?: string) => Promise<void>
  scheduleMessage: (conversationId: string, text: string, scheduledFor: number) => Promise<void>
  sendDisappearingMessage: (conversationId: string, text: string, expiresInSeconds?: number) => Promise<void>
  saveDraft: (conversationId: string, text: string) => void
  loadDraft: (conversationId: string) => string | null
  searchMessages: (conversationId: string, query: string) => Promise<void>
  markConversationRead: (conversationId: string) => Promise<void>
  // Conversation management
  pinConversation: (conversationId: string) => Promise<void>
  unpinConversation: (conversationId: string) => Promise<void>
  archiveConversation: (conversationId: string) => Promise<void>
  unarchiveConversation: (conversationId: string) => Promise<void>
  muteConversation: (conversationId: string, muteHours?: number) => Promise<void>
  unmuteConversation: (conversationId: string) => Promise<void>
  setTypingIndicator: (conversationId: string, isTyping: boolean) => Promise<void>
  // Group / community features
  createGroup: (formData: any) => Promise<string>
  joinCommunity: (communityId: string) => Promise<boolean>
  acceptCommunityInvitation: (communityId: string) => Promise<boolean>
  declineCommunityInvitation: (communityId: string) => Promise<boolean>
  approveCommunityJoinRequest: (communityId: string, userId: string) => Promise<boolean>
  declineCommunityJoinRequest: (communityId: string, userId: string) => Promise<boolean>
  inviteCommunityMember: (communityId: string, userId: string) => Promise<boolean>
  leaveCommunity: (communityId: string) => Promise<boolean>
  requestJoinCommunity: (communityId: string) => Promise<boolean>
  replyToBoardPost: (
    communityId: string,
    postId: string,
    body: string
  ) => Promise<boolean>
  reactToBoardPost: (
    communityId: string,
    postId: string
  ) => Promise<boolean>
  pinBoardPost: (communityId: string, postId: string) => Promise<boolean>
  unpinBoardPost: (communityId: string, postId: string) => Promise<boolean>
  hideBoardPost: (communityId: string, postId: string) => Promise<boolean>
  unhideBoardPost: (communityId: string, postId: string) => Promise<boolean>
  transitionCommunityLifecycle: (
    communityId: string,
    next: "draft" | "discoverable" | "active" | "quiet" | "archived"
  ) => Promise<boolean>
  reportCommunityContent: (
    communityId: string,
    input: {
      targetType: "community" | "post" | "member"
      targetId: string
      reason: "spam" | "harassment" | "hate" | "misinformation" | "impersonation" | "safety" | "other"
      note?: string
    }
  ) => Promise<boolean>
  createCommunityAnnouncement: (
    communityId: string,
    input: { title: string; content: string; type?: "info" | "important" | "celebration" | "maintenance" }
  ) => Promise<boolean>
  createCommunityEvent: (
    communityId: string,
    input: {
      title: string
      description: string
      startTime: number
      endTime: number
      location?: string
      category?: "meeting" | "social" | "workshop" | "discussion" | "celebration"
    }
  ) => Promise<boolean>
  rsvpCommunityEvent: (communityId: string, eventId: string) => Promise<boolean>
  createBoardPost: (
    communityId: string,
    body: string,
    kind?: "text" | "question" | "resource"
  ) => Promise<boolean>
  addGroupMember: (conversationId: string, userId: string) => Promise<void>
  removeGroupMember: (conversationId: string, userId: string) => Promise<void>
  setGroupRole: (conversationId: string, userId: string, role: "owner" | "admin" | "moderator" | "member") => Promise<void>
  updateGroupName: (conversationId: string, newName: string) => Promise<void>
  updateGroupPhoto: (conversationId: string, photoUrl: string) => Promise<void>

  // UI
  setTab: (tab: Tab) => void
  addToast: (message: string, type: "success" | "error" | "info") => void
  logout: () => Promise<void>
}

const GHCContext = createContext<GHCContextType | null>(null)

/** Domain slices — consumers using these hooks only re-render when their slice changes */
const GHCShellContext = createContext<{
  ready: boolean
  tab: Tab
  setTab: (tab: Tab) => void
  toasts: Toast[]
  addToast: (message: string, type: "success" | "error" | "info") => void
  isOnline: boolean
  networkQuality: "excellent" | "good" | "fair" | "poor" | "offline"
  matchCelebration: GHCContextType["matchCelebration"]
  dismissMatchCelebration: () => void
  startConversation: GHCContextType["startConversation"]
} | null>(null)

const GHCProfileContext = createContext<{
  profile: Profile
  settings: Settings
  friends: string[]
  following: string[]
  posts: Post[]
  updateProfile: GHCContextType["updateProfile"]
  completeOnboarding: GHCContextType["completeOnboarding"]
  updateSettings: GHCContextType["updateSettings"]
  addToast: (message: string, type: "success" | "error" | "info") => void
} | null>(null)

const GHCDiscoveryContext = createContext<{
  candidates: Candidate[]
  matches: MatchEntry[]
  following: string[]
  swipe: GHCContextType["swipe"]
  followUser: GHCContextType["followUser"]
  addFriend: GHCContextType["addFriend"]
  reportUser: GHCContextType["reportUser"]
  blockUser: GHCContextType["blockUser"]
  unblockUser: GHCContextType["unblockUser"]
  startConversation: GHCContextType["startConversation"]
  acceptMatch: GHCContextType["acceptMatch"]
  rejectMatch: GHCContextType["rejectMatch"]
  profile: Profile
} | null>(null)

const GHCMessagingContext = createContext<{
  conversations: Conversation[]
  sendMessage: GHCContextType["sendMessage"]
  sendMediaMessage: GHCContextType["sendMediaMessage"]
  loadConversationMessages: GHCContextType["loadConversationMessages"]
  markConversationRead: GHCContextType["markConversationRead"]
  pinConversation: GHCContextType["pinConversation"]
  archiveConversation: GHCContextType["archiveConversation"]
  muteConversation: GHCContextType["muteConversation"]
  createGroup: GHCContextType["createGroup"]
  joinCommunity: GHCContextType["joinCommunity"]
  leaveCommunity: GHCContextType["leaveCommunity"]
  createBoardPost: GHCContextType["createBoardPost"]
  startConversation: GHCContextType["startConversation"]
  addToast: (message: string, type: "success" | "error" | "info") => void
  profile: Profile
  setTab: (tab: Tab) => void
} | null>(null)

/** Feed / posts slice — Home re-renders only when posts/stories change */
const GHCFeedContext = createContext<{
  posts: Post[]
  stories: StoryItem[]
  likedPostIds: string[]
  following: string[]
  friends: string[]
  profile: Profile
  settings: Settings
  candidates: Candidate[]
  createPost: GHCContextType["createPost"]
  likePost: GHCContextType["likePost"]
  reactToPost: GHCContextType["reactToPost"]
  deletePost: GHCContextType["deletePost"]
  editPost: GHCContextType["editPost"]
  archivePost: GHCContextType["archivePost"]
  unarchivePost: GHCContextType["unarchivePost"]
  addComment: GHCContextType["addComment"]
  loadPostComments: GHCContextType["loadPostComments"]
  editComment: GHCContextType["editComment"]
  deleteComment: GHCContextType["deleteComment"]
  addCommentReaction: GHCContextType["addCommentReaction"]
  removeCommentReaction: GHCContextType["removeCommentReaction"]
  pinComment: GHCContextType["pinComment"]
  unpinComment: GHCContextType["unpinComment"]
  createQuoteRepost: GHCContextType["createQuoteRepost"]
  sharePost: GHCContextType["sharePost"]
  applyShareResult: GHCContextType["applyShareResult"]
  savePost: GHCContextType["savePost"]
  unsavePost: GHCContextType["unsavePost"]
  reportPost: GHCContextType["reportPost"]
  reportContent: GHCContextType["reportContent"]
  publishStory: GHCContextType["publishStory"]
  refreshFeed: (opts?: { before?: number; beforeId?: string; append?: boolean; limit?: number }) => Promise<{ ok: boolean; durable?: boolean; error?: string; appended?: number }>
  followUser: GHCContextType["followUser"]
  unfollowFromPost: GHCContextType["unfollowFromPost"]
  muteUser: GHCContextType["muteUser"]
  blockUser: GHCContextType["blockUser"]
  addToast: (message: string, type: "success" | "error" | "info") => void
  setTab: (tab: Tab) => void
  shares: GHCContextType["shares"]
  reposts: GHCContextType["reposts"]
  blockedUsers: string[]
} | null>(null)


// Consolidated state interface (Quick Win: reduce from 16 to 5 useState calls)
interface ConsolidatedState {
  ready: boolean
  profile: Profile
  settings: Settings
  tab: Tab
  toasts: Toast[]
  // Data collections
  posts: Post[]
  stories: StoryItem[]
  candidates: Candidate[]
  matches: MatchEntry[]
  /** Transient mutual-match confirmation (UI only) */
  matchCelebration: null | { userId: string; userName: string; userPhoto: string }
  likes: Like[]
  conversations: Conversation[]
  friendRequests: FriendRequest[]
  // User relationships (session cache; Social Graph domain owns mutations)
  following: string[]
  followers: string[]
  friends: string[]
  blockedUsers: string[]
  mutedUsers: string[]
  restrictedUsers: string[]
  likedPostIds: string[]
  feedToggle: "for-you" | "following"
  shares: import("@/lib/share-types").ShareRecord[]
  reposts: import("@/lib/share-types").RepostFeedItem[]
}

const initialState: ConsolidatedState = {
  ready: false,
  profile: defaultProfile(),
  settings: DEFAULT_SETTINGS,
  tab: "home",
  toasts: [],
  posts: [],
  stories: [],
  // Empty at boot — seed after first paint so cold start is not blocked by large arrays
  candidates: [],
  matches: [],
  matchCelebration: null,
  likes: [],
  conversations: [],
  friendRequests: [],
  following: [],
  followers: [],
  shares: [],
  reposts: [],
  friends: [],
  blockedUsers: [],
  mutedUsers: [],
  restrictedUsers: [],
  likedPostIds: [],
  feedToggle: "for-you",
}

// Extended state for network monitoring
interface ExtendedGHCState extends ConsolidatedState {
  isOnline: boolean
  networkQuality: "excellent" | "good" | "fair" | "poor" | "offline"
}

/** Canonical full session state — always includes network fields required by ExtendedGHCState */
function createDefaultExtendedState(
  overrides?: Partial<ExtendedGHCState>
): ExtendedGHCState {
  return {
    ...initialState,
    isOnline: true,
    networkQuality: "excellent",
    ...overrides,
  }
}


/** Phase 2: map API feed rows → Post (snake_case + camelCase tolerant). */
function mapRemoteFeedPosts(feedPosts: Partial<Post>[] | Record<string, unknown>[]): Post[] {
  return (feedPosts || []).map((raw) => {
    const p = raw as Record<string, unknown>
    const id = String(p.id || p.post_id || "")
    const authorId = String(p.authorId || p.author_id || "")
    const imagesRaw = p.images ?? p.image_urls ?? p.media
    const images = Array.isArray(imagesRaw)
      ? imagesRaw.map(String).filter(Boolean)
      : typeof imagesRaw === "string" && imagesRaw
        ? [imagesRaw]
        : []
    const commentsRaw = p.comments
    const comments = Array.isArray(commentsRaw) ? (commentsRaw as Post["comments"]) : []
    const commentCount = Number(p.commentCount ?? p.comment_count ?? ((p.engagement && typeof p.engagement === "object") ? (p.engagement as Record<string, unknown>).comments : undefined) ?? comments.length) || 0
    const reactionCounts = p.reactionCounts && typeof p.reactionCounts === "object"
      ? Object.fromEntries(Object.entries(p.reactionCounts as Record<string, unknown>).map(([key, value]) => [key, Math.max(0, Number(value) || 0)]))
      : {}
    const viewerReactions = Array.isArray(p.viewerReactions) ? p.viewerReactions.map(String) : []
    const visibilityRaw = String(p.visibility || p.visible_to || "public").toLowerCase()
    const visibility = (
      ["public", "followers", "mutuals", "private"].includes(visibilityRaw)
        ? visibilityRaw
        : "public"
    ) as Post["visibility"]
    const likes = Number(p.likes ?? p.like_count ?? p.likeCount ?? 0) || 0
    const shares = Number(p.shares ?? p.share_count ?? 0) || 0
    const viewCount = Number(p.viewCount ?? p.view_count ?? 0) || 0
    const upvoteCount = Number(p.upvoteCount ?? p.upvote_count ?? 0) || 0
    const downvoteCount = Number(p.downvoteCount ?? p.downvote_count ?? 0) || 0
    const viewerCurationRaw = String(p.viewerCurationChoice ?? p.viewer_curation_choice ?? p.curationChoice ?? "").toLowerCase()
    const viewerCurationChoice =
      viewerCurationRaw === "upvote" || viewerCurationRaw === "downvote" ? viewerCurationRaw : undefined
    const createdAt = Number(p.createdAt ?? p.created_at ?? Date.now()) || Date.now()
    const deletedAtRaw = p.deletedAt ?? p.deleted_at
    const deletedAt =
      deletedAtRaw != null && deletedAtRaw !== ""
        ? Number(deletedAtRaw)
        : null
    return {
      id,
      authorId,
      authorName: String(p.authorName || p.author_name || "Member"),
      authorPhoto: String(p.authorPhoto || p.author_photo || ""),
      content: String(p.content || p.body || ""),
      images,
      video: (p.video as string | null) ?? (p.video_url as string | null) ?? null,
      pdf: (p.pdf as string | null) ?? null,
      pdfName: (p.pdfName as string | null) ?? (p.pdf_name as string | null) ?? null,
      likes,
      comments,
      createdAt,
      engagement: normalizeEngagementMetrics(
        p.engagement && typeof p.engagement === "object" ? p.engagement as Post["engagement"] : undefined,
        { likes, comments: commentCount, shares, views: viewCount },
      ),
      reactionCounts,
      viewerReactions,
      visibility,
      deletedAt: Number.isFinite(deletedAt as number) ? (deletedAt as number) : null,
      isEdited: Boolean(p.isEdited ?? p.is_edited),
      editedAt: p.editedAt || p.edited_at ? Number(p.editedAt || p.edited_at) : undefined,
      hashtags: Array.isArray(p.hashtags) ? p.hashtags.map(String) : undefined,
      mentions: Array.isArray(p.mentions) ? p.mentions.map(String) : undefined,
      communityId: p.communityId || p.community_id ? String(p.communityId || p.community_id) : undefined,
      communityName: p.communityName || p.community_name ? String(p.communityName || p.community_name) : undefined,
      listingId: p.listingId || p.listing_id ? String(p.listingId || p.listing_id) : undefined,
      listingKind: (p.listingKind || p.listing_kind) as Post["listingKind"],
      contentType: (p.contentType || p.content_type) as Post["contentType"],
      shares: shares || undefined,
      viewCount: viewCount || undefined,
      upvoteCount,
      downvoteCount,
      viewerCurationChoice,
      quoteOf: p.quoteOf || p.quote_of_post_id ? String(p.quoteOf || p.quote_of_post_id) : undefined,
    } as Post
  }).filter((p) => Boolean(p.id))
}


export function GHCProvider({ children }: { children: ReactNode }) {
  const { sdk, signOut: piSignOut } = usePiAuth()
  const [identityUserId, setIdentityUserId] = useState(() => IdentityService.getCurrentUserId())
  useEffect(() => {
    return IdentityService.subscribe((id) => setIdentityUserId(id.userId))
  }, [])

  // App-wide heartbeat keeps online/last-seen independent of whether the Messages tab is open.
  useEffect(() => {
    const userId = String(identityUserId || "")
    if (!userId || userId === "current-user" || userId === "preview-user") return
    let disposed = false
    let inFlight = false
    const heartbeat = async () => {
      if (disposed || inFlight || (typeof document !== "undefined" && document.visibilityState !== "visible")) return
      inFlight = true
      try {
        const { apiHeartbeatMessagingPresence } = await import("@/lib/messaging/server-messaging-sync")
        if (!disposed) await apiHeartbeatMessagingPresence()
      } catch { /* Presence is best-effort; message delivery never depends on it. */ }
      finally { inFlight = false }
    }
    void heartbeat()
    const interval = window.setInterval(() => void heartbeat(), 20_000)
    const onVisible = () => { if (document.visibilityState === "visible") void heartbeat() }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      disposed = true
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [identityUserId])

  const [state, setState] = useState<ExtendedGHCState>(() => createDefaultExtendedState())
  const postsSnapshotRef = useRef(state.posts)
  const feedRequestRef = useRef<{ generation: number; controller: AbortController | null }>({ generation: 0, controller: null })
  // Keep a current snapshot without making refreshFeed's callback identity change
  // on every feed update (which can retrigger consumer effects).
  useEffect(() => {
    postsSnapshotRef.current = state.posts
  }, [state.posts])

  // Hydrate persisted communities into conversation list (survives reload)
  useEffect(() => {
    try {
      const persisted = loadPersistedCommunities()
      if (!persisted.length) return
      setState((s) => {
        const merged = mergeCommunityConversations(s.conversations as any, persisted)
        const liveIds = new Set(s.conversations.map((c) => c.id))
        const hasNew = persisted.some((c) => !liveIds.has(c.id))
        if (!hasNew) return s
        return { ...s, conversations: merged as typeof s.conversations }
      })
    } catch {
      /* */
    }
  }, [])

  // Apply Pi Network identity + returning-user onboarding gate when Pi.authenticate succeeds
  useEffect(() => {
    const onPi = (ev: Event) => {
      const d = (ev as CustomEvent).detail as {
        uid?: string
        username?: string | null
        accessToken?: string | null
        serverVerified?: boolean
        needsOnboarding?: boolean
        isReturning?: boolean
        onboardingStatus?: "unknown" | "required" | "complete"
      }
      if (!d?.uid) return
      setState((prev) => {
        const profile: Profile = { ...prev.profile }
        if (!profile.id || profile.id === "current-user" || profile.id === "preview-user") {
          profile.id = d.uid
        }
        if (d.username) {
          if (!profile.username) profile.username = d.username
          if (!profile.displayName) profile.displayName = d.username
        }
        // Server-authoritative onboarding (Phase 2A):
        // profile.onboarded is UI/cache only — never security proof.
        // When serverVerified AND durable, server mapping wins.
        // If the user already completed local profile registration this session,
        // do not force them back through onboarding solely because a non-durable
        // (memory) identity store still has needsOnboarding=true after PIN unlock / Pi reinit.
        if (d.serverVerified) {
          if (
            d.onboardingStatus === "complete" ||
            d.isReturning === true ||
            d.needsOnboarding === false
          ) {
            profile.onboarded = true
          } else if (d.onboardingStatus === "required" || d.needsOnboarding === true) {
            // Phase 4 — never re-force registration when this device already finished setup
            let alreadyLocal = false
            try {
              if (
                hasLocalOnboardingStampForUser({
                  userId: String(d.uid || profile.id || ""),
                  username: d.username || (profile.username as string) || null,
                  candidateUserIds: [d.uid, (d as { piUid?: string }).piUid, profile.id],
                })
              ) {
                alreadyLocal = true
                profile.onboarded = true
              }
            } catch {
              /* */
            }
            alreadyLocal =
              alreadyLocal ||
              profile.onboarded === true ||
              (typeof profile.displayName === "string" &&
                profile.displayName.trim().length > 0 &&
                Array.isArray(profile.photos) &&
                profile.photos.length > 0)
            // Also consult local profile store (PIN unlock / cold start race)
            if (!alreadyLocal) {
              try {
                if (isCompletedProfileShape(profile as never)) alreadyLocal = true
                const found = findCompletedLocalProfileForUser({
                  userId: String(d.uid || profile.id || ""),
                  username: d.username || (profile.username as string) || null,
                  candidateUserIds: [d.uid, profile.id],
                })
                if (found) {
                  alreadyLocal = true
                  profile.onboarded = true
                  // Merge stable fields so UI is not empty
                  if (!profile.displayName && found.displayName) profile.displayName = found.displayName
                  if ((!profile.photos || profile.photos.length === 0) && found.photos) {
                    profile.photos = found.photos
                  }
                  if ((!profile.interests || !(profile.interests as unknown[]).length) && found.interests) {
                    profile.interests = found.interests
                  }
                  if (!profile.city && found.city) profile.city = found.city
                  if (!profile.primaryMode && found.primaryMode) profile.primaryMode = found.primaryMode
                  if (!profile.bio && found.bio) profile.bio = found.bio
                  if (!profile.coverPhoto && found.coverPhoto) profile.coverPhoto = found.coverPhoto
                }
              } catch {
                /* */
              }
            }
            if (!alreadyLocal) {
              profile.onboarded = false
            } else {
              profile.onboarded = true
            }
          }
        }
        return { ...prev, profile }
      })
    }
    window.addEventListener("ghc:pi-identity-ready", onPi as EventListener)
    return () => window.removeEventListener("ghc:pi-identity-ready", onPi as EventListener)
  }, [])

  // Keep IdentityService aligned with profile (Pi UID always wins)
  useEffect(() => {
    const profile = state.profile as { id?: string; username?: string; displayName?: string } | undefined
    if (!profile) return
    try {
      IdentityService.setFromProfile({
        userId: profile.id || null,
        username: profile.username || null,
        displayName: profile.displayName || null,
      })
    } catch {
      /* */
    }
  }, [state.profile])

  // Setup network monitoring on mount
  useEffect(() => {
    // Monitor connection status
    const unsubscribe = connectionMonitor.subscribe((isOnline) => {
      setState((s) => ({ ...s, isOnline, networkQuality: isOnline ? "excellent" : "offline" }))
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        // Paint shell immediately — hydrate storage in the background
        if (mounted) {
          setState((s) => ({
            ...s,
            ready: true,
            posts: s.posts?.length ? s.posts : bootstrapPosts(),
            stories: s.stories?.length ? s.stories : bootstrapStories(),
          }))
        }

        const updates: Partial<ExtendedGHCState> = { ready: true }

        if (!sdk) {
          const cands = bootstrapCandidates()
          updates.posts = bootstrapPosts()
          updates.stories = bootstrapStories()
          updates.candidates = cands
          updates.likes = bootstrapLikes(cands)
          if (mounted) setState((s) => ({ ...s, ...updates }))
          return
        }

        // Priority: identity first so onboarding gate is correct ASAP
        const [profileResult, settingsResult] = await Promise.allSettled([
          withRetry(() => sdk.state.get(STORAGE_KEYS.profile)),
          withRetry(() => sdk.state.get(STORAGE_KEYS.settings)),
        ])
        const early: Partial<ExtendedGHCState> = { ready: true }
        if (profileResult.status === "fulfilled" && profileResult.value?.blob) {
          const coerced = coerceStoredProfile(profileResult.value.blob)
          if (coerced) early.profile = coerced
        }
        if (settingsResult.status === "fulfilled" && settingsResult.value?.blob) {
          const blob = settingsResult.value.blob
          if (blob && typeof blob === "object" && !Array.isArray(blob)) {
            const loaded = blob as Partial<Settings>
            if (typeof loaded.language === "string" || typeof loaded.darkMode === "boolean") {
              const blockedUsers = Array.isArray(loaded.blockedUsers)
                ? loaded.blockedUsers.filter((id): id is string => typeof id === "string").slice(0, 200)
                : []
              early.settings = { ...DEFAULT_SETTINGS, ...loaded, blockedUsers }
              if (blockedUsers.length) early.blockedUsers = blockedUsers
            }
          }
        }
        if (mounted) setState((s) => ({ ...s, ...early }))

        // Correct key mapping — one fetch per domain (no duplicate profile/settings reads)
        const [
          postsResult,
          storiesResult,
          matchesResult,
          likesResult,
          conversationsResult,
          friendRequestsResult,
          followingResult,
        ] = await Promise.allSettled([
          withRetry(() => sdk.state.get(STORAGE_KEYS.posts)),
          withRetry(() => sdk.state.get(STORAGE_KEYS.stories)),
          withRetry(() => sdk.state.get(STORAGE_KEYS.matches)),
          withRetry(() => sdk.state.get(STORAGE_KEYS.likes)),
          withRetry(() => sdk.state.get(STORAGE_KEYS.conversations)),
          withRetry(() => sdk.state.get(STORAGE_KEYS.friendRequests)),
          withRetry(() => sdk.state.get(STORAGE_KEYS.following)),
        ])

        // Profile / settings already loaded above — only fill gaps
        if (!updates.profile && profileResult.status === "fulfilled") {
          const loaded = coerceStoredProfile(profileResult.value?.blob)
          if (loaded?.displayName) updates.profile = loaded
        } else if (profileResult.status === "rejected") {
          errorLogger.logWarning("Profile load failed, using defaults", { error: profileResult.reason })
        }

        if (!updates.settings && settingsResult.status === "fulfilled") {
          const blob = settingsResult.value?.blob
          if (blob && typeof blob === "object" && !Array.isArray(blob)) {
            const loaded = blob as Partial<Settings>
            if (loaded.language) {
              const blockedUsers = Array.isArray(loaded.blockedUsers)
                ? loaded.blockedUsers.filter((id): id is string => typeof id === "string").slice(0, 200)
                : []
              const moderationReports = Array.isArray(loaded.moderationReports)
                ? loaded.moderationReports
                    .filter(
                      (report) =>
                        report &&
                        (report.type === "user" ||
                          report.type === "post" ||
                          report.type === "comment" ||
                          report.type === "message" ||
                          report.type === "story" ||
                          report.type === "group") &&
                        typeof report.targetId === "string"
                    )
                    .slice(-200)
                : []
              updates.settings = { ...DEFAULT_SETTINGS, ...loaded, blockedUsers, moderationReports }
              updates.blockedUsers = blockedUsers
            }
          }
        } else if (settingsResult.status === "rejected") {
          errorLogger.logWarning("Settings load failed, using defaults", { error: settingsResult.reason })
        }

        if (postsResult.status === "fulfilled") {
          const loaded = postsResult.value?.blob as Post[] | undefined
          updates.posts = Array.isArray(loaded)
            ? loaded.map((post) => ({
                ...post,
                content: typeof post?.content === "string" ? post.content : "",
                authorName: typeof post?.authorName === "string" ? post.authorName : "Pi Member",
                images: Array.isArray(post?.images)
                  ? post.images.filter((image): image is string => typeof image === "string")
                  : [],
                comments: Array.isArray(post?.comments) ? post.comments : [],
              }))
            : bootstrapPosts()
        } else {
          errorLogger.logWarning("Posts load failed, using empty collection", { error: postsResult.reason })
          updates.posts = bootstrapPosts()
        }

        if (storiesResult.status === "fulfilled" && Array.isArray(storiesResult.value?.blob)) {
          updates.stories = sanitizeStories(storiesResult.value.blob)
        } else {
          updates.stories = bootstrapStories()
        }
        if (matchesResult.status === "fulfilled" && Array.isArray(matchesResult.value?.blob)) {
          updates.matches = matchesResult.value.blob as MatchEntry[]
        } else if (matchesResult.status === "rejected") {
          errorLogger.logWarning("matches load failed, using empty state", { error: matchesResult.reason })
        }
        // Discovery candidates — light seed only if still empty (after first paint path)
        const cands = bootstrapCandidates()
        updates.candidates = cands
        if (likesResult.status === "fulfilled" && Array.isArray(likesResult.value?.blob)) {
          const loadedLikes = likesResult.value.blob as Like[]
          updates.likes =
            loadedLikes.length > 0 ? loadedLikes : bootstrapLikes(cands)
          updates.likedPostIds = (updates.likes as Like[])
            .filter((like) => like?.fromUserId === "current-user" && typeof like.toUserId === "string")
            .map((like) => like.toUserId)
        } else if (likesResult.status === "rejected") {
          errorLogger.logWarning("likes load failed, using empty state", { error: likesResult.reason })
          updates.likes = bootstrapLikes(cands)
        } else {
          updates.likes = bootstrapLikes(cands)
        }
        if (conversationsResult.status === "fulfilled" && Array.isArray(conversationsResult.value?.blob)) {
          updates.conversations = conversationsResult.value.blob as Conversation[]
        } else if (conversationsResult.status === "rejected") {
          errorLogger.logWarning("conversations load failed, using empty state", { error: conversationsResult.reason })
        }
        if (friendRequestsResult.status === "fulfilled" && Array.isArray(friendRequestsResult.value?.blob)) {
          updates.friendRequests = friendRequestsResult.value.blob as FriendRequest[]
        } else if (friendRequestsResult.status === "rejected") {
          errorLogger.logWarning("friend requests load failed, using empty state", { error: friendRequestsResult.reason })
        }
        if (followingResult.status === "fulfilled" && Array.isArray(followingResult.value?.blob)) {
          updates.following = (followingResult.value.blob as string[]).filter(
            (id) => typeof id === "string"
          )
        }

        if (mounted) setState((s) => ({ ...s, ...updates }))
      } catch (err) {
        errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
        if (mounted) setState((s) => ({ ...s, ready: true, posts: bootstrapPosts(), stories: bootstrapStories() })) // prod: empty
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [sdk])

  useEffect(() => {
    if (!state.ready || typeof window === "undefined") return
    const activeId = getActiveLocalProfileId()
    const localCandidates = readLocalProfiles()
      .filter((profile) => profile.localId !== activeId)
      .map(profileToLocalCandidate)
    setState((current) => ({
      ...current,
      candidates: [
        ...current.candidates.filter((candidate) => !candidate.id.startsWith("local-")),
        ...localCandidates,
      ],
    }))
  }, [state.ready, state.profile])


  // Hydrate social graph slices (following / friends / block / mute) so they survive refresh
  useEffect(() => {
    if (!sdk || !state.ready) return
    let cancelled = false
    ;(async () => {
      try {
        const [followingR, friendsR, blockedR, mutedR] = await Promise.allSettled([
          withRetry(() => sdk.state.get(STORAGE_KEYS.following)),
          withRetry(() => sdk.state.get(STORAGE_KEYS.friends)),
          withRetry(() => sdk.state.get(STORAGE_KEYS.blockedUsers)),
          withRetry(() => sdk.state.get(STORAGE_KEYS.mutedUsers)),
        ])
        if (cancelled) return
        setState((s) => {
          const next = { ...s }
          if (followingR.status === "fulfilled" && Array.isArray(followingR.value?.blob)) {
            next.following = followingR.value.blob.filter((id: unknown) => typeof id === "string")
          }
          if (friendsR.status === "fulfilled" && Array.isArray(friendsR.value?.blob)) {
            next.friends = friendsR.value.blob.filter((id: unknown) => typeof id === "string")
          }
          if (blockedR.status === "fulfilled" && Array.isArray(blockedR.value?.blob)) {
            const blocked = blockedR.value.blob.filter((id: unknown) => typeof id === "string")
            next.blockedUsers = blocked
            next.settings = { ...next.settings, blockedUsers: blocked }
          }
          if (mutedR.status === "fulfilled" && Array.isArray(mutedR.value?.blob)) {
            next.mutedUsers = mutedR.value.blob.filter((id: unknown) => typeof id === "string")
          }
          return next
        })
      } catch {
        /* non-fatal */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sdk, state.ready])

  // Durable social hydrate (posts / stories / follows) — server authoritative when configured
  useEffect(() => {
    if (!state.ready) return
    let cancelled = false
    ;(async () => {
      try {
        const {
          socialFetchFeed,
          socialFetchStories,
          socialFetchFollows,
        } = await import("@/lib/social/client")
        const [feed, stories, follows] = await Promise.all([
          socialFetchFeed({ limit: 40 }),
          socialFetchStories(),
          socialFetchFollows(),
        ])
        if (cancelled) return
        setState((s) => {
          const next = { ...s }
          // Phase 1 multi-user: merge any successful feed payload.
          // Prefer durable remote posts; still merge non-durable remote when present
          // so multi-device sessions share whatever the API returned.
          if (feed.ok && Array.isArray(feed.posts) && feed.posts.length > 0) {
            const remotePosts = mapRemoteFeedPosts(feed.posts)
            const remoteIds = new Set(remotePosts.map((p) => p.id))
            const localOnly = s.posts.filter(
              (p) => !remoteIds.has(p.id) && !p.deletedAt
            )
            // Durable remote is authoritative ordering; local-only kept for offline drafts
            next.posts = [...remotePosts, ...localOnly].sort(
              (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
            )
            const liked = feed.posts
              .filter((p) => (p as { likedByMe?: boolean }).likedByMe)
              .map((p) => String(p.id))
            if (liked.length) {
              next.likedPostIds = Array.from(
                new Set([...(s.likedPostIds || []), ...liked])
              )
            }
          } else if (feed.ok === false && feed.error) {
            try {
              console.warn("[ghc] social feed hydrate failed", feed.error)
            } catch {
              /* */
            }
          }
          if (stories.ok && Array.isArray(stories.stories) && stories.stories.length > 0) {
            next.stories = stories.stories.map((st) => ({
              id: String(st.id),
              ownerId: st.ownerId ? String(st.ownerId) : undefined,
              name: String(st.name || "Member"),
              photo: st.photo ? String(st.photo) : undefined,
              text: String(st.text || ""),
              media: st.media as StoryItem["media"],
              background: typeof st.background === "string" ? st.background : undefined,
              createdAt: Number(st.createdAt) || Date.now(),
              expiresAt: st.expiresAt ? Number(st.expiresAt) : undefined,
              audience: st.audience as StoryItem["audience"],
              status: (st.status as StoryItem["status"]) || "published",
            }))
          }
          // Phase 1: accept follow graph whenever API succeeds (durable preferred)
          if (follows.ok) {
            if (Array.isArray(follows.following) && (follows.durable || follows.following.length > 0)) {
              next.following = follows.following.map(String)
            }
            if (Array.isArray(follows.followers) && (follows.durable || follows.followers.length > 0)) {
              next.followers = follows.followers.map(String)
            }
          }
          return next
        })
      } catch {
        /* studio / offline */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [state.ready])



  // After social writes (or attempts), re-pull shared lists so other accounts' state converges
  useEffect(() => {
    if (!state.ready || typeof window === "undefined") return
    let timer: ReturnType<typeof setTimeout> | null = null
    const onMut = (_ev: Event) => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        void (async () => {
          try {
            const { socialFetchFeed, socialFetchConnectionInbox, socialFetchFollows, socialDiscoverPeople } =
              await import("@/lib/social/client")
            const { apiListConversations } = await import("@/lib/messaging/server-messaging-sync")
            const [feed, inbox, follows, convs, people] = await Promise.all([
              socialFetchFeed({ limit: 40 }),
              socialFetchConnectionInbox(),
              socialFetchFollows(),
              apiListConversations(40).catch(() => null),
              socialDiscoverPeople(40).catch(() => null),
            ])
            setState((s) => {
              let next = { ...s }
              if (feed.ok && Array.isArray(feed.posts) && feed.posts.length > 0) {
                const mapped = feed.posts.map((p) => {
                  const id = String(p.id || "")
                  const existing = s.posts.find((x) => x.id === id)
                  return {
                    ...(existing || {}),
                    ...p,
                    id,
                    likes: typeof p.likes === "number" ? p.likes : existing?.likes ?? 0,
                    comments: Array.isArray((p as { comments?: unknown }).comments)
                      ? (p as { comments: Post["comments"] }).comments
                      : existing?.comments,
                  } as Post
                })
                const remoteIds = new Set(mapped.map((p) => p.id))
                const localOnly = s.posts.filter((p) => !remoteIds.has(p.id) && !p.deletedAt)
                next.posts = [...mapped, ...localOnly].sort(
                  (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
                )
              }
              if (inbox.ok && (inbox.durable || inbox.incoming.length > 0 || inbox.outgoing.length > 0)) {
                const candName = (uid: string) => {
                  const c = (s.candidates || []).find((x) => x.id === uid)
                  return c?.name || "Member"
                }
                const candPhoto = (uid: string) => {
                  const c = (s.candidates || []).find((x) => x.id === uid)
                  return c?.photo || "/placeholder.svg?width=40&height=40"
                }
                const myId = String(s.profile?.id || "").trim()
                const fromServer: FriendRequest[] = []
                for (const r of inbox.incoming || []) {
                  const from = String(r.fromUserId || "")
                  if (!from) continue
                  fromServer.push({
                    id: String(r.id || `in_${from}`),
                    fromUserId: from,
                    fromUserName: candName(from),
                    fromUserPhoto: candPhoto(from),
                    toUserId: String(r.toUserId || myId),
                    createdAt: Number(r.createdAt) || Date.now(),
                  })
                }
                for (const r of inbox.outgoing || []) {
                  const to = String(r.toUserId || "")
                  if (!to) continue
                  fromServer.push({
                    id: String(r.id || `out_${to}`),
                    fromUserId: String(r.fromUserId || myId),
                    fromUserName: s.profile?.displayName || "You",
                    fromUserPhoto: s.profile?.photos?.[0] || "",
                    toUserId: to,
                    createdAt: Number(r.createdAt) || Date.now(),
                  })
                }
                const key = (r: FriendRequest) => `${r.fromUserId}→${r.toUserId}`
                const byKey = new Map<string, FriendRequest>()
                // Prefer server rows; keep local-only pairs not on server only when not durable
                if (!inbox.durable) {
                  for (const r of s.friendRequests || []) byKey.set(key(r), r)
                }
                for (const r of fromServer) byKey.set(key(r), r)
                next.friendRequests = Array.from(byKey.values())
              }
              if (follows.ok && (follows.durable || follows.following.length > 0)) {
                if (Array.isArray(follows.following)) next.following = follows.following.map(String)
                if (Array.isArray(follows.followers)) next.followers = follows.followers.map(String)
              }
              if (convs && convs.ok && convs.durable && Array.isArray(convs.conversations)) {
                const byId = new Map((next.conversations || []).map((c) => [c.id, c]))
                for (const r of convs.conversations) {
                  const id = String(r.id || "")
                  if (!id) continue
                  const existing = byId.get(id)
                  const lastAt =
                    typeof r.lastMessageAt === "number" && Number.isFinite(r.lastMessageAt)
                      ? r.lastMessageAt
                      : existing?.lastMessageTime || Date.now()
                  const base: Conversation = existing ?? {
                    id,
                    participantId: "",
                    participantName: String(r.title || "Chat"),
                    participantPhoto: "/placeholder.svg?width=40&height=40",
                    messages: [],
                    lastMessage: "",
                    lastMessageTime: lastAt,
                    unread: false,
                    online: false,
                    conversationType: "private",
                    unreadCount: 0,
                  }
                  const merged: Conversation = {
                    ...base,
                    id,
                    lastMessage:
                      typeof r.lastMessagePreview === "string" && r.lastMessagePreview
                        ? r.lastMessagePreview
                        : base.lastMessage || "",
                    lastMessageTime: lastAt,
                    participantName: base.participantName || String(r.title || "Chat"),
                    online: base.online ?? false,
                    conversationType: base.conversationType === "group" ? "group" : "private",
                  }
                  byId.set(id, merged)
                }
                next.conversations = Array.from(byId.values()).sort(
                  (a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0)
                )
              }

            if (people && people.ok && Array.isArray(people.people) && people.people.length > 0) {
              const byId = new Map((next.candidates || []).map((c) => [c.id, c]))
              for (const p of people.people) {
                if (!p.userId || p.userId === s.profile?.id) continue
                const existing = byId.get(p.userId)
                byId.set(p.userId, {
                  id: p.userId,
                  name: p.displayName || existing?.name || "Member",
                  age: existing?.age || 0,
                  photo: p.avatarUrl || existing?.photo || "/placeholder.svg?width=80&height=80",
                  photos: p.avatarUrl ? [p.avatarUrl] : existing?.photos,
                  bio: p.bio || existing?.bio || "",
                  location:
                    [p.city, p.country].filter(Boolean).join(", ") || existing?.location || "",
                  interests: existing?.interests || [],
                  verified: existing?.verified ?? false,
                  online: existing?.online ?? false,
                  lastSeen: existing?.lastSeen ?? 0,
                  coverPhoto: existing?.coverPhoto,
                  profilePhotoHistory: existing?.profilePhotoHistory,
                  coverPhotoHistory: existing?.coverPhotoHistory,
                  distance: existing?.distance,
                  isSample: false,
                } as Candidate)
              }
              const merged = Array.from(byId.values()).filter((c) => {
                if (people.durable && people.people.length > 0) {
                  try {
                    return isLikelyServerUserId(c.id)
                  } catch {
                    return true
                  }
                }
                return true
              })
              next.candidates = merged
            }

              return next
            })
            try {
              window.dispatchEvent(new CustomEvent("ghc:notification"))
              window.dispatchEvent(new CustomEvent("ghc:connection-inbox-updated"))
              window.dispatchEvent(new CustomEvent("ghc:messaging-reconcile"))
            } catch {
              /* */
            }
          } catch {
            /* offline */
          }
        })()
      }, 350)
    }
    window.addEventListener(SOCIAL_MUTATION_EVENT, onMut as EventListener)
    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener(SOCIAL_MUTATION_EVENT, onMut as EventListener)
    }
  }, [state.ready])

  // Soft revalidate feed + connection inbox + follows when app returns to foreground
  useEffect(() => {
    if (!state.ready) return
    let last = 0
    const MIN_MS = 12_000
    const revalidate = () => {
      const now = Date.now()
      if (now - last < MIN_MS) return
      last = now
      void (async () => {
        try {
          const { socialFetchFeed, socialFetchConnectionInbox, socialFetchFollows, socialDiscoverPeople, socialFetchMatchInbox } =
            await import("@/lib/social/client")
          const { apiListConversations } = await import("@/lib/messaging/server-messaging-sync")
          const [feed, inbox, follows, convs, people, matchInbox] = await Promise.all([
            socialFetchFeed({ limit: 40 }),
            socialFetchConnectionInbox(),
            socialFetchFollows(),
            apiListConversations(40).catch(() => null),
            socialDiscoverPeople(40).catch(() => null),
            socialFetchMatchInbox().catch(() => null),
          ])
          setState((s) => {
            let next = { ...s }
            if (feed.ok && Array.isArray(feed.posts) && feed.posts.length > 0) {
              const remotePosts = mapRemoteFeedPosts(feed.posts)
              const remoteIds = new Set(remotePosts.map((p) => p.id))
              const localOnly = s.posts.filter((p) => !remoteIds.has(p.id) && !p.deletedAt)
              next.posts = [...remotePosts, ...localOnly].sort(
                (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
              )
            }
            if (inbox.ok && (inbox.durable || inbox.incoming.length > 0 || inbox.outgoing.length > 0)) {
              const myId = String(s.profile?.id || "").trim()
              const candName = (uid: string) =>
                (s.candidates || []).find((x) => x.id === uid)?.name || "Member"
              const candPhoto = (uid: string) =>
                (s.candidates || []).find((x) => x.id === uid)?.photo || ""
              const mapped: FriendRequest[] = []
              for (const row of inbox.incoming || []) {
                if (!row.fromUserId) continue
                mapped.push({
                  id: row.id || `in_${row.fromUserId}`,
                  fromUserId: row.fromUserId,
                  fromUserName: candName(row.fromUserId),
                  fromUserPhoto: candPhoto(row.fromUserId),
                  toUserId: row.toUserId || myId,
                  createdAt: row.createdAt || Date.now(),
                })
              }
              for (const row of inbox.outgoing || []) {
                if (!row.toUserId) continue
                mapped.push({
                  id: row.id || `out_${row.toUserId}`,
                  fromUserId: row.fromUserId || myId,
                  fromUserName: s.profile?.displayName || "You",
                  fromUserPhoto: s.profile?.photos?.[0] || "",
                  toUserId: row.toUserId,
                  createdAt: row.createdAt || Date.now(),
                })
              }
              const key = (r: FriendRequest) => `${r.fromUserId}→${r.toUserId}`
              const byKey = new Map<string, FriendRequest>()
              if (!inbox.durable) {
                for (const r of s.friendRequests || []) byKey.set(key(r), r)
              }
              for (const r of mapped) byKey.set(key(r), r)
              next.friendRequests = Array.from(byKey.values())
            }
            if (follows.ok) {
              if (Array.isArray(follows.following) && (follows.durable || follows.following.length > 0)) {
                next.following = follows.following.map(String)
              }
              if (Array.isArray(follows.followers) && (follows.durable || follows.followers.length > 0)) {
                next.followers = follows.followers.map(String)
              }
            }
            if (convs && convs.ok && convs.durable && Array.isArray(convs.conversations)) {
              const byId = new Map((next.conversations || []).map((c) => [c.id, c]))
              for (const r of convs.conversations) {
                const id = String(r.id || "")
                if (!id) continue
                const existing = byId.get(id)
                const lastAt =
                  typeof r.lastMessageAt === "number" && Number.isFinite(r.lastMessageAt)
                    ? r.lastMessageAt
                    : existing?.lastMessageTime || Date.now()
                const base: Conversation = existing ?? {
                  id,
                  participantId: "",
                  participantName: String(r.title || "Chat"),
                  participantPhoto: "/placeholder.svg?width=40&height=40",
                  messages: [],
                  lastMessage: "",
                  lastMessageTime: lastAt,
                  unread: false,
                  online: false,
                  conversationType: "private",
                  unreadCount: 0,
                }
                const merged: Conversation = {
                  ...base,
                  id,
                  lastMessage:
                    typeof r.lastMessagePreview === "string" && r.lastMessagePreview
                      ? r.lastMessagePreview
                      : base.lastMessage || "",
                  lastMessageTime: lastAt,
                  updatedAt:
                    typeof r.updatedAt === "number" && Number.isFinite(r.updatedAt)
                      ? r.updatedAt
                      : base.updatedAt || lastAt,
                  participantName: base.participantName || String(r.title || "Chat"),
                  online: base.online ?? false,
                  conversationType: base.conversationType === "group" ? "group" : "private",
                }
                byId.set(id, merged)
              }
              next.conversations = Array.from(byId.values()).sort(
                (a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0)
              )
            }

            if (people && people.ok && Array.isArray(people.people) && people.people.length > 0) {
              const byId = new Map((next.candidates || []).map((c) => [c.id, c]))
              for (const p of people.people) {
                if (!p.userId || p.userId === s.profile?.id) continue
                const existing = byId.get(p.userId)
                byId.set(p.userId, {
                  id: p.userId,
                  name: p.displayName || existing?.name || "Member",
                  age: existing?.age || 0,
                  photo: p.avatarUrl || existing?.photo || "/placeholder.svg?width=80&height=80",
                  photos: p.avatarUrl ? [p.avatarUrl] : existing?.photos,
                  bio: p.bio || existing?.bio || "",
                  location:
                    [p.city, p.country].filter(Boolean).join(", ") || existing?.location || "",
                  interests: existing?.interests || [],
                  verified: existing?.verified ?? false,
                  online: existing?.online ?? false,
                  lastSeen: existing?.lastSeen ?? 0,
                  coverPhoto: existing?.coverPhoto,
                  profilePhotoHistory: existing?.profilePhotoHistory,
                  coverPhotoHistory: existing?.coverPhotoHistory,
                  distance: existing?.distance,
                  isSample: false,
                } as Candidate)
              }
              const merged = Array.from(byId.values()).filter((c) => {
                if (people.durable && people.people.length > 0) {
                  try {
                    return isLikelyServerUserId(c.id)
                  } catch {
                    return true
                  }
                }
                return true
              })
              next.candidates = merged
            }

            if (matchInbox && matchInbox.ok && matchInbox.durable) {
              const myId =
                String(s.profile?.id || "").trim() || "current-user"
              const likeKey = (from: string, to: string) => `${from}→${to}`
              const likeMap = new Map<string, Like>()
              for (const l of next.likes || []) {
                likeMap.set(likeKey(l.fromUserId, l.toUserId), l)
              }
              for (const o of matchInbox.outgoingLikes || []) {
                likeMap.set(likeKey(myId, o.toUserId), {
                  id: `like_${myId}_${o.toUserId}`,
                  fromUserId: myId,
                  toUserId: o.toUserId,
                  createdAt: o.createdAt || Date.now(),
                })
              }
              for (const i of matchInbox.incomingLikes || []) {
                likeMap.set(likeKey(i.fromUserId, myId), {
                  id: `like_${i.fromUserId}_${myId}`,
                  fromUserId: i.fromUserId,
                  toUserId: myId,
                  createdAt: i.createdAt || Date.now(),
                })
              }
              const matchMap = new Map((next.matches || []).map((m) => [m.userId, m]))
              for (const m of matchInbox.matches || []) {
                if (!matchMap.has(m.userId)) {
                  matchMap.set(m.userId, {
                    id: `match_${m.userId}`,
                    userId: m.userId,
                    userName: "Match",
                    userPhoto: "",
                    matchedAt: m.createdAt || Date.now(),
                    online: false,
                  })
                }
              }
              next.likes = Array.from(likeMap.values())
              next.matches = Array.from(matchMap.values())
            }

            return next
          })
          try {
            window.dispatchEvent(new CustomEvent("ghc:connection-inbox-updated"))
            window.dispatchEvent(new CustomEvent("ghc:messaging-reconcile"))
          } catch {
            /* */
          }
        } catch {
          /* offline */
        }
      })()
    }
    const onVis = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") revalidate()
    }
    const onFocus = () => revalidate()
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVis)
    }
    if (typeof window !== "undefined") {
      window.addEventListener("focus", onFocus)
    }
    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVis)
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", onFocus)
      }
    }
  }, [state.ready])



  // Phase 5: hydrate durable match signals (likes / mutual matches)
  useEffect(() => {
    if (!state.ready) return
    let cancelled = false
    ;(async () => {
      try {
        const { socialFetchMatchInbox } = await import("@/lib/social/client")
        const inbox = await socialFetchMatchInbox()
        if (cancelled || !inbox.ok) return
        if (!inbox.durable) return
        const myId =
          String(state.profile?.id || IdentityService.getCurrentUserId() || "").trim() ||
          "current-user"
        setState((s) => {
          const likeKey = (from: string, to: string) => `${from}→${to}`
          const likeMap = new Map<string, Like>()
          for (const l of s.likes || []) {
            likeMap.set(likeKey(l.fromUserId, l.toUserId), l)
          }
          for (const o of inbox.outgoingLikes) {
            const k = likeKey(myId, o.toUserId)
            likeMap.set(k, {
              id: `like_${myId}_${o.toUserId}`,
              fromUserId: myId,
              toUserId: o.toUserId,
              createdAt: o.createdAt || Date.now(),
            })
          }
          for (const i of inbox.incomingLikes) {
            const k = likeKey(i.fromUserId, myId)
            likeMap.set(k, {
              id: `like_${i.fromUserId}_${myId}`,
              fromUserId: i.fromUserId,
              toUserId: myId,
              createdAt: i.createdAt || Date.now(),
            })
          }
          const matchMap = new Map(s.matches.map((m) => [m.userId, m]))
          const candById = new Map((s.candidates || []).map((c) => [c.id, c]))
          for (const m of inbox.matches) {
            const cand = candById.get(m.userId)
            const existing = matchMap.get(m.userId)
            if (!existing) {
              matchMap.set(m.userId, {
                id: `match_${m.userId}`,
                userId: m.userId,
                userName: cand?.name || "Match",
                userPhoto: cand?.photo || cand?.photos?.[0] || "",
                matchedAt: m.createdAt || Date.now(),
                online: Boolean(cand?.online),
              })
            } else if (
              (!existing.userName || existing.userName === "Match") &&
              Boolean(cand && cand.name)
            ) {
              matchMap.set(m.userId, {
                ...existing,
                userName: String(cand?.name || "Match"),
                userPhoto: existing.userPhoto || cand?.photo || cand?.photos?.[0] || "",
              })
            }
          }
          return {
            ...s,
            likes: Array.from(likeMap.values()),
            matches: Array.from(matchMap.values()),
          }
        })
      } catch {
        /* offline */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [state.ready, state.profile?.id])

  // Phase 4: hydrate pending connection requests from durable API
  useEffect(() => {
    if (!state.ready) return
    let cancelled = false
    ;(async () => {
      try {
        const { socialFetchConnectionInbox } = await import("@/lib/social/client")
        const inbox = await socialFetchConnectionInbox()
        if (cancelled || !inbox.ok) return
        if (!inbox.durable && inbox.incoming.length === 0 && inbox.outgoing.length === 0) return
        const myId = String(state.profile?.id || "").trim()
        const mapped: FriendRequest[] = []
        for (const row of inbox.incoming) {
          mapped.push({
            id: row.id || `in_${row.fromUserId}`,
            fromUserId: row.fromUserId,
            fromUserName: "Member",
            fromUserPhoto: "",
            toUserId: row.toUserId || myId,
            createdAt: row.createdAt || Date.now(),
          })
        }
        for (const row of inbox.outgoing) {
          mapped.push({
            id: row.id || `out_${row.toUserId}`,
            fromUserId: row.fromUserId || myId,
            fromUserName: state.profile?.displayName || "You",
            fromUserPhoto: state.profile?.photos?.[0] || "",
            toUserId: row.toUserId,
            createdAt: row.createdAt || Date.now(),
          })
        }
        setState((s) => {
          // Merge by pair key; prefer server rows
          const key = (r: FriendRequest) => `${r.fromUserId}→${r.toUserId}`
          const byKey = new Map<string, FriendRequest>()
          for (const r of s.friendRequests || []) byKey.set(key(r), r)
          for (const r of mapped) byKey.set(key(r), r)
          return { ...s, friendRequests: Array.from(byKey.values()) }
        })
      } catch {
        /* offline */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [state.ready, state.profile?.id, state.profile?.displayName, state.profile?.photos])



  // Rehydrate social surfaces when the device comes back online
  useEffect(() => {
    if (typeof window === "undefined") return
    const onOnline = () => {
      try {
        window.dispatchEvent(new CustomEvent("ghc:connection-inbox-updated"))
        window.dispatchEvent(new CustomEvent("ghc:social-mutation", { detail: { type: "online" } }))
      } catch { /* */ }
    }
    window.addEventListener("online", onOnline)
    return () => window.removeEventListener("online", onOnline)
  }, [])

  // Phase 3 — keep friends + request inbox coherent after accept/decline on any surface
  useEffect(() => {
    if (typeof window === "undefined") return
    const rehydrateInbox = async () => {
      try {
        const { socialFetchConnectionInbox } = await import("@/lib/social/client")
        const inbox = await socialFetchConnectionInbox()
        if (!inbox.ok) return
        setState((s) => {
          const myId = String(s.profile?.id || "").trim()
          const key = (r: { fromUserId: string; toUserId?: string }) =>
            `${String(r.fromUserId || "").trim()}→${String(r.toUserId || myId || "").trim()}`
          const byKey = new Map<string, FriendRequest>()
          if (!inbox.durable) {
            for (const r of s.friendRequests || []) byKey.set(key(r), r)
          }
          for (const r of inbox.incoming || []) {
            byKey.set(key(r), {
              id: r.id || `in_${r.fromUserId}`,
              fromUserId: r.fromUserId,
              fromUserName: "Member",
              fromUserPhoto: "",
              toUserId: r.toUserId || myId,
              createdAt: r.createdAt || Date.now(),
            } as FriendRequest)
          }
          for (const r of inbox.outgoing || []) {
            byKey.set(key(r), {
              id: r.id || `out_${r.toUserId}`,
              fromUserId: r.fromUserId || myId,
              fromUserName: s.profile?.displayName || "You",
              fromUserPhoto: s.profile?.photos?.[0] || "",
              toUserId: r.toUserId,
              createdAt: r.createdAt || Date.now(),
            } as FriendRequest)
          }
          return { ...s, friendRequests: Array.from(byKey.values()) }
        })
      } catch { /* */ }
    }
    const onConnectionUpdated = (ev: Event) => {
      const detail = (ev as CustomEvent).detail || {}
      const action = String(detail.action || "")
      const peer = String(detail.fromUserId || detail.peerUserId || "").trim()
      if (action === "accept" && peer) {
        setState((s) => {
          const friends = Array.from(new Set([...(s.friends || []), peer]))
          const following = Array.from(new Set([...(s.following || []), peer]))
          const myId = String(s.profile?.id || "").trim()
          const friendRequests = (s.friendRequests || []).filter(
            (r) =>
              !(r.fromUserId === peer && r.toUserId === myId) &&
              !(r.fromUserId === myId && r.toUserId === peer)
          )
          return { ...s, friends, following, friendRequests }
        })
      } else if (action === "decline" && peer) {
        setState((s) => {
          const myId = String(s.profile?.id || "").trim()
          const friendRequests = (s.friendRequests || []).filter(
            (r) =>
              !(r.fromUserId === peer && r.toUserId === myId) &&
              !(r.fromUserId === myId && r.toUserId === peer)
          )
          return { ...s, friendRequests }
        })
      }
      void rehydrateInbox()
    }
    window.addEventListener("ghc:connection-updated", onConnectionUpdated as EventListener)
    window.addEventListener("ghc:connection-inbox-updated", rehydrateInbox as EventListener)
    return () => {
      window.removeEventListener("ghc:connection-updated", onConnectionUpdated as EventListener)
      window.removeEventListener("ghc:connection-inbox-updated", rehydrateInbox as EventListener)
    }
  }, [])

  // Cross-account discovery: merge server profiles into candidates (real gh_user_id)
  useEffect(() => {
    if (!state.ready) return
    let cancelled = false
    ;(async () => {
      try {
        const { socialDiscoverPeople } = await import("@/lib/social/client")
        const remote = await socialDiscoverPeople(40)
        if (cancelled || !remote.ok || !remote.people.length) return
        setState((s) => {
          const byId = new Map(s.candidates.map((c) => [c.id, c]))
          for (const p of remote.people) {
            if (!p.userId || p.userId === s.profile?.id) continue
            const existing = byId.get(p.userId)
            byId.set(p.userId, {
              id: p.userId,
              name: p.displayName || existing?.name || "Member",
              age: existing?.age || 0,
              photo: p.avatarUrl || existing?.photo || "/placeholder.svg?width=80&height=80",
              photos: p.avatarUrl ? [p.avatarUrl] : existing?.photos,
              bio: p.bio || existing?.bio || "",
              location:
                [p.city, p.country].filter(Boolean).join(", ") ||
                existing?.location ||
                "",
              interests: existing?.interests || [],
              verified: existing?.verified ?? false,
              online: existing?.online ?? false,
              lastSeen: existing?.lastSeen ?? 0,
              coverPhoto: existing?.coverPhoto,
              profilePhotoHistory: existing?.profilePhotoHistory,
              coverPhotoHistory: existing?.coverPhotoHistory,
              distance: existing?.distance,
              isSample: false,
            })
          }
          // Drop demo seeds when we have real people (production multi-user)
          const merged = Array.from(byId.values()).filter((c) => {
            if (remote.durable && remote.people.length > 0) {
              return isLikelyServerUserId(c.id)
            }
            return true
          })
          return { ...s, candidates: merged }
        })
      } catch {
        /* offline */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [state.ready])

  // Phase 9: hydrate public communities from durable API into conversations[]
  useEffect(() => {
    if (!state.ready) return
    let cancelled = false
    ;(async () => {
      try {
        const { socialListCommunities } = await import("@/lib/social/client")
        const remote = await socialListCommunities(50)
        if (cancelled || !remote.ok || !Array.isArray(remote.communities)) return
        if (!remote.communities.length) return
        setState((s) => {
          const byId = new Map(s.conversations.map((c) => [c.id, c]))
          for (const raw of remote.communities) {
            const row = raw as Record<string, unknown>
            const id = String(row.id || row.community_id || "")
            if (!id) continue
            const existing = byId.get(id)
            const name = String(row.name || row.title || existing?.participantName || "Community")
            const next: Conversation = {
              ...(existing || {
                id,
                participantId: id,
                participantName: name,
                participantPhoto: String(row.coverImage || row.cover_image || ""),
                messages: [],
                lastMessage: String(row.description || row.purpose || "").slice(0, 120),
                lastMessageTime: Number(row.createdAt || row.created_at || Date.now()),
                unread: false,
                online: false,
                conversationType: "group",
              }),
              id,
              participantName: name,
              conversationType: "group" as const,
              privacy: (String(row.privacy || existing?.privacy || "public") as Conversation["privacy"]) || "public",
              members: Array.isArray(row.members)
                ? (row.members as string[])
                : existing?.members || [],
            }
            byId.set(id, next)
          }
          return { ...s, conversations: Array.from(byId.values()) }
        })
      } catch {
        /* offline */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [state.ready])

  // Durable messaging hydrate — conversations list when server has membership rows
  useEffect(() => {
    if (!state.ready) return
    let cancelled = false
    ;(async () => {
      try {
        const { apiListConversations } = await import("@/lib/messaging/server-messaging-sync")
        const res = await apiListConversations(50)
        if (cancelled || !res?.ok || !res.durable) return
        const remote = Array.isArray(res.conversations) ? res.conversations : []
        if (!remote.length) return
        setState((s) => {
          const byId = new Map(s.conversations.map((c) => [c.id, c]))
          for (const r of remote) {
            const id = String(r.id || "")
            if (!id) continue
            const existing = byId.get(id)
            const remoteMembers = Array.isArray(r.memberIds)
              ? r.memberIds.map(String)
              : []
            const members =
              remoteMembers.length > 0
                ? remoteMembers
                : existing?.members || existing?.memberIds || []
            const preview =
              typeof r.lastMessagePreview === "string" ? r.lastMessagePreview : ""
            const lastAt =
              typeof r.lastMessageAt === "number" && Number.isFinite(r.lastMessageAt)
                ? r.lastMessageAt
                : existing?.lastMessageTime || Date.now()
            const updatedAt =
              typeof r.updatedAt === "number" && Number.isFinite(r.updatedAt)
                ? r.updatedAt
                : existing?.updatedAt || lastAt
            // Fallback object only when existing is missing (do not reference existing inside it).
            byId.set(id, {
              ...(existing || {
                id,
                participantId: "",
                participantName: r.title || "Chat",
                participantPhoto: "/placeholder.svg?width=40&height=40",
                messages: [],
                lastMessage: "",
                lastMessageTime: lastAt,
                unread: false,
                online: false,
                conversationType: "private" as const,
                members: [],
                memberIds: [],
                name: r.title || "Chat",
                unreadCount: 0,
                updatedAt: lastAt,
              }),
              id,
              members,
              memberIds: members,
              name: r.title || existing?.name || existing?.groupName || existing?.participantName || "Chat",
              groupName: r.title || existing?.groupName || existing?.name,
              updatedAt,
              lastMessage: preview || existing?.lastMessage || "",
              lastMessageTime: lastAt,
              ...(typeof r.unreadCount === "number" && Number.isFinite(r.unreadCount) ? { unreadCount: Math.max(0, r.unreadCount), unread: r.unreadCount > 0 } : {}),
            })
          }
          return {
            ...s,
            conversations: Array.from(byId.values()).sort(
              (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
            ),
          }
        })
      } catch {
        /* offline */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [state.ready])

  // Define addToast first - it's used by other functions
  const addToast = useCallback((message: string, type: "success" | "error" | "info") => {
    const id = generateId()
    setState((s) => ({ ...s, toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => {
      setState((s) => ({ ...s, toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 3000)
  }, [])


  // Hydrate server-authoritative messaging and online-status privacy. Legacy device settings are
  // seeded only for preference fields not yet configured on the server, so a stale device cannot
  // overwrite a setting that was already saved from another device.
  useEffect(() => {
    if (!state.ready || !identityUserId || identityUserId === "current-user" || identityUserId === "preview-user") return
    let cancelled = false
    ;(async () => {
      try {
        const headers = { Accept: "application/json", ...IdentityService.getAuthHeaders() }
        const response = await fetch("/api/messaging/preferences", { credentials: "include", cache: "no-store", headers })
        const result = await response.json().catch(() => ({}))
        if (cancelled || !response.ok || result?.ok !== true || result?.durable !== true) return
        const whoValid = ["everyone", "matches-only", "no-one"].includes(String(result.whoCanMessage))
        const onlineValid = ["everyone", "matches-only", "hidden"].includes(String(result.onlineStatus))
        const seed: Record<string, string | boolean> = { seedIfMissing: true }
        if (result.whoCanMessageConfigured !== true && ["everyone", "matches-only", "no-one"].includes(String(state.settings.whoCanMessage))) {
          seed.whoCanMessage = state.settings.whoCanMessage
        }
        if (result.onlineStatusConfigured !== true && ["everyone", "matches-only", "hidden"].includes(String(state.settings.onlineStatus))) {
          seed.onlineStatus = state.settings.onlineStatus
        }
        if (whoValid || onlineValid) {
          setState((current) => ({
            ...current,
            settings: {
              ...current.settings,
              ...(result.whoCanMessageConfigured === true && whoValid ? { whoCanMessage: result.whoCanMessage } : {}),
              ...(result.onlineStatusConfigured === true && onlineValid ? { onlineStatus: result.onlineStatus } : {}),
            },
          }))
        }
        if (Object.keys(seed).some((key) => key !== "seedIfMissing")) {
          const saved = await fetch("/api/messaging/preferences", {
            method: "PATCH", credentials: "include", cache: "no-store",
            headers: { "Content-Type": "application/json", Accept: "application/json", ...IdentityService.getAuthHeaders() },
            body: JSON.stringify(seed),
          })
          const canonical = await saved.json().catch(() => ({}))
          if (!cancelled && saved.ok && canonical?.ok === true) {
            setState((current) => ({
              ...current,
              settings: {
                ...current.settings,
                ...( ["everyone", "matches-only", "no-one"].includes(String(canonical.whoCanMessage)) ? { whoCanMessage: canonical.whoCanMessage } : {}),
                ...( ["everyone", "matches-only", "hidden"].includes(String(canonical.onlineStatus)) ? { onlineStatus: canonical.onlineStatus } : {}),
              },
            }))
          } else if (!cancelled && !saved.ok) {
            addToast("Could not migrate your messaging privacy settings to the server.", "error")
          }
        }
      } catch { /* privacy setting hydration retries on the next app session */ }
    })()
    return () => { cancelled = true }
  }, [state.ready, identityUserId, state.settings.whoCanMessage, state.settings.onlineStatus, addToast])

  // Keep the inbox and message previews fresh while the app is open, without an N+1 DB query per conversation.
  useEffect(() => {
    if (!state.ready) return
    let cancelled = false
    let inFlight = false
    const refreshInbox = async () => {
      if (cancelled || inFlight || (typeof document !== "undefined" && document.visibilityState !== "visible")) return
      inFlight = true
      try {
        const { apiListConversations } = await import("@/lib/messaging/server-messaging-sync")
        const result = await apiListConversations(40)
        if (cancelled || !result?.ok || !result.durable || !Array.isArray(result.conversations) || !result.conversations.length) return
        setState((current) => {
          const byId = new Map(current.conversations.map((conversation) => [conversation.id, conversation]))
          for (const remote of result.conversations as Array<Record<string, unknown>>) {
            const id = String(remote.id || "")
            if (!id) continue
            const existing = byId.get(id)
            const members = Array.isArray(remote.memberIds) ? remote.memberIds.map(String) : existing?.memberIds || existing?.members || []
            const lastMessageAt = typeof remote.lastMessageAt === "number" && Number.isFinite(remote.lastMessageAt) ? remote.lastMessageAt : existing?.lastMessageTime || Date.now()
            const updatedAt = typeof remote.updatedAt === "number" && Number.isFinite(remote.updatedAt) ? remote.updatedAt : lastMessageAt
            const preview = typeof remote.lastMessagePreview === "string" ? remote.lastMessagePreview : existing?.lastMessage || ""
            byId.set(id, {
              ...(existing || {
                id,
                participantId: members.find((memberId: string) => memberId !== identityUserId) || "",
                participantName: String(remote.title || "Chat"),
                participantPhoto: "/placeholder.svg?width=40&height=40",
                messages: [],
                lastMessage: "",
                lastMessageTime: lastMessageAt,
                unread: false,
                online: false,
                conversationType: "private" as const,
              }),
              id,
              participantId: existing?.participantId || members.find((memberId: string) => memberId !== identityUserId) || "",
              memberIds: members,
              members,
              lastMessage: preview,
              lastMessageTime: lastMessageAt,
              updatedAt,
              ...(typeof remote.unreadCount === "number" && Number.isFinite(remote.unreadCount) ? { unreadCount: Math.max(0, remote.unreadCount), unread: remote.unreadCount > 0 } : {}),
            })
          }
          return { ...current, conversations: Array.from(byId.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)) }
        })
      } catch { /* transient failures recover on the next refresh */ }
      finally { inFlight = false }
    }
    void refreshInbox()
    const interval = window.setInterval(() => void refreshInbox(), 15_000)
    const onVisible = () => { if (document.visibilityState === "visible") void refreshInbox() }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      cancelled = true
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [state.ready, identityUserId])

  // Snapshot the exact persistence slices during render so the effect can depend on
  // the values it writes, without capturing the entire state object.
  const persistenceReady = state.ready
  const persistenceProfile = state.profile
  const persistenceSettings = state.settings
  const persistencePosts = state.posts
  const persistenceMatches = state.matches
  const persistenceLikes = state.likes
  const persistenceConversations = state.conversations
  const persistenceFriendRequests = state.friendRequests
  const persistenceFollowing = state.following
  const persistenceFriends = state.friends
  const persistenceBlockedUsers = state.blockedUsers
  const persistenceMutedUsers = state.mutedUsers

  // Save existing user-state slices together after startup restoration.
  useEffect(() => {
    if (!sdk || !persistenceReady) return
    const profile = persistenceProfile
    const settings = persistenceSettings
    const posts = persistencePosts
    const matches = persistenceMatches
    const likes = persistenceLikes
    const conversations = persistenceConversations
    const friendRequests = persistenceFriendRequests
    const following = persistenceFollowing
    const friends = persistenceFriends
    const blockedUsers = persistenceBlockedUsers
    const mutedUsers = persistenceMutedUsers
    if (!profile.onboarded) return

    const timer = setTimeout(async () => {
      try {
        const results = await Promise.allSettled([
          withRetry(() => sdk.state.set(STORAGE_KEYS.profile, profile)),
          withRetry(() => sdk.state.set(STORAGE_KEYS.settings, settings)),
          withRetry(() => sdk.state.set(STORAGE_KEYS.posts, posts)),
          withRetry(() => sdk.state.set(STORAGE_KEYS.matches, matches)),
          withRetry(() => sdk.state.set(STORAGE_KEYS.likes, likes)),
          withRetry(() => sdk.state.set(STORAGE_KEYS.conversations, conversations)),
          withRetry(() => sdk.state.set(STORAGE_KEYS.friendRequests, friendRequests)),
          withRetry(() => sdk.state.set(STORAGE_KEYS.following, following || [])),
          withRetry(() => sdk.state.set(STORAGE_KEYS.friends, friends || [])),
          withRetry(() =>
            sdk.state.set(STORAGE_KEYS.blockedUsers, blockedUsers || settings?.blockedUsers || []),
          ),
          withRetry(() => sdk.state.set(STORAGE_KEYS.mutedUsers, mutedUsers || [])),
        ])
        const failed = results.filter((result) => result.status === "rejected")
        if (failed.length > 0) {
          console.warn(`[v0] ${failed.length} state slice(s) could not be saved; memory retained for retry`)
        }
      } catch (e) {
        console.warn("[v0] State save failed; keeping the current in-memory state:", e)
      }
    }, 1500)
    return () => clearTimeout(timer)
  }, [
    persistenceReady,
    persistenceProfile,
    persistenceSettings,
    persistencePosts,
    persistenceMatches,
    persistenceLikes,
    persistenceConversations,
    persistenceFriendRequests,
    persistenceFollowing,
    persistenceFriends,
    persistenceBlockedUsers,
    persistenceMutedUsers,
    sdk,
  ])

  // Stories have their own slower write lane so media never competes with the rest of the app.
  useEffect(() => {
    if (!sdk || !state.ready || !state.profile.onboarded) return
    const timer = setTimeout(() => {
      withRetry(() => sdk.state.set(STORAGE_KEYS.stories, sanitizeStories(state.stories))).catch(() => {
        console.warn("[v0] Stories could not be saved; keeping the latest stories in memory")
      })
    }, 5000)
    return () => clearTimeout(timer)
  }, [sdk, state.ready, state.profile.onboarded, state.stories])


  // Phase 7: soft profile rehydrate when app returns to foreground
  useEffect(() => {
    if (!state.ready) return
    let last = 0
    const MIN_MS = 60_000
    const rehydrate = () => {
      const now = Date.now()
      if (now - last < MIN_MS) return
      last = now
      void (async () => {
        try {
          const result = await fetchServerProfile()
          if (!result.ok || !result.profile) return
          if (!(result.durable && result.exists)) return
          setState((s) => {
            const server = result.profile as Partial<Profile>
            const photos = mergePhotos(s.profile.photos, server.photos)
            const coverPhoto = mergeCover(s.profile.coverPhoto, server.coverPhoto)
            return {
              ...s,
              profile: {
                ...s.profile,
                ...server,
                id: (server.id as string) || s.profile.id,
                photos,
                coverPhoto,
                onboarded: Boolean(server.onboarded ?? s.profile.onboarded),
              },
            }
          })
        } catch {
          /* offline */
        }
      })()
    }
    const onVis = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") rehydrate()
    }
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVis)
    }
    if (typeof window !== "undefined") {
      window.addEventListener("focus", rehydrate)
    }
    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVis)
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", rehydrate)
      }
    }
  }, [state.ready])

  // Cross-device profile hydrate — server is authoritative when durable row exists.
  // Must run after Pi/server session is ready; early calls before auth return empty.
  useEffect(() => {
    let cancelled = false
    const hydrateFromServer = async () => {
      try {
        const uid = IdentityService.getCurrentUserId?.() || state.profile?.id
        if (!uid || uid === "current-user") return
        const result = await fetchServerProfile()
        if (cancelled || !result.ok || !result.profile) return
        setState((s) => {
          const server = result.profile as Partial<Profile>
          // Durable https media from server wins; empty server must not wipe local data: previews.
          const durable = result.durable && result.exists
          const photos = mergePhotos(s.profile.photos, server.photos)
          const coverPhoto = mergeCover(s.profile.coverPhoto, server.coverPhoto)
          const onboarded = durable
            ? Boolean(server.onboarded)
            : Boolean(server.onboarded) || Boolean(s.profile.onboarded)
          return {
            ...s,
            profile: {
              ...s.profile,
              ...server,
              id: (server.id as string) || s.profile.id,
              photos,
              coverPhoto,
              onboarded,
            },
          }
        })
      } catch {
        /* offline */
      }
    }
    void hydrateFromServer()
    const onPiReady = () => {
      void hydrateFromServer()
    }
    if (typeof window !== "undefined") {
      window.addEventListener("ghc:pi-identity-ready", onPiReady as EventListener)
    }
    return () => {
      cancelled = true
      if (typeof window !== "undefined") {
        window.removeEventListener("ghc:pi-identity-ready", onPiReady as EventListener)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate on profile id + after Pi identity ready
  }, [state.profile?.id])

  // Domain state and services are initialized before callbacks that depend on them.
  const getDomainState = useCallback(() => ({
    profile: state.profile,
    posts: state.posts,
    stories: state.stories || [],
    following: state.following || [],
    followers: state.followers || [],
    blockedUsers: Array.from(
      new Set([...(state.settings?.blockedUsers || []), ...(state.blockedUsers || [])])
    ),
    mutedUsers: state.mutedUsers || state.settings?.mutedUsers || [],
    restrictedUsers: state.restrictedUsers || state.settings?.restrictedUsers || [],
    matches: state.matches || [],
    likes: state.likes || [],
    friends: state.friends || [],
    outgoingFriendRequestIds: (state.friendRequests || [])
      .filter((r: any) => {
        const me = String(state.profile?.id || IdentityService.getCurrentUserId() || "").trim()
        const from = String(r.fromUserId || "")
        return from === me || from === "current-user"
      })
      .map((r: any) => r.toUserId)
      .filter(Boolean),
    incomingFriendRequestIds: (state.friendRequests || [])
      .filter((r: any) => {
        const me = String(state.profile?.id || IdentityService.getCurrentUserId() || "").trim()
        const to = String(r.toUserId || "")
        const from = String(r.fromUserId || "")
        // Incoming: addressed to me (or legacy rows without toUserId from others)
        if (to && me && to === me) return true
        if (!to && from && from !== me && from !== "current-user") return true
        return false
      })
      .map((r: any) => r.fromUserId)
      .filter((id: string) => {
        const me = String(state.profile?.id || IdentityService.getCurrentUserId() || "").trim()
        return id && id !== me && id !== "current-user"
      }),
    candidates: state.candidates || [],
    conversations: state.conversations || [],
  }), [state])

  const domains: DomainServices = useMemo(
    () =>
      createDomainServices(getDomainState, {
        currentUserId: IdentityService.getCurrentUserId(),
        onReportPersist: (report) => {
          try {
            // recordModerationReport is defined later in this component; invoked only on user action.
            recordModerationReport?.(report.targetType, report.targetId, report.reason)
          } catch { /* */ }
        },
        getConversations: () => getDomainState().conversations,
        setConversations: (updater) => {
          setState((s) => ({ ...s, conversations: updater(s.conversations || []) }))
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recordModerationReport is declared below; getDomainState is stable
    [getDomainState, identityUserId]
  )

  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    try {
      // UX-layer validation (compatibility); domain re-validates on mutate path
      if (updates.displayName && !validation.isValidName(updates.displayName)) {
        addToast("Invalid name format", "error")
        return
      }
      if (updates.bio && !validation.isValidBio(updates.bio)) {
        addToast("Bio must be between 10 and 500 characters", "error")
        return
      }
      if (updates.age && !validation.isValidAge(updates.age)) {
        addToast("Age must be between 18 and 120", "error")
        return
      }
      if (
        updates.displayName &&
        updates.bio &&
        spamDetection.isSpammyProfile(updates.bio, updates.displayName)
      ) {
        addToast("Your profile update was flagged as spam", "error")
        return
      }

      const sanitized: Partial<Profile> = sanitizeProfileMediaPartial({
        ...updates,
        displayName: updates.displayName ? sanitizeDisplayName(updates.displayName) : undefined,
        bio: updates.bio ? sanitizeText(updates.bio, 500) : undefined,
      } as Record<string, unknown>) as Partial<Profile>

      // Client keeps displayable media (incl. compact data:image). Server only gets durable URLs.
      const forServer = {
        ...sanitized,
        ...durableOnlyProfileMedia({
          photos: Array.isArray(sanitized.photos) ? (sanitized.photos as string[]) : undefined,
          coverPhoto:
            "coverPhoto" in sanitized
              ? ((sanitized.coverPhoto as string | null | undefined) ?? null)
              : undefined,
        }),
      } as Partial<Profile>

      const hasLocalOnlyMedia =
        (Array.isArray(sanitized.photos) &&
          (sanitized.photos as string[]).some((u) => String(u).startsWith("data:"))) ||
        (typeof sanitized.coverPhoto === "string" && String(sanitized.coverPhoto).startsWith("data:"))

      // Canonical Identity domain mutation — keep full client media in domain state
      const result = await domains.identity.updateProfile(sanitized)
      if (!result.ok) {
        addToast(result.error, "error")
        return
      }

      setState((s) => {
        const nextProfile = {
          ...s.profile,
          ...result.data,
          photos: mergePhotos(
            Array.isArray(sanitized.photos) ? sanitized.photos : result.data.photos,
            result.data.photos
          ),
          coverPhoto: mergeCover(
            "coverPhoto" in sanitized ? sanitized.coverPhoto : result.data.coverPhoto,
            result.data.coverPhoto
          ),
        }
        return { ...s, profile: nextProfile }
      })

      // Durable social profile (server). Never POST large data: URLs (API body limit ~65KB).
      if (!state.isOnline) {
        offlineQueue.addAction({
          type: "profile_update",
          payload: forServer,
          maxRetries: 3,
        })
        addToast(
          hasLocalOnlyMedia
            ? "Photo saved on this device — will sync when durable storage is ready"
            : "Profile queued for sync",
          "info"
        )
        return
      }

      try {
        const persisted = await persistServerProfile({ ...forServer })
        if (!persisted.ok) {
          offlineQueue.addAction({
            type: "profile_update",
            payload: forServer,
            maxRetries: 3,
          })
          addToast(
            hasLocalOnlyMedia
              ? "Photo shows on this device. Configure media storage so other devices can see it."
              : persisted.error ||
                  "Profile saved on this device — server not confirmed. Will retry.",
            "info"
          )
          // still persist local full profile
          try {
            const full = { ...result.data, ...sanitized }
            window.localStorage.setItem("ghc.profile", JSON.stringify(full))
          } catch { /* */ }
          return
        }
        // Merge durable server media back without wiping local data previews
        const persistedProfile = persisted.profile
        if (persistedProfile) {
          setState((s) => ({
            ...s,
            profile: {
              ...s.profile,
              ...persistedProfile,
              photos: mergePhotos(s.profile.photos, persistedProfile.photos),
              coverPhoto: mergeCover(s.profile.coverPhoto, persistedProfile.coverPhoto),
            },
          }))
        }
      } catch {
        offlineQueue.addAction({
          type: "profile_update",
          payload: forServer,
          maxRetries: 3,
        })
        addToast("Profile saved on this device — server not confirmed. Will retry.", "info")
        return
      }

      try {
        const fullLocal = {
          ...result.data,
          photos: mergePhotos(sanitized.photos ?? result.data.photos, result.data.photos),
          coverPhoto: mergeCover(
            "coverPhoto" in sanitized ? sanitized.coverPhoto : result.data.coverPhoto,
            result.data.coverPhoto
          ),
        }
        window.localStorage.setItem("ghc.profile", JSON.stringify(fullLocal))
        const { stampLocalOnboardingComplete, isStrongCompletedProfileShape } = await import("@/lib/onboarding-local")
        if (isStrongCompletedProfileShape(result.data as never) || (result.data as { onboarded?: boolean }).onboarded) {
          stampLocalOnboardingComplete({
            userId: (result.data as { id?: string }).id || null,
            username:
              (result.data as { username?: string }).username ||
              (result.data as { displayName?: string }).displayName ||
              null,
            altUserIds: [(result.data as { id?: string }).id].filter(Boolean) as string[],
          })
        }
      } catch {
        /* */
      }
      analytics.trackEvent("profile_update", { fields: Object.keys(updates) }, state.profile.displayName)
      addToast("Profile updated", "success")
    } catch (error) {
      errorLogger.logError(error instanceof Error ? error : new Error(String(error)))
      addToast("Failed to update profile", "error")
    }
  }, [addToast, domains.identity, state.isOnline, state.profile])

  const completeOnboarding = useCallback(async () => {
    try {
      const bound = getBoundDomainServices()
      const result = bound?.identity
        ? await bound.identity.completeOnboarding()
        : { ok: false as const, error: "Services not ready" }
      if (!result.ok) {
        addToast(("error" in result && result.error) || "Onboarding failed", "error")
        return
      }
      // Persist on server identity bridge (Pi-verified mapping).
      // Client state advances only after authoritative success (or local-dev fallback).
      let serverOk = false
      try {
        const headers = {
          "Content-Type": "application/json",
          ...IdentityService.getAuthHeaders(),
        }
        const res = await fetch("/api/auth/onboarding-complete", {
          method: "POST",
          headers,
          credentials: "include",
        })
        const body = await res.json().catch(() => ({}))
        serverOk = Boolean(res.ok && body?.ok && body?.identity?.onboardingCompleted === true)
        if (!serverOk) {
          console.warn("[completeOnboarding] server did not confirm", body?.error || res.status)
        }
      } catch (e) {
        console.warn("[completeOnboarding] network error", e)
      }

      const { allowLocalAuthFallback } = await import("@/lib/system-config")
      if (!serverOk && !allowLocalAuthFallback()) {
        addToast(
          "Could not save onboarding on the server. Please check your connection and try again.",
          "error"
        )
        return
      }

      IdentityService.setOnboardingCompleted()
      const profile = { ...state.profile, onboarded: true as const }
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem("ghc.profile", JSON.stringify(profile))
          const { stampLocalOnboardingComplete } = await import("@/lib/onboarding-local")
          stampLocalOnboardingComplete({
            userId: profile?.id || IdentityService.getCurrentUserId() || null,
            username: profile?.username || profile?.displayName || null,
            altUserIds: [
              profile?.id,
              IdentityService.getCurrentUserId(),
              (IdentityService as { getPiUid?: () => string | null }).getPiUid?.(),
            ].filter(Boolean) as string[],
          })
        }
      } catch {
        /* */
      }
      setState((s) => ({ ...s, profile: { ...s.profile, onboarded: true as const } }))
      // Await durable social profile so reload/login restores name, photos, fields
      try {
        await persistServerProfile({ ...profile, onboarded: true })
      } catch {
        /* offline — local cache still holds this session */
      }
    } catch (error) {
      errorLogger.logError(error instanceof Error ? error : new Error(String(error)))
      addToast("Onboarding could not be completed. Please try again.", "error")
    }
  }, [addToast, state.profile])

  const switchLocalProfile = useCallback((localId: string) => {
    const profile = findLocalProfile(localId)
    if (!profile) return
    setActiveLocalProfileId(localId)
    const otherLocals = readLocalProfiles()
      .filter((item) => item.localId !== localId)
      .map(profileToLocalCandidate)
    setState((current) => ({
      ...current,
      profile,
      candidates: [
        ...current.candidates.filter(
          (candidate) => !candidate.id.startsWith("local-") && candidate.id !== localId
        ),
        ...otherLocals,
      ],
    }))
  }, [])

  const createLocalProfile = useCallback((profile: Partial<Profile>) => {
    // Identity domain builds the record; local-profiles API persists it
    const next = domains.identity.buildLocalProfile(profile)
    setActiveLocalProfileId(next.localId)
    writeLocalProfile(next)
    setState((current) => ({
      ...current,
      profile: next,
      candidates: [
        ...current.candidates.filter((candidate) => !candidate.id.startsWith("local-")),
        ...readLocalProfiles()
          .filter((item) => item.localId !== next.localId)
          .map(profileToLocalCandidate),
      ],
    }))
  }, [domains.identity])

  const createPost = useCallback(async (
    content: string,
    images: string[],
    video: string | null,
    pdf: string | null,
    pdfName: string | null,
    audience: "public" | "followers" | "mutuals" | "private" = "public",
    community?: { id: string; name: string } | null,
  ): Promise<boolean> => {
    try {
      // Rate limit check
      if (!postLimiter.isAllowed(`post_${state.profile.displayName}`)) {
        addToast("Too many posts. Please wait before posting again.", "error")
        return false
      }

      const safeContent = typeof content === "string" ? content : ""
      // Spam detection must receive a guaranteed string, even if an older caller sends nullish data.
      if (spamDetection.detectSpamText(safeContent)) {
        addToast("Your post was flagged as spam. Please review it.", "error")
        return false
      }

      const safeImages = Array.isArray(images) ? images.filter((image): image is string => typeof image === "string") : []
      const safeVideo = typeof video === "string" ? video : null
      const safePdf = typeof pdf === "string" ? pdf : null
      const safePdfName = typeof pdfName === "string" ? pdfName : null
      const visibility =
        audience === "followers" || audience === "mutuals" || audience === "private"
          ? audience
          : "public"
      // Validation: text-only posts still require text; media posts may omit it.
      const hasMedia = safeImages.length > 0 || Boolean(safeVideo) || Boolean(safePdf)
      if ((!safeContent.trim() && !hasMedia) || safeContent.length > 5000) {
        addToast("Add text, a photo, or a video before posting", "error")
        return false
      }

      // Sanitize content (XSS prevention); always normalize to a string for feed renderers.
      const sanitizedContent = String(sanitizeText(safeContent, 5000) || "")

      // Canonical domain path (validate → audience → event)
      const domainResult = await domains.posts.createPost({
        content: sanitizedContent,
        images: safeImages,
        video: safeVideo,
        pdf: safePdf,
        pdfName: safePdfName,
        visibility,
        communityId: community?.id,
        communityName: community?.name,
      })
      if (!domainResult.ok) {
        addToast(domainResult.error || "Failed to create post", "error")
        return false
      }
      const newPost = domainResult.data

      // Durable write first when online — no cross-account "published" without server
      let durableStatus: "ok" | "local" | "unconfirmed" = "local"
      let publishedPost = newPost
      if (state.isOnline) {
        try {
          const { socialCreatePost } = await import("@/lib/social/client")
          const remote = await socialCreatePost({
            id: newPost.id,
            content: newPost.content,
            images: newPost.images,
            video: newPost.video,
            pdf: newPost.pdf,
            pdfName: newPost.pdfName,
            visibility: newPost.visibility || visibility,
            authorName: newPost.authorName,
            authorPhoto: newPost.authorPhoto,
            communityId: newPost.communityId,
            communityName: newPost.communityName,
            contentType: newPost.contentType,
            listingId: newPost.listingId,
            listingKind: newPost.listingKind,
          })
          if (!remote.ok || remote.durable === false) {
            addToast(
              remote.error || "Could not publish post to the server. Try again.",
              "error"
            )
            return false
          }
          durableStatus = "ok"
          if (remote.post?.id) {
            publishedPost = { ...newPost, id: String(remote.post.id) }
          }
        } catch {
          addToast("Could not reach the server to publish this post", "error")
          return false
        }
      } else {
        offlineQueue.addAction({
          type: "create_post",
          payload: newPost,
          maxRetries: 3,
        })
        setState((s) => ({ ...s, posts: [newPost, ...s.posts] }))
        addToast("Post queued - will upload when online", "info")
        return true
      }

      setState((s) => ({ ...s, posts: [publishedPost, ...s.posts] }))

      // Track analytics
      analytics.trackEvent(
        "post_created",
        { postId: publishedPost.id, visibility },
        state.profile.displayName,
      )

      // Notification
      notificationSystem.addNotification("share", "Posted", "Your post is live on Feed", "✓", { open: "feed", section: "post" })
      if (durableStatus === "ok") {
        addToast("Post published", "success")
        try {
          const { reportMissionProgress } = await import("@/lib/missions/progress")
          const m = await reportMissionProgress("first_post", { postId: publishedPost.id })
          if (m.ok && m.grantedGhc && m.grantedGhc > 0) {
            addToast(m.message || `Mission · ₲ ${m.grantedGhc}`, "success")
          }
        } catch { /* */ }
        // Phase 2: revalidate feed so other sessions/devices converge faster
        try {
          const { socialFetchFeed } = await import("@/lib/social/client")
          const feed = await socialFetchFeed({ limit: 40 })
          if (feed.ok && Array.isArray(feed.posts) && feed.posts.length > 0) {
            const remotePosts = mapRemoteFeedPosts(feed.posts)
            setState((s) => {
              const remoteIds = new Set(remotePosts.map((p) => p.id))
              const localOnly = s.posts.filter((p) => !remoteIds.has(p.id) && !p.deletedAt)
              return {
                ...s,
                posts: [...remotePosts, ...localOnly].sort(
                  (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
                ),
              }
            })
          }
        } catch {
          /* non-fatal */
        }
      } else {
        // Online path already fail-closed above; offline returns early with queue toast.
        addToast("Post published", "success")
      }
      return true
    } catch (error) {
      errorLogger.logError(error instanceof Error ? error : new Error(String(error)))
      addToast("Failed to create post", "error")
      return false
    }
  }, [addToast, domains.posts, state.isOnline, state.profile])

  /** Durable multi-reaction (like, love, support, …). Server is authority when configured. */
  const reactToPost = useCallback(async (postId: string, reaction: string = "like") => {
    const isLike = reaction === "like" || !reaction
    const normalized = (reaction || "like").trim() || "like"
    try {
      // Server-first: other accounts only see reactions that hit durable storage.
      const { socialToggleReaction } = await import("@/lib/social/client")
      const remote = await socialToggleReaction(postId, normalized)
      if (!remote.ok || remote.durable === false) {
        addToast(remote.error || "Could not update reaction", "error")
        emitSocialMutation({
          kind: "reaction",
          durable: false,
          postId,
          error: remote.error || "NOT_DURABLE",
        })
        return
      }

      const active =
        remote.active !== undefined
          ? Boolean(remote.active)
          : remote.liked !== false

      setState((s) => {
        let nextLikedPostIds = s.likedPostIds || []
        let nextLikes = s.likes || []
        if (isLike) {
          if (active) {
            if (!nextLikedPostIds.includes(postId)) {
              nextLikedPostIds = [...nextLikedPostIds, postId]
            }
            const hasLike = nextLikes.some(
              (like) =>
                like.toUserId === postId &&
                (like.fromUserId === "current-user" ||
                  like.fromUserId === IdentityService.getCurrentUserId())
            )
            if (!hasLike) {
              nextLikes = [
                ...nextLikes,
                {
                  id: generateId(),
                  fromUserId: IdentityService.getCurrentUserId() || "current-user",
                  toUserId: postId,
                  createdAt: Date.now(),
                },
              ]
            }
          } else {
            nextLikedPostIds = nextLikedPostIds.filter((id) => id !== postId)
            nextLikes = nextLikes.filter((like) => like.toUserId !== postId)
          }
        }
        return {
          ...s,
          likes: nextLikes,
          likedPostIds: nextLikedPostIds,
          posts: s.posts.map((post) => {
            if (post.id !== postId) return post
            const next = { ...post }
            if (typeof remote.likeCount === "number" && Number.isFinite(remote.likeCount)) {
              next.likes = Math.max(0, remote.likeCount)
              next.engagement = normalizeEngagementMetrics(post.engagement, {
                likes: Math.max(0, remote.likeCount),
              })
            } else if (isLike) {
              // Fallback when server omits count: nudge by active state vs previous
              const wasLiked = (s.likedPostIds || []).includes(postId)
              if (active && !wasLiked) next.likes = Math.max(0, (post.likes || 0) + 1)
              if (!active && wasLiked) next.likes = Math.max(0, (post.likes || 0) - 1)
            }
            if (remote.reactionCounts && typeof remote.reactionCounts === "object") {
              next.reactionCounts = remote.reactionCounts
            }
            if (Array.isArray(remote.viewerReactions)) {
              next.viewerReactions = remote.viewerReactions
            }
            return next
          }),
        }
      })

      emitSocialMutation({
        kind: "reaction",
        durable: true,
        postId,
      })
      try {
        window.dispatchEvent(
          new CustomEvent("ghc:social-mutation", {
            detail: {
              type: "reaction",
              postId,
              reaction: normalized,
              active,
              likeCount: remote.likeCount,
            },
          })
        )
      } catch {
        /* */
      }
      broadcastPostEngagement({
        postId,
        kind: "reaction",
        ...(typeof remote.likeCount === "number" ? { likeCount: remote.likeCount } : {}),
        reactionCounts: remote.reactionCounts,
        viewerReactions: remote.viewerReactions,
        likedByMe: isLike ? active : undefined,
      })
    } catch (err) {
      try {
        errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      } catch {
        /* */
      }
      addToast("Could not update reaction", "error")
    }
  }, [addToast])

  const likePost = useCallback(async (postId: string) => {
    return reactToPost(postId, "like")
  }, [reactToPost])


  // Migration foundation: non-React adapters can resolve active domain services
  useEffect(() => {
    bindDomainServices(domains)
    return () => bindDomainServices(null)
  }, [domains])

  // Canonical notifications: domain events → preference-aware delivery
  useEffect(() => {
    const stop = domains.notifications.startEventBridge()
    return () => {
      stop()
      domains.notifications.stopEventBridge()
    }
  }, [domains])

  // Economy reward engine: domain events → eligibility / ledger
  useEffect(() => {
    const stop = domains.economy.startRewardEventBridge()
    return () => {
      stop()
      domains.economy.stopRewardEventBridge()
    }
  }, [domains])

  // Reputation + Achievements bridges (separate from GHC)
  useEffect(() => {
    const stopRep = domains.reputation.startEventBridge()
    const stopAch = domains.achievements.startEventBridge()
    return () => {
      stopRep()
      stopAch()
      domains.reputation.stopEventBridge()
      domains.achievements.stopEventBridge()
    }
  }, [domains])

  // Keep social-graph-store edges aligned with session relationship cache
  useEffect(() => {
    if (!state.ready) return
    syncSessionEdgesToStore("current-user", {
      following: state.following || [],
      friends: state.friends || [],
      blockedUsers: Array.from(
        new Set([...(state.blockedUsers || []), ...(state.settings?.blockedUsers || [])])
      ),
      mutedUsers: state.mutedUsers || state.settings?.mutedUsers || [],
      restrictedUsers: state.restrictedUsers || state.settings?.restrictedUsers || [],
      matches: state.matches || [],
    })
  }, [
    state.ready,
    state.following,
    state.friends,
    state.blockedUsers,
    state.mutedUsers,
    state.restrictedUsers,
    state.matches,
    state.settings?.blockedUsers,
    state.settings?.mutedUsers,
    state.settings?.restrictedUsers,
  ])

  // Realtime: domain events → local cache reconcile + transport bridge
  useEffect(() => {
    const unsub = subscribeDomainCache((event) => {
      if (process.env.NODE_ENV !== "production") {
        console.debug("[domain-event]", event.type, event.payload)
      }
      // Apply remote/local domain events into React state (live UI)
      const p = (event.payload || {}) as Record<string, any>
      switch (event.type) {
        case "POST_CREATED":
          // Own creates already write state; remote posts arrive via transport
          if (p.post && event.actorId !== "current-user") {
            setState((s) => {
              if (s.posts.some((x) => x.id === p.post.id)) return s
              return { ...s, posts: [p.post as Post, ...s.posts] }
            })
          }
          break
        case "POST_DELETED":
          if (p.postId) {
            setState((s) => ({
              ...s,
              posts: s.posts.filter((x) => x.id !== p.postId),
            }))
          }
          break
        case "LIKE_ADDED":
        case "LIKE_REMOVED":
          if (p.postId) {
            setState((s) => ({
              ...s,
              posts: s.posts.map((post) =>
                post.id === p.postId
                  ? {
                      ...post,
                      likes: Math.max(
                        0,
                        (post.likes || 0) + (event.type === "LIKE_ADDED" ? 1 : -1),
                      ),
                    }
                  : post,
              ),
            }))
          }
          break
        case "COMMENT_CREATED":
          if (p.postId && p.comment) {
            setState((s) => ({
              ...s,
              posts: s.posts.map((post) =>
                post.id === p.postId
                  ? { ...post, comments: [...(post.comments || []), p.comment] }
                  : post,
              ),
            }))
          }
          break
        case "MESSAGE_CREATED":
          if (p.conversationId && p.message) {
            setState((s) => ({
              ...s,
              conversations: (s.conversations || []).map((c) => {
                if (c.id !== p.conversationId) return c
                const exists = (c.messages || []).some((m: any) => m.id === p.message.id)
                if (exists) return c
                return {
                  ...c,
                  messages: [...(c.messages || []), p.message],
                  lastMessage: p.message.text,
                  lastMessageTime: p.message.createdAt || Date.now(),
                  unread: event.actorId !== "current-user",
                }
              }),
            }))
          }
          break
        case "FOLLOW_CREATED":
          if (p.userId && event.actorId === "current-user") {
            setState((s) =>
              s.following.includes(p.userId)
                ? s
                : { ...s, following: [...s.following, p.userId] },
            )
          }
          break
        case "FOLLOW_REMOVED":
          if (p.userId) {
            setState((s) => ({
              ...s,
              following: s.following.filter((id) => id !== p.userId),
            }))
          }
          break
        case "BLOCK_CREATED":
          if (p.userId) {
            setState((s) => ({
              ...s,
              blockedUsers: s.blockedUsers.includes(p.userId)
                ? s.blockedUsers
                : [...s.blockedUsers, p.userId],
            }))
          }
          break
        default:
          break
      }
    })
    // Realtime: local bus always; WebSocket only when NEXT_PUBLIC_GH_REALTIME_URL is set
    // (never invent /realtime on the API host — that is not a real service).
    try {
      const { bootstrapRealtimeTransport } = require("@/lib/realtime/transport-bridge")
      bootstrapRealtimeTransport()
    } catch {
      try {
        transportBridge.startLocal()
      } catch {
        /* */
      }
    }
    try {
      const { presenceStore } = require("@/lib/realtime/presence")
      const { IdentityService } = require("@/lib/identity/identity-service")
      const uid = IdentityService.getCurrentUserId?.() || "current-user"
      presenceStore.setSelf(uid)
      presenceStore.startHeartbeat(30_000)
    } catch {
      /* optional */
    }
    // After reconnect / online: refresh messaging + wallet surfaces (no fake data)
    const onReconcile = () => {
      try {
        window.dispatchEvent(new CustomEvent("ghc:wallet-refresh"))
      } catch {
        /* */
      }
      try {
        window.dispatchEvent(new CustomEvent("ghc:messaging-reconcile"))
      } catch {
        /* */
      }
    }
    try {
      window.addEventListener("ghc:realtime-reconcile", onReconcile)
    } catch {
      /* */
    }
    return () => {
      unsub()
      try {
        window.removeEventListener("ghc:realtime-reconcile", onReconcile)
      } catch {
        /* */
      }
      try {
        const { presenceStore } = require("@/lib/realtime/presence")
        presenceStore.stopHeartbeat()
      } catch {
        /* */
      }
    }
  }, [])

  const deletePost = useCallback(async (postId: string) => {
    try {
      const previous = state.posts.find((p) => p.id === postId)
      const online = typeof navigator === "undefined" ? true : navigator.onLine !== false
      if (online) {
        try {
          const { socialDeletePost } = await import("@/lib/social/client")
          const remote = await socialDeletePost(postId)
          if (remote.ok === false || remote.durable === false) {
            addToast(remote.error || "Could not delete post on the server", "error")
            return
          }
        } catch {
          addToast("Could not reach the server to delete this post", "error")
          return
        }
      }
      const result = await domains.posts.deletePost(postId)
      if (!result.ok) {
        addToast(result.error, "error")
        return
      }
      const deleted = result.data.post
      setState((s) => ({
        ...s,
        posts: s.posts.map((p) => (p.id === postId ? { ...p, ...deleted } : p)),
      }))
      if (!online) {
        offlineQueue.addAction({
          type: "delete_post",
          payload: { id: postId },
          maxRetries: 3,
        })
        broadcastPostSync({ postId, operation: "delete", source: "post-delete-offline" })
        addToast("Delete queued — will sync when online", "info")
        return
      }
      broadcastPostSync({ postId, operation: "delete", source: "post-delete" })
      addToast("Post deleted", "success")
    } catch (err) {
      errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      addToast("Could not delete post", "error")
    }
  }, [addToast, domains.posts, state.posts])

  const pendingCommentRequestIdsRef = useRef(new Map<string, string>())

  const addComment = useCallback(async (
    postId: string,
    text: string,
    replyToCommentId?: string,
    mediaAttachments?: Array<{ id?: string; type: "image" | "video" | "file"; url: string; fileName?: string }>
  ) => {
    const normalizedText = sanitizeText(text, 500).trim()
    const safeMedia = (mediaAttachments || [])
      .filter((a) => a && a.url && !String(a.url).startsWith("blob:") && !String(a.url).startsWith("data:"))
      .slice(0, 4)
    if (!normalizedText && !safeMedia.length) {
      addToast("Comment cannot be empty", "error")
      return
    }
    try {
      if (replyToCommentId) {
        const post = state.posts.find((p) => p.id === postId)
        let parentExists = Boolean(post?.comments?.some((c) => c.id === replyToCommentId))
        if (!parentExists) {
          // Parent may only exist on server (cross-account thread)
          try {
            const { socialListComments } = await import("@/lib/social/client")
            const remoteThread = await socialListComments(postId, { limit: 80 })
            parentExists = (remoteThread.comments || []).some(
              (c) => String((c as { id?: string }).id || "") === replyToCommentId
            )
            if (!parentExists && remoteThread.durable) {
              addToast("Original comment was removed", "error")
              return
            }
          } catch {
            /* allow server to validate on write */
          }
        }
      }

      // Server-first: other accounts only see comments that hit durable storage.
      const { socialAddComment } = await import("@/lib/social/client")
      const profile = state.profile
      const requestText = normalizedText || (safeMedia[0]?.type === "video" ? "🎥 Video" : "📷 Photo")
      const requestKey = `${postId}|${replyToCommentId || ""}|${requestText}|${safeMedia.map((item) => `${item.id || ""}:${item.url}`).join(",")}`
      let requestId = pendingCommentRequestIdsRef.current.get(requestKey)
      if (!requestId) {
        requestId = generateId()
        pendingCommentRequestIdsRef.current.set(requestKey, requestId)
        if (pendingCommentRequestIdsRef.current.size > 100) {
          const oldest = pendingCommentRequestIdsRef.current.keys().next().value
          if (oldest) pendingCommentRequestIdsRef.current.delete(oldest)
        }
      }
      const remote = await socialAddComment(postId, {
        id: requestId,
        text: requestText,
        authorName: profile?.displayName || profile?.username || "Member",
        authorPhoto: profile?.photos?.[0] || "",
        parentId: replyToCommentId,
        mediaAttachments: safeMedia.length ? safeMedia : undefined,
      })

      if (!remote.ok) {
        addToast(
          remote.error ||
            (replyToCommentId ? "Could not post reply" : "Could not post comment"),
          "error"
        )
        return
      }
      if (remote.durable === false) {
        addToast(
          replyToCommentId
            ? "Reply not visible to others yet — server not durable"
            : "Comment not visible to others yet — server not durable",
          "error"
        )
        return
      }

      pendingCommentRequestIdsRef.current.delete(requestKey)
      const remoteComment = remote.comment || {}
      const newComment = {
        id: String(remoteComment.id || `cmt_${Date.now().toString(36)}`),
        authorId: String(
          (remoteComment as { authorId?: string }).authorId ||
            profile?.id ||
            IdentityService.getCurrentUserId() ||
            ""
        ),
        authorName: String(
          (remoteComment as { authorName?: string }).authorName ||
            profile?.displayName ||
            "Member"
        ),
        authorPhoto: String(
          (remoteComment as { authorPhoto?: string }).authorPhoto ||
            profile?.photos?.[0] ||
            ""
        ),
        text: String((remoteComment as { text?: string }).text || normalizedText),
        mediaAttachments: Array.isArray((remoteComment as { mediaAttachments?: unknown }).mediaAttachments)
          ? (remoteComment as { mediaAttachments: Array<{ id: string; type: "image" | "video" | "file"; url: string; fileName?: string }> }).mediaAttachments
          : safeMedia.length
            ? safeMedia.map((a, i) => ({
                id: String(a.id || `catt_${i}`),
                type: a.type,
                url: a.url,
                fileName: a.fileName,
              }))
            : undefined,
        createdAt: Number((remoteComment as { createdAt?: number }).createdAt) || Date.now(),
        replyTo:
          replyToCommentId ||
          (remoteComment as { parentId?: string; replyTo?: string }).parentId ||
          (remoteComment as { replyTo?: string }).replyTo,
        replies: [] as [],
        reactions: {},
        reactionCounts: remoteComment.reactionCounts && typeof remoteComment.reactionCounts === "object"
          ? remoteComment.reactionCounts as Record<string, number> : {},
        viewerReactions: Array.isArray(remoteComment.viewerReactions) ? remoteComment.viewerReactions.map(String) : [],
      }

      setState((s) => ({
        ...s,
        posts: s.posts.map((post) => {
          if (post.id !== postId) return post
          const existing = Array.isArray(post.comments) ? post.comments : []
          if (existing.some((c) => c.id === newComment.id)) return post
          const currentCommentCount = Math.max(
            Number(post.engagement?.comments ?? existing.length) || 0,
            existing.length,
          )
          const nextComments = [
            ...existing,
            {
              ...newComment,
              replyTo: replyToCommentId || newComment.replyTo,
              replies: [],
            },
          ]
          return {
            ...post,
            comments: nextComments,
            // Feed hydration only loads a preview. Preserve the known durable
            // total instead of replacing it with the number loaded on device.
            engagement: normalizeEngagementMetrics(post.engagement, {
              comments: Number.isFinite(remote.commentCount)
                ? Math.max(0, Number(remote.commentCount))
                : currentCommentCount + (remote.idempotent ? 0 : 1),
            }),
          }
        }),
      }))
      const postBeforeComment = state.posts.find((p) => p.id === postId)
      const countBeforeComment = Math.max(
        Number(postBeforeComment?.engagement?.comments ?? 0) || 0,
        postBeforeComment?.comments?.length ?? 0,
      )
      broadcastPostEngagement({
        postId,
        kind: "comment",
        commentDelta: remote.idempotent ? 0 : 1,
        commentCount: Number.isFinite(remote.commentCount)
          ? Math.max(0, Number(remote.commentCount))
          : countBeforeComment + (remote.idempotent ? 0 : 1),
      })
      try {
        window.dispatchEvent(
          new CustomEvent("ghc:social-mutation", {
            detail: { type: "comment", postId, commentId: newComment.id },
          })
        )
      } catch {
        /* */
      }
      // Reconcile thread from server so ids/order match other accounts
      try {
        const { socialListComments } = await import("@/lib/social/client")
        const thread = await socialListComments(postId, { limit: 80 })
        if (thread.ok && Array.isArray(thread.comments) && thread.comments.length > 0) {
          const mapped = thread.comments.map((c) => ({
            id: String((c as { id?: string }).id || ""),
            authorId: String((c as { authorId?: string }).authorId || ""),
            authorName: String((c as { authorName?: string }).authorName || "Member"),
            authorPhoto: String((c as { authorPhoto?: string }).authorPhoto || ""),
            text: String((c as { text?: string }).text || ""),
            createdAt: Number((c as { createdAt?: number }).createdAt) || Date.now(),
            replyTo: (c as { parentId?: string; replyTo?: string }).parentId || (c as { replyTo?: string }).replyTo,
            replies: [] as [],
            reactions: {},
            reactionCounts: c.reactionCounts && typeof c.reactionCounts === "object"
              ? c.reactionCounts as Record<string, number> : {},
            viewerReactions: Array.isArray(c.viewerReactions) ? c.viewerReactions.map(String) : [],
            isPinned: Boolean(c.isPinned),
            isEdited: Boolean(c.isEdited),
            editedAt: Number(c.editedAt) || undefined,
            mediaAttachments: Array.isArray((c as { mediaAttachments?: unknown }).mediaAttachments)
              ? (c as { mediaAttachments: unknown[] }).mediaAttachments
              : undefined,
          })).filter((c) => c.id)
          setState((s) => ({
            ...s,
            posts: s.posts.map((post) => {
              if (post.id !== postId) return post
              return {
                ...post,
                comments: mapped as typeof post.comments,
                engagement: normalizeEngagementMetrics(post.engagement, {
                  // Reconciliation is capped at 80 comments; keep the larger
                  // known total rather than treating the loaded page as total.
                  comments: Math.max(
                    Number.isFinite(remote.commentCount) ? Math.max(0, Number(remote.commentCount)) : 0,
                    Number(post.engagement?.comments ?? 0) || 0,
                    post.comments?.length ?? 0,
                    mapped.length,
                  ),
                }),
              }
            }),
          }))
          broadcastPostEngagement({
            postId,
            kind: "comment",
            commentCount: Math.max(
              Number.isFinite(remote.commentCount) ? Math.max(0, Number(remote.commentCount)) : 0,
              countBeforeComment + (remote.idempotent ? 0 : 1),
              mapped.length,
            ),
          })
        }
      } catch { /* non-fatal */ }
      addToast(replyToCommentId ? "Reply posted" : "Comment posted", "success")
      if (!replyToCommentId && !remote.idempotent) {
        try {
          const { reportMissionProgress } = await import("@/lib/missions/progress")
          const m = await reportMissionProgress("first_comment", { postId })
          if (m.ok && m.completed && !m.alreadyCompleted && typeof m.grantedGhc === "number" && m.grantedGhc > 0) {
            addToast(`Mission reward · ₲ ${m.grantedGhc.toFixed(2)}`, "success")
          }
        } catch { /* optional */ }
      }
    } catch (err) {
      try {
        errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      } catch {
        /* logger must never block UX */
      }
      addToast("Could not post comment", "error")
    }
  }, [addToast, state.profile, state.posts])



  useEffect(() => {
    const onEngagement = (ev: Event) => {
      const detail = (ev as CustomEvent<{
        postId?: string
        upvoteCount?: number
        downvoteCount?: number
        commentDelta?: number
        commentCount?: number
        likeCount?: number
        likedByMe?: boolean
        reactionCounts?: Record<string, number>
        viewerReactions?: string[]
        shareCount?: number
      }>).detail
      if (!detail?.postId) return
      const postId = String(detail.postId)
      setState((s) => {
        let nextLiked = s.likedPostIds || []
        if (typeof detail.likedByMe === "boolean") {
          if (detail.likedByMe && !nextLiked.includes(postId)) {
            nextLiked = [...nextLiked, postId]
          } else if (!detail.likedByMe) {
            nextLiked = nextLiked.filter((id) => id !== postId)
          }
        }
        return {
          ...s,
          likedPostIds: nextLiked,
          posts: s.posts.map((post) => {
            if (post.id !== postId) return post
            const next = { ...post } as typeof post
            if (typeof detail.upvoteCount === "number" && Number.isFinite(detail.upvoteCount)) {
              ;(next as { upvoteCount?: number }).upvoteCount = Math.max(0, detail.upvoteCount)
            }
            if (typeof detail.downvoteCount === "number" && Number.isFinite(detail.downvoteCount)) {
              ;(next as { downvoteCount?: number }).downvoteCount = Math.max(0, detail.downvoteCount)
            }
            if (typeof detail.likeCount === "number" && Number.isFinite(detail.likeCount)) {
              next.likes = Math.max(0, detail.likeCount)
              next.engagement = normalizeEngagementMetrics(post.engagement, {
                likes: Math.max(0, detail.likeCount),
              })
            }
            if (detail.reactionCounts && typeof detail.reactionCounts === "object") {
              next.reactionCounts = detail.reactionCounts
            }
            if (Array.isArray(detail.viewerReactions)) {
              next.viewerReactions = detail.viewerReactions
            }
            if (typeof detail.shareCount === "number" && Number.isFinite(detail.shareCount)) {
              next.shares = Math.max(0, detail.shareCount)
              next.engagement = normalizeEngagementMetrics(next.engagement || post.engagement, { shares: Math.max(0, detail.shareCount) })
            }
            if (typeof detail.commentCount === "number" && Number.isFinite(detail.commentCount)) {
              next.engagement = normalizeEngagementMetrics(next.engagement || post.engagement, {
                comments: Math.max(0, detail.commentCount),
              })
            } else if (typeof detail.commentDelta === "number" && detail.commentDelta) {
              const base = Array.isArray(post.comments)
                ? post.comments.length
                : Number(post.engagement?.comments ?? 0)
              next.engagement = normalizeEngagementMetrics(next.engagement || post.engagement, {
                comments: Math.max(0, base + detail.commentDelta),
              })
            }
            return next
          }),
        }
      })
    }
    window.addEventListener(POST_ENGAGEMENT_EVENT, onEngagement as EventListener)
    return () => window.removeEventListener(POST_ENGAGEMENT_EVENT, onEngagement as EventListener)
  }, [])


  /** Phase 3: hydrate comments from durable API into the shared posts array (feed + profile). */
  const loadPostComments = useCallback(async (postId: string) => {
    const id = String(postId || "").trim()
    if (!id) return { ok: false as const, count: 0 }
    try {
      const { socialListComments } = await import("@/lib/social/client")
      const remote = await socialListComments(id, { limit: 80 })
      if (!remote.ok || !Array.isArray(remote.comments)) {
        return { ok: false as const, count: 0, error: remote.error }
      }
      const mapped = remote.comments.map((c) => ({
        id: String(c.id || ""),
        authorId: String((c as { authorId?: string }).authorId || ""),
        authorName: String((c as { authorName?: string }).authorName || "Member"),
        authorPhoto: String((c as { authorPhoto?: string }).authorPhoto || ""),
        text: String((c as { text?: string }).text || ""),
        mediaAttachments: Array.isArray((c as { mediaAttachments?: unknown }).mediaAttachments)
          ? ((c as { mediaAttachments: Array<{ id: string; type: "image" | "video" | "file"; url: string; fileName?: string }> }).mediaAttachments)
          : undefined,
        createdAt: Number((c as { createdAt?: number }).createdAt) || Date.now(),
        replyTo: (c as { parentId?: string; replyTo?: string }).parentId
          || (c as { replyTo?: string }).replyTo
          || undefined,
        replies: [] as [],
        isEdited: Boolean(c.isEdited),
        editedAt: Number(c.editedAt) || undefined,
        isPinned: Boolean(c.isPinned),
        reactionCounts: c.reactionCounts && typeof c.reactionCounts === "object"
          ? c.reactionCounts as Record<string, number> : {},
        viewerReactions: Array.isArray(c.viewerReactions) ? c.viewerReactions.map(String) : [],
      })).filter((c) => c.id)
      if (mapped.length === 0 && !remote.durable) {
        return { ok: true as const, count: 0, durable: false }
      }
      const knownPost = postsSnapshotRef.current.find((post) => post.id === id)
      const knownCommentCount = Math.max(
        Number(knownPost?.engagement?.comments ?? 0) || 0,
        knownPost?.comments?.length ?? 0,
        mapped.length,
      )
      setState((s) => ({
        ...s,
        posts: s.posts.map((post) => {
          if (post.id !== id) return post
          // Durable server list is authoritative for cross-account visibility.
          // When durable, prefer mapped; only keep local rows missing from server if not durable.
          const byId = new Map<string, (typeof mapped)[0]>()
          for (const c of mapped) byId.set(c.id, c)
          if (!remote.durable) {
            for (const c of post.comments || []) {
              if (!byId.has(c.id)) byId.set(c.id, c as (typeof mapped)[0])
            }
          }
          const nextComments = Array.from(byId.values()).sort(
            (a, b) => (a.createdAt || 0) - (b.createdAt || 0)
          )
          return {
            ...post,
            comments: nextComments as typeof post.comments,
            engagement: normalizeEngagementMetrics(post.engagement, {
              comments: Math.max(Number(post.engagement?.comments ?? 0) || 0, nextComments.length),
            }),
          }
        }),
      }))
      broadcastPostEngagement({
        postId: id,
        kind: "comment",
        commentCount: knownCommentCount,
      })
      return { ok: true as const, count: mapped.length, durable: Boolean(remote.durable) }
    } catch (e) {
      return { ok: false as const, count: 0, error: e instanceof Error ? e.message : "load_failed" }
    }
  }, [])

  const editPost = useCallback(async (
    postId: string,
    newContent: string,
    media?: { images?: string[]; video?: string | null }
  ) => {
    try {
      const result = await domains.posts.editPost(postId, newContent, media)
      if (!result.ok) {
        addToast(result.error, "error")
        return
      }
      setState((s) => ({
        ...s,
        posts: s.posts.map((post) =>
          post.id === postId
            ? {
                ...post,
                content: result.data.content,
                ...(result.data.media
                  ? {
                      images: result.data.media.images ?? post.images,
                      video: result.data.media.video !== undefined ? result.data.media.video : post.video,
                    }
                  : {}),
                isDraft: false,
                isEdited: true,
                editedAt: Date.now(),
              }
            : post
        ),
      }))
      try {
        const { socialEditPost } = await import("@/lib/social/client")
        const durable = await socialEditPost(postId, result.data.content, result.data.media)
        if (durable && durable.ok === false) {
          addToast(
            durable.error || "Could not save post edit on the server",
            "error"
          )
          return
        }
        if (durable?.durable === false) {
          addToast("Could not save post edit on the server", "error")
          return
        }
        addToast("Post updated", "success")
        try {
          const { broadcastPostEngagement } = await import("@/lib/engagement/post-engagement")
          broadcastPostEngagement({ postId, kind: "edit" })
          broadcastPostSync({ postId, operation: "edit", patch: { content: result.data.content, ...(result.data.media || {}) }, source: "post-edit" })
        } catch {
          /* */
        }
      } catch {
        addToast("Could not save post edit on the server", "error")
      }
    } catch (err) {
      errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      addToast("Could not update post", "error")
    }
  }, [addToast, domains])

  const archivePost = useCallback(async (postId: string) => {
    const post = state.posts.find((p) => p.id === postId)
    if (!post) {
      addToast("Post not found", "error")
      return
    }
    // Optimistic local archive; reconcile with server when durable
    setState((s) => ({
      ...s,
      posts: s.posts.map((p) =>
        p.id === postId ? { ...p, isArchived: true, archivedAt: Date.now() } : p
      ),
    }))
    try {
      const res = await fetch(`/api/social/posts/${encodeURIComponent(postId)}/archive`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...IdentityService.getAuthHeaders(),
        },
        body: JSON.stringify({ archived: true }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        durable?: boolean
        error?: string
      }
      if (!res.ok || data.ok === false || data.durable === false) {
        setState((s) => ({
          ...s,
          posts: s.posts.map((p) =>
            p.id === postId ? { ...p, isArchived: false, archivedAt: undefined } : p
          ),
        }))
        addToast(data.error || "Could not archive post on the server", "error")
        return
      }
      broadcastPostSync({ postId, operation: "archive", patch: { isArchived: true, archivedAt: Date.now() }, source: "post-archive" })
      addToast("Post archived", "success")
    } catch {
      setState((s) => ({
        ...s,
        posts: s.posts.map((p) =>
          p.id === postId ? { ...p, isArchived: false, archivedAt: undefined } : p
        ),
      }))
      addToast("Could not reach the server to archive this post", "error")
    }
  }, [addToast, state.posts])

  const unarchivePost = useCallback(async (postId: string) => {
    const post = state.posts.find((p) => p.id === postId)
    if (!post) {
      addToast("Post not found", "error")
      return
    }
    setState((s) => ({
      ...s,
      posts: s.posts.map((p) =>
        p.id === postId ? { ...p, isArchived: false, archivedAt: undefined } : p
      ),
    }))
    try {
      const res = await fetch(`/api/social/posts/${encodeURIComponent(postId)}/archive`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...IdentityService.getAuthHeaders(),
        },
        body: JSON.stringify({ archived: false }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        durable?: boolean
        error?: string
      }
      if (!res.ok || data.ok === false || data.durable === false) {
        setState((s) => ({
          ...s,
          posts: s.posts.map((p) =>
            p.id === postId ? { ...p, isArchived: true, archivedAt: Date.now() } : p
          ),
        }))
        addToast(data.error || "Could not restore post on the server", "error")
        return
      }
      broadcastPostSync({ postId, operation: "restore", patch: { isArchived: false, archivedAt: undefined }, source: "post-restore" })
      addToast("Post restored", "success")
    } catch {
      setState((s) => ({
        ...s,
        posts: s.posts.map((p) =>
          p.id === postId ? { ...p, isArchived: true, archivedAt: Date.now() } : p
        ),
      }))
      addToast("Could not reach the server to restore this post", "error")
    }
  }, [addToast, state.posts])

  const editComment = useCallback(async (postId: string, commentId: string, newText: string) => {
    const normalized = (newText || "").trim()
    if (!normalized) {
      addToast("Comment cannot be empty", "error")
      return
    }
    try {
      const response = await fetch(`/api/social/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json", ...IdentityService.getAuthHeaders() },
        body: JSON.stringify({ text: normalized }),
      })
      const result = await response.json().catch(() => ({})) as { ok?: boolean; durable?: boolean; error?: string; text?: string; editedAt?: number }
      if (!response.ok || result.ok !== true || result.durable === false) {
        addToast(result.error || "Comment edit was not saved", "error")
        return
      }
      setState((s) => ({
        ...s,
        posts: s.posts.map((p) => p.id === postId ? {
          ...p,
          comments: p.comments.map((c) => c.id === commentId
            ? { ...c, text: result.text || normalized, isEdited: true, editedAt: Number(result.editedAt) || Date.now() }
            : c),
        } : p),
      }))
      addToast("Comment updated", "success")
    } catch (err) {
      errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      addToast("Could not edit comment", "error")
    }
  }, [addToast])

  const deleteComment = useCallback(async (postId: string, commentId: string) => {
    try {
      const response = await fetch(`/api/social/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`, {
        method: "DELETE", credentials: "include",
        headers: { Accept: "application/json", ...IdentityService.getAuthHeaders() },
      })
      const result = await response.json().catch(() => ({})) as { ok?: boolean; durable?: boolean; error?: string; commentCount?: number }
      if (!response.ok || result.ok !== true || result.durable === false) {
        addToast(result.error || "Comment delete was not saved", "error")
        return
      }
      setState((s) => ({
        ...s,
        posts: s.posts.map((p) => p.id !== postId ? p : {
          ...p,
          // Keep replies from other authors; the deleted parent becomes an orphan root.
          comments: p.comments.filter((c) => c.id !== commentId),
          engagement: normalizeEngagementMetrics(p.engagement, {
            comments: Number.isFinite(result.commentCount) ? Math.max(0, Number(result.commentCount)) : Math.max(0, (Number(p.engagement?.comments ?? p.comments.length) || 0) - 1),
          }),
        }),
      }))
      addToast("Comment deleted", "success")
    } catch (err) {
      errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      addToast("Could not delete comment", "error")
    }
  }, [addToast])

  const addCommentReaction = useCallback(async (postId: string, commentId: string, emoji: string) => {
    const em = String(emoji || "").trim().slice(0, 16)
    if (!em) return
    try {
      // Server-first so emoji reactions are visible across accounts
      const res = await fetch(
        `/api/social/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}/reactions`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...IdentityService.getAuthHeaders(),
          },
          body: JSON.stringify({ emoji: em }),
        }
      )
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        durable?: boolean
        error?: string
        counts?: Record<string, number>
        active?: boolean
      }
      if (!res.ok || body.ok === false) {
        addToast(body.error || "Could not save reaction", "error")
        return
      }
      if (body.durable === false) {
        addToast("Reaction not visible to others yet — server not durable", "error")
        return
      }
      // The API response is authoritative. Do not run a second local-domain
      // toggle after the database write; that could invert or double-count it.
      setState((s) => ({
        ...s,
        posts: s.posts.map((post) => post.id !== postId ? post : {
          ...post,
          comments: post.comments.map((c) => {
            if (c.id !== commentId) return c
            const viewerReactions = new Set(c.viewerReactions || [])
            if (body.active) viewerReactions.add(em)
            else viewerReactions.delete(em)
            return {
              ...c,
              reactionCounts: body.counts || c.reactionCounts || {},
              viewerReactions: Array.from(viewerReactions),
            }
          }),
        }),
      }))
      try {
        window.dispatchEvent(
          new CustomEvent("ghc:social-mutation", {
            detail: { type: "comment-reaction", postId, commentId, emoji: em },
          })
        )
      } catch {
        /* */
      }
    } catch (err) {
      errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      addToast("Could not react to comment", "error")
    }
  }, [addToast])


  const removeCommentReaction = useCallback(async (postId: string, commentId: string, emoji: string) => {
    // Removal is the same durable toggle as addition; never edit a local roster.
    await addCommentReaction(postId, commentId, emoji)
  }, [addCommentReaction])

  const pinComment = useCallback(async (postId: string, commentId: string) => {
    try {
      const response = await fetch(`/api/social/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json", ...IdentityService.getAuthHeaders() },
        body: JSON.stringify({ isPinned: true }),
      })
      const result = await response.json().catch(() => ({})) as { ok?: boolean; durable?: boolean; error?: string; isPinned?: boolean }
      if (!response.ok || result.ok !== true || result.durable === false) {
        addToast(result.error || "Comment pin was not saved", "error")
        return
      }
      setState((s) => ({ ...s, posts: s.posts.map((post) => post.id !== postId ? post : {
        ...post, comments: post.comments.map((c) => c.id === commentId ? { ...c, isPinned: Boolean(result.isPinned) } : c),
      }) }))
      addToast("Comment pinned", "success")
    } catch { addToast("Could not pin comment", "error") }
  }, [addToast])

  const unpinComment = useCallback(async (postId: string, commentId: string) => {
    try {
      const response = await fetch(`/api/social/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json", ...IdentityService.getAuthHeaders() },
        body: JSON.stringify({ isPinned: false }),
      })
      const result = await response.json().catch(() => ({})) as { ok?: boolean; durable?: boolean; error?: string; isPinned?: boolean }
      if (!response.ok || result.ok !== true || result.durable === false) {
        addToast(result.error || "Comment unpin was not saved", "error")
        return
      }
      setState((s) => ({ ...s, posts: s.posts.map((post) => post.id !== postId ? post : {
        ...post, comments: post.comments.map((c) => c.id === commentId ? { ...c, isPinned: Boolean(result.isPinned) } : c),
      }) }))
      addToast("Comment unpinned", "success")
    } catch { addToast("Could not unpin comment", "error") }
  }, [addToast])

  const createQuoteRepost = useCallback(async (originalPostId: string, quoteText: string) => {
    const originalPost = state.posts.find((p) => p.id === originalPostId)
    if (!originalPost) {
      addToast("Original post not found", "error")
      return
    }
    const text = (quoteText || "").trim()
    // Prefer durable createPost path with quote metadata (migration 56: quote_of_post_id)
    try {
      const { socialCreatePost } = await import("@/lib/social/client")
      const remote = await socialCreatePost({
        content: text || `Quoted @${originalPost.authorName}`,
        images: [],
        video: null,
        pdf: null,
        pdfName: null,
        visibility: "public",
        quoteOf: originalPostId,
      } as Parameters<typeof socialCreatePost>[0] & { quoteOf: string })
      if (remote.ok && remote.durable !== false && remote.post) {
        const durablePost = {
          id: String(remote.post.id || generateId()),
          authorId: IdentityService.getCurrentUserId() || "current-user",
          authorName: state.profile.displayName || "You",
          authorPhoto: state.profile.photos[0] || "/placeholder.svg?width=32&height=32",
          content: text || `Quoted @${originalPost.authorName}`,
          images: [] as string[],
          video: null as string | null,
          pdf: null as string | null,
          pdfName: null as string | null,
          likes: 0,
          comments: [] as Post["comments"],
          createdAt: Date.now(),
          quoteOf: originalPostId,
        } as Post
        setState((s) => ({ ...s, posts: [durablePost, ...s.posts] }))
        addToast("Quote repost published", "success")
        return
      }
      addToast(
        (remote as { error?: string }).error || "Could not publish quote on the server",
        "error"
      )
      return
    } catch {
      addToast("Could not reach the server to publish this quote", "error")
      return
    }
  }, [addToast, state.posts, state.profile])

  const sharePost = useCallback(async (
    postId: string,
    platform: "twitter" | "facebook" | "linkedin" | "copy" | "timeline" | "story" | "private" | "group" = "copy"
  ) => {
    // Durable share edge — await so callers can observe failure; external copy still independent
    try {
      const { socialSharePost } = await import("@/lib/social/client")
      await socialSharePost(postId)
    } catch {
      /* non-blocking for external platforms */
    }
    // Legacy external platforms still supported; internal shares use ShareService via ShareSheet
    const { ShareService } = await import("@/lib/share-service")
    const ctx = {
      currentUserId: IdentityService.getCurrentUserId(),
      blockedUsers: state.settings?.blockedUsers || state.blockedUsers || [],
      posts: state.posts,
      conversations: state.conversations,
    }
    if (platform === "copy" || platform === "twitter" || platform === "facebook" || platform === "linkedin") {
      const result = ShareService.copyPostLink(ctx, postId)
      if (!result.ok) {
        addToast(result.error, "error")
        return ""
      }
      setState((s) => ({ ...s, shares: [result.share, ...(s.shares || [])].slice(0, 200) }))
      addToast("Link copied", "success")
      return result.link || ""
    }
    return ""
  }, [addToast, state.settings, state.blockedUsers, state.posts, state.conversations])


  const savePost = useCallback(async (postId: string, collection?: string) => {
    setState((s) => ({
      ...s,
      posts: s.posts.map((post) =>
        post.id === postId
          ? { ...post, bookmarkedBy: [...(post.bookmarkedBy || []), s.profile.displayName] }
          : post
      ),
    }))
    try {
      const { socialToggleSave } = await import("@/lib/social/client")
      const remote = await socialToggleSave(postId)
      if (remote.ok === false) {
        setState((s) => ({
          ...s,
          posts: s.posts.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  bookmarkedBy: (post.bookmarkedBy || []).filter(
                    (name) => name !== s.profile.displayName
                  ),
                }
              : post
          ),
        }))
        addToast(remote.error || "Could not save post", "error")
        return
      }
      if (remote.durable === false) {
        setState((s) => ({
          ...s,
          posts: s.posts.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  bookmarkedBy: (post.bookmarkedBy || []).filter(
                    (name) => name !== s.profile.displayName
                  ),
                }
              : post
          ),
        }))
        addToast("Could not save post on the server", "error")
        return
      }
      addToast("Post saved", "success")
    } catch {
      setState((s) => ({
        ...s,
        posts: s.posts.map((post) =>
          post.id === postId
            ? {
                ...post,
                bookmarkedBy: (post.bookmarkedBy || []).filter(
                  (name) => name !== s.profile.displayName
                ),
              }
            : post
        ),
      }))
      addToast("Could not reach the server to save this post", "error")
    }
  }, [addToast])

  const unsavePost = useCallback(async (postId: string) => {
    const prevBookmarks = state.posts.find((p) => p.id === postId)?.bookmarkedBy
    setState((s) => ({
      ...s,
      posts: s.posts.map((post) =>
        post.id === postId
          ? {
              ...post,
              bookmarkedBy: (post.bookmarkedBy || []).filter((name) => name !== s.profile.displayName),
            }
          : post
      ),
    }))
    try {
      const { socialToggleSave } = await import("@/lib/social/client")
      const remote = await socialToggleSave(postId)
      if (remote.ok === false) {
        setState((s) => ({
          ...s,
          posts: s.posts.map((post) =>
            post.id === postId
              ? { ...post, bookmarkedBy: prevBookmarks || post.bookmarkedBy }
              : post
          ),
        }))
        addToast(remote.error || "Could not remove saved post", "error")
        return
      }
      if (remote.durable === false) {
        setState((s) => ({
          ...s,
          posts: s.posts.map((post) =>
            post.id === postId
              ? { ...post, bookmarkedBy: prevBookmarks || post.bookmarkedBy }
              : post
          ),
        }))
        addToast("Could not update saved posts on the server", "error")
        return
      }
      addToast("Post removed from saved", "success")
    } catch {
      setState((s) => ({
        ...s,
        posts: s.posts.map((post) =>
          post.id === postId
            ? { ...post, bookmarkedBy: prevBookmarks || post.bookmarkedBy }
            : post
        ),
      }))
      addToast("Could not reach the server to update saved posts", "error")
    }
  }, [addToast, state.posts])

  const hidePost = useCallback(async (postId: string) => {
    setState((s) => ({
      ...s,
      posts: s.posts.map((post) =>
        post.id === postId ? { ...post, hideCount: (post.hideCount || 0) + 1 } : post
      ),
    }))
    addToast("Post hidden", "success")
  }, [addToast])

  const markNotInterested = useCallback(async (postId: string) => {
    setState((s) => ({
      ...s,
      posts: s.posts.filter((p) => p.id !== postId),
    }))
    addToast("Marked as not interested", "success")
  }, [addToast])

  const recordModerationReport = useCallback((type: "user" | "post" | "comment" | "message" | "story" | "group", targetId: string, reason: string) => {
    const normalizedReason = reason.trim().slice(0, 160) || "Other"
    setState((s) => {
      const existing = s.settings.moderationReports || []
      const alreadyReported = existing.some((report) => report.type === type && report.targetId === targetId)
      if (alreadyReported) return s
      return {
        ...s,
        settings: {
          ...s.settings,
          moderationReports: [...existing, { type, targetId, reason: normalizedReason, createdAt: Date.now() }].slice(-200),
        },
      }
    })
  }, [])

  const reportPost = useCallback(async (postId: string, reason: string) => {
    try {
      const result = await domains.reports.report("post", postId, reason)
      if (!result.ok) {
        addToast(result.error, "error")
        return
      }
      recordModerationReport("post", postId, reason)
      try {
        const { socialReport } = await import("@/lib/social/client")
        await socialReport({ targetType: "post", targetId: postId, reason })
      } catch {
        /* domain already accepted */
      }
      addToast("Post reported for review", "success")
    } catch (err) {
      errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      addToast("Could not submit report", "error")
    }
  }, [addToast, domains.reports, recordModerationReport])

  const reportContent = useCallback(async (
    targetType: "user" | "post" | "comment" | "message" | "story" | "group",
    targetId: string,
    reason: string,
    details?: string
  ) => {
    try {
      const result = await domains.reports.report(targetType, targetId, reason, details)
      if (!result.ok) {
        addToast(result.error, "error")
        return
      }
      recordModerationReport(targetType, targetId, reason)
      const labels: Record<string, string> = {
        user: "user",
        post: "post",
        comment: "comment",
        message: "message",
        story: "story",
        group: "community",
      }
      addToast(`Thank you. We'll review this ${labels[targetType] || "content"}.`, "success")
    } catch (err) {
      errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      addToast("Could not submit report", "error")
    }
  }, [addToast, recordModerationReport, domains])


  const muteUser = useCallback(async (userId: string) => {
    try {
      const result = await domains.graph.muteUser(userId)
      if (!result.ok) {
        addToast(result.error, "error")
        return
      }
      setState((s) => applyGraphPatch(s, patchFromMute(result.data)))
      addToast("User muted", "success")
    } catch (err) {
      errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      addToast("Error muting user", "error")
    }
  }, [addToast, domains.graph])

  const unmuteUser = useCallback(async (userId: string) => {
    try {
      const result = await domains.graph.unmuteUser(userId)
      if (!result.ok) {
        addToast(result.error, "error")
        return
      }
      setState((s) => applyGraphPatch(s, patchFromMute(result.data)))
      addToast("User unmuted", "success")
    } catch (err) {
      errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      addToast("Error unmuting user", "error")
    }
  }, [addToast, domains.graph])

  const restrictUser = useCallback(async (userId: string) => {
    try {
      const result = await domains.graph.restrictUser(userId)
      if (!result.ok) {
        addToast(result.error, "error")
        return
      }
      setState((s) => applyGraphPatch(s, patchFromRestrict(result.data)))
      addToast("User restricted", "success")
    } catch (err) {
      errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      addToast("Error restricting user", "error")
    }
  }, [addToast, domains.graph])

  const unrestrictUser = useCallback(async (userId: string) => {
    try {
      const result = await domains.graph.unrestrictUser(userId)
      if (!result.ok) {
        addToast(result.error, "error")
        return
      }
      setState((s) => applyGraphPatch(s, patchFromRestrict(result.data)))
      addToast("Restriction removed", "success")
    } catch (err) {
      errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      addToast("Error updating restriction", "error")
    }
  }, [addToast, domains.graph])

  const updateSettings = useCallback(async (updates: Partial<Settings>) => {
    const messagingPrivacyUpdates: Record<string, string> = {}
    if (updates.whoCanMessage && updates.whoCanMessage !== state.settings.whoCanMessage) messagingPrivacyUpdates.whoCanMessage = updates.whoCanMessage
    if (updates.onlineStatus && updates.onlineStatus !== state.settings.onlineStatus) messagingPrivacyUpdates.onlineStatus = updates.onlineStatus
    if (Object.keys(messagingPrivacyUpdates).length) {
      try {
        const response = await fetch("/api/messaging/preferences", {
          method: "PATCH",
          credentials: "include",
          cache: "no-store",
          headers: { "Content-Type": "application/json", Accept: "application/json", ...IdentityService.getAuthHeaders() },
          body: JSON.stringify(messagingPrivacyUpdates),
        })
        const result = await response.json().catch(() => ({}))
        if (!response.ok || result?.ok !== true) {
          addToast("Messaging privacy could not be saved securely. Please try again.", "error")
          return
        }
      } catch {
        addToast("Messaging privacy could not be saved securely. Please try again.", "error")
        return
      }
    }
    setState((s) => ({ ...s, settings: { ...s.settings, ...updates } }))
  }, [addToast, state.settings])

  const isMatchOrFriend = useCallback(
    (userId: string) => state.matches.some((match) => match.userId === userId) || state.friends.includes(userId),
    [state.matches, state.friends]
  )
  const canViewProfile = useCallback(
    (userId: string) => userId === "current-user" || state.settings.profileVisibility === "everyone" || (state.settings.profileVisibility === "matches-only" && isMatchOrFriend(userId)),
    [state.settings.profileVisibility, isMatchOrFriend]
  )
  const canMessageUser = useCallback((userId: string) => {
    if (userId === "current-user") return false
    const blocked = new Set([...(state.settings?.blockedUsers || []), ...(state.blockedUsers || [])])
    if (blocked.has(userId)) return false
    // whoCanMessage is an inbound privacy setting; the server checks the recipient's saved preference.
    return true
  }, [state.settings?.blockedUsers, state.blockedUsers])
  const canViewStory = useCallback(
    (ownerId: string) => ownerId === "current-user" || state.settings.storyVisibility === "everyone" || (state.settings.storyVisibility === "matches-only" && isMatchOrFriend(ownerId)),
    [state.settings.storyVisibility, isMatchOrFriend]
  )
  const canSeeOnlineStatus = useCallback(
    (userId: string) => userId === "current-user" || state.settings.onlineStatus === "everyone" || (state.settings.onlineStatus === "matches-only" && isMatchOrFriend(userId)),
    [state.settings.onlineStatus, isMatchOrFriend]
  )

  const swipe = useCallback(async (candidateId: string, action: "like" | "pass" | "superlike") => {
    try {
      const candidate = state.candidates.find((c) => c.id === candidateId)
      if (!candidate) return

      if (action === "like" || action === "superlike") {
        // Server-first match signal when online — no local-only "liked" success.
        let durableMutual = false
        let durableOk = false
        let remoteError = ""
        const online =
          typeof navigator === "undefined" ? true : navigator.onLine !== false
        if (online) {
          try {
            const { socialMatchSignal } = await import("@/lib/social/client")
            const remote = await socialMatchSignal(candidateId, action)
            durableOk = Boolean(remote.ok && remote.durable !== false)
            if (remote.ok && remote.mutual) durableMutual = true
            if (!durableOk) {
              remoteError = remote.error || "MATCH_NOT_DURABLE"
              addToast(
                remote.error || "Could not save this like on the server. Try again.",
                "error"
              )
              return
            }
          } catch (e) {
            addToast("Could not reach the server to save this like.", "error")
            return
          }
        }

        const interest = await domains.matching.expressInterest(candidateId, {
          superlike: action === "superlike",
        })
        if (!interest.ok) {
          addToast(interest.error, "error")
          return
        }

        const quality = domains.matching.evaluateQuality(candidate)
        const now = Date.now()
        const myId =
          String(state.profile?.id || IdentityService.getCurrentUserId() || "").trim() ||
          "current-user"
        let createdMatch: (typeof state.matches)[number] | null = null
        let alreadyMatched = interest.data.alreadyMatched

        setState((s) => {
          const alreadyLiked = s.likes.some(
            (like) =>
              (like.fromUserId === myId || like.fromUserId === "current-user") &&
              like.toUserId === candidateId
          )
          const hasMutualLike =
            durableMutual ||
            s.likes.some(
              (like) =>
                like.fromUserId === candidateId &&
                (like.toUserId === myId || like.toUserId === "current-user")
            )
          const existingMatch = s.matches.find((match) => match.userId === candidateId)
          if (existingMatch) {
            alreadyMatched = true
            return alreadyLiked
              ? s
              : {
                  ...s,
                  likes: [
                    ...s.likes,
                    {
                      id: generateId(),
                      fromUserId: myId,
                      toUserId: candidateId,
                      createdAt: now,
                    },
                  ],
                }
          }
          const nextLikes = alreadyLiked
            ? s.likes
            : [
                ...s.likes,
                {
                  id: generateId(),
                  fromUserId: myId,
                  toUserId: candidateId,
                  createdAt: now,
                },
              ]
          // Mutual consent only — does not add to friends[]
          if (!hasMutualLike) return { ...s, likes: nextLikes }

          createdMatch = {
            id: generateId(),
            userId: candidateId,
            userName: candidate.name,
            userPhoto: candidate.photo || "/placeholder.svg?height=80&width=80",
            matchedAt: now,
            online: candidate.online,
            intentions: quality.sharedIntentions.length
              ? quality.sharedIntentions
              : domains.matching.openIntentions(),
            reasons: quality.reasons.slice(0, 3),
            qualityScore: quality.score,
          }
          const existingConversation = s.conversations.find(
            (conversation) =>
              conversation.conversationType === "private" &&
              conversation.participantId === candidateId
          )
          const matchConversation: Conversation = existingConversation || ensureConversation({
            id: `match-${candidateId}`,
            participantId: candidateId,
            participantName: candidate.name,
            participantPhoto: candidate.photo || "/placeholder.svg?height=80&width=80",
            messages: [],
            lastMessage: "You matched — say hello!",
            lastMessageTime: now,
            unread: false,
            online: Boolean(candidate.online),
            conversationType: "private",
          })
          // Dedupe: never add a second match for the same userId
          const priorMatches = (s.matches || []).filter((m) => m.userId !== candidateId)
          return {
            ...s,
            likes: nextLikes,
            matches: [...priorMatches, createdMatch],
            matchCelebration: {
              userId: candidateId,
              userName: candidate.name,
              userPhoto: candidate.photo || "/placeholder.svg?height=80&width=80",
            },
            // Explicit: friends/connections unchanged
            conversations: existingConversation
              ? s.conversations
              : [matchConversation, ...s.conversations],
          }
        })

        analytics.trackEvent("swipe_action", { action, candidateId }, state.profile.displayName)

        if ((createdMatch && !alreadyMatched) || (durableMutual && !alreadyMatched)) {
          await domains.graph.addMatch(candidateId).catch(() => null)
          notificationSystem.addNotification(
            "match",
            "It's a Match",
            `You and ${candidate.name} both expressed interest`,
            "💚",
            { candidateId, candidateName: candidate.name }
          )
          addToast(
            durableOk
              ? "It's a Match — mutual interest"
              : "Match recorded offline — will sync when you\'re back online",
            "success",
          )
        } else if (alreadyMatched) {
          addToast("You're already matched", "info")
        } else {
          addToast(
            durableOk
              ? action === "superlike"
                ? "Interest sent"
                : "Interest sent — not a Match until they like you too"
              : "Interest saved offline — will sync when you're back online",
            durableOk ? "success" : "info",
          )
        }
      } else {
        // Pass — server-first when online
        const online = typeof navigator === "undefined" ? true : navigator.onLine !== false
        if (online) {
          try {
            const { socialMatchSignal } = await import("@/lib/social/client")
            const remote = await socialMatchSignal(candidateId, "pass")
            if (!remote.ok || remote.durable === false) {
              addToast(remote.error || "Could not save pass on the server", "error")
              return
            }
            addToast("Passed", "info")
          } catch {
            addToast("Could not reach the server to save this pass", "error")
            return
          }
        } else {
          addToast("You're offline — pass will sync when you're back online", "info")
        }
      }
    } catch (err) {
      errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      addToast("Error processing action", "error")
    }
  }, [state, domains, addToast])

  

const dismissMatchCelebration = useCallback(() => {
    setState((s) => (s.matchCelebration ? { ...s, matchCelebration: null } : s))
  }, [])

  const setFollowUser = useCallback(async (userId: string, shouldFollow: boolean) => {
    try {
      if (!isLikelyServerUserId(userId)) {
        addToast("Cannot follow — pick a real registered member", "error")
        return
      }
      const already = (state.following || []).includes(userId)
      if (shouldFollow && !already) {
        const matchIds = (state.matches || []).map((m) => m.userId)
        const friendIds = state.friends || []
        if (!privacyCanFollow(state.settings, "current-user", userId, matchIds, friendIds)) {
          addToast("Follow is limited by privacy settings", "info")
          return
        }
      }
      // The authenticated Supabase-backed endpoint is the durable source of truth.
      const { socialFollow } = await import("@/lib/social/client")
      const remote = await socialFollow(userId, shouldFollow)
      if (!remote.ok || remote.durable === false) {
        addToast(remote.error || (shouldFollow
          ? "Could not follow — server not confirmed"
          : "Could not unfollow — server not confirmed"), "error")
        return
      }
      // Update the in-memory graph only when its current state differs from the confirmed
      // server target. The domain adapter is local/session state, not a second DB write.
      if (already !== shouldFollow) {
        const result = await domains.graph.toggleFollow(userId)
        if (result.ok) {
          setState((s) => applyGraphPatch(s, patchFromFollow(result.data)))
        } else {
          setState((s) => ({
            ...s,
            following: shouldFollow
              ? Array.from(new Set([...(s.following || []), userId]))
              : (s.following || []).filter((id) => id !== userId),
          }))
        }
      }
      try {
        window.dispatchEvent(new CustomEvent("ghc:social-mutation", {
          detail: { type: shouldFollow ? "follow" : "unfollow", targetUserId: userId },
        }))
      } catch { /* non-browser/test runtime */ }
      addToast(shouldFollow ? "Following" : "Unfollowed", shouldFollow ? "success" : "info")
    } catch (err) {
      errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      addToast("Error updating follow status", "error")
    }
  }, [domains, addToast, state.following, state.matches, state.friends, state.settings])

  const followUser = useCallback(async (userId: string) => {
    try {
      // Read authoritative status before toggling so stale profile/feed state cannot invert
      // an intended action or issue duplicate follow writes.
      const { socialFetchFollowStatus } = await import("@/lib/social/client")
      const status = await socialFetchFollowStatus(userId)
      if (!status.ok || !status.durable) {
        addToast(status.error || "Could not verify follow status. Try again.", "error")
        return
      }
      await setFollowUser(userId, !status.isFollowing)
    } catch (err) {
      errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      addToast("Could not verify follow status", "error")
    }
  }, [setFollowUser, addToast])

  // Keep Feed and Profile adapters below the canonical callback declaration to avoid
  // block-scoped use-before-declaration errors in the CI TypeScript check.
  const followFromPost = useCallback(async (userId: string) => {
    await setFollowUser(userId, true)
  }, [setFollowUser])

  const unfollowFromPost = useCallback(async (userId: string) => {
    await setFollowUser(userId, false)
  }, [setFollowUser])

  const addFriend = useCallback(async (userId: string) => {
    try {
      if (!isLikelyServerUserId(userId)) {
        addToast("Cannot connect — pick a real registered member (not a demo card)", "error")
        return
      }
      if (state.friends.includes(userId)) {
        const result = await domains.graph.removeFriend(userId)
        if (!result.ok) {
          addToast(result.error, "error")
          return
        }
        setState((s) => applyGraphPatch(s, patchFromFriendRemoved(result.data)))
        addToast("Removed from friends", "info")
        return
      }
      // Server-first connection request
      const { socialConnectionRequest } = await import("@/lib/social/client")
      const remote = await socialConnectionRequest({
        toUserId: userId,
        source: "profile_connect",
      })
      if (!remote.ok || !remote.durable) {
        addToast(
          remote.error || "Could not send request — not visible to them until server confirms",
          "error",
        )
        return
      }
      const result = await domains.graph.sendFriendRequest(userId)
      const myId = String(state.profile?.id || "").trim() || "current-user"
      const cand = bootstrapCandidates().find((c) => c.id === userId)
      const newRequest = {
        id: generateId(),
        fromUserId: myId,
        fromUserName: state.profile.displayName || "You",
        fromUserPhoto: state.profile.photos?.[0] || "/placeholder.svg?width=40&height=40",
        toUserId: userId,
        toUserName: cand?.name || "User",
        createdAt: Date.now(),
      }
      setState((s) => ({
        ...s,
        friendRequests: [
          ...(s.friendRequests || []).filter(
            (r) => !(r.fromUserId === myId && r.toUserId === userId) &&
              !(r.fromUserId === "current-user" && r.toUserId === userId)
          ),
          newRequest as any,
        ],
      }))
      if (!result.ok) {
        console.warn("[ghc] session graph lag after durable connection request", result.error)
      }
      emitSocialMutation({
        kind: "connection_request",
        durable: true,
        targetUserId: userId,
      })
      try {
        window.dispatchEvent(
          new CustomEvent("ghc:social-mutation", {
            detail: { type: "connection_request", toUserId: userId },
          })
        )
      } catch {
        /* */
      }
      addToast("Friend request sent — they will see it in their inbox", "success")
      try {
        const { reportMissionProgress } = await import("@/lib/missions/progress")
        const m = await reportMissionProgress("send_connection", { toUserId: userId })
        if (m.ok && m.grantedGhc && m.grantedGhc > 0) {
          addToast(m.message || `Mission · ₲ ${m.grantedGhc}`, "success")
        }
      } catch { /* */ }
    } catch (err) {
      errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      addToast("Error adding friend", "error")
    }
  }, [state.friends, state.profile, domains, addToast])

  const reportUser = useCallback(async (userId: string, reason: string) => {
    try {
      recordModerationReport("user", userId, reason)
      addToast("Thank you for reporting. We'll review this user.", "success")
    } catch (err) {
      errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      addToast("Error submitting report", "error")
    }
  }, [addToast, recordModerationReport])

  const blockUser = useCallback(async (userId: string) => {
    try {
      if (!userId || userId === "current-user") return
      const result = await domains.graph.applyBlock(userId)
      if (!result.ok) {
        addToast(result.error, "error")
        return
      }
      setState((s) =>
        applyGraphPatch(
          s,
          patchFromBlock({
            ...(result.data as any),
            friends: (result.data as any).friends ?? (s.friends || []).filter((id) => id !== userId),
          })
        )
      )
      addToast("User blocked — hidden from feed, discovery, matches, and messaging", "success")
    } catch (err) {
      errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      addToast("Error blocking user", "error")
    }
  }, [domains, addToast])

  const unblockUser = useCallback(async (userId: string) => {
    try {
      const result = await domains.graph.removeBlock(userId)
      if (!result.ok) {
        addToast(result.error, "error")
        return
      }
      setState((s) => applyGraphPatch(s, patchFromUnblock(result.data)))
      addToast("User unblocked", "success")
    } catch (err) {
      errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      addToast("Error unblocking user", "error")
    }
  }, [domains, addToast])


  const startConversation = useCallback(async (userId: string, userName: string, userPhoto: string): Promise<string | null> => {
    try {
      if (!canMessageUser(userId)) {
        addToast("You cannot start this conversation because of your block settings.", "info")
        return null
      }
      const existingConv = state.conversations.find(c => c.participantId === userId && c.conversationType === "private")
      if (existingConv) {
        setState((s) => ({ ...s, tab: "messages" as Tab }))
        return existingConv.id
      }

      const online = typeof navigator === "undefined" ? true : navigator.onLine !== false
      let durableId: string | null = null
      if (online) {
        try {
          const { apiCreateDirectConversation } = await import("@/lib/messaging/server-messaging-sync")
          const remote = await apiCreateDirectConversation(userId)
          if (!remote?.ok || remote.durable === false || !remote.conversation?.id) {
            addToast(
              remote?.error || "Could not create conversation on the server",
              "error"
            )
            return null
          }
          durableId = String(remote.conversation.id)
        } catch {
          addToast("Could not reach the server to start this conversation", "error")
          return null
        }
      }

      const result = await domains.messaging.createConversation({
        kind: "private",
        participantId: userId,
        participantName: userName,
        participantPhoto: userPhoto,
      })
      if (!result.ok) {
        addToast(result.error, "error")
        return null
      }
      const newConversation = ensureConversation({
        ...result.data.conversation,
        id: durableId || result.data.conversation.id,
        participantId: userId,
        participantName: userName || result.data.conversation.participantName,
        participantPhoto: userPhoto || result.data.conversation.participantPhoto,
        online: true,
        conversationType: "private",
      })

      if (!online) {
        offlineQueue.addAction({
          type: "create_conversation",
          payload: { userId, userName, userPhoto, localId: newConversation.id },
          maxRetries: 3,
        })
        addToast("Conversation saved offline — will sync when online", "info")
      }

      setState((s) => ({
        ...s,
        conversations: [
          newConversation,
          ...s.conversations.filter(
            (c) =>
              c.id !== newConversation.id &&
              !(c.participantId === userId && c.conversationType === "private")
          ),
        ],
        tab: "messages" as Tab,
      }))
      return newConversation.id
    } catch (err) {
      errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      addToast("Error starting conversation", "error")
      return null
    }
  }, [state.conversations, domains, addToast, canMessageUser])

  const acceptMatch = useCallback(async (userId: string) => {
    try {
      const result = await domains.graph.addMatch(userId)
      if (!result.ok) {
        addToast(result.error, "error")
        return
      }
      setState((s) => {
        const cand = s.candidates.find((c) => c.id === userId)
        return applyGraphPatch(
          s,
          patchFromMatchIds(result.data.matchIds, s.matches || [], (id) => ({
            id: `match-${id}`,
            userId: id,
            userName: cand?.name || "Match",
            userPhoto: cand?.photo || "/placeholder.svg?width=40&height=40",
            matchedAt: Date.now(),
            online: Boolean(cand?.online),
          }))
        )
      })
      addToast("Match accepted!", "success")
    } catch (err) {
      errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      addToast("Error accepting match", "error")
    }
  }, [domains, addToast])

  const rejectMatch = useCallback(async (userId: string) => {
    try {
      const result = await domains.graph.removeMatch(userId)
      if (!result.ok) {
        // Still remove from session list for UX even if edge missing
        setState((s) => ({
          ...s,
          matches: (s.matches || []).filter((m) => m.userId !== userId),
        }))
        addToast("Request declined", "info")
        return
      }
      setState((s) =>
        applyGraphPatch(s, patchFromMatchIds(result.data.matchIds, s.matches || []))
      )
      addToast("Request declined", "info")
    } catch (err) {
      errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      addToast("Error declining match", "error")
    }
  }, [domains, addToast])


  /** Phase 6: hydrate messages for one thread from durable API. */
  const loadConversationMessages = useCallback(
    async (conversationId: string): Promise<{ ok: boolean; count: number; durable?: boolean }> => {
      const id = String(conversationId || "").trim()
      if (!id) return { ok: false, count: 0 }
      try {
        const { apiListMessages } = await import("@/lib/messaging/server-messaging-sync")
        const remote = await apiListMessages(id, { limit: 80 })
        if (!remote?.ok || !Array.isArray(remote.messages)) {
          return { ok: false, count: 0, durable: Boolean(remote?.durable) }
        }
        const mapped = remote.messages
          .map((raw: Record<string, unknown>) => {
            const mid = String(raw.id || raw.message_id || "")
            if (!mid) return null
            return {
              id: mid,
              senderId: String(raw.senderId || raw.sender_id || ""),
              text: String(raw.body || raw.text || ""),
              createdAt: (() => {
                const stamp = raw.createdAt ?? raw.created_at
                if (typeof stamp === "number" && Number.isFinite(stamp)) return stamp
                const parsed = Date.parse(String(stamp || ""))
                return Number.isFinite(parsed) ? parsed : Date.now()
              })(),
              status: (["sending", "sent", "delivered", "read", "failed", "deleted"].includes(String(raw.status)) ? String(raw.status) : "sent") as "sending" | "sent" | "delivered" | "read" | "failed" | "deleted",
              deliveredAt: typeof raw.deliveredAt === "number" ? raw.deliveredAt : raw.deliveredAt ? Date.parse(String(raw.deliveredAt)) : null,
              readAt: typeof raw.readAt === "number" ? raw.readAt : raw.readAt ? Date.parse(String(raw.readAt)) : undefined,
              isDeleted: Boolean(raw.deletedAt || raw.deleted_at || String(raw.status || "") === "deleted"),
              deletedAt: typeof raw.deletedAt === "number" ? raw.deletedAt : raw.deletedAt || raw.deleted_at ? Date.parse(String(raw.deletedAt || raw.deleted_at)) : undefined,
              sharedPostId: typeof raw.sharedPostId === "string" ? raw.sharedPostId : undefined,
              replyTo: typeof raw.replyTo === "string" ? raw.replyTo : undefined,
              replyToPreview: raw.replyToPreview && typeof raw.replyToPreview === "object"
                ? raw.replyToPreview as { senderName: string; text: string }
                : undefined,
              mediaAttachments: Array.isArray(raw.mediaAttachments)
                ? (raw.mediaAttachments as Array<Record<string, unknown>>)
                    .slice(0, 4)
                    .map((a) => ({
                      id: String(a.id || ""),
                      type: (["image", "video", "file"].includes(String(a.type))
                        ? String(a.type)
                        : "file") as "image" | "video" | "file",
                      url: String(a.url || ""),
                      fileName: a.fileName != null ? String(a.fileName) : undefined,
                    }))
                    .filter((a) => a.url && !a.url.startsWith("blob:") && !a.url.startsWith("data:"))
                : undefined,
            }
          })
          .filter(Boolean) as Array<{
          id: string
          senderId: string
          text: string
          createdAt: number
          status: "sending" | "sent" | "delivered" | "read" | "failed" | "deleted"
          deliveredAt?: number | null
          readAt?: number
          isDeleted?: boolean
          deletedAt?: number
          sharedPostId?: string
          replyTo?: string
          replyToPreview?: { senderName: string; text: string }
        }>
        setState((s) => ({
          ...s,
          conversations: (s.conversations || []).map((c) => {
            if (c.id !== id) return c
            const byId = new Map<string, (typeof mapped)[0]>()
            for (const m of mapped) byId.set(m.id, m)
            // Drop optimistic "sending" rows that already arrived from server
            // (same sender + text within 2 minutes) to prevent visible duplicates.
            const serverFingerprints = new Set(
              mapped.map(
                (m) =>
                  `${String(m.senderId)}|${String(m.text).trim()}|${Math.floor((m.createdAt || 0) / 120_000)}`,
              ),
            )
            for (const m of c.messages || []) {
              if (byId.has(m.id)) continue
              const localStatus = String(m.status || "")
              const fp = `${String(m.senderId || "")}|${String(m.text || "").trim()}|${Math.floor((Number(m.createdAt) || 0) / 120_000)}`
              if (
                (localStatus === "sending" || localStatus === "sent") &&
                serverFingerprints.has(fp)
              ) {
                continue
              }
              byId.set(m.id, {
                id: m.id,
                senderId: String(m.senderId || ""),
                text: String(m.text || ""),
                createdAt: Number(m.createdAt) || Date.now(),
                status: m.status || "sent",
                deliveredAt: m.deliveredAt,
                readAt: m.readAt,
                isDeleted: m.isDeleted,
                deletedAt: m.deletedAt,
                sharedPostId: m.sharedPostId,
                replyTo: m.replyTo,
                replyToPreview: m.replyToPreview,
                mediaAttachments: Array.isArray((m as { mediaAttachments?: unknown }).mediaAttachments)
                  ? ((m as { mediaAttachments: Message["mediaAttachments"] }).mediaAttachments)
                  : undefined,
              })
            }
            const nextMsgs = Array.from(byId.values()).sort(
              (a, b) => (a.createdAt || 0) - (b.createdAt || 0)
            )
            const last = nextMsgs[nextMsgs.length - 1]
            return {
              ...c,
              messages: nextMsgs as typeof c.messages,
              lastMessage: last?.text || c.lastMessage,
              lastMessageTime: last?.createdAt || c.lastMessageTime,
            }
          }),
        }))
        return { ok: true, count: mapped.length, durable: Boolean(remote.durable) }
      } catch {
        return { ok: false, count: 0 }
      }
    },
    []
  )

  const sendMessage = useCallback(async (conversationId: string, text: string, replyToMessageId?: string, sharedPostId?: string): Promise<boolean> => {
    // Keep the final outcome outside the try block so it remains available to
    // both the optimistic-message reconciliation and the boolean return value.
    let permanentFailure = false
    let permanentError = ""
    try {
      if (!messageLimiter.isAllowed(`msg_${conversationId}`)) {
        addToast("You're messaging too fast. Please slow down.", "error")
        return false
      }

      const safeText = typeof text === "string" ? text : ""
      if (spamDetection.detectSpamText(safeText)) {
        addToast("Your message was flagged as spam.", "error")
        return false
      }

      const sanitizedText = String(sanitizeText(safeText, 5000) || "").trim()
      if (!sanitizedText) {
        addToast("Message cannot be empty", "error")
        return false
      }

      const csrfToken = getCsrfToken()

      const result = await domains.messaging.sendMessage({
        conversationId,
        text: sanitizedText,
        replyToId: replyToMessageId,
        sharedPostId,
        offline: !state.isOnline,
      })
      if (!result.ok) {
        addToast(result.error, "error")
        return false
      }

      const rawUiMessage = (result.data as any).uiMessage || {
        id: result.data.id,
        senderId: result.data.senderId || "current-user",
        text: sanitizedText,
        createdAt: result.data.createdAt || Date.now(),
        status: state.isOnline ? "sent" : "sending",
      }
      const replyParent = replyToMessageId
        ? (state.conversations || []).find((c) => c.id === conversationId)?.messages?.find((m) => m.id === replyToMessageId)
        : undefined
      const uiMessage = {
        ...rawUiMessage,
        replyTo: replyToMessageId || rawUiMessage.replyTo,
        sharedPostId: sharedPostId || rawUiMessage.sharedPostId,
        replyToPreview: replyParent
          ? {
              senderName: replyParent.senderId === IdentityService.getCurrentUserId()
                ? "Your message"
                : ((state.conversations || []).find((c) => c.id === conversationId)?.participantName || "Original message"),
              text: String(replyParent.text || "").replace(/\s+/g, " ").slice(0, 160),
            }
          : rawUiMessage.replyToPreview,
      }

      setState((s) => ({
        ...s,
        conversations: (s.conversations || []).map((c) => {
          if (c.id !== conversationId) return c
          const existing = Array.isArray(c.messages) ? c.messages : []
          if (existing.some((m) => m.id === uiMessage.id)) {
            return {
              ...c,
              lastMessage: uiMessage.text,
              lastMessageTime: uiMessage.createdAt || Date.now(),
            }
          }
          return {
            ...c,
            messages: [...existing, uiMessage],
            lastMessage: uiMessage.text,
            lastMessageTime: uiMessage.createdAt || Date.now(),
            unread: false,
            unreadCount: 0,
          }
        }),
      }))

      analytics.trackEvent("message_sent", { conversationId }, state.profile.displayName)

      if (!state.isOnline) {
        offlineQueue.addAction({
          type: "send_message",
          payload: {
            conversationId,
            text: sanitizedText,
            csrfToken,
            messageId: result.data.id,
            replyToMessageId,
            sharedPostId,
          },
          maxRetries: 3,
        })
        addToast("Message queued — will send when online", "info")
        return true
      }

      // Domain messaging already performed the durable POST when online
      // (apiSendMessageWithRetry inside sendMessage). Do NOT call the API again —
      // a second POST was creating duplicate messages for a single Send press.
      const domainStatus = String((result.data as { status?: string }).status || uiMessage.status || "")
      const alreadyDurable =
        domainStatus === "sent" || domainStatus === "delivered" || domainStatus === "read"
      let serverId: string | null = alreadyDurable
        ? String(uiMessage.id || result.data.id || "")
        : null
      let durable = alreadyDurable

      if (!alreadyDurable) {
        // Offline-prepared / failed domain path only — one network attempt here.
        try {
          const { apiSendMessageWithRetry } = await import("@/lib/messaging/server-messaging-sync")
          const remote = await apiSendMessageWithRetry(
            conversationId,
            sanitizedText,
            String(uiMessage.id),
            replyToMessageId,
            sharedPostId
          )
          if (remote?.ok && remote.durable !== false) {
            durable = true
            serverId = remote.message?.id ? String(remote.message.id) : String(uiMessage.id)
          } else {
            const remoteError = String(remote?.error || "STORE_UNAVAILABLE")
            permanentFailure = /AUTH_REQUIRED|FORBIDDEN|BLOCKED|PRIVACY_RESTRICTED|PRIVACY_SETTINGS_UNCONFIGURED|SHARED_POST_PRIVATE|INVALID_SHARED_POST|INVALID|VALIDATION|TOO_LONG|EMPTY_BODY|REPLY_TARGET_NOT_FOUND/i.test(remoteError)
            if (permanentFailure) permanentError = remoteError
            if (!permanentFailure) {
              offlineQueue.addAction({
                type: "send_message",
                payload: {
                  conversationId,
                  text: sanitizedText,
                  csrfToken,
                  messageId: uiMessage.id,
                  replyToMessageId,
                  sharedPostId,
                },
                maxRetries: 3,
              })
            }
          }
        } catch {
          offlineQueue.addAction({
            type: "send_message",
            payload: {
              conversationId,
              text: sanitizedText,
              csrfToken,
              messageId: uiMessage.id,
              replyToMessageId,
              sharedPostId,
            },
            maxRetries: 3,
          })
        }
      }

      await domains.messaging
        // Server acceptance means SENT; only a recipient fetch creates a delivery receipt.
        .setMessageStatus(conversationId, result.data.id, durable ? "sent" : permanentFailure ? "failed" : "sending")
        .catch(() => null)
      setState((s) => ({
        ...s,
        conversations: (s.conversations || []).map((c) => {
          if (c.id !== conversationId) return c
          return {
            ...c,
            messages: (c.messages || []).map((m) => {
              if (m.id !== uiMessage.id) return m
              return {
                ...m,
                id: serverId || m.id,
                status: (durable ? "sent" : permanentFailure ? "failed" : "sending") as "sent" | "failed" | "sending",
                senderId: String(
                  m.senderId ||
                    state.profile?.id ||
                    IdentityService.getCurrentUserId() ||
                    "current-user"
                ),
                failureReason: permanentFailure ? permanentError || "The server rejected this message." : undefined,
                failedAt: permanentFailure ? Date.now() : undefined,
              }
            }),
          }
        }),
      }))
      if (permanentFailure) {
        const failureMessage = permanentError === "PRIVACY_SETTINGS_UNCONFIGURED"
          ? "Message not sent: this recipient needs to open GreenHaven once to sync privacy settings."
          : permanentError === "SHARED_POST_PRIVATE"
            ? "This post cannot be shared to every selected recipient because of its audience or block settings."
            : "Message was not sent. Check the conversation permissions and try again."
        addToast(failureMessage, "error")
      }
      try {
        window.dispatchEvent(
          new CustomEvent("ghc:new-message", {
            detail: {
              conversationId,
              messageId: serverId || uiMessage.id,
              outbound: true,
              durable,
            },
          }),
        )
      } catch {
        /* */
      }
    } catch (err) {
      errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      addToast("Failed to send message", "error")
      return false
    }
    return !permanentFailure
  }, [domains, state.isOnline, state.profile, state.conversations, addToast])

  
  const applyShareResult = useCallback(async (result: import("@/lib/share-service").ShareResult) => {
    if (!result.ok) return
    let shareRecord = result.share
    if (result.messages?.length) {
      const outcomes = await Promise.all(result.messages.map(async (shared) => ({
        conversationId: shared.conversationId,
        ok: await sendMessage(shared.conversationId, shared.text, undefined, shared.sharedPostId),
      })))
      const successfulIds = outcomes.filter((item) => item.ok).map((item) => item.conversationId)
      if (!successfulIds.length) {
        addToast("The post could not be shared. Check the post's audience and your conversation permissions.", "error")
        return
      }
      if (successfulIds.length !== outcomes.length) addToast("The post was shared to some chats, but not all selected chats.", "error")
      shareRecord = { ...result.share, destinationId: successfulIds.join(",") }
    }
    setState((current) => ({
      ...current,
      shares: [shareRecord, ...(current.shares || [])].slice(0, 200),
      reposts: result.repost ? [result.repost, ...(current.reposts || [])].slice(0, 100) : current.reposts,
      stories: result.story ? [result.story as any, ...(current.stories || [])] : current.stories,
    }))
  }, [sendMessage, addToast])

  // Phase 7: flush queued profile updates when online
  useEffect(() => {
    if (typeof window === "undefined") return
    const flush = async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return
      try {
        const pending = offlineQueue.getActionsByType?.("profile_update") || []
        for (const action of pending) {
          const payload = sanitizeProfileMediaPartial(
            (action.payload || {}) as Record<string, unknown>
          )
          try {
            const persisted = await persistServerProfile(payload)
            if (persisted.ok) {
              offlineQueue.removeAction(action.id)
            } else {
              offlineQueue.incrementRetry?.(action.id)
            }
          } catch {
            offlineQueue.incrementRetry?.(action.id)
          }
        }
      } catch {
        /* */
      }
    }
    const onOnline = () => {
      void flush()
    }
    window.addEventListener("online", onOnline)
    void flush()
    return () => window.removeEventListener("online", onOnline)
  }, [])

  // Flush queued create_post when back online (server-first)
  useEffect(() => {
    if (typeof window === "undefined") return
    const flush = async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return
      try {
        const { flushQueuedPosts } = await import("@/lib/social/offline-post-flush")
        const result = await flushQueuedPosts()
        if (result.succeeded > 0) {
          try {
            const { socialFetchFeed } = await import("@/lib/social/client")
            const feed = await socialFetchFeed({ limit: 40 })
            if (feed.ok && Array.isArray(feed.posts) && feed.posts.length > 0) {
              const remotePosts = mapRemoteFeedPosts(feed.posts)
              setState((s) => {
                const remoteIds = new Set(remotePosts.map((p) => p.id))
                const localOnly = s.posts.filter((p) => !remoteIds.has(p.id) && !p.deletedAt)
                return {
                  ...s,
                  posts: [...remotePosts, ...localOnly].sort(
                    (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
                  ),
                }
              })
            }
          } catch {
            /* non-fatal */
          }
          try {
            addToast(
              result.succeeded === 1
                ? "Queued post published"
                : `${result.succeeded} queued posts published`,
              "success"
            )
          } catch {
            /* */
          }
        }
      } catch {
        /* */
      }
    }
    const onOnline = () => {
      void flush()
    }
    window.addEventListener("online", onOnline)
    void flush()
    return () => window.removeEventListener("online", onOnline)
  }, [addToast])

  // Flush queued stories + deletes when back online
  useEffect(() => {
    if (typeof window === "undefined") return
    const flush = async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return
      try {
        const { flushQueuedStories } = await import("@/lib/social/offline-story-flush")
        const stories = await flushQueuedStories()
        if (stories.succeeded > 0) {
          addToast(
            stories.succeeded === 1
              ? "Queued story published"
              : `${stories.succeeded} queued stories published`,
            "success"
          )
        }
      } catch {
        /* */
      }
      try {
        const { flushQueuedDeletes } = await import("@/lib/social/offline-delete-flush")
        await flushQueuedDeletes()
      } catch {
        /* */
      }
      try {
        const { flushQueuedListings } = await import("@/lib/social/offline-listing-flush")
        const listings = await flushQueuedListings()
        if (listings.succeeded > 0) {
          addToast(
            listings.succeeded === 1
              ? "Queued listing published"
              : `${listings.succeeded} queued listings published`,
            "success"
          )
        }
      } catch {
        /* */
      }
      try {
        const { flushQueuedConversations } = await import("@/lib/messaging/offline-conversation-flush")
        const convs = await flushQueuedConversations()
        if (convs.succeeded > 0 && Object.keys(convs.idMap).length > 0) {
          setState((s) => ({
            ...s,
            conversations: (s.conversations || []).map((c) => {
              const mapped = convs.idMap[c.id]
              return mapped ? { ...c, id: mapped } : c
            }),
          }))
        }
        if (convs.succeeded > 0) {
          addToast(
            convs.succeeded === 1
              ? "Queued conversation synced"
              : `${convs.succeeded} queued conversations synced`,
            "success"
          )
        }
      } catch {
        /* */
      }
    }
    const onOnline = () => {
      void flush()
    }
    window.addEventListener("online", onOnline)
    void flush()
    return () => window.removeEventListener("online", onOnline)
  }, [addToast])

  // Phase 6 — flush queued messages when back online
  useEffect(() => {
    if (typeof window === "undefined") return

    const flush = async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return
      try {
        const { flushQueuedMessages } = await import("@/lib/messaging/offline-message-flush")
        const result = await flushQueuedMessages(async ({ conversationId, text, messageId, replyToMessageId, sharedPostId }) => {
          try {
            const { apiSendMessageWithRetry } = await import("@/lib/messaging/server-messaging-sync")
            const remote = await apiSendMessageWithRetry(
              conversationId,
              text,
              String(messageId || `offline-${Date.now()}`),
              replyToMessageId,
              sharedPostId
            )
            if (remote?.ok && remote.durable) {
              const remoteMessage = remote.message as Record<string, unknown> | undefined
              const durableId = String(remoteMessage?.id || messageId || "")
              if (durableId && messageId) {
                setState((current) => ({
                  ...current,
                  conversations: (current.conversations || []).map((conv) => {
                    if (conv.id !== conversationId) return conv
                    const messages = (conv.messages || []).map((message) => {
                      if (message.id !== messageId && message.id !== durableId) return message
                      return {
                        ...message,
                        id: durableId,
                        text: String(remoteMessage?.body || message.text || text),
                        senderId: String(remoteMessage?.senderId || remoteMessage?.sender_id || message.senderId || "current-user"),
                        createdAt: typeof remoteMessage?.createdAt === "number" ? remoteMessage.createdAt : message.createdAt,
                        status: "sent" as const,
                        sharedPostId: typeof remoteMessage?.sharedPostId === "string" ? remoteMessage.sharedPostId : sharedPostId || message.sharedPostId,
                        replyTo: typeof remoteMessage?.replyTo === "string" ? remoteMessage.replyTo : replyToMessageId || message.replyTo,
                        replyToPreview: remoteMessage?.replyToPreview && typeof remoteMessage.replyToPreview === "object"
                          ? remoteMessage.replyToPreview as { senderName: string; text: string }
                          : message.replyToPreview,
                      }
                    })
                    return { ...conv, messages, lastMessage: text, lastMessageTime: Date.now() }
                  }),
                }))
              }
              return { ok: true }
            }
            const remoteError = String(remote?.error || "STORE_UNAVAILABLE")
            if (isDurableMessagingEnabled()) {
              const permanent = /AUTH_REQUIRED|FORBIDDEN|BLOCKED|PRIVACY_RESTRICTED|PRIVACY_SETTINGS_UNCONFIGURED|SHARED_POST_PRIVATE|INVALID_SHARED_POST|INVALID|VALIDATION|TOO_LONG|EMPTY_BODY|REPLY_TARGET_NOT_FOUND/i.test(remoteError)
              return { ok: false, error: remoteError, permanent }
            }
          } catch {
            if (isDurableMessagingEnabled()) return { ok: false, error: "STORE_UNAVAILABLE" }
            /* local fallback is only permitted when durable mode is not required */
          }
          const res = await domains.messaging.sendMessage({
            conversationId,
            text,
            replyToId: replyToMessageId,
            sharedPostId,
            offline: false,
          })
          if (!res.ok) return { ok: false, error: res.error }
          // Merge into UI if missing
          const rawUi = (res.data as { uiMessage?: { id: string; text: string; createdAt?: number; senderId?: string; replyTo?: string; replyToPreview?: { senderName: string; text: string } }; id?: string; createdAt?: number; senderId?: string }).uiMessage
          const uiMessage: {
            id: string
            senderId: string
            text: string
            createdAt: number
            status: "sent"
            replyTo?: string
            replyToPreview?: { senderName: string; text: string }
          } = {
            id: String(rawUi?.id || (res.data as { id?: string }).id || `msg-${Date.now()}`),
            senderId: String(rawUi?.senderId || (res.data as { senderId?: string }).senderId || "current-user"),
            text: String(rawUi?.text || text),
            createdAt: Number(rawUi?.createdAt || (res.data as { createdAt?: number }).createdAt || Date.now()),
            status: "sent",
            replyTo: rawUi?.replyTo || replyToMessageId,
            replyToPreview: rawUi?.replyToPreview,
          }
          setState((s) => ({
            ...s,
            conversations: (s.conversations || []).map((conv) => {
              if (conv.id !== conversationId) return conv
              const existing = Array.isArray(conv.messages) ? conv.messages : []
              const delivered: {
                id: string
                senderId: string
                text: string
                createdAt: number
                status: "sent"
                replyTo?: string
                replyToPreview?: { senderName: string; text: string }
              } = {
                id: uiMessage.id,
                senderId: uiMessage.senderId,
                text: uiMessage.text,
                createdAt: uiMessage.createdAt,
                status: "sent",
                replyTo: uiMessage.replyTo,
                replyToPreview: uiMessage.replyToPreview,
              }
              if (existing.some((m) => m.id === delivered.id || (m.text === text && m.status === "sending"))) {
                return {
                  ...conv,
                  messages: existing.map((m) =>
                    m.id === delivered.id || (m.text === text && (m.status === "sending" || m.status === "failed"))
                      ? {
                          ...m,
                          id: delivered.id,
                          senderId: delivered.senderId,
                          text: delivered.text,
                          createdAt: delivered.createdAt,
                          status: "sent" as const,
                          replyTo: delivered.replyTo,
                          replyToPreview: delivered.replyToPreview,
                        }
                      : m,
                  ),
                  lastMessage: text,
                  lastMessageTime: delivered.createdAt,
                }
              }
              return {
                ...conv,
                messages: [...existing, delivered],
                lastMessage: text,
                lastMessageTime: delivered.createdAt,
              }
            }),
          }))
          return { ok: true }
        })
        if (Array.isArray(result.failedItems) && result.failedItems.length) {
          const failedAt = Date.now()
          setState((current) => ({
            ...current,
            conversations: (current.conversations || []).map((conv) => ({
              ...conv,
              messages: (conv.messages || []).map((message) => {
                const failure = result.failedItems.find((item) => item.conversationId === conv.id && item.messageId && item.messageId === message.id)
                return failure ? { ...message, status: "failed" as const, failedAt, failureReason: failure.error } : message
              }),
            })),
          }))
          addToast(`${result.failedItems.length} message${result.failedItems.length === 1 ? "" : "s"} could not be sent. Review and retry.`, "error")
        }
        if (result.succeeded > 0) {
          addToast(
            result.succeeded === 1
              ? "Queued message sent"
              : `${result.succeeded} queued messages sent`,
            "success",
          )
        }
      } catch {
        /* fail-soft */
      }
    }

    const onOnline = () => {
      void flush()
    }
    window.addEventListener("online", onOnline)
    // Cold start with pending queue
    if (typeof navigator !== "undefined" && navigator.onLine) {
      window.setTimeout(() => void flush(), 1500)
    }
    return () => window.removeEventListener("online", onOnline)
  }, [domains, addToast])

  const markConversationRead = useCallback(
    async (conversationId: string) => {
      // Skip work when already read — avoids full list remap freezes
      const me = (() => {
        try {
          return IdentityService.getCurrentUserId() || "current-user"
        } catch {
          return "current-user"
        }
      })()
      setState((s) => {
        const current = (s.conversations || []).find((c) => c.id === conversationId)
        if (current && !current.unread && !(current.unreadCount && current.unreadCount > 0)) {
          return s
        }
        const now = Date.now()
        return {
          ...s,
          conversations: (s.conversations || []).map((c) => {
            if (c.id !== conversationId) return c
            return {
              ...c,
              unread: false,
              unreadCount: 0,
              // Advance peer-sent messages to read so the sender sees ✓✓ when sharing state
              messages: (c.messages || []).map((m) => {
                const fromPeer =
                  m.senderId && m.senderId !== me && m.senderId !== "current-user"
                if (!fromPeer) return m
                if (m.status === "sent" || m.status === "delivered" || !m.status) {
                  return {
                    ...m,
                    status: "read" as const,
                    readAt: now,
                    readBy: Array.from(
                      new Set([...((m as { readBy?: string[] }).readBy || []), me]),
                    ),
                  }
                }
                return m
              }),
            }
          }),
        }
      })
      // Even if the local inbox was already clear, the server must persist per-message read receipts.
      try {
        await domains.messaging.markRead(conversationId)
      } catch {
        /* local state already cleared */
      }
    },
    [domains]
  )

  // Unified message operations - reused by both Messages (private) and Chat (group)
  const editMessage = useCallback(async (conversationId: string, messageId: string, newText: string) => {
    try {
      const result = await domains.messaging.editMessage({
        conversationId,
        messageId,
        newText,
      })
      if (!result.ok) {
        addToast(result.error, "error")
        return
      }
      setState((s) => ({
        ...s,
        conversations: s.conversations.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === messageId ? result.data.message : m
                ),
              }
            : c
        ),
      }))
      analytics.trackEvent("message_edited", { conversationId, messageId }, state.profile.displayName)
      addToast("Message updated", "success")
    } catch (err) {
      errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      addToast(
        err instanceof Error && err.message
          ? err.message
          : "Could not edit message. Try again.",
        "error"
      )
    }
  }, [domains, state.profile.displayName, addToast])

  const deleteMessage = useCallback(
    async (conversationId: string, messageId: string, deleteForEveryone: boolean = false) => {
      const conv = state.conversations.find((c) => c.id === conversationId)
      if (!conv) return

      const message = conv.messages.find((m) => m.id === messageId)
      if (!message) return

      try {
        const result = await domains.messaging.deleteMessage(
          {
            id: message.id,
            senderId: message.senderId,
            createdAt: message.createdAt,
            conversationId,
          },
          deleteForEveryone ? "for_everyone" : "for_me"
        )
        if (!result.ok) {
          addToast(result.error, "error")
          return
        }
        if (result.data.message) {
          setState((s) => ({
            ...s,
            conversations: s.conversations.map((c) =>
              c.id === conversationId
                ? {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === messageId ? (result.data.message as typeof m) : m
                    ),
                  }
                : c
            ),
          }))
        }
        analytics.trackEvent(
          "message_deleted",
          { conversationId, messageId, deleteForEveryone },
          state.profile.displayName
        )
        addToast(deleteForEveryone ? "Message deleted for everyone" : "Message deleted", "success")
      } catch (err) {
        errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
        addToast("Failed to delete message", "error")
      }
    },
    [state.conversations, state.profile.displayName, domains, addToast]
  )

  const replyToMessage = useCallback(
    async (conversationId: string, replyToMessageId: string, text: string) => {
      const conv = state.conversations.find((c) => c.id === conversationId)
      const parent = conv?.messages?.find((m) => m.id === replyToMessageId)
      if (!conv || !parent || parent.isDeleted || parent.isDeletedForEveryone) {
        addToast("Original message is no longer available", "error")
        return false
      }
      const sent = await sendMessage(conversationId, text, replyToMessageId)
      if (sent) analytics.trackEvent("message_replied", { conversationId, replyToMessageId }, state.profile.displayName)
      return sent
    },
    [state.conversations, state.profile.displayName, sendMessage, addToast]
  )

  const forwardMessage = useCallback(
    async (conversationId: string, messageId: string) => {
      const conv = state.conversations.find((c) => c.id === conversationId)
      if (!conv) return

      const message = conv.messages.find((m) => m.id === messageId)
      if (!message) return

      const forwarded = handleMessageForwarding(message, "current-user")
      if (!forwarded) {
        addToast("Cannot forward this message", "error")
        return
      }

      setState((s) => ({
        ...s,
        conversations: s.conversations.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                messages: [...c.messages, forwarded],
                lastMessage: message.text,
                lastMessageTime: Date.now(),
              }
            : c
        ),
      }))

      analytics.trackEvent("message_forwarded", { conversationId, messageId }, state.profile.displayName)
      addToast("Message forwarded", "success")
    },
    [state.conversations, state.profile.displayName, addToast]
  )

  const addMessageReaction = useCallback(
    async (conversationId: string, messageId: string, emoji: string) => {
      setState((s) => ({
        ...s,
        conversations: s.conversations.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === messageId ? handleMessageReaction(m, emoji, "current-user", true) : m
                ),
              }
            : c
        ),
      }))

      analytics.trackEvent("reaction_added", { conversationId, messageId, emoji }, state.profile.displayName)
    },
    [state.profile.displayName]
  )

  const removeMessageReaction = useCallback(
    async (conversationId: string, messageId: string, emoji: string) => {
      setState((s) => ({
        ...s,
        conversations: s.conversations.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === messageId ? handleMessageReaction(m, emoji, "current-user", false) : m
                ),
              }
            : c
        ),
      }))

      analytics.trackEvent("reaction_removed", { conversationId, messageId, emoji }, state.profile.displayName)
    },
    [state.profile.displayName]
  )

  const pinMessage = useCallback(async (conversationId: string, messageId: string) => {
    setState((s) => ({
      ...s,
      conversations: s.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, messages: c.messages.map((m) => (m.id === messageId ? { ...m, isPinned: true } : m)) }
          : c
      ),
    }))
    try {
      const res = await fetch(
        `/api/messaging/conversations/${encodeURIComponent(conversationId)}/messages`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...IdentityService.getAuthHeaders(),
          },
          body: JSON.stringify({ messageId, pinned: true }),
        }
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        durable?: boolean
        error?: string
      }
      if (!res.ok || data.ok === false || data.durable === false) {
        setState((s) => ({
          ...s,
          conversations: s.conversations.map((c) =>
            c.id === conversationId
              ? { ...c, messages: c.messages.map((m) => (m.id === messageId ? { ...m, isPinned: false } : m)) }
              : c
          ),
        }))
        addToast(data.error || "Could not pin message on the server", "error")
        return
      }
      addToast("Message pinned", "success")
    } catch {
      setState((s) => ({
        ...s,
        conversations: s.conversations.map((c) =>
          c.id === conversationId
            ? { ...c, messages: c.messages.map((m) => (m.id === messageId ? { ...m, isPinned: false } : m)) }
            : c
        ),
      }))
      addToast("Could not reach the server to pin this message", "error")
    }
  }, [addToast])

  const unpinMessage = useCallback(async (conversationId: string, messageId: string) => {
    setState((s) => ({
      ...s,
      conversations: s.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, messages: c.messages.map((m) => (m.id === messageId ? { ...m, isPinned: false } : m)) }
          : c
      ),
    }))
    try {
      const res = await fetch(
        `/api/messaging/conversations/${encodeURIComponent(conversationId)}/messages`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...IdentityService.getAuthHeaders(),
          },
          body: JSON.stringify({ messageId, pinned: false }),
        }
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        durable?: boolean
        error?: string
      }
      if (!res.ok || data.ok === false || data.durable === false) {
        setState((s) => ({
          ...s,
          conversations: s.conversations.map((c) =>
            c.id === conversationId
              ? { ...c, messages: c.messages.map((m) => (m.id === messageId ? { ...m, isPinned: true } : m)) }
              : c
          ),
        }))
        addToast(data.error || "Could not unpin message on the server", "error")
        return
      }
      addToast("Message unpinned", "success")
    } catch {
      setState((s) => ({
        ...s,
        conversations: s.conversations.map((c) =>
          c.id === conversationId
            ? { ...c, messages: c.messages.map((m) => (m.id === messageId ? { ...m, isPinned: true } : m)) }
            : c
        ),
      }))
      addToast("Could not reach the server to unpin this message", "error")
    }
  }, [addToast])

  const sendVoiceNote = useCallback(
    async (conversationId: string, audioBlob: Blob, waveform: number[]) => {
      // Durable messaging API is text-only; do not claim durable delivery for voice.
      if (isDurableMessagingEnabled()) {
        addToast("Voice notes are not available with durable messaging yet", "error")
        return
      }
      try {
        const message = await createVoiceNoteMessage(audioBlob, waveform, "current-user")
        setState((s) => ({
          ...s,
          conversations: s.conversations.map((c) =>
            c.id === conversationId
              ? { ...c, messages: [...c.messages, message], lastMessage: "🎤 Voice message", lastMessageTime: Date.now() }
              : c
          ),
        }))
        analytics.trackEvent("voice_note_sent", { conversationId }, state.profile.displayName)
        addToast("Voice note is device-local only — durable messaging is text-first", "info")
      } catch (error) {
        errorLogger.logError(error instanceof Error ? error : new Error(String(error)))
        addToast("Failed to send voice note", "error")
      }
    },
    [state.profile.displayName, addToast]
  )

  const sendMediaMessage = useCallback(
    async (conversationId: string, mediaUrl: string, type: "image" | "file" | "video", fileName?: string) => {
      const url = String(mediaUrl || "").trim()
      // Fail closed: never claim cross-device delivery for blob/data URLs.
      if (!url || url.startsWith("blob:") || url.startsWith("data:")) {
        addToast("Upload the file to the server first, then send it in chat", "error")
        return
      }
      try {
        const { isDurableMediaUrl } = await import("@/lib/media/durable-url")
        if (!isDurableMediaUrl(url) && !/^https?:\/\//i.test(url)) {
          addToast("Only server-stored media can be sent in chat", "error")
          return
        }
      } catch { /* */ }

      const text =
        type === "image" ? "📷 Photo" : type === "video" ? "🎥 Video" : `📎 ${fileName || "File"}`
      const clientMessageId = generateId()
      const attachment = {
        id: generateId(),
        type,
        url,
        fileName,
      }
      const optimistic: Message = {
        id: clientMessageId,
        senderId: state.profile?.id || IdentityService.getCurrentUserId?.() || "me",
        text,
        createdAt: Date.now(),
        status: "sending",
        mediaAttachments: [attachment],
      }
      setState((s) => ({
        ...s,
        conversations: s.conversations.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                messages: [...(c.messages || []), optimistic],
                lastMessage: text,
                lastMessageTime: Date.now(),
              }
            : c
        ),
      }))

      try {
        const { apiSendMessage } = await import("@/lib/messaging/server-messaging-sync")
        const res = await apiSendMessage(
          conversationId,
          text,
          clientMessageId,
          undefined,
          undefined,
          [attachment]
        )
        if (!res.httpOk || res.ok === false) {
          setState((s) => ({
            ...s,
            conversations: s.conversations.map((c) =>
              c.id === conversationId
                ? {
                    ...c,
                    messages: (c.messages || []).map((m) =>
                      m.id === clientMessageId ? { ...m, status: "failed" as const } : m
                    ),
                  }
                : c
            ),
          }))
          addToast(
            typeof res.error === "string" ? `Could not send media (${res.error})` : "Could not send media message",
            "error"
          )
          return
        }
        const serverMsg = res.message as { id?: string } | undefined
        setState((s) => ({
          ...s,
          conversations: s.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: (c.messages || []).map((m) =>
                    m.id === clientMessageId
                      ? {
                          ...m,
                          id: serverMsg?.id || m.id,
                          status: "sent" as const,
                          mediaAttachments: [attachment],
                        }
                      : m
                  ),
                }
              : c
          ),
        }))
        analytics.trackEvent("media_sent", { conversationId, type, durable: true }, state.profile.displayName)
      } catch {
        setState((s) => ({
          ...s,
          conversations: s.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: (c.messages || []).map((m) =>
                    m.id === clientMessageId ? { ...m, status: "failed" as const } : m
                  ),
                }
              : c
          ),
        }))
        addToast("Could not send media message", "error")
      }
    },
    [state.profile?.id, state.profile.displayName, addToast]
  )

  const scheduleMessage = useCallback(
    async (conversationId: string, text: string, scheduledFor: number) => {
      if (isDurableMessagingEnabled()) {
        addToast("Scheduled messages are not available with durable messaging yet", "error")
        return
      }
      const message: Message = {
        id: generateId(),
        senderId: "current-user",
        text,
        createdAt: Date.now(),
        status: "sending",
        scheduledFor,
      }

      setState((s) => ({
        ...s,
        conversations: s.conversations.map((c) =>
          c.id === conversationId ? { ...c, messages: [...c.messages, message] } : c
        ),
      }))

      analytics.trackEvent("message_scheduled", { conversationId }, state.profile.displayName)
      addToast("Message scheduled on this device only — not server durable yet", "info")
    },
    [state.profile.displayName, addToast]
  )

  const sendDisappearingMessage = useCallback(
    async (conversationId: string, text: string, expiresInSeconds: number = 300) => {
      if (isDurableMessagingEnabled()) {
        addToast("Disappearing messages are not available with durable messaging yet", "error")
        return
      }
      const message: Message = {
        id: generateId(),
        senderId: "current-user",
        text,
        createdAt: Date.now(),
        status: "sending",
        expiresIn: expiresInSeconds,
        expiresAt: Date.now() + expiresInSeconds * 1000,
      }

      setState((s) => ({
        ...s,
        conversations: s.conversations.map((c) =>
          c.id === conversationId
            ? { ...c, messages: [...c.messages, message], lastMessage: text, lastMessageTime: Date.now() }
            : c
        ),
      }))

      analytics.trackEvent("disappearing_message_sent", { conversationId }, state.profile.displayName)
      addToast("Disappearing message is device-local only — not durable messaging", "info")
    },
    [state.profile.displayName, addToast]
  )

  const saveDraft = useCallback((conversationId: string, text: string) => {
    draftStorage.save(conversationId, text)
  }, [])

  const loadDraft = useCallback((conversationId: string): string | null => {
    const draft = draftStorage.load(conversationId)
    return draft?.text || null
  }, [])

  /** Context API: run in-conversation message search via unified engine (no side effects). */
  const searchMessages = useCallback(
    async (conversationId: string, query: string) => {
      const conv = state.conversations.find((c) => c.id === conversationId)
      if (!conv) return
      searchMessagesInThread(conv.messages || [], { query })
    },
    [state.conversations]
  )

  const pinConversation = useCallback(async (conversationId: string) => {
    // Local-only — no durable conversation pin API.
    setState((s) => ({
      ...s,
      conversations: s.conversations.map((c) => (c.id === conversationId ? toggleConversationPin(c) : c)),
    }))
    addToast("Conversation pinned on this device only", "info")
  }, [addToast])

  const unpinConversation = useCallback(async (conversationId: string) => {
    setState((s) => ({
      ...s,
      conversations: s.conversations.map((c) => (c.id === conversationId ? toggleConversationPin(c) : c)),
    }))
    addToast("Conversation unpinned on this device only", "info")
  }, [addToast])

  const archiveConversation = useCallback(async (conversationId: string) => {
    // Local-only — no durable conversation archive API.
    setState((s) => ({
      ...s,
      conversations: s.conversations.map((c) => (c.id === conversationId ? toggleConversationArchive(c) : c)),
    }))
    addToast("Conversation archived on this device only", "info")
  }, [addToast])

  const unarchiveConversation = useCallback(async (conversationId: string) => {
    setState((s) => ({
      ...s,
      conversations: s.conversations.map((c) => (c.id === conversationId ? toggleConversationArchive(c) : c)),
    }))
    addToast("Conversation unarchived on this device only", "info")
  }, [addToast])

  const muteConversation = useCallback(async (conversationId: string, muteHours: number = 1) => {
    // Local-only conversation mute (graph muteUser is separate durable path).
    setState((s) => ({
      ...s,
      conversations: s.conversations.map((c) => (c.id === conversationId ? toggleConversationMute(c, muteHours) : c)),
    }))
    addToast(
      `Notifications muted for ${muteHours} hour${muteHours > 1 ? "s" : ""} on this device only`,
      "success"
    )
  }, [addToast])

  const unmuteConversation = useCallback(async (conversationId: string) => {
    setState((s) => ({
      ...s,
      conversations: s.conversations.map((c) => (c.id === conversationId ? toggleConversationMute(c, 0) : c)),
    }))
    addToast("Notifications unmuted on this device only", "info")
  }, [addToast])

  const setTypingIndicator = useCallback(async (conversationId: string, isTyping: boolean) => {
    setState((s) => ({
      ...s,
      conversations: s.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, isTyping, typingUser: isTyping ? "current-user" : undefined }
          : c
      ),
    }))
  }, [])

  const createGroup = useCallback(
    async (formData: any): Promise<string> => {
      try {
        // Community org + chat share one group conversation with kind=community
        const result = await domains.community.createCommunity({
          name: formData.name,
          description: formData.description,
          privacy: formData.privacy,
          category: formData.category,
          coverImage: formData.coverImage,
          welcomeMessage: formData.welcomeMessage,
          rules: formData.rules,
          invitedMembers: formData.invitedMembers || [],
        })
        if (!result.ok) {
          addToast(result.error, "error")
          return ""
        }
        let newGroup = result.data.community
        const online = typeof navigator === "undefined" ? true : navigator.onLine !== false
        if (online) {
          try {
            const { socialCreateCommunity } = await import("@/lib/social/client")
            const durable = await socialCreateCommunity({
              id: newGroup.id,
              name: newGroup.name || formData.name,
              purpose: formData.description || "",
              description: formData.description || "",
              privacy: formData.privacy,
              category: formData.category,
              coverImage:
                formData.coverImage &&
                !String(formData.coverImage).startsWith("data:") &&
                !String(formData.coverImage).startsWith("blob:")
                  ? String(formData.coverImage)
                  : undefined,
              welcomeMessage: formData.welcomeMessage || undefined,
              rules: Array.isArray(formData.rules) ? formData.rules : undefined,
              feeCurrency:
                String(formData.feeCurrency || "GHC").toUpperCase() === "PI" ? "PI" : "GHC",
            })
            const ok =
              durable &&
              typeof durable === "object" &&
              (durable as { ok?: boolean }).ok !== false &&
              (durable as { durable?: boolean }).durable !== false
            if (!ok) {
              addToast(
                (durable as { error?: string })?.error ||
                  "Could not create community on the server",
                "error"
              )
              return ""
            }
            const serverId = String(
              (durable as { id?: string; community?: { id?: string } }).id ||
                (durable as { community?: { id?: string } }).community?.id ||
                ""
            ).trim()
            if (serverId && serverId !== newGroup.id) {
              newGroup = { ...newGroup, id: serverId }
            }
          } catch {
            addToast("Could not reach the server to create this community", "error")
            return ""
          }
        }
        const me = IdentityService.getCurrentUserId() || "current-user"
        const stamped = {
          ...newGroup,
          conversationType: "group" as const,
          kind: "community",
          isCommunity: true,
          communityId: newGroup.id,
          members: Array.from(new Set([me, ...((newGroup.members as string[]) || [])])),
          groupRoles: {
            ...(newGroup.groupRoles || {}),
            [me]: "owner" as const,
          },
          createdBy: newGroup.createdBy || me,
        }
        setState((s) => ({
          ...s,
          conversations: [stamped, ...s.conversations.filter((c) => c.id !== stamped.id)],
        }))
        try {
          persistCommunityConversation(stamped)
          markJoined(stamped.id)
        } catch {
          /* */
        }
        // Server membership (idempotent) so first message is not FORBIDDEN
        try {
          const { apiEnsureConversationMember } = await import("@/lib/messaging/server-messaging-sync")
          await apiEnsureConversationMember(stamped.id, stamped.groupName || stamped.participantName)
        } catch {
          /* */
        }
        analytics.trackEvent(
          "group_created",
          { groupId: newGroup.id, category: formData.category, privacy: formData.privacy },
          state.profile.displayName
        )
        addToast(
          online
            ? `"${formData.name}" is live — Board is ready`
            : `"${formData.name}" saved offline — will sync when online`,
          "success"
        )
        return newGroup.id
      } catch (err) {
        errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
        addToast("Could not create community", "error")
        return ""
      }
    },
    [state.profile.displayName, addToast, domains]
  )

  const joinCommunity = useCallback(
    async (communityId: string): Promise<boolean> => {
      try {
        const conv = state.conversations.find((c) => c.id === communityId)
        const privacy = (conv?.privacy || "public") as string
        if (privacy === "invite-only") {
          const req = await domains.community.requestJoin(communityId)
          if (!req.ok) {
            addToast(req.error, "error")
            return false
          }
          setState((s) => ({
            ...s,
            conversations: s.conversations.map((c) =>
              c.id === communityId
                ? {
                    ...c,
                    pendingJoinRequests: req.data.pendingRequests,
                  }
                : c
            ),
          }))
          // Durable pending membership: POST /api/communities/:id/join → gh_community_join
          // (non-public → status "pending"). Never toast "Joined" for a request-only path.
          try {
            const { socialJoinCommunity } = await import("@/lib/social/client")
            const durable = await socialJoinCommunity(communityId)
            if (durable.ok === false || durable.durable === false) {
              addToast(
                durable.error || "Could not send join request to the server",
                "error"
              )
              return false
            }
            if (String(durable.status || "") === "active") {
              addToast("Joined community", "success")
              return true
            }
          } catch {
            addToast("Could not reach the server to send join request", "error")
            return false
          }
          addToast("Join request sent — waiting for approval", "info")
          return true
        }
        const result = await domains.community.joinCommunity(communityId)
        if (!result.ok) {
          // Seed/demo communities may not be in conversations yet — admit locally only in hybrid
          if (!conv) {
            setState((s) => {
              const existing = s.conversations.find((c) => c.id === communityId)
              if (existing) {
                return {
                  ...s,
                  conversations: s.conversations.map((c) =>
                    c.id === communityId
                      ? {
                          ...c,
                          members: Array.from(
                            new Set([
                              ...(c.members || []),
                              IdentityService.getCurrentUserId() || "current-user",
                            ])
                          ),
                        }
                      : c
                  ),
                }
              }
              return s
            })
            markJoined(communityId)
            addToast("Joined on this device only — server not confirmed", "error")
            return true
          }
          addToast(result.error, "error")
          return false
        }
        let durableOk: boolean | null = null
        const online = typeof navigator === "undefined" ? true : navigator.onLine !== false
        if (online) {
          try {
            const { socialJoinCommunity } = await import("@/lib/social/client")
            const durable = await socialJoinCommunity(communityId)
            if (durable.ok === false || durable.durable === false) {
              addToast(
                durable.error || "Could not join community on the server",
                "error"
              )
              return false
            }
            durableOk = true
          } catch {
            addToast("Could not reach the server to join this community", "error")
            return false
          }
        } else {
          durableOk = false
          addToast("You're offline — join will sync when online", "info")
        }
        setState((s) => {
          const memberId = IdentityService.getCurrentUserId() || "current-user"
          const next: Conversation[] = s.conversations.map((c) => {
            if (c.id !== communityId) return c
            const groupRoles: NonNullable<Conversation["groupRoles"]> = {
              ...(c.groupRoles || {}),
              [memberId]: "member",
            }
            const memberList = Array.from(
              new Set([...(result.data.members || []), memberId, ...(c.members || [])])
            )
            return {
              ...c,
              members: memberList,
              groupRoles,
              kind: (c as { kind?: string }).kind || "community",
              isCommunity: true,
              communityId: (c as { communityId?: string }).communityId || communityId,
              conversationType: "group" as const,
            }
          })
          const row = next.find((c) => c.id === communityId)
          if (row) {
            try {
              persistCommunityConversation(row)
            } catch {
              /* */
            }
          }
          return { ...s, conversations: next }
        })
        markJoined(communityId)
        try {
          const { apiEnsureConversationMember } = await import("@/lib/messaging/server-messaging-sync")
          await apiEnsureConversationMember(communityId)
        } catch {
          /* */
        }
        if (durableOk !== false) {
          addToast("Joined community", "success")
          try {
            const { reportMissionProgress } = await import("@/lib/missions/progress")
            const m = await reportMissionProgress("join_community", { communityId })
            if (m.ok && m.grantedGhc && m.grantedGhc > 0) {
              addToast(m.message || `Mission · ₲ ${m.grantedGhc}`, "success")
            } else if (m.ok && m.completed) {
              addToast(m.message || "Mission progress saved", "info")
            }
          } catch { /* */ }
        }
        analytics.trackEvent("community_joined", { communityId }, state.profile.displayName)
        return true
      } catch (err) {
        errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
        addToast("Could not join community", "error")
        return false
      }
    },
    [state.conversations, state.profile.displayName, addToast, domains]
  )

  const leaveCommunity = useCallback(
    async (communityId: string): Promise<boolean> => {
      try {
        const result = await domains.community.leaveCommunity(communityId)
        if (!result.ok) {
          addToast(result.error, "error")
          return false
        }
        try {
          const { socialLeaveCommunity } = await import("@/lib/social/client")
          const durable = await socialLeaveCommunity(communityId)
          if (durable.ok === false) {
            addToast(
              durable.error || "Left locally — server leave not confirmed",
              "info"
            )
          }
        } catch {
          addToast("Left locally — server leave not confirmed", "info")
        }
        setState((s) => {
          const next: Conversation[] = s.conversations.map((c) =>
            c.id === communityId
              ? {
                  ...c,
                  members: result.data.members,
                }
              : c
          )
          const row = next.find((c) => c.id === communityId)
          if (row) {
            try {
              persistCommunityConversation(row)
            } catch {
              /* */
            }
          }
          return { ...s, conversations: next }
        })
        markLeft(communityId)
        addToast("Left community", "info")
        return true
      } catch (err) {
        errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
        addToast("Could not leave community", "error")
        return false
      }
    },
    [addToast, domains]
  )

  const acceptCommunityInvitation = useCallback(
    async (communityId: string): Promise<boolean> => {
      try {
        const result = await domains.community.acceptInvitation(communityId)
        if (!result.ok) {
          addToast(result.error || "Invitation unavailable", "error")
          return false
        }
        setState((s) => {
          const memberId = IdentityService.getCurrentUserId() || "current-user"
          return {
            ...s,
            conversations: s.conversations.map((c) => {
              if (c.id !== communityId) return c
              const groupRoles: NonNullable<Conversation["groupRoles"]> = {
                ...(c.groupRoles || {}),
                [memberId]: "member",
              }
              return {
                ...c,
                members: result.data.members,
                invitedMembers: (c.invitedMembers || []).filter((id: string) => id !== memberId),
                groupRoles,
              }
            }),
          }
        })
        try {
          const communityName =
            (state.conversations.find((c) => c.id === communityId))?.groupName || "community"
          emitCommunityNotification({
            subtype: "invitation_accepted",
            communityId,
            communityName,
            userId: IdentityService.getCurrentUserId() || undefined,
            actorName: state.profile.displayName || "Member",
            referenceId: `invitation_accepted:${communityId}:${IdentityService.getCurrentUserId()}`,
          })
        } catch { /* */ }
        addToast("Joined community", "success")
        return true
      } catch (err) {
        addToast("Could not accept invitation", "error")
        return false
      }
    },
    [addToast, domains, state.conversations, state.profile.displayName]
  )

  const declineCommunityInvitation = useCallback(
    async (communityId: string): Promise<boolean> => {
      try {
        const result = await domains.community.declineInvitation(communityId)
        if (!result.ok) {
          addToast(result.error || "Invitation unavailable", "error")
          return false
        }
        setState((s) => ({
          ...s,
          conversations: s.conversations.map((c) =>
            c.id === communityId
              ? {
                  ...c,
                  invitedMembers: (c.invitedMembers || []).filter(
                    (id: string) => id !== (IdentityService.getCurrentUserId() || "current-user")
                  ),
                }
              : c
          ),
        }))
        addToast("Invitation declined", "info")
        return true
      } catch {
        addToast("Could not decline invitation", "error")
        return false
      }
    },
    [addToast, domains]
  )


  const approveCommunityJoinRequest = useCallback(
    async (communityId: string, userId: string): Promise<boolean> => {
      try {
        const result = await domains.community.approveJoinRequest(communityId, userId)
        if (!result.ok) {
          addToast(result.error || "Could not approve", "error")
          return false
        }
        let durableOk: boolean | null = null
        const online = typeof navigator === "undefined" ? true : navigator.onLine !== false
        if (online) {
          try {
            const { socialDecideJoinRequest } = await import("@/lib/social/client")
            const durable = await socialDecideJoinRequest(communityId, userId, true)
            if (durable.ok === false || durable.durable === false) {
              addToast(
                durable.error || "Could not approve join on the server",
                "error"
              )
              return false
            }
            durableOk = true
          } catch {
            addToast("Could not reach the server to approve this request", "error")
            return false
          }
        } else {
          durableOk = false
          addToast("You're offline — approval will sync when online", "info")
        }
        const communityName =
          (state.conversations.find((c) => c.id === communityId))?.groupName ||
          (state.conversations.find((c) => c.id === communityId))?.participantName ||
          "community"
        setState((s) => ({
          ...s,
          conversations: s.conversations.map((c) =>
            c.id === communityId
              ? {
                  ...c,
                  members: result.data.members,
                  pendingJoinRequests: result.data.pendingJoinRequests,
                }
              : c
          ),
        }))
        try {
          emitCommunityNotification({
            subtype: "join_accepted",
            communityId,
            communityName,
            userId,
            actorName: state.profile.displayName || "Admin",
            referenceId: `join_accepted:${communityId}:${userId}`,
          })
        } catch { /* */ }
        if (durableOk !== false) {
          addToast("Join request approved", "success")
        }
        return true
      } catch {
        addToast("Could not approve request", "error")
        return false
      }
    },
    [addToast, domains, state.conversations, state.profile.displayName]
  )

  const declineCommunityJoinRequest = useCallback(
    async (communityId: string, userId: string): Promise<boolean> => {
      try {
        const result = await domains.community.declineJoinRequest(communityId, userId)
        if (!result.ok) {
          addToast(result.error || "Could not decline", "error")
          return false
        }
        let durableOk: boolean | null = null
        const online = typeof navigator === "undefined" ? true : navigator.onLine !== false
        if (online) {
          try {
            const { socialDecideJoinRequest } = await import("@/lib/social/client")
            const durable = await socialDecideJoinRequest(communityId, userId, false)
            if (durable.ok === false || durable.durable === false) {
              addToast(
                durable.error || "Could not decline join on the server",
                "error"
              )
              return false
            }
            durableOk = true
          } catch {
            addToast("Could not reach the server to decline this request", "error")
            return false
          }
        } else {
          durableOk = false
          addToast("You're offline — decline will sync when online", "info")
        }
        const communityName =
          (state.conversations.find((c) => c.id === communityId))?.groupName || "community"
        setState((s) => ({
          ...s,
          conversations: s.conversations.map((c) =>
            c.id === communityId
              ? { ...c, pendingJoinRequests: result.data.pendingJoinRequests }
              : c
          ),
        }))
        try {
          emitCommunityNotification({
            subtype: "join_declined",
            communityId,
            communityName,
            userId,
            referenceId: `join_declined:${communityId}:${userId}`,
          })
        } catch { /* */ }
        if (durableOk !== false) {
          addToast("Join request declined", "info")
        }
        return true
      } catch {
        addToast("Could not decline request", "error")
        return false
      }
    },
    [addToast, domains, state.conversations]
  )

  const inviteCommunityMember = useCallback(
    async (communityId: string, userId: string): Promise<boolean> => {
      try {
        if (!userId || userId === IdentityService.getCurrentUserId()) {
          addToast("Invalid invite target", "error")
          return false
        }
        const result = await domains.community.inviteMember(communityId, userId)
        if (!result.ok) {
          addToast(result.error || "Could not invite", "error")
          return false
        }
        const communityName =
          (state.conversations.find((c) => c.id === communityId))?.groupName || "community"
        setState((s) => ({
          ...s,
          conversations: s.conversations.map((c) =>
            c.id === communityId
              ? {
                  ...c,
                  invitedMembers: result.data.invitedMembers || [
                    ...new Set([...(c.invitedMembers || []), userId]),
                  ],
                }
              : c
          ),
        }))
        try {
          emitCommunityNotification({
            subtype: "invitation",
            communityId,
            communityName,
            userId,
            actorName: state.profile.displayName || "Member",
            referenceId: `invitation:${communityId}:${userId}`,
          })
        } catch { /* */ }
        addToast("Invitation sent", "success")
        return true
      } catch {
        addToast("Could not send invitation", "error")
        return false
      }
    },
    [addToast, domains, state.conversations, state.profile.displayName]
  )

  const requestJoinCommunity = useCallback(
    async (communityId: string): Promise<boolean> => {
      try {
        const result = await domains.community.requestJoin(communityId)
        if (!result.ok) {
          addToast(result.error, "error")
          return false
        }
        setState((s) => ({
          ...s,
          conversations: s.conversations.map((c) =>
            c.id === communityId
              ? { ...c, pendingJoinRequests: result.data.pendingRequests }
              : c
          ),
        }))
        try {
          const { socialJoinCommunity } = await import("@/lib/social/client")
          const durable = await socialJoinCommunity(communityId)
          if (durable.ok === false) {
            addToast(
              durable.error || "Could not confirm join request on the server",
              "info"
            )
          } else if (String(durable.status || "") === "active") {
            addToast("Joined community", "success")
          } else {
            addToast("Join request sent — waiting for approval", "info")
          }
        } catch {
          addToast("Could not confirm join request on the server", "error")
        }
        try {
          const communityName =
            (state.conversations.find((c) => c.id === communityId))?.groupName || "community"
          emitCommunityNotification({
            subtype: "join_request",
            communityId,
            communityName,
            userId: IdentityService.getCurrentUserId() || undefined,
            actorName: state.profile.displayName || "Member",
            referenceId: `join_request:${communityId}:${IdentityService.getCurrentUserId()}`,
          })
        } catch { /* */ }
        return true
      } catch (err) {
        addToast("Could not send request", "error")
        return false
      }
    },
    [addToast, domains, state.conversations, state.profile.displayName]
  )

  const createBoardPost = useCallback(
    async (
      communityId: string,
      body: string,
      kind: "text" | "question" | "resource" = "text"
    ): Promise<boolean> => {
      try {
        const text = String(body || "").trim()
        if (!text) {
          addToast("Write something before posting", "error")
          return false
        }
        // Membership gate (local + domain)
        const conv = state.conversations.find((c) => c.id === communityId)
        const me = IdentityService.getCurrentUserId() || state.profile?.id || ""
        const isMember =
          Boolean(conv) &&
          (conv!.createdBy === me ||
            (conv!.members || []).includes(me) ||
            Boolean(conv!.groupRoles?.[me]) ||
            conv!.createdBy === "current-user")
        if (conv && !isMember) {
          addToast("Join this community before posting on the board", "error")
          return false
        }

        // Server-first: durable social post scoped to community
        let durableId: string | null = null
        let durableOk = false
        if (typeof navigator === "undefined" || navigator.onLine) {
          try {
            const { socialCreatePost } = await import("@/lib/social/client")
            const remote = await socialCreatePost({
              content: text,
              communityId,
              // Board posts are scoped by communityId; visibility stays feed-compatible.
              visibility: "public",
              type: kind === "question" ? "text" : "text",
            } as Partial<import("@/lib/ghc-types").Post> & { content: string; communityId: string })
            if (remote.ok && remote.durable && remote.post?.id) {
              durableOk = true
              durableId = String(remote.post.id)
            } else if (remote.ok === false) {
              addToast(
                remote.error === "NOT_A_MEMBER"
                  ? "Join this community on the server before posting"
                  : remote.error || "Could not publish board post",
                "error"
              )
              return false
            }
          } catch {
            addToast("Could not reach the server to publish board post", "error")
            return false
          }
        } else {
          addToast("You're offline — board posts require a connection", "error")
          return false
        }

        const result = await domains.community.createBoardPost(communityId, { body: text, kind })
        if (!result.ok) {
          // Server already accepted — keep local board in sync for UI
          if (!durableOk) {
            addToast(result.error, "error")
            return false
          }
        }
        const post = {
          ...(result.ok ? result.data.post : {
            id: durableId || `bpost_${Date.now().toString(36)}`,
            communityId,
            authorId: me || "current-user",
            authorName: state.profile.displayName || "You",
            body: text,
            kind,
            createdAt: Date.now(),
            likes: 0,
            comments: 0,
          }),
          id: durableId || (result.ok ? result.data.post.id : `bpost_${Date.now().toString(36)}`),
          authorName: state.profile.displayName || "You",
          durable: durableOk,
        }
        setState((s) => ({
          ...s,
          conversations: s.conversations.map((c) => {
            if (c.id !== communityId) return c
            const existing = (c.boardPosts || []) as typeof post[]
            return {
              ...c,
              boardPosts: [post, ...existing],
              lastMessage: text.slice(0, 80),
              lastMessageTime: post.createdAt,
            }
          }),
        }))
        addToast(durableOk ? "Posted to community board" : "Posted to board", "success")
        return true
      } catch (err) {
        addToast("Could not post", "error")
        return false
      }
    },
    [state.profile, state.conversations, addToast, domains]
  )

  const replyToBoardPost = useCallback(
    async (communityId: string, postId: string, body: string): Promise<boolean> => {
      try {
        const result = await domains.community.replyToBoardPost(communityId, postId, body)
        if (!result.ok) {
          addToast(result.error || "Could not reply", "error")
          return false
        }
        const reply = {
          ...result.data.reply,
          authorName: state.profile.displayName || "You",
        }
        setState((s) => ({
          ...s,
          conversations: s.conversations.map((c) => {
            if (c.id !== communityId) return c
            const posts = (c.boardPosts || []) as any[]
            return {
              ...c,
              boardPosts: posts.map((p) =>
                p.id === postId
                  ? {
                      ...p,
                      replies: [...(p.replies || []), reply],
                      comments: result.data.comments,
                    }
                  : p
              ),
            }
          }),
        }))
        addToast("Reply posted", "success")
        return true
      } catch {
        addToast("Could not reply", "error")
        return false
      }
    },
    [addToast, domains, state.profile.displayName]
  )

  const reactToBoardPost = useCallback(
    async (communityId: string, postId: string): Promise<boolean> => {
      try {
        const result = await domains.community.reactToBoardPost(communityId, postId, "like")
        if (!result.ok) {
          addToast(result.error || "Could not react", "error")
          return false
        }
        setState((s) => ({
          ...s,
          conversations: s.conversations.map((c) => {
            if (c.id !== communityId) return c
            const posts = (c.boardPosts || []) as any[]
            return {
              ...c,
              boardPosts: posts.map((p) =>
                p.id === postId
                  ? {
                      ...p,
                      likes: result.data.likes,
                      likedBy: result.data.likedBy,
                    }
                  : p
              ),
            }
          }),
        }))
        return true
      } catch {
        addToast("Could not react", "error")
        return false
      }
    },
    [addToast, domains]
  )


  const pinBoardPost = useCallback(
    async (communityId: string, postId: string): Promise<boolean> => {
      try {
        const result = await domains.community.pinBoardPost(communityId, postId)
        if (!result.ok) {
          addToast(result.error || "Could not pin", "error")
          return false
        }
        setState((s) => ({
          ...s,
          conversations: s.conversations.map((c) => {
            if (c.id !== communityId) return c
            const posts = (c.boardPosts || []) as any[]
            return {
              ...c,
              boardPosts: posts.map((p) =>
                p.id === postId ? { ...p, pinned: true } : p
              ),
            }
          }),
        }))
        try {
          appendModerationLog({
            communityId,
            action: "pin",
            actorId: IdentityService.getCurrentUserId() || "unknown",
            targetType: "post",
            targetId: postId,
          })
        } catch { /* */ }
        addToast("Discussion pinned", "success")
        return true
      } catch {
        addToast("Could not pin", "error")
        return false
      }
    },
    [addToast, domains]
  )

  const unpinBoardPost = useCallback(
    async (communityId: string, postId: string): Promise<boolean> => {
      try {
        const result = await domains.community.unpinBoardPost(communityId, postId)
        if (!result.ok) {
          addToast(result.error || "Could not unpin", "error")
          return false
        }
        setState((s) => ({
          ...s,
          conversations: s.conversations.map((c) => {
            if (c.id !== communityId) return c
            const posts = (c.boardPosts || []) as any[]
            return {
              ...c,
              boardPosts: posts.map((p) =>
                p.id === postId ? { ...p, pinned: false } : p
              ),
            }
          }),
        }))
        try {
          appendModerationLog({
            communityId,
            action: "unpin",
            actorId: IdentityService.getCurrentUserId() || "unknown",
            targetType: "post",
            targetId: postId,
          })
        } catch { /* */ }
        addToast("Discussion unpinned", "info")
        return true
      } catch {
        addToast("Could not unpin", "error")
        return false
      }
    },
    [addToast, domains]
  )

  const hideBoardPost = useCallback(
    async (communityId: string, postId: string): Promise<boolean> => {
      try {
        const result = await domains.community.hideBoardPost(communityId, postId)
        if (!result.ok) {
          addToast(result.error || "Could not hide", "error")
          return false
        }
        setState((s) => ({
          ...s,
          conversations: s.conversations.map((c) => {
            if (c.id !== communityId) return c
            const posts = (c.boardPosts || []) as any[]
            return {
              ...c,
              boardPosts: posts.map((p) =>
                p.id === postId ? { ...p, hidden: true, pinned: false } : p
              ),
            }
          }),
        }))
        try {
          appendModerationLog({
            communityId,
            action: "hide",
            actorId: IdentityService.getCurrentUserId() || "unknown",
            targetType: "post",
            targetId: postId,
          })
        } catch { /* */ }
        addToast("Discussion hidden", "info")
        return true
      } catch {
        addToast("Could not hide", "error")
        return false
      }
    },
    [addToast, domains]
  )

  const unhideBoardPost = useCallback(
    async (communityId: string, postId: string): Promise<boolean> => {
      try {
        const result = await domains.community.unhideBoardPost(communityId, postId)
        if (!result.ok) {
          addToast(result.error || "Could not unhide", "error")
          return false
        }
        setState((s) => ({
          ...s,
          conversations: s.conversations.map((c) => {
            if (c.id !== communityId) return c
            const posts = (c.boardPosts || []) as any[]
            return {
              ...c,
              boardPosts: posts.map((p) =>
                p.id === postId ? { ...p, hidden: false } : p
              ),
            }
          }),
        }))
        try {
          appendModerationLog({
            communityId,
            action: "unhide",
            actorId: IdentityService.getCurrentUserId() || "unknown",
            targetType: "post",
            targetId: postId,
          })
        } catch { /* */ }
        addToast("Discussion restored", "success")
        return true
      } catch {
        addToast("Could not unhide", "error")
        return false
      }
    },
    [addToast, domains]
  )

  const transitionCommunityLifecycle = useCallback(
    async (
      communityId: string,
      next: "draft" | "discoverable" | "active" | "quiet" | "archived"
    ): Promise<boolean> => {
      try {
        const result = await domains.community.transitionLifecycle(communityId, next)
        if (!result.ok) {
          addToast(result.error || "Could not update status", "error")
          return false
        }
        setState((s) => ({
          ...s,
          conversations: s.conversations.map((c) =>
            c.id === communityId ? { ...c, lifecycle: next } : c
          ),
        }))
        try {
          appendModerationLog({
            communityId,
            action: "lifecycle",
            actorId: IdentityService.getCurrentUserId() || "unknown",
            targetType: "community",
            targetId: communityId,
            metadata: { lifecycle: next },
          })
        } catch { /* */ }
        addToast(`Community marked ${next}`, "success")
        return true
      } catch {
        addToast("Could not update community status", "error")
        return false
      }
    },
    [addToast, domains]
  )

  const reportCommunityContent = useCallback(
    async (
      communityId: string,
      input: {
        targetType: "community" | "post" | "member"
        targetId: string
        reason: "spam" | "harassment" | "hate" | "misinformation" | "impersonation" | "safety" | "other"
        note?: string
      }
    ): Promise<boolean> => {
      try {
        const result = await domains.community.reportCommunityContent(communityId, input)
        if (!result.ok) {
          addToast(result.error || "Could not submit report", "error")
          return false
        }
        const durableResponse = await fetch(`/api/communities/${encodeURIComponent(communityId)}/platform`, {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ action: "report_create", ...input }),
        })
        const durablePayload = await durableResponse.json().catch(() => ({}))
        if (!durableResponse.ok || durablePayload?.durable !== true) {
          addToast(durablePayload?.error || "Report could not be saved on the server", "error")
          return false
        }
        try {
          createCommunityReport({
            communityId,
            targetType: input.targetType,
            targetId: input.targetId,
            reporterId: IdentityService.getCurrentUserId() || "unknown",
            reason: input.reason,
            note: input.note,
          })
        } catch { /* */ }
        addToast("Report submitted — thank you", "success")
        return true
      } catch {
        addToast("Could not submit report", "error")
        return false
      }
    },
    [addToast, domains]
  )

  const createCommunityAnnouncement = useCallback(
    async (
      communityId: string,
      input: { title: string; content: string; type?: "info" | "important" | "celebration" | "maintenance" }
    ): Promise<boolean> => {
      try {
        const result = await domains.community.createAnnouncement(communityId, input)
        if (!result.ok) {
          addToast(result.error || "Could not announce", "error")
          return false
        }
        const durableResponse = await fetch(`/api/communities/${encodeURIComponent(communityId)}/platform`, {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ action: "announcement_create", ...input }),
        })
        const durablePayload = await durableResponse.json().catch(() => ({}))
        if (!durableResponse.ok || durablePayload?.durable !== true || !durablePayload?.announcement) {
          addToast(durablePayload?.error || "Announcement could not be saved on the server", "error")
          return false
        }
        const announcement = durablePayload.announcement
        const communityName =
          (state.conversations.find((c) => c.id === communityId))?.groupName || "community"
        setState((s) => ({
          ...s,
          conversations: s.conversations.map((c) => {
            if (c.id !== communityId) return c
            const existing = ((c as any).announcements || []) as any[]
            return {
              ...c,
              announcements: [announcement, ...existing],
            }
          }),
        }))
        try {
          emitCommunityNotification({
            subtype: "announcement",
            communityId,
            communityName,
            actorName: state.profile.displayName || "Moderator",
            referenceId: `announcement:${communityId}:${announcement.id}`,
            messageOverride: input.title,
          })
        } catch { /* */ }
        addToast("Announcement published", "success")
        return true
      } catch {
        addToast("Could not publish announcement", "error")
        return false
      }
    },
    [addToast, domains, state.conversations, state.profile.displayName]
  )

  const createCommunityEvent = useCallback(
    async (
      communityId: string,
      input: {
        title: string
        description: string
        startTime: number
        endTime: number
        location?: string
        category?: "meeting" | "social" | "workshop" | "discussion" | "celebration"
      }
    ): Promise<boolean> => {
      try {
        const result = await domains.community.createEvent(communityId, input)
        if (!result.ok) {
          addToast(result.error || "Could not create event", "error")
          return false
        }
        const durableResponse = await fetch(`/api/communities/${encodeURIComponent(communityId)}/platform`, {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ action: "event_create", title: input.title, description: input.description, startsAt: new Date(input.startTime).toISOString(), endsAt: new Date(input.endTime).toISOString(), location: input.location, category: input.category }),
        })
        const durablePayload = await durableResponse.json().catch(() => ({}))
        if (!durableResponse.ok || durablePayload?.durable !== true || !durablePayload?.event) {
          addToast(durablePayload?.error || "Event could not be saved on the server", "error")
          return false
        }
        const event = durablePayload.event
        setState((s) => ({
          ...s,
          conversations: s.conversations.map((c) => {
            if (c.id !== communityId) return c
            const existing = (c.events || []) as any[]
            return { ...c, events: [event, ...existing] }
          }),
        }))
        addToast("Event scheduled", "success")
        return true
      } catch {
        addToast("Could not create event", "error")
        return false
      }
    },
    [addToast, domains]
  )

  const rsvpCommunityEvent = useCallback(
    async (communityId: string, eventId: string): Promise<boolean> => {
      try {
        const durableResponse = await fetch(`/api/communities/${encodeURIComponent(communityId)}/platform`, {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ action: "event_rsvp", eventId, status: "going" }),
        })
        const durablePayload = await durableResponse.json().catch(() => ({}))
        if (!durableResponse.ok || durablePayload?.durable !== true) {
          addToast(durablePayload?.error || "RSVP could not be saved", "error")
          return false
        }
        setState((s) => ({
          ...s,
          conversations: s.conversations.map((c) => {
            if (c.id !== communityId) return c
            const events = ((c.events || []) as any[]).map((e) => {
              if (e.id !== eventId) return e
              const attendees = Array.from(
                new Set([...(e.attendees || []), IdentityService.getCurrentUserId() || "current-user"]),
              )
              return { ...e, attendees, rsvpCount: attendees.length }
            })
            return { ...c, events }
          }),
        }))
        addToast("You're attending", "success")
        return true
      } catch {
        return false
      }
    },
    [addToast]
  )

    const addGroupMember = useCallback(
    async (conversationId: string, userId: string) => {
      setState((s) => ({
        ...s,
        conversations: s.conversations.map((c) =>
          c.id === conversationId && !c.members?.includes(userId)
            ? { ...c, members: [...(c.members || []), userId] }
            : c
        ),
      }))
      analytics.trackEvent("group_member_added", { conversationId, userId }, state.profile.displayName)
      addToast("Member added", "success")
    },
    [state.profile.displayName, addToast]
  )

  const removeGroupMember = useCallback(
    async (conversationId: string, userId: string) => {
      try {
        const response = await fetch(`/api/communities/${encodeURIComponent(conversationId)}/platform`, {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ action: "member_remove", targetUserId: userId }),
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok || payload?.durable !== true) {
          addToast(payload?.error || "Member could not be removed", "error")
          return
        }
        setState((s) => ({
          ...s,
          conversations: s.conversations.map((c) =>
            c.id === conversationId ? applyRemoveGroupMember(c, userId) : c
          ),
        }))
        analytics.trackEvent("group_member_removed", { conversationId, userId }, state.profile.displayName)
        addToast("Member removed", "success")
      } catch {
        addToast("Could not reach the community server", "error")
      }
    },
    [state.profile.displayName, addToast]
  )

  const setGroupRole = useCallback(
    async (conversationId: string, userId: string, role: "admin" | "member" | "owner" | "moderator") => {
      try {
        const normalized =
          role === "admin" || role === "owner" || role === "moderator" || role === "member"
            ? role
            : "member"
        const result = await domains.community.setRole(conversationId, userId, normalized as any)
        if (!result.ok) {
          addToast(result.error, "error")
          return
        }
        // Durable role when community membership is server-backed
        try {
          // Owner transfer is separate; map owner promotion request to admin on API
          const roleApi =
            normalized === "owner" ? "admin" : normalized
          await fetch(`/api/communities/${encodeURIComponent(conversationId)}/roles`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ targetUserId: userId, role: roleApi }),
          })
        } catch {
          /* offline / studio */
        }
        setState((s) => ({
          ...s,
          conversations: s.conversations.map((c) => {
            if (c.id !== conversationId) return c
            const role = result.data.role
            const safeRole: NonNullable<Conversation["groupRoles"]>[string] =
              role === "owner" || role === "admin" || role === "moderator" || role === "member"
                ? role
                : "member"
            const groupRoles: NonNullable<Conversation["groupRoles"]> = {
              ...(c.groupRoles || {}),
              [userId]: safeRole,
            }
            return { ...c, groupRoles }
          }),
        }))
        analytics.trackEvent(
          "group_role_updated",
          { conversationId, userId, role: result.data.role },
          state.profile.displayName
        )
        addToast("Role updated", "success")
      } catch (err) {
        errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
        addToast("Could not update role", "error")
      }
    },
    [state.profile.displayName, addToast, domains]
  )

  const updateGroupName = useCallback(
    async (conversationId: string, newName: string) => {
      setState((s) => ({
        ...s,
        conversations: s.conversations.map((c) =>
          c.id === conversationId ? { ...c, groupName: newName, participantName: newName } : c
        ),
      }))
      analytics.trackEvent("group_name_updated", { conversationId }, state.profile.displayName)
      addToast("Group name updated", "success")
    },
    [state.profile.displayName, addToast]
  )

  const updateGroupPhoto = useCallback(
    async (conversationId: string, photoUrl: string) => {
      setState((s) => ({
        ...s,
        conversations: s.conversations.map((c) =>
          c.id === conversationId ? { ...c, groupPhoto: photoUrl, participantPhoto: photoUrl } : c
        ),
      }))
      analytics.trackEvent("group_photo_updated", { conversationId }, state.profile.displayName)
      addToast("Group photo updated", "success")
    },
    [state.profile.displayName, addToast]
  )

  const logout = useCallback(async () => {
    try {
      backupRecoveryManager.createBackup(state.profile, state.settings, state.posts, state.conversations, "manual")
      // Server-side GH session revoke + clear HttpOnly cookie (Phase 2B)
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        })
      } catch {
        /* network — still clear local state */
      }
      // Clear local App Lock session flags (keeps PIN hash for next login)
      try {
        const { clearLockSessionState } = await import("@/lib/session-security")
        clearLockSessionState()
      } catch {
        /* */
      }
      // Identity domain session signal (does not replace Pi auth transport)
      await domains.identity.clearSession()
      try {
        IdentityService.clear()
      } catch {
        /* */
      }
      setState(() => createDefaultExtendedState({ ready: true }))
      addToast("Logged out successfully", "success")
      // Reset the Pi/GH auth layer too, otherwise the app stays "authenticated" and re-logs in on reload
      piSignOut()
    } catch (error) {
      errorLogger.logError(error instanceof Error ? error : new Error(String(error)))
      addToast("Error logging out", "error")
    }
  }, [addToast, state.profile, state.settings, state.posts, state.conversations, domains, piSignOut])

  const createBackup = useCallback(() => {
    try {
      backupRecoveryManager.createBackup(
        state.profile,
        state.settings,
        state.posts,
        state.conversations,
        "manual"
      )
      addToast("Backup created successfully", "success")
    } catch (error) {
      errorLogger.logError(error instanceof Error ? error : new Error(String(error)))
      addToast("Failed to create backup", "error")
    }
  }, [state.profile, state.settings, state.posts, state.conversations, addToast])

  const restoreFromBackup = useCallback(async (): Promise<boolean> => {
    try {
      const latestBackup = backupRecoveryManager.getLatestBackup()

      if (!latestBackup) {
        addToast("No backup available", "error")
        return false
      }

      // Verify backup integrity
      if (!backupRecoveryManager.verifySnapshot(latestBackup)) {
        addToast("Backup verification failed - possible corruption", "error")
        return false
      }

      // Restore within transaction for atomicity
      const result = await transactionManager.executeTransaction(async () => {
        if (latestBackup.data.profile) {
          setState((s) => ({ ...s, profile: latestBackup.data.profile! }))
        }

        if (latestBackup.data.settings) {
          setState((s) => ({ ...s, settings: latestBackup.data.settings! }))
        }

        setState((s) => ({ 
          ...s, 
          posts: latestBackup.data.posts, 
          conversations: latestBackup.data.conversations 
        }))

        return true
      })

      if (result.success) {
        addToast("Data restored from backup successfully", "success")
        return true
      }

      return false
    } catch (error) {
      errorLogger.logError(error instanceof Error ? error : new Error(String(error)))
      addToast("Failed to restore from backup", "error")
      return false
    }
  }, [addToast])

  const publishStory = useCallback(async (story: StoryItem): Promise<{ ok: boolean; durable?: boolean; error?: string }> => {
    try {
      const prepared: StoryItem = {
        ...story,
        id: typeof story.id === "string" && story.id ? story.id : generateId(),
        name: sanitizeDisplayName(story.name || state.profile.displayName || "User"),
        text: sanitizeText(story.text || "", 500),
        createdAt: Number.isFinite(story.createdAt) ? story.createdAt : Date.now(),
        ownerId: story.ownerId || "current-user",
        photo: story.photo || state.profile.photos?.[0],
      }
      const online = typeof navigator === "undefined" ? true : navigator.onLine !== false
      let durableStory = prepared
      if (online) {
        try {
          const { socialCreateStory } = await import("@/lib/social/client")
          const remote = await socialCreateStory({
            id: prepared.id,
            ownerId: prepared.ownerId,
            name: prepared.name,
            photo: prepared.photo,
            text: prepared.text,
            media: prepared.media,
            background: prepared.background,
            audience: prepared.audience,
            expiresAt: prepared.expiresAt || Date.now() + 24 * 60 * 60 * 1000,
            createdAt: prepared.createdAt,
          })
          if (!remote.ok || remote.durable === false) {
            return {
              ok: false,
              durable: false,
              error: remote.error || "Could not publish story to the server",
            }
          }
          if (remote.story && typeof remote.story === "object") {
            const sid = String((remote.story as { id?: string }).id || prepared.id)
            durableStory = { ...prepared, id: sid }
          }
        } catch {
          return {
            ok: false,
            durable: false,
            error: "Could not reach the server to publish this story",
          }
        }
      }
      if (!online) {
        offlineQueue.addAction({
          type: "create_story",
          payload: prepared,
          maxRetries: 3,
        })
        const resultOffline = await domains.stories.publish(prepared)
        if (!resultOffline.ok) {
          return { ok: false, error: resultOffline.error || "Could not save story offline" }
        }
        setState((s) => ({
          ...s,
          stories: sanitizeStories([
            resultOffline.data,
            ...s.stories.filter((x) => x.id !== resultOffline.data.id),
          ]),
        }))
        return { ok: true, durable: false }
      }
      const result = await domains.stories.publish(durableStory)
      if (!result.ok) {
        return { ok: false, error: result.error || "Could not publish story" }
      }
      setState((s) => ({
        ...s,
        stories: sanitizeStories([result.data, ...s.stories.filter((x) => x.id !== result.data.id)]),
      }))
      return { ok: true, durable: true }
    } catch (err) {
      errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      return { ok: false, error: "This story could not be saved safely" }
    }
  }, [domains, state.profile.displayName, state.profile.photos])

  /**
   * Canonical durable feed refresh — server authoritative when online.
   * Reconciles remote posts with local-only optimistic items; never wipes feed on failure.
   */
  const refreshFeed = useCallback(async (opts?: {
    before?: number
    beforeId?: string
    append?: boolean
    limit?: number
  }): Promise<{ ok: boolean; durable?: boolean; error?: string; appended?: number }> => {
    try {
      const { socialFetchFeed } = await import("@/lib/social/client")
      // A fresh top-level refresh supersedes any older top-level refresh. Append
      // requests keep their own generation so a late page cannot overwrite newer state.
      const generation = feedRequestRef.current.generation + 1
      if (!opts?.append) feedRequestRef.current.controller?.abort()
      const controller = new AbortController()
      feedRequestRef.current = { generation, controller }
      const feed = await socialFetchFeed({
        limit: opts?.limit ?? 40,
        before: opts?.before,
        beforeId: opts?.beforeId,
        signal: controller.signal,
      })
      if (generation !== feedRequestRef.current.generation) {
        return { ok: false, durable: false, error: "STALE_FEED_RESPONSE" }
      }
      if (!feed.ok) {
        return { ok: false, durable: false, error: feed.error || "Could not refresh feed" }
      }
      // Phase 2: merge whenever API returns posts (durable preferred, not required)
      if (feed.ok && Array.isArray(feed.posts) && feed.posts.length > 0) {
        const remotePosts = mapRemoteFeedPosts(feed.posts)
        const existingIdsBeforeMerge = new Set(postsSnapshotRef.current.map((post) => post.id))
        const newlyFetchedCount = opts?.append
          ? remotePosts.filter((post) => !existingIdsBeforeMerge.has(post.id)).length
          : remotePosts.length
        setState((s) => {
          if (opts?.append) {
            const existingIds = new Set(s.posts.map((p) => p.id))
            const onlyNew = remotePosts.filter((p) => !existingIds.has(p.id))
            const nextPosts = [...s.posts, ...onlyNew].sort(
              (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
            )
            const liked = feed.posts
              .filter((p) => (p as { likedByMe?: boolean }).likedByMe)
              .map((p) => String(p.id))
            const nextLiked = liked.length
              ? Array.from(new Set([...(s.likedPostIds || []), ...liked]))
              : s.likedPostIds
            return { ...s, posts: nextPosts, likedPostIds: nextLiked }
          }
          const remoteIds = new Set(remotePosts.map((p) => p.id))
          const localOnly = s.posts.filter((p) => !remoteIds.has(p.id) && !p.deletedAt)
          const nextPosts = [...remotePosts, ...localOnly].sort(
            (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
          )
          const liked = feed.posts
            .filter((p) => (p as { likedByMe?: boolean }).likedByMe)
            .map((p) => String(p.id))
          const nextLiked = liked.length
            ? Array.from(new Set([...(s.likedPostIds || []), ...liked]))
            : s.likedPostIds
          return { ...s, posts: nextPosts, likedPostIds: nextLiked }
        })
        return { ok: true, durable: Boolean(feed.durable), appended: newlyFetchedCount }
      }
      // Server reachable but empty / non-durable — preserve existing local feed
      return { ok: true, durable: Boolean(feed.durable), appended: 0 }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return { ok: false, durable: false, error: "FEED_REQUEST_SUPERSEDED" }
      }
      const message = err instanceof Error ? err.message : "Could not refresh feed"
      return { ok: false, durable: false, error: message }
    }
  }, [])

  /**
   * Story reply → Messaging domain: open or create private conversation with story owner.
   * Does not invent a parallel story-messaging channel.
   */
  const replyToStory = useCallback(
    async (storyId: string): Promise<string | null> => {
      try {
        const target = domains.stories.resolveReplyTarget(storyId)
        if (!target.ok) {
          addToast(target.error, "error")
          return null
        }
        const { ownerId, ownerName, ownerPhoto } = target.data
        if (!canMessageUser(ownerId)) {
          addToast("You cannot message this person with your current privacy settings.", "info")
          return null
        }
        return await startConversation(
          ownerId,
          ownerName,
          ownerPhoto || "/placeholder.svg?width=40&height=40"
        )
      } catch (err) {
        errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
        addToast("Could not open conversation", "error")
        return null
      }
    },
    [domains, addToast, canMessageUser, startConversation]
  )

  const setTab = useCallback((tab: Tab) => {
    startTransition(() => {
      setState((s) => (s.tab === tab ? s : { ...s, tab: tab as Tab }))
    })
  }, [])

  // Platform-wide block + mute enforcement (single policy, not per-screen rules)
  const blockedIdsForUi = useMemo(
    () =>
      resolveBlockedIds({
        blockedUsers: state.blockedUsers,
        settingsBlocked: state.settings?.blockedUsers,
      }),
    [state.blockedUsers, state.settings?.blockedUsers]
  )

  const mutedIdsForUi = useMemo(() => {
    const fromState = ((state as { mutedUsers?: string[] }).mutedUsers) || []
    const fromSettings = state.settings?.mutedUsers || []
    return Array.from(new Set([...fromState, ...fromSettings]))
  }, [state])

  const visibleSession = useMemo(
    () =>
      applyGlobalBlockFilters({
        blockedIds: blockedIdsForUi,
        mutedIds: mutedIdsForUi,
        posts: state.posts,
        candidates: state.candidates,
        matches: state.matches,
        conversations: state.conversations,
        stories: state.stories,
      }),
    [
      blockedIdsForUi,
      mutedIdsForUi,
      state.posts,
      state.candidates,
      state.matches,
      state.conversations,
      state.stories,
    ]
  )

  // Stable context value — prevents every consumer re-rendering when only parent re-renders
  const contextValue = useMemo(
    () => ({
      ready: state.ready,
      profile: state.profile,
      settings: state.settings,
      posts: visibleSession.posts,
      stories: visibleSession.stories,
      publishStory,
      refreshFeed,
      replyToStory,
      tab: state.tab,
      toasts: state.toasts,
      candidates: visibleSession.candidates,
      matches: visibleSession.matches,
      likes: state.likes,
      conversations: visibleSession.conversations,
      friendRequests: state.friendRequests,
      following: state.following,
      friends: state.friends || [],
      shares: state.shares || [],
      reposts: state.reposts || [],
      likedPostIds: state.likedPostIds,
      isOnline: state.isOnline,
      networkQuality: state.networkQuality,
      dataIntegrity: "verified" as const,
      createBackup,
      restoreFromBackup,
      updateProfile,
      completeOnboarding,
      localProfiles: typeof window === "undefined" ? [] : readLocalProfiles(),
      switchLocalProfile,
      createLocalProfile,
      createPost,
      likePost,
      reactToPost,
      deletePost,
      editPost,
      archivePost,
      unarchivePost,
      addComment,
      loadPostComments,
      editComment,
      deleteComment,
      addCommentReaction,
      removeCommentReaction,
      pinComment,
      unpinComment,
      createQuoteRepost,
      sharePost,
      applyShareResult,
      savePost,
      unsavePost,
      hidePost,
      markNotInterested,
      reportPost,
      reportContent,
      muteUser,
      unmuteUser,
      restrictUser,
      unrestrictUser,
      followFromPost,
      unfollowFromPost,
      updateSettings,
      canViewProfile,
      canMessageUser,
      canViewStory,
      canSeeOnlineStatus,
      swipe,
      matchCelebration: state.matchCelebration,
      dismissMatchCelebration,
      followUser,
      addFriend,
      reportUser,
      blockUser,
      unblockUser,
      blockedUsers: blockedIdsForUi,
      mutedUsers: mutedIdsForUi,
      startConversation,
      acceptMatch,
      rejectMatch,
      sendMessage,
      loadConversationMessages,
      editMessage,
      deleteMessage,
      replyToMessage,
      forwardMessage,
      addMessageReaction,
      removeMessageReaction,
      pinMessage,
      unpinMessage,
      sendVoiceNote,
      sendMediaMessage,
      scheduleMessage,
      sendDisappearingMessage,
      saveDraft,
      loadDraft,
      searchMessages,
      markConversationRead,
      pinConversation,
      unpinConversation,
      archiveConversation,
      unarchiveConversation,
      muteConversation,
      unmuteConversation,
      setTypingIndicator,
      createGroup,
      joinCommunity,
      acceptCommunityInvitation,
      declineCommunityInvitation,
      leaveCommunity,
      requestJoinCommunity,
      approveCommunityJoinRequest,
      declineCommunityJoinRequest,
      inviteCommunityMember,
      createBoardPost,
      replyToBoardPost,
      reactToBoardPost,
      pinBoardPost,
      unpinBoardPost,
      hideBoardPost,
      unhideBoardPost,
      createCommunityAnnouncement,
      createCommunityEvent,
      rsvpCommunityEvent,
      transitionCommunityLifecycle,
      reportCommunityContent,
      addGroupMember,
      removeGroupMember,
      setGroupRole,
      updateGroupName,
      updateGroupPhoto,
      setTab,
      addToast,
      logout,
    }),
    // The context value exposes these stable callbacks. Include every callback
    // so memoization remains correct when a callback implementation changes.
    [
      state.ready,
      state.profile,
      state.settings,
      state.tab,
      state.toasts,
      state.likes,
      state.friendRequests,
      state.following,
      state.friends,
      state.shares,
      state.reposts,
      state.likedPostIds,
      state.isOnline,
      state.networkQuality,
      state.matchCelebration,
      visibleSession,
      blockedIdsForUi,
      mutedIdsForUi,
      acceptCommunityInvitation,
      acceptMatch,
      addComment,
      addCommentReaction,
      addFriend,
      addGroupMember,
      addMessageReaction,
      addToast,
      applyShareResult,
      approveCommunityJoinRequest,
      archiveConversation,
      archivePost,
      blockUser,
      canMessageUser,
      canSeeOnlineStatus,
      canViewProfile,
      canViewStory,
      completeOnboarding,
      createBackup,
      createBoardPost,
      createCommunityAnnouncement,
      createCommunityEvent,
      createGroup,
      createLocalProfile,
      createPost,
      createQuoteRepost,
      declineCommunityInvitation,
      declineCommunityJoinRequest,
      deleteComment,
      deleteMessage,
      deletePost,
      dismissMatchCelebration,
      editComment,
      editMessage,
      editPost,
      followFromPost,
      followUser,
      forwardMessage,
      hideBoardPost,
      hidePost,
      inviteCommunityMember,
      joinCommunity,
      leaveCommunity,
      likePost,
      loadConversationMessages,
      loadDraft,
      loadPostComments,
      logout,
      markConversationRead,
      markNotInterested,
      muteConversation,
      muteUser,
      pinBoardPost,
      pinComment,
      pinConversation,
      pinMessage,
      publishStory,
      reactToBoardPost,
      reactToPost,
      refreshFeed,
      rejectMatch,
      removeCommentReaction,
      removeGroupMember,
      removeMessageReaction,
      replyToBoardPost,
      replyToMessage,
      replyToStory,
      reportCommunityContent,
      reportContent,
      reportPost,
      reportUser,
      restrictUser,
      requestJoinCommunity,
      restoreFromBackup,
      rsvpCommunityEvent,
      saveDraft,
      savePost,
      scheduleMessage,
      searchMessages,
      sendDisappearingMessage,
      sendMediaMessage,
      sendMessage,
      sendVoiceNote,
      setGroupRole,
      setTab,
      setTypingIndicator,
      sharePost,
      startConversation,
      swipe,
      switchLocalProfile,
      transitionCommunityLifecycle,
      unarchiveConversation,
      unarchivePost,
      unblockUser,
      unfollowFromPost,
      unhideBoardPost,
      unmuteConversation,
      unmuteUser,
      unpinBoardPost,
      unpinComment,
      unpinConversation,
      unpinMessage,
      unrestrictUser,
      unsavePost,
      updateGroupName,
      updateGroupPhoto,
      updateProfile,
      updateSettings,
    ],
  )

  const shellValue = useMemo(
    () => ({
      ready: state.ready,
      tab: state.tab,
      setTab,
      toasts: state.toasts,
      addToast,
      isOnline: state.isOnline,
      networkQuality: state.networkQuality,
      matchCelebration: state.matchCelebration,
      dismissMatchCelebration,
      startConversation,
    }),
    [
      state.ready,
      state.tab,
      state.toasts,
      state.isOnline,
      state.networkQuality,
      state.matchCelebration,
      setTab,
      addToast,
      dismissMatchCelebration,
      startConversation,
    ],
  )

  const profileValue = useMemo(
    () => ({
      profile: state.profile,
      settings: state.settings,
      friends: state.friends || [],
      following: state.following || [],
      posts: visibleSession.posts,
      updateProfile,
      completeOnboarding,
      updateSettings,
      addToast,
    }),
    [
      state.profile,
      state.settings,
      state.friends,
      state.following,
      visibleSession.posts,
      updateProfile,
      completeOnboarding,
      updateSettings,
      addToast,
    ],
  )

  const discoveryValue = useMemo(
    () => ({
      candidates: visibleSession.candidates,
      matches: visibleSession.matches,
      following: state.following || [],
      swipe,
      followUser,
      addFriend,
      reportUser,
      blockUser,
      unblockUser,
      startConversation,
      acceptMatch,
      rejectMatch,
      profile: state.profile,
    }),
    [
      visibleSession.candidates,
      visibleSession.matches,
      state.following,
      state.profile,
      swipe,
      followUser,
      addFriend,
      reportUser,
      blockUser,
      unblockUser,
      startConversation,
      acceptMatch,
      rejectMatch,
    ],
  )

  const messagingValue = useMemo(
    () => ({
      conversations: visibleSession.conversations,
      sendMessage,
      sendMediaMessage,
      loadConversationMessages,
      markConversationRead,
      pinConversation,
      archiveConversation,
      muteConversation,
      createGroup,
      joinCommunity,
      acceptCommunityInvitation,
      declineCommunityInvitation,
      leaveCommunity,
      replyToBoardPost,
      reactToBoardPost,
      pinBoardPost,
      unpinBoardPost,
      hideBoardPost,
      unhideBoardPost,
      transitionCommunityLifecycle,
      reportCommunityContent,
      createCommunityAnnouncement,
      createCommunityEvent,
      rsvpCommunityEvent,
      createBoardPost,
      startConversation,
      addToast,
      profile: state.profile,
      setTab,
    }),
    [
      visibleSession.conversations,
      state.profile,
      sendMessage,
      sendMediaMessage,
      loadConversationMessages,
      markConversationRead,
      pinConversation,
      archiveConversation,
      muteConversation,
      createGroup,
      joinCommunity,
      acceptCommunityInvitation,
      declineCommunityInvitation,
      leaveCommunity,
      replyToBoardPost,
      reactToBoardPost,
      pinBoardPost,
      unpinBoardPost,
      hideBoardPost,
      unhideBoardPost,
      transitionCommunityLifecycle,
      reportCommunityContent,
      createCommunityAnnouncement,
      createCommunityEvent,
      rsvpCommunityEvent,
      createBoardPost,
      startConversation,
      addToast,
      setTab,
    ],
  )

  const feedValue = useMemo(
    () => ({
      posts: visibleSession.posts,
      stories: state.stories,
      likedPostIds: state.likedPostIds || [],
      following: state.following || [],
      friends: state.friends || [],
      profile: state.profile,
      settings: state.settings,
      candidates: visibleSession.candidates,
      createPost,
      likePost,
      reactToPost,
      deletePost,
      editPost,
      archivePost,
      unarchivePost,
      addComment,
      loadPostComments,
      editComment,
      deleteComment,
      addCommentReaction,
      removeCommentReaction,
      pinComment,
      unpinComment,
      createQuoteRepost,
      sharePost,
      applyShareResult,
      savePost,
      unsavePost,
      reportPost,
      reportContent,
      publishStory,
      refreshFeed,
      followUser,
      unfollowFromPost,
      muteUser,
      blockUser,
      addToast,
      setTab,
      shares: state.shares,
      reposts: state.reposts,
      blockedUsers: blockedIdsForUi,
    mutedUsers: mutedIdsForUi,
    }),
    [
      visibleSession.posts,
      visibleSession.candidates,
      state.stories,
      state.likedPostIds,
      state.following,
      state.friends,
      state.profile,
      state.settings,
      state.shares,
      state.reposts,
      blockedIdsForUi,
      mutedIdsForUi,
      createPost,
      likePost,
      reactToPost,
      deletePost,
      editPost,
      archivePost,
      unarchivePost,
      addComment,
      loadPostComments,
      editComment,
      deleteComment,
      addCommentReaction,
      removeCommentReaction,
      pinComment,
      unpinComment,
      createQuoteRepost,
      sharePost,
      refreshFeed,
      applyShareResult,
      savePost,
      unsavePost,
      reportPost,
      reportContent,
      publishStory,
      followUser,
      unfollowFromPost,
      muteUser,
      blockUser,
      addToast,
      setTab,
    ],
  )


  return (
    <GHCContext.Provider value={contextValue}>
      <GHCShellContext.Provider value={shellValue}>
        <GHCProfileContext.Provider value={profileValue}>
          <GHCDiscoveryContext.Provider value={discoveryValue}>
            <GHCMessagingContext.Provider value={messagingValue}>
              <GHCFeedContext.Provider value={feedValue}>
                {children}
              </GHCFeedContext.Provider>
            </GHCMessagingContext.Provider>
          </GHCDiscoveryContext.Provider>
        </GHCProfileContext.Provider>
      </GHCShellContext.Provider>
    </GHCContext.Provider>
  )
}

export function useGHC() {
  const context = useContext(GHCContext)
  if (!context) throw new Error("useGHC must be used within GHCProvider")
  return context
}

/** Shell: tab, toasts, online — does not re-render on feed/messages data */
export function useGHCShell() {
  const ctx = useContext(GHCShellContext)
  if (!ctx) throw new Error("useGHCShell must be used within GHCProvider")
  return ctx
}

/** Profile + settings slice */
export function useGHCProfile() {
  const ctx = useContext(GHCProfileContext)
  if (!ctx) throw new Error("useGHCProfile must be used within GHCProvider")
  return ctx
}

/** Discovery / Find slice — isolated from messaging list churn */
export function useGHCDiscovery() {
  const ctx = useContext(GHCDiscoveryContext)
  if (!ctx) throw new Error("useGHCDiscovery must be used within GHCProvider")
  return ctx
}

/** Messages + communities slice */
export function useGHCMessaging() {
  const ctx = useContext(GHCMessagingContext)
  if (!ctx) throw new Error("useGHCMessaging must be used within GHCProvider")
  return ctx
}

/** Feed / Home slice — prefer over useGHC() on the feed screen */
export function useGHCFeed() {
  const ctx = useContext(GHCFeedContext)
  if (!ctx) throw new Error("useGHCFeed must be used within GHCProvider")
  return ctx
}

/** @deprecated Prefer useGHCMessaging — kept for existing imports */
export function useGHCCommunity() {
  return useGHCMessaging()
}

