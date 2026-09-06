/**
 * Extraction seams for contexts/ghc-context.tsx (strangler-fig).
 *
 * These adapters map the mega-context slices onto domain contracts so UI can
 * migrate gradually. They do NOT move financial authority and do NOT invent data.
 *
 * Target order:
 * 1. Identity / Profile
 * 2. Connections
 * 3. Discovery
 * 4. Feed
 * 5. Messaging
 */

import { isDemoDataAllowed } from "@/lib/demo-data-policy"
import { IdentityService } from "@/lib/identity/identity-service"
import {
  defaultIdentityEmptyState,
  type IdentityDomainContract,
  type IdentitySnapshot,
} from "@/lib/domains/contracts/identity"
import {
  defaultNetworkEmptyState,
  type ConnectionsDomainContract,
  type ConnectionsSummary,
} from "@/lib/domains/contracts/connections"
import {
  discoveryEmptyState,
  buildExplainableReasons,
  type DiscoveryDomainContract,
  type DiscoveryQuery,
  type DiscoveryCandidate,
} from "@/lib/domains/contracts/discovery"
import {
  feedEmptyState,
  type FeedDomainContract,
  type FeedPostSummary,
} from "@/lib/domains/contracts/feed"
import {
  messagingEmptyState,
  type MessagingDomainContract,
  type ConversationSummary,
} from "@/lib/domains/contracts/messaging"
import type { DomainResult } from "@/lib/domains/contracts/types"
import type { CanonicalFeedMode } from "@/lib/domains/feed-domain"
import { resolveUserIntents } from "@/lib/connection-intents"

function emptyOk<T>(data: T): DomainResult<T> {
  return { ok: true, data, source: "empty" }
}

function sessionOk<T>(data: T): DomainResult<T> {
  return { ok: true, data, source: "session" }
}

/** Profile-like shape from existing session (loose to avoid coupling) */
export type SeamProfile = {
  id?: string
  displayName?: string
  username?: string
  ghId?: string
  avatar?: string
  photoUrl?: string
  bio?: string
  location?: string
  city?: string
  profession?: string
  interests?: string[]
  onboarded?: boolean
  connectionIntents?: string[]
  primaryMode?: string
  profileCompletion?: number
}

export type SeamPost = {
  id: string
  userId?: string
  authorId?: string
  authorName?: string
  content?: string
  text?: string
  createdAt?: string
  likes?: number
  likeCount?: number
  comments?: unknown[]
  commentCount?: number
}

export type SeamConversation = {
  id: string
  title?: string
  name?: string
  peerId?: string
  lastMessage?: string
  preview?: string
  unread?: number
  unreadCount?: number
  updatedAt?: string
  kind?: string
}

export function createIdentitySeam(getProfile: () => SeamProfile | null | undefined): IdentityDomainContract {
  return {
    getSnapshot(): DomainResult<IdentitySnapshot> {
      const p = getProfile()
      const id = IdentityService.getCurrentUserId()
      if (!p && !id) {
        return { ok: false, error: "NO_IDENTITY", code: "NO_IDENTITY" }
      }
      const interests = Array.isArray(p?.interests) ? p!.interests! : []
      const completion =
        typeof p?.profileCompletion === "number"
          ? p.profileCompletion
          : Math.min(
              100,
              (p?.displayName ? 20 : 0) +
                (p?.bio ? 20 : 0) +
                (interests.length ? 20 : 0) +
                (p?.avatar || p?.photoUrl ? 20 : 0) +
                (p?.profession ? 20 : 0)
            )
      const snap: IdentitySnapshot = {
        userId: p?.id || id,
        piUserId: IdentityService.getPiUserId(),
        username: p?.username || IdentityService.getUsername(),
        displayName: p?.displayName || "Member",
        ghId: p?.ghId || null,
        avatarUrl: p?.avatar || p?.photoUrl || null,
        bio: p?.bio || null,
        locationLabel: p?.location || p?.city || null,
        profession: p?.profession || null,
        interests,
        onboarded: Boolean(p?.onboarded),
        profileCompletionPercent: completion,
        verificationState: IdentityService.getVerificationState(),
      }
      return sessionOk(snap)
    },
    completionEmptyState: defaultIdentityEmptyState,
  }
}

export function createConnectionsSeam(getCounts: () => Partial<ConnectionsSummary>): ConnectionsDomainContract {
  return {
    getSummary(): DomainResult<ConnectionsSummary> {
      const c = getCounts()
      return sessionOk({
        friendsCount: c.friendsCount ?? 0,
        followingCount: c.followingCount ?? 0,
        followersCount: c.followersCount ?? 0,
        pendingRequestsCount: c.pendingRequestsCount ?? 0,
      })
    },
    listFriends() {
      return emptyOk([])
    },
    listFollowing() {
      return emptyOk([])
    },
    emptyNetworkState: defaultNetworkEmptyState,
  }
}

/**
 * Discovery seam — filters studio seeds in production; explainable reasons only.
 */
export function createDiscoverySeam(getCandidates: () => Array<Record<string, unknown>>): DiscoveryDomainContract {
  return {
    search(query: DiscoveryQuery): DomainResult<DiscoveryCandidate[]> {
      if (!isDemoDataAllowed()) {
        // Production: only map real candidates; never inject seeds
      }
      const raw = getCandidates() || []
      const limit = query.limit ?? 20
      const mapped: DiscoveryCandidate[] = []
      for (const c of raw) {
        if (mapped.length >= limit) break
        const id = String(c.id || c.userId || "")
        if (!id) continue
        if (!isDemoDataAllowed() && (id.startsWith("demo-") || id.startsWith("seed-"))) continue
        const interests = Array.isArray(c.interests) ? (c.interests as string[]) : []
        const intents = resolveUserIntents(id, {
          connectionIntents: c.connectionIntents as string[] | undefined,
          primaryMode: c.primaryMode as string | undefined,
        })
        const sharedIntents = (query.intents || []).filter((i) => intents.includes(i))
        const sharedInterests = (query.interests || []).filter((i) =>
          interests.map((x) => x.toLowerCase()).includes(i.toLowerCase())
        )
        mapped.push({
          id,
          kind: query.category === "communities" ? "communities" : "people",
          displayName: String(c.displayName || c.name || "Member"),
          subtitle: String(c.profession || c.bio || "").slice(0, 120) || undefined,
          avatarUrl: (c.avatar || c.photoUrl) as string | null | undefined,
          locationLabel: (c.location || c.city) as string | null | undefined,
          interests,
          intents,
          reasons: buildExplainableReasons({
            sharedInterests: sharedInterests.slice(0, 3),
            sharedIntents: sharedIntents.slice(0, 3),
          }),
          rankScore: typeof c.score === "number" ? c.score : undefined,
        })
      }
      if (mapped.length === 0) return emptyOk([])
      return sessionOk(mapped)
    },
    emptyState: discoveryEmptyState,
  }
}

export function createFeedSeam(getPosts: () => SeamPost[]): FeedDomainContract {
  return {
    list(mode: CanonicalFeedMode, limit = 30): DomainResult<FeedPostSummary[]> {
      const posts = getPosts() || []
      const list = posts.slice(0, limit).map((p) => ({
        id: p.id,
        authorId: p.authorId || p.userId || "",
        authorName: p.authorName || "Member",
        preview: String(p.content || p.text || "").slice(0, 160),
        createdAt: p.createdAt || new Date(0).toISOString(),
        likeCount: p.likeCount ?? p.likes ?? 0,
        commentCount: p.commentCount ?? (Array.isArray(p.comments) ? p.comments.length : 0),
      }))
      if (!list.length) return emptyOk([])
      return sessionOk(list)
    },
    emptyState: feedEmptyState,
  }
}

export function createMessagingSeam(getConversations: () => SeamConversation[]): MessagingDomainContract {
  return {
    listInbox(limit = 50): DomainResult<ConversationSummary[]> {
      const rows = (getConversations() || []).slice(0, limit).map((c) => ({
        id: c.id,
        peerUserId: c.peerId,
        title: c.title || c.name || "Conversation",
        lastPreview: c.lastMessage || c.preview || "",
        unreadCount: c.unreadCount ?? c.unread ?? 0,
        updatedAt: c.updatedAt || new Date(0).toISOString(),
        kind:
          c.kind === "community" || c.kind === "group"
            ? (c.kind as "community" | "group")
            : ("direct" as const),
      }))
      if (!rows.length) return emptyOk([])
      return sessionOk(rows)
    },
    conversationsNeedingAttention(): DomainResult<ConversationSummary[]> {
      const inbox = this.listInbox(50)
      if (!inbox.ok) return inbox
      const need = inbox.data.filter((c) => c.unreadCount > 0)
      return need.length ? sessionOk(need) : emptyOk([])
    },
    emptyInboxState: messagingEmptyState,
  }
}

/**
 * Documented map of ghc-context responsibilities → target domains.
 * Used by audits; does not mutate runtime.
 */
export const GHC_CONTEXT_EXTRACTION_MAP = {
  identity: ["profile", "identityUserId", "IdentityService alignment"],
  connections: ["friends", "following", "followers", "blockedUsers", "graph"],
  discovery: ["candidates", "find filters", "match pool"],
  feed: ["posts", "stories", "feed mode"],
  messaging: ["conversations", "messages", "startConversation"],
  /** Protected — do not extract into social contracts */
  economy_protected: ["wallet", "ledger", "claims", "membership", "pi payments"],
} as const
