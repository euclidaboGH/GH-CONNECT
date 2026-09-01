"use client"

import { useMemo, createContext, useContext, useState, useEffect, ReactNode, useCallback, startTransition } from "react"
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
import { defaultProfile, DEFAULT_SETTINGS, seedCandidates, seedReciprocalInterests, seedPosts, seedStories, sanitizeStories, sanitizeStory, STORAGE_KEYS, generateId } from "@/lib/ghc-data"
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
import { validation } from "@/lib/validation"
import { messageLimiter, postLimiter, spamDetection } from "@/lib/rate-limiter"
import { analytics } from "@/lib/analytics"
import { notificationSystem } from "@/lib/notifications"
import { offlineSupport } from "@/lib/offline"
import { offlineQueue, connectionMonitor, withRetry } from "@/lib/network-resilience"
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
  handleMessageReply,
  handleMessageForwarding,
  handleMessageRead,
  TypingIndicatorManager,
  searchMessages,
  toggleConversationPin,
  toggleConversationArchive,
  toggleConversationMute,
  createVoiceNoteMessage,
  ScheduledMessageQueue,
  updateGroupRole,
  removeGroupMember,
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
        archivePost,
        unarchivePost,
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
        reportContent,
  createFollowAction,
  muteUser,
  blockUser,
        unblockUser,
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
  publishStory: (story: StoryItem) => Promise<void>
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
  deletePost: (postId: string) => Promise<void>
  editPost: (postId: string, newContent: string) => Promise<void>
  archivePost: (postId: string) => Promise<void>
  unarchivePost: (postId: string) => Promise<void>
  addComment: (postId: string, text: string, replyToCommentId?: string) => Promise<void>
  editComment: (postId: string, commentId: string, newText: string) => Promise<void>
  deleteComment: (postId: string, commentId: string) => Promise<void>
  addCommentReaction: (postId: string, commentId: string, emoji: string) => Promise<void>
  removeCommentReaction: (postId: string, commentId: string, emoji: string) => Promise<void>
  pinComment: (postId: string, commentId: string) => Promise<void>
  unpinComment: (postId: string, commentId: string) => Promise<void>
  createQuoteRepost: (originalPostId: string, quoteText: string) => Promise<void>
  sharePost: (postId: string, platform: "twitter" | "facebook" | "linkedin" | "copy" | "timeline" | "story" | "private" | "group") => Promise<string>
  applyShareResult: (result: any) => void
  shares: any[]
  reposts: any[]
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
  matchCelebration: null | { userId: string; userName: string; userPhoto: string }
  dismissMatchCelebration: () => void
  followUser: (userId: string) => Promise<void>
  addFriend: (userId: string) => Promise<void>
  reportUser: (userId: string, reason: string) => Promise<void>
  blockUser: (userId: string) => Promise<void>
  unblockUser: (userId: string) => Promise<void>
  /** Returns conversation id when opened/found, or null if blocked by privacy */
  startConversation: (userId: string, userName: string, userPhoto: string) => Promise<string | null>

  // Match actions
  acceptMatch: (userId: string) => Promise<void>
  rejectMatch: (userId: string) => Promise<void>

  // Messages - unified for both private chats and group chats
  sendMessage: (conversationId: string, text: string) => Promise<void>
  editMessage: (conversationId: string, messageId: string, newText: string) => Promise<void>
  deleteMessage: (conversationId: string, messageId: string, deleteForEveryone?: boolean) => Promise<void>
  replyToMessage: (conversationId: string, replyToMessageId: string, text: string) => Promise<void>
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
  leaveCommunity: (communityId: string) => Promise<boolean>
  requestJoinCommunity: (communityId: string) => Promise<boolean>
  createBoardPost: (
    communityId: string,
    body: string,
    kind?: "text" | "question" | "resource"
  ) => Promise<boolean>
  addGroupMember: (conversationId: string, userId: string) => Promise<void>
  removeGroupMember: (conversationId: string, userId: string) => Promise<void>
  setGroupRole: (conversationId: string, userId: string, role: "admin" | "member") => Promise<void>
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
  deletePost: GHCContextType["deletePost"]
  editPost: GHCContextType["editPost"]
  archivePost: GHCContextType["archivePost"]
  unarchivePost: GHCContextType["unarchivePost"]
  addComment: GHCContextType["addComment"]
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

export function GHCProvider({ children }: { children: ReactNode }) {
  const { sdk } = usePiAuth()
  const [identityUserId, setIdentityUserId] = useState(() => IdentityService.getCurrentUserId())
  useEffect(() => {
    return IdentityService.subscribe((id) => setIdentityUserId(id.userId))
  }, [])

  const [state, setState] = useState<ExtendedGHCState>({ ...initialState, isOnline: true, networkQuality: "excellent" })

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
            posts: s.posts?.length ? s.posts : seedPosts(),
            stories: s.stories?.length ? s.stories : seedStories(),
          }))
        }

        const updates: Partial<ExtendedGHCState> = { ready: true }

        if (!sdk) {
          const cands = seedCandidates()
          updates.posts = seedPosts()
          updates.stories = seedStories()
          updates.candidates = cands
          updates.likes = seedReciprocalInterests(cands)
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
          early.profile = profileResult.value.blob as typeof early.profile
        }
        if (settingsResult.status === "fulfilled" && settingsResult.value?.blob) {
          early.settings = settingsResult.value.blob as typeof early.settings
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
          const loaded = profileResult.value?.blob as Profile | undefined
          if (loaded?.displayName) updates.profile = loaded
        } else if (profileResult.status === "rejected") {
          errorLogger.logWarning("Profile load failed, using defaults", { error: profileResult.reason })
        }

        if (!updates.settings && settingsResult.status === "fulfilled") {
          const loaded = settingsResult.value?.blob as Settings | undefined
          if (loaded?.language) {
            const blockedUsers = Array.isArray(loaded.blockedUsers)
              ? loaded.blockedUsers.filter((id): id is string => typeof id === "string").slice(0, 200)
              : []
            const moderationReports = Array.isArray(loaded.moderationReports)
              ? loaded.moderationReports
                  .filter((report) => report && (report.type === "user" || report.type === "post") && typeof report.targetId === "string")
                  .slice(-200)
              : []
            updates.settings = { ...DEFAULT_SETTINGS, ...loaded, blockedUsers, moderationReports }
            updates.blockedUsers = blockedUsers
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
            : seedPosts()
        } else {
          errorLogger.logWarning("Posts load failed, using seed data", { error: postsResult.reason })
          updates.posts = seedPosts()
        }

        if (storiesResult.status === "fulfilled" && Array.isArray(storiesResult.value?.blob)) {
          updates.stories = sanitizeStories(storiesResult.value.blob)
        } else {
          updates.stories = seedStories()
        }
        if (matchesResult.status === "fulfilled" && Array.isArray(matchesResult.value?.blob)) {
          updates.matches = matchesResult.value.blob as MatchEntry[]
        } else if (matchesResult.status === "rejected") {
          errorLogger.logWarning("matches load failed, using empty state", { error: matchesResult.reason })
        }
        // Discovery candidates — light seed only if still empty (after first paint path)
        const cands = seedCandidates()
        updates.candidates = cands
        if (likesResult.status === "fulfilled" && Array.isArray(likesResult.value?.blob)) {
          const loadedLikes = likesResult.value.blob as Like[]
          updates.likes =
            loadedLikes.length > 0 ? loadedLikes : seedReciprocalInterests(cands)
          updates.likedPostIds = (updates.likes as Like[])
            .filter((like) => like?.fromUserId === "current-user" && typeof like.toUserId === "string")
            .map((like) => like.toUserId)
        } else if (likesResult.status === "rejected") {
          errorLogger.logWarning("likes load failed, using empty state", { error: likesResult.reason })
          updates.likes = seedReciprocalInterests(cands)
        } else {
          updates.likes = seedReciprocalInterests(cands)
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
        if (mounted) setState((s) => ({ ...s, ready: true, posts: seedPosts(), stories: seedStories() }))
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

  // Save existing user-state slices together after startup restoration.
  useEffect(() => {
    if (!sdk || !state.ready) return
    const {
      profile,
      settings,
      posts,
      matches,
      likes,
      conversations,
      friendRequests,
      following,
      friends,
      blockedUsers,
      mutedUsers,
    } = state
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
    state.ready,
    state.profile,
    state.settings,
    state.posts,
    state.matches,
    state.likes,
    state.conversations,
    state.friendRequests,
    state.following,
    state.friends,
    state.blockedUsers,
    state.mutedUsers,
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

  // Define addToast first - it's used by other functions
  const addToast = useCallback((message: string, type: "success" | "error" | "info") => {
    const id = generateId()
    setState((s) => ({ ...s, toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => {
      setState((s) => ({ ...s, toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 3000)
  }, [])

  const updateProfile = async (updates: Partial<Profile>) => {
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

      const sanitized: Partial<Profile> = {
        ...updates,
        displayName: updates.displayName ? sanitizeDisplayName(updates.displayName) : undefined,
        bio: updates.bio ? sanitizeText(updates.bio, 500) : undefined,
      }

      // Canonical Identity domain mutation
      const result = await domains.identity.updateProfile(sanitized)
      if (!result.ok) {
        addToast(result.error, "error")
        return
      }

      setState((s) => ({ ...s, profile: { ...s.profile, ...result.data } }))

      if (!state.isOnline) {
        offlineQueue.addAction({
          type: "profile_update",
          payload: result.data,
          maxRetries: 3,
        })
        addToast("Profile queued for sync", "info")
        return
      }

      analytics.trackEvent("profile_update", { fields: Object.keys(updates) }, state.profile.displayName)
      addToast("Profile updated", "success")
    } catch (error) {
      errorLogger.logError(error instanceof Error ? error : new Error(String(error)))
      addToast("Failed to update profile", "error")
    }
  }

  const completeOnboarding = async () => {
    try {
      const result = await domains.identity.completeOnboarding()
      if (!result.ok) {
        addToast(result.error, "error")
        return
      }
      setState((s) => ({ ...s, profile: { ...s.profile, onboarded: true } }))
    } catch (error) {
      errorLogger.logError(error instanceof Error ? error : new Error(String(error)))
      // Fallback: preserve prior behavior
      setState((s) => ({ ...s, profile: { ...s.profile, onboarded: true } }))
    }
  }

  const switchLocalProfile = (localId: string) => {
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
  }

  const createLocalProfile = (profile: Partial<Profile>) => {
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
  }

  const createPost = async (
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

      setState((s) => ({ ...s, posts: [newPost, ...s.posts] }))
      // Dual-write path ready for HTTP repository when API is configured
      try {
        const { resolveApiBaseUrl, createHttpPostRepository } = require("@/lib/domains/http-repositories")
        const base = resolveApiBaseUrl()
        if (base) {
          createHttpPostRepository({ baseUrl: base }).save(newPost)
        }
      } catch {
        /* local-only */
      }

      // Queue for sync if offline
      if (!state.isOnline) {
        offlineQueue.addAction({
          type: "create_post",
          payload: newPost,
          maxRetries: 3,
        })
        addToast("Post queued - will upload when online", "info")
        return true
      }

      // Track analytics
      analytics.trackEvent(
        "post_created",
        { postId: newPost.id, visibility },
        state.profile.displayName,
      )

      // Notification
      notificationSystem.addNotification("share", "Posted", "Your post is live on Feed", "✓", { open: "feed", section: "post" })
      addToast("Posted to your feed", "success")
      return true
    } catch (error) {
      errorLogger.logError(error instanceof Error ? error : new Error(String(error)))
      addToast("Failed to create post", "error")
      return false
    }
  }

  const likePost = async (postId: string) => {
    setState((s) => {
      const isLiked = s.likedPostIds.includes(postId)
      const nextLikedPostIds = isLiked ? s.likedPostIds.filter((id) => id !== postId) : [...s.likedPostIds, postId]
      const nextLikes = isLiked
        ? s.likes.filter((like) => !(like.fromUserId === "current-user" && like.toUserId === postId))
        : [...s.likes, { id: generateId(), fromUserId: "current-user", toUserId: postId, createdAt: Date.now() }]
      return {
        ...s,
        posts: s.posts.map((post) => (post.id === postId ? { ...post, likes: Math.max(0, post.likes + (isLiked ? -1 : 1)) } : post)),
        likes: nextLikes,
        likedPostIds: nextLikedPostIds,
      }
    })
  }


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
        const me = IdentityService.getCurrentUserId()
        return r.fromUserId === me || r.fromUserId === "current-user" || r.toUserId
      })
      .map((r: any) => r.toUserId || r.fromUserId)
      .filter(Boolean),
    incomingFriendRequestIds: (state.friendRequests || [])
      .map((r) => r.fromUserId)
      .filter((id) => {
        const me = IdentityService.getCurrentUserId()
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
            recordModerationReport?.(report.targetType, report.targetId, report.reason)
          } catch { /* */ }
        },
        getConversations: () => getDomainState().conversations,
        setConversations: (updater) => {
          setState((s) => ({ ...s, conversations: updater(s.conversations || []) }))
        },
      }),
    [getDomainState, identityUserId]
  )

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
    transportBridge.startLocal()
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { presenceStore } = require("@/lib/realtime/presence")
      presenceStore.setSelf("current-user")
      presenceStore.startHeartbeat(30_000)
    } catch {
      /* optional */
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { resolveApiBaseUrl } = require("@/lib/domains/http-repositories")
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { enableWebSocketTransport } = require("@/lib/realtime/transport-bridge")
      const base = resolveApiBaseUrl()
      if (base) {
        const wsUrl = base.replace(/^http/, "ws") + "/realtime"
        void enableWebSocketTransport(wsUrl)
      }
    } catch {
      /* stay on LocalTransport */
    }
    return () => {
      unsub()
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { presenceStore } = require("@/lib/realtime/presence")
        presenceStore.stopHeartbeat()
      } catch {
        /* */
      }
    }
  }, [])

  const deletePost = async (postId: string) => {
    try {
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
      addToast("Post deleted", "success")
    } catch (err) {
      errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      addToast("Could not delete post", "error")
    }
  }

  const addComment = async (postId: string, text: string, replyToCommentId?: string) => {
    const normalizedText = sanitizeText(text, 500).trim()
    if (!normalizedText) {
      addToast("Comment cannot be empty", "error")
      return
    }
    try {
      // Validate reply target exists (orphans still allowed by domain, but UX clearer)
      if (replyToCommentId) {
        const post = state.posts.find((p) => p.id === postId)
        const parentExists = post?.comments?.some((c) => c.id === replyToCommentId)
        if (!parentExists) {
          addToast("Original comment was removed", "error")
          return
        }
      }
      const result = await domains.posts.addComment(postId, normalizedText, replyToCommentId)
      if (!result.ok) {
        addToast(result.error || "Could not post comment", "error")
        return
      }
      const newComment = result.data
      if (!newComment?.id) {
        addToast("Could not post comment", "error")
        return
      }
      setState((s) => ({
        ...s,
        posts: s.posts.map((post) => {
          if (post.id !== postId) return post
          const existing = Array.isArray(post.comments) ? post.comments : []
          // Dedupe by id (preferred) or near-duplicate text from same user
          if (existing.some((c) => c.id === newComment.id)) return post
          const duplicate = existing.some(
            (comment) =>
              comment.authorId === "current-user" &&
              (comment.text ?? "").trim().toLowerCase() === normalizedText.toLowerCase() &&
              Date.now() - (comment.createdAt || 0) < 5000
          )
          if (duplicate) return post
          // Flat list only — buildCommentTree nests via replyTo (no dual-write)
          return {
            ...post,
            comments: [
              ...existing,
              {
                ...newComment,
                replyTo: replyToCommentId || newComment.replyTo,
                replies: [],
              },
            ],
          }
        }),
      }))
      addToast(replyToCommentId ? "Reply posted" : "Comment posted", "success")
    } catch (err) {
      try {
        errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      } catch {
        /* logger must never block UX */
      }
      addToast("Could not post comment", "error")
    }
  }

  const editPost = async (postId: string, newContent: string) => {
    try {
      const result = await domains.posts.editPost(postId, newContent)
      if (!result.ok) {
        addToast(result.error, "error")
        return
      }
      setState((s) => ({
        ...s,
        posts: s.posts.map((post) =>
          post.id === postId
            ? { ...post, content: result.data.content, isDraft: false }
            : post
        ),
      }))
      addToast("Post updated", "success")
    } catch (err) {
      errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      addToast("Could not update post", "error")
    }
  }

  const archivePost = async (postId: string) => {
    setState((s) => ({
      ...s,
      posts: s.posts.map((post) =>
        post.id === postId
          ? { ...post, isArchived: true, archivedAt: Date.now() }
          : post
      ),
    }))
    addToast("Post archived", "success")
  }

  const unarchivePost = async (postId: string) => {
    setState((s) => ({
      ...s,
      posts: s.posts.map((post) =>
        post.id === postId
          ? { ...post, isArchived: false, archivedAt: undefined }
          : post
      ),
    }))
    addToast("Post restored from archive", "success")
  }

  const editComment = async (postId: string, commentId: string, newText: string) => {
    const normalized = (newText || "").trim()
    if (!normalized) {
      addToast("Comment cannot be empty", "error")
      return
    }
    try {
      const result = await domains.posts.editComment(postId, commentId, normalized)
      if (!result.ok) {
        addToast(result.error, "error")
        return
      }
      setState((s) => ({
        ...s,
        posts: s.posts.map((p) =>
          p.id === postId
            ? {
                ...p,
                comments: p.comments.map((c) =>
                  c.id === commentId
                    ? { ...c, text: result.data.text, isEdited: true, editedAt: Date.now() }
                    : c
                ),
              }
            : p
        ),
      }))
      addToast("Comment updated", "success")
    } catch (err) {
      errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      addToast("Could not edit comment", "error")
    }
  }

  const deleteComment = async (postId: string, commentId: string) => {
    try {
      const result = await domains.posts.deleteComment(postId, commentId)
      if (!result.ok) {
        addToast(result.error, "error")
        return
      }
      setState((s) => ({
        ...s,
        posts: s.posts.map((p) =>
          p.id === postId
            ? {
                ...p,
                comments: p.comments.filter(
                  (c) => c.id !== commentId && c.replyTo !== commentId
                ),
              }
            : p
        ),
      }))
      addToast("Comment deleted", "success")
    } catch (err) {
      errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      addToast("Could not delete comment", "error")
    }
  }

  const addCommentReaction = async (postId: string, commentId: string, emoji: string) => {
    try {
      const result = await domains.posts.reactToComment(postId, commentId, emoji)
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
                comments: post.comments.map((c) =>
                  c.id === commentId ? { ...c, reactions: result.data.reactions } : c
                ),
              }
            : post
        ),
      }))
    } catch (err) {
      errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      addToast("Could not react to comment", "error")
    }
  }

  const removeCommentReaction = async (postId: string, commentId: string, emoji: string) => {
    setState((s) => ({
      ...s,
      posts: s.posts.map((post) =>
        post.id === postId
          ? {
              ...post,
              comments: post.comments.map((c) => {
                if (c.id === commentId) {
                  const reactions = { ...c.reactions }
                  if (reactions[emoji]) {
                    reactions[emoji] = reactions[emoji].filter((id) => id !== s.profile.displayName)
                    if (reactions[emoji].length === 0) delete reactions[emoji]
                  }
                  return { ...c, reactions }
                }
                return c
              }),
            }
          : post
      ),
    }))
  }

  const pinComment = async (postId: string, commentId: string) => {
    setState((s) => ({
      ...s,
      posts: s.posts.map((post) =>
        post.id === postId
          ? {
              ...post,
              comments: post.comments.map((c) => (c.id === commentId ? { ...c, isPinned: true } : c)),
            }
          : post
      ),
    }))
    addToast("Comment pinned", "success")
  }

  const unpinComment = async (postId: string, commentId: string) => {
    setState((s) => ({
      ...s,
      posts: s.posts.map((post) =>
        post.id === postId
          ? {
              ...post,
              comments: post.comments.map((c) => (c.id === commentId ? { ...c, isPinned: false } : c)),
            }
          : post
      ),
    }))
    addToast("Comment unpinned", "success")
  }

  const createQuoteRepost = async (originalPostId: string, quoteText: string) => {
    const originalPost = state.posts.find((p) => p.id === originalPostId)
    if (!originalPost) {
      addToast("Original post not found", "error")
      return
    }
    const newPost: Post = {
      id: generateId(),
      authorId: "current-user",
      authorName: state.profile.displayName || "You",
      authorPhoto: state.profile.photos[0] || "/placeholder.svg?width=32&height=32",
      content: quoteText,
      images: [],
      video: null,
      pdf: null,
      pdfName: null,
      likes: 0,
      comments: [],
      createdAt: Date.now(),
      quoteOf: originalPostId,
    }
    setState((s) => ({ ...s, posts: [newPost, ...s.posts] }))
    addToast("Quote repost created", "success")
  }

  const sharePost = async (
    postId: string,
    platform: "twitter" | "facebook" | "linkedin" | "copy" | "timeline" | "story" | "private" | "group" = "copy"
  ) => {
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
  }

  const applyShareResult = (result: import("@/lib/share-service").ShareResult) => {
    if (!result.ok) return
    setState((s) => {
      let conversations = s.conversations
      if (result.messages?.length) {
        conversations = s.conversations.map((c) => {
          const batch = result.messages!.filter((m) => m.conversationId === c.id)
          if (!batch.length) return c
          const newMsgs = batch.map((m) => ({
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            senderId: "current-user",
            text: m.text,
            createdAt: Date.now(),
            sharedPostId: m.sharedPostId,
            status: "sent" as const,
          }))
          return {
            ...c,
            messages: [...(c.messages || []), ...newMsgs],
            lastMessage: newMsgs[newMsgs.length - 1]?.text || c.lastMessage,
            lastMessageTime: Date.now(),
          }
        })
      }
      let stories = s.stories
      if (result.story) {
        stories = [result.story as any, ...(s.stories || [])]
      }
      return {
        ...s,
        shares: [result.share, ...(s.shares || [])].slice(0, 200),
        reposts: result.repost ? [result.repost, ...(s.reposts || [])].slice(0, 100) : s.reposts,
        conversations,
        stories,
      }
    })
  }

  const savePost = async (postId: string, collection?: string) => {
    setState((s) => ({
      ...s,
      posts: s.posts.map((post) =>
        post.id === postId
          ? { ...post, bookmarkedBy: [...(post.bookmarkedBy || []), s.profile.displayName] }
          : post
      ),
    }))
    addToast("Post saved", "success")
  }

  const unsavePost = async (postId: string) => {
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
    addToast("Post removed from saved", "success")
  }

  const hidePost = async (postId: string) => {
    setState((s) => ({
      ...s,
      posts: s.posts.map((post) =>
        post.id === postId ? { ...post, hideCount: (post.hideCount || 0) + 1 } : post
      ),
    }))
    addToast("Post hidden", "success")
  }

  const markNotInterested = async (postId: string) => {
    setState((s) => ({
      ...s,
      posts: s.posts.filter((p) => p.id !== postId),
    }))
    addToast("Marked as not interested", "success")
  }

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

  const reportPost = async (postId: string, reason: string) => {
    try {
      const result = await domains.reports.report("post", postId, reason)
      if (!result.ok) {
        addToast(result.error, "error")
        return
      }
      recordModerationReport("post", postId, reason)
      addToast("Post reported for review", "success")
    } catch (err) {
      errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      addToast("Could not submit report", "error")
    }
  }

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


  const muteUser = async (userId: string) => {
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
  }

  const unmuteUser = async (userId: string) => {
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
  }

  const restrictUser = async (userId: string) => {
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
  }

  const unrestrictUser = async (userId: string) => {
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
  }

  const followFromPost = async (userId: string) => {
    // Canonical: same path as followUser (graph domain)
    await followUser(userId)
  }

  const unfollowFromPost = async (userId: string) => {
    // Canonical: toggleFollow via graph — never dual-write following alone
    await followUser(userId)
  }

  const updateSettings = async (updates: Partial<Settings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...updates } }))
  }

  const isMatchOrFriend = (userId: string) => state.matches.some((match) => match.userId === userId) || state.friends.includes(userId)
  const canViewProfile = (userId: string) => userId === "current-user" || state.settings.profileVisibility === "everyone" || (state.settings.profileVisibility === "matches-only" && isMatchOrFriend(userId))
  const canMessageUser = (userId: string) => {
    if (userId === "current-user") return false
    const blocked = new Set([...(state.settings?.blockedUsers || []), ...(state.blockedUsers || [])])
    if (blocked.has(userId)) return false
    if (state.settings.whoCanMessage === "no-one") return false
    if (state.settings.whoCanMessage === "matches-only" && !isMatchOrFriend(userId)) return false
    return true
  }
  const canViewStory = (ownerId: string) => ownerId === "current-user" || state.settings.storyVisibility === "everyone" || (state.settings.storyVisibility === "matches-only" && isMatchOrFriend(ownerId))
  const canSeeOnlineStatus = (userId: string) => userId === "current-user" || state.settings.onlineStatus === "everyone" || (state.settings.onlineStatus === "matches-only" && isMatchOrFriend(userId))

  const swipe = useCallback(async (candidateId: string, action: "like" | "pass" | "superlike") => {
    try {
      const candidate = state.candidates.find((c) => c.id === candidateId)
      if (!candidate) return

      if (action === "like" || action === "superlike") {
        const interest = await domains.matching.expressInterest(candidateId, {
          superlike: action === "superlike",
        })
        if (!interest.ok) {
          addToast(interest.error, "error")
          return
        }

        const quality = domains.matching.evaluateQuality(candidate)
        const now = Date.now()
        let createdMatch: (typeof state.matches)[number] | null = null
        let alreadyMatched = interest.data.alreadyMatched

        setState((s) => {
          const alreadyLiked = s.likes.some(
            (like) => like.fromUserId === "current-user" && like.toUserId === candidateId
          )
          const hasMutualLike = s.likes.some(
            (like) => like.fromUserId === candidateId && like.toUserId === "current-user"
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
                      fromUserId: "current-user",
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
                  fromUserId: "current-user",
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
          const matchConversation: Conversation = existingConversation || {
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
          }
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

        if (createdMatch && !alreadyMatched) {
          await domains.graph.addMatch(candidateId).catch(() => null)
          notificationSystem.addNotification(
            "match",
            "It's a Match",
            `You and ${candidate.name} both expressed interest`,
            "💚",
            { candidateId, candidateName: candidate.name }
          )
          // Confirmation UI is driven by matchCelebration — avoid reward/earnings language
          addToast("It's a Match — mutual interest", "success")
        } else if (alreadyMatched) {
          addToast("You're already matched", "info")
        } else {
          addToast(
            action === "superlike" ? "Interest sent" : "Interest sent — not a Match until they like you too",
            "success",
          )
        }
      } else {
        addToast("Passed", "info")
      }
    } catch (err) {
      errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      addToast("Error processing action", "error")
    }
  }, [state.candidates, state.profile.displayName, state.likes, state.matches, domains, addToast])

  

const dismissMatchCelebration = useCallback(() => {
    setState((s) => (s.matchCelebration ? { ...s, matchCelebration: null } : s))
  }, [])

  const followUser = useCallback(async (userId: string) => {
    try {
      const already = (state.following || []).includes(userId)
      if (!already) {
        const matchIds = (state.matches || []).map((m) => m.userId)
        const friendIds = state.friends || []
        if (!privacyCanFollow(state.settings, "current-user", userId, matchIds, friendIds)) {
          addToast("Follow is limited by privacy settings", "info")
          return
        }
      }
      const result = await domains.graph.toggleFollow(userId)
      if (!result.ok) {
        addToast(result.error, "error")
        return
      }
      setState((s) => applyGraphPatch(s, patchFromFollow(result.data)))
      addToast(
        result.data.action === "follow" ? "Following" : "Unfollowed",
        result.data.action === "follow" ? "success" : "info"
      )
    } catch (err) {
      errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      addToast("Error following user", "error")
    }
  }, [domains, addToast, state.following, state.matches, state.friends, state.settings])

  const addFriend = useCallback(async (userId: string) => {
    try {
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
      const result = await domains.graph.sendFriendRequest(userId)
      if (!result.ok) {
        addToast(result.error, "error")
        return
      }
      const cand = seedCandidates().find((c) => c.id === userId)
      const newRequest = {
        id: generateId(),
        fromUserId: "current-user",
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
            (r) => !(r.fromUserId === "current-user" && (r as any).toUserId === userId)
          ),
          newRequest as any,
        ],
      }))
      addToast("Friend request sent!", "success")
    } catch (err) {
      errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      addToast("Error adding friend", "error")
    }
  }, [state.friends, state.friendRequests, state.profile, domains, addToast])

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
        addToast(state.settings.whoCanMessage === "no-one" ? "Messaging is turned off in your privacy settings." : "This person cannot be messaged with your current privacy settings.", "info")
        return null
      }
      const existingConv = state.conversations.find(c => c.participantId === userId && c.conversationType === "private")
      if (existingConv) {
        setState((s) => ({ ...s, tab: "messages" as Tab }))
        return existingConv.id
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
      const newConversation = {
        ...result.data.conversation,
        online: true,
      } as Conversation

      setState((s) => ({
        ...s,
        conversations: [newConversation, ...s.conversations],
        tab: "messages" as Tab,
      }))
      return newConversation.id
    } catch (err) {
      errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      addToast("Error starting conversation", "error")
      return null
    }
  }, [state.conversations, state.settings.whoCanMessage, domains, addToast])

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

  const sendMessage = useCallback(async (conversationId: string, text: string) => {
    try {
      if (!messageLimiter.isAllowed(`msg_${conversationId}`)) {
        addToast("You're messaging too fast. Please slow down.", "error")
        return
      }

      const safeText = typeof text === "string" ? text : ""
      if (spamDetection.detectSpamText(safeText)) {
        addToast("Your message was flagged as spam.", "error")
        return
      }

      const sanitizedText = String(sanitizeText(safeText, 5000) || "").trim()
      if (!sanitizedText) {
        addToast("Message cannot be empty", "error")
        return
      }

      const csrfToken = getCsrfToken()

      const result = await domains.messaging.sendMessage({
        conversationId,
        text: sanitizedText,
        offline: !state.isOnline,
      })
      if (!result.ok) {
        addToast(result.error, "error")
        return
      }

      const uiMessage = (result.data as any).uiMessage || {
        id: result.data.id,
        senderId: result.data.senderId || "current-user",
        text: sanitizedText,
        createdAt: result.data.createdAt || Date.now(),
        status: state.isOnline ? "sent" : "sending",
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
          },
          maxRetries: 3,
        })
        addToast("Message queued — will send when online", "info")
        return
      }

      await domains.messaging
        .setMessageStatus(conversationId, result.data.id, "delivered")
        .catch(() => null)
      setState((s) => ({
        ...s,
        conversations: (s.conversations || []).map((c) => {
          if (c.id !== conversationId) return c
          return {
            ...c,
            messages: (c.messages || []).map((m) =>
              m.id === uiMessage.id ? { ...m, status: "delivered" as const } : m,
            ),
          }
        }),
      }))
    } catch (err) {
      errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      addToast("Failed to send message", "error")
    }
  }, [domains, state.isOnline, state.profile.displayName, addToast])

  const markConversationRead = useCallback(
    async (conversationId: string) => {
      // Skip work when already read — avoids full list remap freezes
      let alreadyRead = false
      setState((s) => {
        const current = (s.conversations || []).find((c) => c.id === conversationId)
        if (current && !current.unread && !(current.unreadCount && current.unreadCount > 0)) {
          alreadyRead = true
          return s
        }
        return {
          ...s,
          conversations: (s.conversations || []).map((c) =>
            c.id === conversationId ? { ...c, unread: false, unreadCount: 0 } : c
          ),
        }
      })
      if (alreadyRead) return
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
      addToast("Cannot edit this message", "error")
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
      if (!conv) return

      const replyMessage = handleMessageReply(
        conv.messages.find((m) => m.id === replyToMessageId)!,
        text,
        "current-user"
      )
      if (!replyMessage) {
        addToast("Invalid reply message", "error")
        return
      }

      setState((s) => ({
        ...s,
        conversations: s.conversations.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                messages: [...c.messages, replyMessage],
                lastMessage: text,
                lastMessageTime: Date.now(),
              }
            : c
        ),
      }))

      analytics.trackEvent("message_replied", { conversationId, replyToMessageId }, state.profile.displayName)
      addToast("Reply sent", "success")
    },
    [state.conversations, state.profile.displayName, addToast]
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
    addToast("Message pinned", "success")
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
    addToast("Message unpinned", "success")
  }, [addToast])

  const sendVoiceNote = useCallback(
    async (conversationId: string, audioBlob: Blob, waveform: number[]) => {
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
        addToast("Voice note sent", "success")
      } catch (error) {
        errorLogger.logError(error instanceof Error ? error : new Error(String(error)))
        addToast("Failed to send voice note", "error")
      }
    },
    [state.profile.displayName, state.conversations, addToast]
  )

  const sendMediaMessage = useCallback(
    async (conversationId: string, mediaUrl: string, type: "image" | "file" | "video", fileName?: string) => {
      const message: Message = {
        id: generateId(),
        senderId: "current-user",
        text: type === "image" ? "📷 Sent a photo" : type === "video" ? "🎥 Sent a video" : `📎 ${fileName || "File"}`,
        createdAt: Date.now(),
        status: "sending",
        mediaAttachments: [{ id: generateId(), type, url: mediaUrl, fileName }],
      }

      setState((s) => ({
        ...s,
        conversations: s.conversations.map((c) =>
          c.id === conversationId
            ? { ...c, messages: [...c.messages, message], lastMessage: message.text, lastMessageTime: Date.now() }
            : c
        ),
      }))

      analytics.trackEvent("media_sent", { conversationId, type }, state.profile.displayName)
      addToast(`${type === "image" ? "Photo" : type === "video" ? "Video" : "File"} sent`, "success")
    },
    [state.profile.displayName, state.conversations, addToast]
  )

  const scheduleMessage = useCallback(
    async (conversationId: string, text: string, scheduledFor: number) => {
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
      addToast("Message scheduled", "success")
    },
    [state.profile.displayName, state.conversations, addToast]
  )

  const sendDisappearingMessage = useCallback(
    async (conversationId: string, text: string, expiresInSeconds: number = 300) => {
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
      addToast("Disappearing message sent", "success")
    },
    [state.profile.displayName, state.conversations, addToast]
  )

  const saveDraft = useCallback((conversationId: string, text: string) => {
    draftStorage.save(conversationId, text)
  }, [])

  const loadDraft = useCallback((conversationId: string): string | null => {
    const draft = draftStorage.load(conversationId)
    return draft?.text || null
  }, [])

  const pinConversation = useCallback(async (conversationId: string) => {
    setState((s) => ({
      ...s,
      conversations: s.conversations.map((c) => (c.id === conversationId ? toggleConversationPin(c) : c)),
    }))
    addToast("Conversation pinned", "success")
  }, [addToast])

  const unpinConversation = useCallback(async (conversationId: string) => {
    setState((s) => ({
      ...s,
      conversations: s.conversations.map((c) => (c.id === conversationId ? toggleConversationPin(c) : c)),
    }))
    addToast("Conversation unpinned", "success")
  }, [addToast])

  const archiveConversation = useCallback(async (conversationId: string) => {
    setState((s) => ({
      ...s,
      conversations: s.conversations.map((c) => (c.id === conversationId ? toggleConversationArchive(c) : c)),
    }))
    addToast("Conversation archived", "success")
  }, [addToast])

  const unarchiveConversation = useCallback(async (conversationId: string) => {
    setState((s) => ({
      ...s,
      conversations: s.conversations.map((c) => (c.id === conversationId ? toggleConversationArchive(c) : c)),
    }))
    addToast("Conversation unarchived", "success")
  }, [addToast])

  const muteConversation = useCallback(async (conversationId: string, muteHours: number = 1) => {
    setState((s) => ({
      ...s,
      conversations: s.conversations.map((c) => (c.id === conversationId ? toggleConversationMute(c, muteHours) : c)),
    }))
    addToast(`Notifications muted for ${muteHours} hour${muteHours > 1 ? "s" : ""}`, "success")
  }, [addToast])

  const unmuteConversation = useCallback(async (conversationId: string) => {
    setState((s) => ({
      ...s,
      conversations: s.conversations.map((c) => (c.id === conversationId ? toggleConversationMute(c, 0) : c)),
    }))
    addToast("Notifications unmuted", "success")
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
        const newGroup = result.data.community
        setState((s) => ({
          ...s,
          conversations: [newGroup, ...s.conversations],
        }))
        try {
          persistCommunityConversation(newGroup as any)
          markJoined(newGroup.id)
        } catch {
          /* */
        }
        analytics.trackEvent(
          "group_created",
          { groupId: newGroup.id, category: formData.category, privacy: formData.privacy },
          state.profile.displayName
        )
        addToast(`"${formData.name}" is live — Board is ready`, "success")
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
        const privacy = ((conv as any)?.privacy || "public") as string
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
          addToast("Join request sent — waiting for approval", "info")
          return true
        }
        const result = await domains.community.joinCommunity(communityId)
        if (!result.ok) {
          // Seed/demo communities may not be in conversations yet — admit locally
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
            addToast("Joined community", "success")
            return true
          }
          addToast(result.error, "error")
          return false
        }
        setState((s) => {
          const next = s.conversations.map((c) =>
            c.id === communityId
              ? {
                  ...c,
                  members: result.data.members,
                  groupRoles: {
                    ...((c as any).groupRoles || {}),
                    [IdentityService.getCurrentUserId() || "current-user"]: "member",
                  },
                }
              : c
          )
          const row = next.find((c) => c.id === communityId)
          if (row) {
            try {
              persistCommunityConversation(row as any)
            } catch {
              /* */
            }
          }
          return { ...s, conversations: next }
        })
        markJoined(communityId)
        addToast("Joined community", "success")
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
        setState((s) => {
          const next = s.conversations.map((c) =>
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
              persistCommunityConversation(row as any)
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
        addToast("Request sent", "info")
        return true
      } catch (err) {
        addToast("Could not send request", "error")
        return false
      }
    },
    [addToast, domains]
  )

  const createBoardPost = useCallback(
    async (
      communityId: string,
      body: string,
      kind: "text" | "question" | "resource" = "text"
    ): Promise<boolean> => {
      try {
        const result = await domains.community.createBoardPost(communityId, { body, kind })
        if (!result.ok) {
          addToast(result.error, "error")
          return false
        }
        const post = {
          ...result.data.post,
          authorName: state.profile.displayName || "You",
        }
        setState((s) => ({
          ...s,
          conversations: s.conversations.map((c) => {
            if (c.id !== communityId) return c
            const existing = ((c as any).boardPosts || []) as typeof post[]
            return {
              ...c,
              boardPosts: [post, ...existing],
              lastMessage: body.slice(0, 80),
              lastMessageTime: post.createdAt,
            }
          }),
        }))
        addToast("Posted to board", "success")
        return true
      } catch (err) {
        addToast("Could not post", "error")
        return false
      }
    },
    [state.profile.displayName, addToast, domains]
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
      setState((s) => ({
        ...s,
        conversations: s.conversations.map((c) =>
          c.id === conversationId ? removeGroupMember(c, userId) : c
        ),
      }))
      analytics.trackEvent("group_member_removed", { conversationId, userId }, state.profile.displayName)
      addToast("Member removed", "success")
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
        setState((s) => ({
          ...s,
          conversations: s.conversations.map((c) => {
            if (c.id !== conversationId) return c
            const groupRoles = { ...((c as any).groupRoles || {}), [userId]: result.data.role }
            return { ...c, groupRoles } as Conversation
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
      // Identity domain session signal (does not replace Pi auth transport)
      await domains.identity.clearSession()
      setState(() => ({
        ...initialState,
        ready: true,
      }))
      addToast("Logged out successfully", "success")
    } catch (error) {
      errorLogger.logError(error instanceof Error ? error : new Error(String(error)))
      addToast("Error logging out", "error")
    }
  }, [addToast, state.profile, state.settings, state.posts, state.conversations, domains])

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

  const publishStory = useCallback(async (story: StoryItem) => {
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
      const result = await domains.stories.publish(prepared)
      if (!result.ok) {
        addToast(result.error, "error")
        return
      }
      setState((s) => ({
        ...s,
        stories: sanitizeStories([result.data, ...s.stories.filter((x) => x.id !== result.data.id)]),
      }))
    } catch (err) {
      errorLogger.logError(err instanceof Error ? err : new Error(String(err)))
      addToast("This story could not be saved safely", "error")
    }
  }, [addToast, domains, state.profile.displayName, state.profile.photos])

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
  }, [state, state.settings?.mutedUsers])

  const visibleSession = useMemo(
    () =>
      applyGlobalBlockFilters({
        blockedIds: blockedIdsForUi,
        mutedIds: mutedIdsForUi,
        posts: state.posts,
        candidates: state.candidates,
        matches: state.matches,
        conversations: state.conversations,
        stories: state.stories as any,
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
      posts: visibleSession.posts as typeof state.posts,
      stories: visibleSession.stories as typeof state.stories,
      publishStory,
      replyToStory,
      tab: state.tab,
      toasts: state.toasts,
      candidates: visibleSession.candidates as typeof state.candidates,
      matches: visibleSession.matches as typeof state.matches,
      likes: state.likes,
      conversations: visibleSession.conversations as typeof state.conversations,
      friendRequests: state.friendRequests,
      following: state.following,
      friends: state.friends || [],
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
      deletePost,
      editPost,
      addComment,
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
      startConversation,
      acceptMatch,
      rejectMatch,
      sendMessage,
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
      leaveCommunity,
      requestJoinCommunity,
      createBoardPost,
      addGroupMember,
      removeGroupMember,
      setGroupRole,
      updateGroupName,
      updateGroupPhoto,
      setTab,
      addToast,
      logout,
    }),
    // Intentionally depend on session slices + state fields that surface in UI.
    // Callbacks are useCallback-stable in this provider.
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
      state.likedPostIds,
      state.isOnline,
      state.networkQuality,
      state.matchCelebration,
      visibleSession,
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
      posts: visibleSession.posts as typeof state.posts,
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
      candidates: visibleSession.candidates as typeof state.candidates,
      matches: visibleSession.matches as typeof state.matches,
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
      conversations: visibleSession.conversations as typeof state.conversations,
      sendMessage,
      markConversationRead,
      pinConversation,
      archiveConversation,
      muteConversation,
      createGroup,
      joinCommunity,
      leaveCommunity,
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
      markConversationRead,
      pinConversation,
      archiveConversation,
      muteConversation,
      createGroup,
      joinCommunity,
      leaveCommunity,
      createBoardPost,
      startConversation,
      addToast,
      setTab,
    ],
  )

  const feedValue = useMemo(
    () => ({
      posts: visibleSession.posts as typeof state.posts,
      stories: state.stories,
      likedPostIds: state.likedPostIds || [],
      following: state.following || [],
      friends: state.friends || [],
      profile: state.profile,
      settings: state.settings,
      candidates: visibleSession.candidates as typeof state.candidates,
      createPost,
      likePost,
      deletePost,
      editPost,
      archivePost,
      unarchivePost,
      addComment,
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
      followUser,
      unfollowFromPost,
      muteUser,
      blockUser,
      addToast,
      setTab,
      shares: state.shares,
      reposts: state.reposts,
      blockedUsers: blockedIdsForUi,
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
      createPost,
      likePost,
      deletePost,
      editPost,
      archivePost,
      unarchivePost,
      addComment,
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

