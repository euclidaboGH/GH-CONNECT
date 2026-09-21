/**
 * ProfileDomain — Profile as digital identity presentation.
 *
 * Composes Identity + Social Graph + Feed + Stories + Community reads.
 * Does not create a second profile store — session Profile remains singular.
 *
 * Relationship actions always derive from canonical Social Graph state
 * (never hardcode Follow/Connect/Match labels).
 */

import type {
  Profile,
  Post,
  StoryItem,
  Candidate,
  MatchEntry,
  Conversation,
} from "../ghc-types"
import type { DomainServices } from "./create-domains"
import type { SocialGraphSnapshot } from "../social-graph"
import type { MatchIntention } from "../ghc-types"

export type ProfileRelationshipAction =
  | "follow"
  | "unfollow"
  | "connect"
  | "accept_request"
  | "cancel_request"
  | "remove_connection"
  | "match"
  | "unmatch"
  | "message"
  | "block"
  | "unblock"
  | "restrict"
  | "unrestrict"
  | "report"
  | "mute"
  | "unmute"

export interface ProfileRelationshipState {
  isSelf: boolean
  isFollowing: boolean
  isFollower: boolean
  isFriend: boolean
  isMatched: boolean
  isBlocked: boolean
  isMuted: boolean
  isRestricted: boolean
  outgoingRequest: boolean
  incomingRequest: boolean
  /** Ordered actions appropriate for current graph state */
  actions: ProfileRelationshipAction[]
  /** Human-readable status for UI chips */
  statusLabel: string
}

export interface DigitalIdentityView {
  profile: Profile
  userId: string
  bio: string
  about: {
    profession: string
    education: string
    hometown: string
    city: string
    country: string
    status: string
  }
  interests: string[]
  skills: string[]
  posts: Post[]
  media: Array<{ type: "image" | "video"; url: string; postId?: string }>
  communities: Conversation[]
  connections: { friends: string[]; following: string[]; followers: string[] }
  stories: StoryItem[]
  highlights: StoryItem[]
  achievements: string[]
  reputation: { score?: number; notes: string[] }
  verification: { verified: boolean }
  marketplace: {
    sellerEnabled: boolean
    activeListings?: number
    completedOrders?: number
    averageRating?: number
  }
  membership?: {
    tier: string
    label: string
    badge?: string
  }
  verification?: {
    verified: boolean
    labels: string[]
  }
  creatorBusiness?: {
    isCreator: boolean
    isBusiness: boolean
  }
  /** GHC wallet is private by default — only present when user opts in */
  walletPublic?: never
  relationship?: ProfileRelationshipState
}

export function createProfileDomain(deps: {
  currentUserId?: string
  getProfile: () => Profile
  getPosts: () => Post[]
  getStories?: () => StoryItem[]
  getConversations?: () => Conversation[]
  getFollowing?: () => string[]
  getFollowers?: () => string[]
  getFriends?: () => string[]
  getMatches?: () => MatchEntry[]
  getBlockedUsers?: () => string[]
  getMutedUsers?: () => string[]
  getRestrictedUsers?: () => string[]
  getOutgoingRequestIds?: () => string[]
  getIncomingRequestIds?: () => string[]
  /** Optional live graph snapshot for richer edges */
  getGraphSnapshot?: (me: string) => SocialGraphSnapshot | null
}) {
  const me = deps.currentUserId || "current-user"

  function relationshipTo(userId: string): ProfileRelationshipState {
    if (!userId || userId === me) {
      return {
        isSelf: true,
        isFollowing: false,
        isFollower: false,
        isFriend: false,
        isMatched: false,
        isBlocked: false,
        isMuted: false,
        isRestricted: false,
        outgoingRequest: false,
        incomingRequest: false,
        actions: [],
        statusLabel: "You",
      }
    }

    const following = new Set(deps.getFollowing?.() || [])
    const followers = new Set(deps.getFollowers?.() || [])
    const friends = new Set(deps.getFriends?.() || [])
    const matches = new Set((deps.getMatches?.() || []).map((m) => m.userId))
    const blocked = new Set(deps.getBlockedUsers?.() || [])
    const muted = new Set(deps.getMutedUsers?.() || [])
    const restricted = new Set(deps.getRestrictedUsers?.() || [])
    const outgoing = new Set(deps.getOutgoingRequestIds?.() || [])
    const incoming = new Set(deps.getIncomingRequestIds?.() || [])

    const state: ProfileRelationshipState = {
      isSelf: false,
      isFollowing: following.has(userId),
      isFollower: followers.has(userId),
      isFriend: friends.has(userId),
      isMatched: matches.has(userId),
      isBlocked: blocked.has(userId),
      isMuted: muted.has(userId),
      isRestricted: restricted.has(userId),
      outgoingRequest: outgoing.has(userId),
      incomingRequest: incoming.has(userId),
      actions: [],
      statusLabel: "",
    }

    // Block takes precedence
    if (state.isBlocked) {
      state.actions = ["unblock", "report"]
      state.statusLabel = "Blocked"
      return state
    }

    const actions: ProfileRelationshipAction[] = []

    if (state.isFollowing) actions.push("unfollow")
    else actions.push("follow")

    if (state.isFriend) actions.push("remove_connection")
    else if (state.incomingRequest) actions.push("accept_request")
    else if (state.outgoingRequest) actions.push("cancel_request")
    else actions.push("connect")

    if (state.isMatched) actions.push("unmatch")
    else actions.push("match")

    actions.push("message")

    if (state.isMuted) actions.push("unmute")
    else actions.push("mute")

    actions.push("block", "report")

    state.actions = actions

    if (state.isFriend) state.statusLabel = "Connected"
    else if (state.isMatched) state.statusLabel = "Matched"
    else if (state.outgoingRequest) state.statusLabel = "Request sent"
    else if (state.incomingRequest) state.statusLabel = "Wants to connect"
    else if (state.isFollowing && state.isFollower) state.statusLabel = "Friends on feed"
    else if (state.isFollowing) state.statusLabel = "Following"
    else if (state.isFollower) state.statusLabel = "Follows you"
    else state.statusLabel = "Not connected"

    return state
  }

  function buildSelfIdentity(): DigitalIdentityView {
    const profile = deps.getProfile()
    const posts = (deps.getPosts() || []).filter(
      (p) => p.authorId === me || p.authorId === "current-user"
    )
    const stories = (deps.getStories?.() || []).filter(
      (s) => !s.ownerId || s.ownerId === me || s.ownerId === "current-user"
    )
    const highlights = stories.filter((s) => s.status === "highlight")
    const communities = (deps.getConversations?.() || []).filter(
      (c) =>
        c.conversationType === "group" &&
        ((c as any).kind === "community" ||
          (c as any).members?.includes(me) ||
          c.createdBy === me)
    )

    const media: DigitalIdentityView["media"] = []
    for (const p of posts) {
      for (const url of p.images || []) {
        media.push({ type: "image", url, postId: p.id })
      }
      if (p.video) media.push({ type: "video", url: p.video, postId: p.id })
    }

    return {
      profile,
      userId: me,
      bio: profile.bio || "",
      about: {
        profession: profile.profession || "",
        education: profile.education || "",
        hometown: profile.hometown || "",
        city: profile.city || "",
        country: profile.country || "",
        status: profile.status || "",
      },
      interests: profile.interests || [],
      skills: profile.skills || [],
      posts,
      media,
      communities,
      connections: {
        friends: deps.getFriends?.() || [],
        following: deps.getFollowing?.() || [],
        followers: deps.getFollowers?.() || [],
      },
      stories,
      highlights,
      achievements: (() => {
        try {
          const { getBoundDomainServices } = require("./compat")
          const services = getBoundDomainServices?.()
          const unlocked = services?.achievements?.getUnlockedForProfile?.() || []
          if (unlocked.length) return unlocked.map((a: any) => a.id)
        } catch { /* */ }
        return (profile as any).achievements || []
      })(),
      reputation: (() => {
        try {
          const { getBoundDomainServices } = require("./compat")
          const services = getBoundDomainServices?.()
          const snap = services?.reputation?.getSnapshot?.()
          if (snap) return { score: snap.score, notes: [`tier:${snap.tier}`] }
        } catch { /* */ }
        return {
          score: (profile as any).reputationScore,
          notes: [],
        }
      })(),
      verification: (() => {
        try {
          const { getBoundDomainServices } = require("./compat")
          const services = getBoundDomainServices?.()
          const snap = services?.verification?.getSnapshot?.()
          if (snap) {
            return {
              verified: snap.anyVerified || Boolean(profile.verified),
              labels: services?.verification?.getLabels?.() || [],
            }
          }
        } catch { /* */ }
        return { verified: Boolean(profile.verified), labels: [] }
      })(),
      membership: (() => {
        try {
          const { getBoundDomainServices } = require("./compat")
          const services = getBoundDomainServices?.()
          const status = services?.membership?.getStatus?.()
          const plan = services?.membership?.getPlan?.()
          if (status && plan) {
            return {
              tier: status.tier,
              label: plan.label,
              badge:
                status.tier === "vvip"
                  ? "VVIP"
                  : status.tier === "vip"
                    ? "VIP"
                    : undefined,
            }
          }
        } catch { /* */ }
        return { tier: "free", label: "Free" }
      })(),
      marketplace: (() => {
        try {
          const { getBoundDomainServices } = require("./compat")
          const services = getBoundDomainServices?.()
          const seller = services?.marketplace?.getSellerProfile?.(me)
          if (seller) {
            return {
              sellerEnabled: seller.activeListings > 0 || seller.completedOrders > 0,
              activeListings: seller.activeListings,
              completedOrders: seller.completedOrders,
              averageRating: seller.averageRating,
            }
          }
        } catch { /* */ }
        return {
          sellerEnabled: Boolean((profile as any).marketplaceEnabled),
        }
      })(),
      creatorBusiness: (() => {
        try {
          const { getBoundDomainServices } = require("./compat")
          const services = getBoundDomainServices?.()
          const isCreator = Boolean(services?.verification?.isVerified?.("creator"))
          const isBusiness = Boolean(
            services?.verification?.isVerified?.("business") ||
              services?.verification?.isVerified?.("organization")
          )
          return { isCreator, isBusiness }
        } catch {
          return { isCreator: false, isBusiness: false }
        }
      })(),
      // GHC balance intentionally omitted — private by default
      relationship: relationshipTo(me),
    }
  }

  /**
   * Public presentation for another user when only candidate/partial data exists.
   * Still attaches live relationship state from the graph.
   */
  function buildPeerIdentity(input: {
    userId: string
    displayName?: string
    photo?: string
    bio?: string
    interests?: string[]
    location?: string
    verified?: boolean
    profession?: string
  }): DigitalIdentityView {
    const posts = (deps.getPosts() || []).filter((p) => p.authorId === input.userId)
    const stories = (deps.getStories?.() || []).filter((s) => s.ownerId === input.userId)
    const shell: Profile = {
      ...deps.getProfile(),
      displayName: input.displayName || "User",
      bio: input.bio || "",
      photos: input.photo ? [input.photo] : [],
      interests: input.interests || [],
      city: input.location || "",
      verified: Boolean(input.verified),
      profession: input.profession || "",
    }

    return {
      profile: shell,
      userId: input.userId,
      bio: shell.bio,
      about: {
        profession: shell.profession,
        education: shell.education || "",
        hometown: shell.hometown || "",
        city: shell.city,
        country: shell.country || "",
        status: "",
      },
      interests: shell.interests,
      skills: [],
      posts,
      media: posts.flatMap((p) =>
        (p.images || []).map((url) => ({ type: "image" as const, url, postId: p.id }))
      ),
      communities: [],
      connections: { friends: [], following: [], followers: [] },
      stories,
      highlights: stories.filter((s) => s.status === "highlight"),
      achievements: [],
      reputation: { notes: [] },
      verification: { verified: shell.verified },
      marketplace: { sellerEnabled: false },
      relationship: relationshipTo(input.userId),
    }
  }

  return {
    /** Canonical self digital identity (single profile store) */
    getDigitalIdentity(): DigitalIdentityView {
      return buildSelfIdentity()
    },

    getPeerIdentity: buildPeerIdentity,

    /** Derive actions from Social Graph — never hardcode */
    getRelationshipState(userId: string): ProfileRelationshipState {
      return relationshipTo(userId)
    },

    /**
     * Map UI intent → graph/matching mutation name for callers.
     * Actual mutation goes through domains.graph / domains.matching / messaging.
     */
    resolveActionHandler(action: ProfileRelationshipAction): {
      domain: "graph" | "matching" | "messaging" | "reports"
      operation: string
    } {
      switch (action) {
        case "follow":
        case "unfollow":
          return { domain: "graph", operation: "toggleFollow" }
        case "connect":
          return { domain: "graph", operation: "sendFriendRequest" }
        case "accept_request":
          return { domain: "graph", operation: "acceptFriendRequest" }
        case "cancel_request":
          return { domain: "graph", operation: "cancelFriendRequest" }
        case "remove_connection":
          return { domain: "graph", operation: "removeFriend" }
        case "match":
          return { domain: "matching", operation: "expressInterest" }
        case "unmatch":
          return { domain: "matching", operation: "unmatch" }
        case "message":
          return { domain: "messaging", operation: "createConversation" }
        case "block":
          return { domain: "graph", operation: "applyBlock" }
        case "unblock":
          return { domain: "graph", operation: "removeBlock" }
        case "restrict":
          return { domain: "graph", operation: "restrictUser" }
        case "unrestrict":
          return { domain: "graph", operation: "unrestrictUser" }
        case "mute":
          return { domain: "graph", operation: "muteUser" }
        case "unmute":
          return { domain: "graph", operation: "unmuteUser" }
        case "report":
          return { domain: "reports", operation: "createReport" }
        default:
          return { domain: "graph", operation: "unknown" }
      }
    },
  }
}

export type ProfileDomain = ReturnType<typeof createProfileDomain>

/**
 * Execute a profile relationship action through bound domain services.
 * Keeps UI free of hardcoded graph rules.
 */
export async function performProfileRelationshipAction(
  services: DomainServices,
  action: ProfileRelationshipAction,
  userId: string,
  extras?: {
    userName?: string
    userPhoto?: string
    reportReason?: string
  }
): Promise<{ ok: boolean; error?: string; data?: unknown }> {
  if (!services) return { ok: false, error: "Services unavailable" }
  if (!userId) return { ok: false, error: "Invalid user" }
  switch (action) {
    case "follow":
    case "unfollow": {
      if (!services.graph?.toggleFollow) return { ok: false, error: "Graph unavailable" }
      const r = await services.graph.toggleFollow(userId)
      return r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error }
    }
    case "connect": {
      const r = await services.graph?.sendFriendRequest?.(userId)
      return r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error }
    }
    case "accept_request": {
      const r = await services.graph?.acceptFriendRequest?.(userId)
      return r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error }
    }
    case "cancel_request": {
      const r = await services.graph.cancelFriendRequest?.(userId)
      if (!r) return { ok: false, error: "Cancel not available" }
      return r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error }
    }
    case "remove_connection": {
      const r = await services.graph?.removeFriend?.(userId)
      return r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error }
    }
    case "match": {
      const r = await services.matching?.expressInterest?.(userId)
      return r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error }
    }
    case "unmatch": {
      const r = await services.matching?.unmatch?.(userId)
      return r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error }
    }
    case "message": {
      const r = await services.messaging.createConversation({
        kind: "private",
        participantId: userId,
        participantName: extras?.userName || "User",
        participantPhoto: extras?.userPhoto,
      })
      return r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error }
    }
    case "restrict": {
      const r = await services.graph.restrictUser(userId)
      return r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error }
    }
    case "unrestrict": {
      const r = await services.graph.unrestrictUser(userId)
      return r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error }
    }
    case "block": {
      const r = await services.graph.applyBlock(userId)
      return r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error }
    }
    case "unblock": {
      const r = await services.graph.removeBlock(userId)
      return r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error }
    }
    case "mute": {
      const r = await services.graph.muteUser(userId)
      return r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error }
    }
    case "unmute": {
      const r = await services.graph.unmuteUser(userId)
      return r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error }
    }
    case "report": {
      const r = await services.reports.report(
        "user",
        userId,
        extras?.reportReason || "profile_report"
      )
      return r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error }
    }
    default:
      return { ok: false, error: "Unknown action" }
  }
}
