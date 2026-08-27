/**
 * Factory — one place to build all canonical services for a session.
 */

import { createUserDomain } from "./user-domain"
import { createPostDomain } from "./post-domain"
import { createSocialGraphDomain } from "./social-graph-domain"
import { createMessagingDomain } from "./messaging-domain"
import { createReportDomain } from "./report-domain"
import { createShareDomain } from "./share-domain"
import { createStoryDomain } from "./story-domain"
import { createDiscoveryDomain } from "./discovery-domain"
import { createMatchingDomain } from "./matching-domain"
import { createCommunityDomain } from "./community-domain"
import { createProfileDomain } from "./profile-domain"
import { createNotificationDomain } from "./notification-domain"
import { createEconomyDomain, createLocalEconomyRepository } from "./economy-domain"
import { createReputationDomain } from "./reputation-domain"
import { createAchievementDomain } from "./achievement-domain"
import { createMembershipDomain, hydrateAccountCreatedAtFromServer } from "./membership-domain"
import { createVerificationDomain } from "./verification-domain"
import { createMarketplaceDomain } from "./marketplace-domain"
import { createPaymentDomain } from "./payment-domain"
import { createSearchDomain } from "./search-domain"
import { getBoundDomainServices } from "./compat"
export { getBoundDomainServices }
import {
  createLocalReportRepository,
  createLocalMessageRepository,
  createLocalPostRepository,
  createLocalConversationRepository,
  createLocalStoryRepository,
  createLocalSocialGraphRepository,
  type MessageRepository,
  type PostRepository,
  type ReportRepository,
  type ConversationRepository,
  type StoryRepository,
  type SocialGraphRepository,
} from "./repositories"
import {
  createHttpPostRepository,
  createHttpMessageRepository,
  createHttpReportRepository,
  createHttpConversationRepository,
  createHttpStoryRepository,
  createHttpSocialGraphRepository,
  resolveApiBaseUrl,
  createHttpEconomyRepository,
} from "./http-repositories"
import { createFeedDomain } from "./feed-domain"
import { buildPermissionContext } from "../permission-engine"
import type { Profile, Post, Conversation, StoryItem } from "../ghc-types"

export interface DomainStateSlice {
  profile: Profile
  posts: Post[]
  stories?: StoryItem[]
  following: string[]
  /** Users who follow the current user (when known) */
  followers?: string[]
  blockedUsers: string[]
  mutedUsers?: string[]
  restrictedUsers?: string[]
  matches: { userId: string }[]
  likes?: { id: string; fromUserId: string; toUserId: string; createdAt: number }[]
  friends: string[]
  outgoingFriendRequestIds?: string[]
  incomingFriendRequestIds?: string[]
  candidates: { id: string }[]
  conversations: Conversation[]
}

export interface DomainServiceOptions {
  currentUserId?: string
  onReportPersist?: (r: any) => void
  /** When set, messaging domain persists via repository (single write path) */
  messageRepository?: MessageRepository
  postRepository?: PostRepository
  reportRepository?: ReportRepository
  /** Or provide conversation getters/setters to build a local message repo */
  getConversations?: () => Conversation[]
  setConversations?: (updater: (c: Conversation[]) => Conversation[]) => void
  getPosts?: () => Post[]
  setPosts?: (updater: (posts: Post[]) => Post[]) => void
}

export function createDomainServices(
  getState: () => DomainStateSlice,
  options?: DomainServiceOptions
) {
  const uid = options?.currentUserId || "current-user"

  const user = createUserDomain({
    getProfile: () => getState().profile,
    currentUserId: uid,
  })
  /** Canonical Identity domain (same service instance as user) */
  const identity = user

  const posts = createPostDomain({
    getPosts: () => getState().posts,
    getBlockedUsers: () => getState().blockedUsers,
    getProfile: () => getState().profile,
    currentUserId: uid,
  })

  // Prefer HTTP repos when API base is configured (backend authoritative + optimistic cache)
  let postRepo = options?.postRepository
  const apiBase = resolveApiBaseUrl()
  if (!postRepo && apiBase) {
    postRepo = createHttpPostRepository({ baseUrl: apiBase })
  } else if (!postRepo && options?.getPosts && options?.setPosts) {
    postRepo = createLocalPostRepository({
      getPosts: options.getPosts,
      setPosts: options.setPosts,
    })
  }

  let socialRepo: SocialGraphRepository | null = null
  if (apiBase) {
    socialRepo = createHttpSocialGraphRepository({ baseUrl: apiBase })
  } else {
    socialRepo = createLocalSocialGraphRepository({
      getSnapshot: () => {
        const s = getState()
        return {
          following: s.following || [],
          followers: s.followers || [],
          friends: s.friends || [],
          blockedUsers: s.blockedUsers || [],
          mutedUsers: s.mutedUsers || [],
          restrictedUsers: s.restrictedUsers || [],
          matches: (s.matches || []) as any,
          friendRequests: [],
          outgoingFriendRequestIds: s.outgoingFriendRequestIds,
          incomingFriendRequestIds: s.incomingFriendRequestIds,
        }
      },
      applyPatch: () => {
        /* session owned by context patches */
      },
    })
  }

  const graph = createSocialGraphDomain(() => {
    const s = getState()
    return {
      ...buildPermissionContext({
        currentUserId: uid,
        blockedUsers: s.blockedUsers,
      }),
      following: s.following || [],
      followers: s.followers || [],
      blockedUsers: s.blockedUsers || [],
      mutedUsers: s.mutedUsers || [],
      restrictedUsers: s.restrictedUsers || [],
      matches: s.matches || [],
      friends: s.friends || [],
      outgoingFriendRequestIds: s.outgoingFriendRequestIds || [],
      incomingFriendRequestIds: s.incomingFriendRequestIds || [],
      candidates: s.candidates || [],
      conversations: s.conversations || [],
      onEdge: (input) => {
        socialRepo?.recordEdge?.({
          type: input.type as any,
          targetUserId: input.targetUserId,
          meta: input.meta,
        })
      },
    }
  })

  let messageRepo = options?.messageRepository
  if (!messageRepo && apiBase) {
    messageRepo = createHttpMessageRepository({ baseUrl: apiBase })
  } else if (!messageRepo && options?.getConversations && options?.setConversations) {
    messageRepo = createLocalMessageRepository({
      getConversations: options.getConversations,
      setConversations: options.setConversations,
    })
  }

  let conversationRepo: ConversationRepository | null = null
  if (apiBase) {
    conversationRepo = createHttpConversationRepository({ baseUrl: apiBase })
  } else if (options?.getConversations && options?.setConversations) {
    conversationRepo = createLocalConversationRepository({
      getConversations: options.getConversations,
      setConversations: options.setConversations,
    })
  }

  let storyRepo: StoryRepository | null = null
  if (apiBase) {
    storyRepo = createHttpStoryRepository({ baseUrl: apiBase })
  }

  const messaging = createMessagingDomain({
    currentUserId: uid,
    isBlocked: (id) => {
      const s = getState()
      const blocked = new Set([...(s.blockedUsers || [])])
      return blocked.has(id)
    },
    getConversationParticipant: (conversationId) => {
      const c = getState().conversations.find((x) => x.id === conversationId)
      return c?.participantId || null
    },
    getConversation: (conversationId) =>
      getState().conversations.find((x) => x.id === conversationId),
    repository: messageRepo,
    upsertConversation: (conversation) => {
      if (options?.setConversations) {
        options.setConversations((convs) => {
          const exists = convs.some((c) => c.id === conversation.id)
          if (exists) {
            return convs.map((c) => (c.id === conversation.id ? { ...c, ...conversation } : c))
          }
          return [conversation, ...convs]
        })
      }
    },
    patchConversation: (conversationId, patch) => {
      if (options?.setConversations) {
        options.setConversations((convs) =>
          convs.map((c) => (c.id === conversationId ? { ...c, ...patch } : c))
        )
      }
    },
    getPermissionContext: () => {
      const s = getState()
      const settings = (s as any).settings || (s.profile as any)?.settings
      return buildPermissionContext({
        currentUserId: uid,
        blockedUsers: s.blockedUsers || [],
        mutedIds: s.mutedUsers,
        restrictedIds: s.restrictedUsers,
        followingIds: s.following,
        friendIds: s.friends,
        matchIds: (s.matches || []).map((m) => m.userId),
        whoCanMessage: settings?.whoCanMessage || "everyone",
      })
    },
    isMember: (conversationId, userId) => {
      const c = getState().conversations.find((x) => x.id === conversationId)
      if (!c) return false
      const members = (c as any).members || (c as any).memberIds || []
      return members.includes(userId) || c.createdBy === userId
    },
  })

  const reportRepo =
    options?.reportRepository ||
    (apiBase
      ? createHttpReportRepository({ baseUrl: apiBase })
      : createLocalReportRepository({ onCreate: options?.onReportPersist }))

  const reports = createReportDomain({
    currentUserId: uid,
    repository: reportRepo,
    onPersist: options?.onReportPersist,
  })

  const feed = createFeedDomain(() => {
    const s = getState()
    return {
      ...buildPermissionContext({
        currentUserId: uid,
        blockedUsers: s.blockedUsers,
        mutedIds: s.mutedUsers,
        restrictedIds: s.restrictedUsers,
        followingIds: s.following,
        friendIds: s.friends,
      }),
      blockedUsers: s.blockedUsers || [],
      mutedUsers: s.mutedUsers || [],
      posts: s.posts || [],
      profile: s.profile,
      followingIds: s.following || [],
      friendIds: s.friends || [],
      communityIds: [],
      userInterests: s.profile?.interests || [],
      savedPostIds: [],
    }
  })

  const share = createShareDomain(() => {
    const s = getState()
    return {
      currentUserId: uid,
      blockedUsers: s.blockedUsers,
      posts: s.posts,
      conversations: s.conversations,
    }
  })

  const stories = createStoryDomain({
    currentUserId: uid,
    getStories: () => getState().stories || [],
    getBlockedUsers: () => getState().blockedUsers || [],
    getMutedUsers: () => getState().mutedUsers || [],
    matchIds: () => (getState().matches || []).map((m) => m.userId),
    friendIds: () => getState().friends || [],
    followingIds: () => getState().following || [],
  })

  const discovery = createDiscoveryDomain({
    currentUserId: uid,
    getCandidates: () => getState().candidates || [],
    getProfile: () => getState().profile,
    getBlockedUsers: () => getState().blockedUsers || [],
    getMutedUsers: () => getState().mutedUsers || [],
    getFollowingIds: () => getState().following || [],
    getFriendIds: () => getState().friends || [],
    locationDiscoveryEnabled: () => true,
  })
  /** Product name alias */
  const find = discovery

  const matching = createMatchingDomain({
    currentUserId: uid,
    getProfile: () => getState().profile,
    getMatches: () => getState().matches || [],
    getLikes: () => getState().likes || [],
    getCandidates: () => getState().candidates || [],
    getBlockedUsers: () => getState().blockedUsers || [],
    getFriendIds: () => getState().friends || [],
    getFollowingIds: () => getState().following || [],
  })

  const community = createCommunityDomain({
    currentUserId: uid,
    getConversations: () => getState().conversations || [],
    getBlockedUsers: () => getState().blockedUsers || [],
  })

  const profile = createProfileDomain({
    currentUserId: uid,
    getProfile: () => getState().profile,
    getPosts: () => getState().posts || [],
    getStories: () => getState().stories || [],
    getConversations: () => getState().conversations || [],
    getFollowing: () => getState().following || [],
    getFollowers: () => getState().followers || [],
    getFriends: () => getState().friends || [],
    getMatches: () => getState().matches || [],
    getBlockedUsers: () => getState().blockedUsers || [],
    getMutedUsers: () => getState().mutedUsers || [],
    getRestrictedUsers: () => getState().restrictedUsers || [],
    getOutgoingRequestIds: () => getState().outgoingFriendRequestIds || [],
    getIncomingRequestIds: () => getState().incomingFriendRequestIds || [],
  })

  const notifications = createNotificationDomain({
    currentUserId: uid,
    suppressSelf: true,
  })


  const economyRepo =
    apiBase
      ? createHttpEconomyRepository({ baseUrl: apiBase })
      : createLocalEconomyRepository()

  const economy = createEconomyDomain({
    currentUserId: uid,
    repository: economyRepo,
    isBlockedEitherWay: (otherId) => {
      const s = getState()
      const blocked = new Set([...(s.blockedUsers || [])])
      // If graph tracks who blocked me, merge when present
      const blockedBy = new Set([...((s as any).blockedByUsers || [])])
      return blocked.has(otherId) || blockedBy.has(otherId)
    },
    isAccountRestricted: () => {
      const s = getState() as any
      return Boolean(s.accountSuspended || s.isRestricted || s.profile?.restricted)
    },
    recipientExists: (otherId) => {
      if (!otherId?.trim()) return false
      // Known in session graph/candidates/conversations counts as exists for Studio
      const s = getState() as any
      if (otherId === uid) return true
      const pools = [
        ...(s.followers || []),
        ...(s.following || []),
        ...(s.friends || []),
        ...(s.matches || []).map((m: any) => m.userId || m.id),
        ...(s.candidates || []).map((c: any) => c.id || c.userId),
      ]
      if (pools.some((id: string) => id === otherId)) return true
      // Allow explicit ids in local multi-user tests (non-empty id)
      return otherId.length > 0
    },
  })

  const reputation = createReputationDomain({
    currentUserId: uid,
  })

  const achievements = createAchievementDomain({
    currentUserId: uid,
    getContext: () => {
      const s = getState()
      return {
        profile: s.profile,
        posts: s.posts || [],
        followerCount: (s.followers || []).length,
      }
    },
  })

  const membership = createMembershipDomain({
    currentUserId: uid,
    getAccountCreatedAt: () => {
      try {
        const p = getState().profile as { createdAt?: number; joinedAt?: number } | undefined
        const v = p?.createdAt ?? p?.joinedAt
        return typeof v === "number" && Number.isFinite(v) ? v : undefined
      } catch {
        return undefined
      }
    },
    spendGhc: async (input) => {
      // Lazy: economy is created above — closed over after both exist via getter below
      return { ok: false, error: "Wire spend after economy init" }
    },
  })

  // Best-effort: lock trial to server accountCreatedAt when API is available
  try {
    void hydrateAccountCreatedAtFromServer(uid)
  } catch {
    /* */
  }

  const verification = createVerificationDomain({
    currentUserId: uid,
  })

  // Re-bind membership with real economy spend (economy already constructed)
  const membershipWithSpend = createMembershipDomain({
    currentUserId: uid,
    getAccountCreatedAt: () => {
      try {
        const p = getState().profile as { createdAt?: number; joinedAt?: number } | undefined
        const v = p?.createdAt ?? p?.joinedAt
        return typeof v === "number" && Number.isFinite(v) ? v : undefined
      } catch {
        return undefined
      }
    },
    spendGhc: async (input) => {
      const r = await economy.spend({
        amount: input.amount,
        reason: input.reason,
        sourceEvent: input.sourceEvent,
        referenceId: input.referenceId,
      })
      if (!r.ok) return { ok: false, error: r.error }
      return { ok: true, txId: r.data?.tx?.id }
    },
  })

  const marketplace = createMarketplaceDomain({
    currentUserId: uid,
    getServices: () => getBoundDomainServices(),
  })

  const payment = createPaymentDomain({
    currentUserId: uid,
    getServices: () => getBoundDomainServices(),
  })

  const search = createSearchDomain({
    currentUserId: uid,
    getProfile: () => getState().profile,
    getCandidates: () => getState().candidates || [],
    getPosts: () => getState().posts || [],
    getConversations: () => getState().conversations || [],
    getListings: () => {
      try {
        return getBoundDomainServices()?.marketplace?.listListings?.({ status: "active" }) || []
      } catch {
        return []
      }
    },
    getBlockedUsers: () => getState().blockedUsers || [],
    getMutedUsers: () => getState().mutedUsers || [],
    getFollowing: () => getState().following || [],
    getFriends: () => getState().friends || [],
    isCommunityMember: (conversationId) => {
      const c = (getState().conversations || []).find((x) => x.id === conversationId)
      if (!c) return false
      const members = (c as any).members || []
      return members.includes(uid) || c.createdBy === uid
    },
  })

  return {
    user,
    identity,
    profile,
    notifications,
    economy,
    reputation,
    achievements,
    membership: membershipWithSpend,
    verification,
    marketplace,
    payment,
    search,
    posts,
    graph,
    messaging,
    reports,
    feed,
    stories,
    discovery,
    find,
    matching,
    community,
    share,
    /** Exposed so context can dual-write after domain create */
    postRepository: postRepo ?? null,
    messageRepository: messageRepo ?? null,
    conversationRepository: conversationRepo,
    storyRepository: storyRepo,
    socialRepository: socialRepo,
    backendConfigured: Boolean(apiBase),
  }
}

export type DomainServices = ReturnType<typeof createDomainServices>
