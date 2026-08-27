/**
 * Universal Search — one architecture for People, Communities, Posts,
 * Marketplace listings, Services, Interests, Profession, Hashtags.
 *
 * Screens call this domain only; they must not invent separate search engines.
 * Results respect privacy, blocking, visibility, membership, moderation, listing status.
 */

import type {
  Candidate,
  Post,
  Conversation,
  Profile,
} from "../ghc-types"
import type { MarketplaceListing } from "./marketplace-domain"
import { resolveBlockedIds } from "../block-enforcement"
import { isSoftDeleted } from "../social-graph"

export type SearchEntityType =
  | "people"
  | "communities"
  | "posts"
  | "listings"
  | "services"
  | "interests"
  | "profession"
  | "hashtags"

export interface SearchHit {
  type: SearchEntityType
  id: string
  title: string
  subtitle?: string
  photo?: string
  score: number
  /** Opaque payload for navigation — never a second source of truth */
  ref: {
    userId?: string
    postId?: string
    conversationId?: string
    listingId?: string
    tag?: string
    profession?: string
    interest?: string
  }
}

export interface SearchQuery {
  q: string
  types?: SearchEntityType[]
  limit?: number
  /** When set, only return this type */
  type?: SearchEntityType
}

export interface SearchResponse {
  query: string
  hits: SearchHit[]
  counts: Partial<Record<SearchEntityType, number>>
}

function norm(s: string) {
  return s.trim().toLowerCase()
}

function tokens(q: string): string[] {
  return norm(q)
    .split(/[\s,.#]+/)
    .filter((t) => t.length >= 1)
}

function scoreText(query: string, ...fields: (string | undefined | null)[]): number {
  const q = norm(query)
  if (!q) return 0
  const tks = tokens(query)
  let score = 0
  const blob = fields
    .filter(Boolean)
    .map((f) => norm(String(f)))
    .join(" ")
  if (!blob) return 0
  if (blob === q) score += 100
  if (blob.startsWith(q)) score += 40
  if (blob.includes(q)) score += 20
  for (const t of tks) {
    if (blob.includes(t)) score += 8
  }
  return score
}

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w\u00c0-\u024f]+/gi) || []
  return matches.map((m) => m.slice(1).toLowerCase())
}

export function createSearchDomain(deps: {
  currentUserId?: string
  getProfile?: () => Profile
  getCandidates: () => Candidate[]
  getPosts: () => Post[]
  getConversations: () => Conversation[]
  getListings?: () => MarketplaceListing[]
  getBlockedUsers: () => string[]
  getMutedUsers?: () => string[]
  getFollowing?: () => string[]
  getFriends?: () => string[]
  /** Community membership check */
  isCommunityMember?: (conversationId: string) => boolean
  /** Optional interests catalog */
  getInterestCatalog?: () => string[]
}) {
  const me = deps.currentUserId || "current-user"

  function blockedSet(): Set<string> {
    return new Set(
      resolveBlockedIds({
        blockedUsers: deps.getBlockedUsers() || [],
      })
    )
  }

  function mutedSet(): Set<string> {
    return new Set(deps.getMutedUsers?.() || [])
  }

  function canSeePerson(c: Candidate, blocked: Set<string>): boolean {
    if (!c?.id || c.id === me) return false
    if (blocked.has(c.id)) return false
    // Hidden / private profiles: if candidate exposes visibility
    const vis = (c as any).profileVisibility || (c as any).visibility
    if (vis === "hidden") return false
    if (vis === "matches-only" || vis === "friends") {
      const friends = new Set(deps.getFriends?.() || [])
      if (!friends.has(c.id)) return false
    }
    return true
  }

  function canSeePost(p: Post, blocked: Set<string>, muted: Set<string>): boolean {
    if (!p?.id || isSoftDeleted(p as any)) return false
    if (blocked.has(p.authorId) || muted.has(p.authorId)) return false
    const vis = p.visibility || (p as any).visibleTo
    if (vis === "private" && p.authorId !== me) return false
    if (vis === "followers" || vis === "mutuals") {
      const following = new Set(deps.getFollowing?.() || [])
      const friends = new Set(deps.getFriends?.() || [])
      if (p.authorId !== me && !following.has(p.authorId) && !friends.has(p.authorId)) {
        return false
      }
    }
    // Moderation: under_review style flags
    if ((p as any).moderationStatus === "removed" || (p as any).status === "removed") {
      return false
    }
    return true
  }

  function canSeeCommunity(c: Conversation, blocked: Set<string>): boolean {
    if (!c?.id) return false
    const isGroup =
      c.conversationType === "group" ||
      (c as any).kind === "community" ||
      (c as any).isCommunity
    if (!isGroup) return false
    const privacy = (c as any).privacy || (c as any).visibility || "public"
    if (privacy === "secret" || privacy === "private") {
      if (deps.isCommunityMember) return deps.isCommunityMember(c.id)
      const members: string[] = (c as any).members || []
      return members.includes(me) || c.createdBy === me
    }
    // Don't surface communities owned solely by blocked users when known
    if (c.createdBy && blocked.has(c.createdBy)) return false
    return true
  }

  function canSeeListing(l: MarketplaceListing): boolean {
    if (!l?.id) return false
    if (l.status !== "active") return false
    const blocked = blockedSet()
    if (blocked.has(l.sellerId)) return false
    return true
  }

  function searchPeople(q: string, limit: number): SearchHit[] {
    const blocked = blockedSet()
    const hits: SearchHit[] = []
    for (const c of deps.getCandidates() || []) {
      if (!canSeePerson(c, blocked)) continue
      const score = scoreText(
        q,
        c.name,
        c.bio,
        (c as any).profession,
        ...(c.interests || [])
      )
      if (score <= 0) continue
      hits.push({
        type: "people",
        id: c.id,
        title: c.name,
        subtitle: [(c as any).profession, c.location].filter(Boolean).join(" · "),
        photo: c.photo,
        score,
        ref: { userId: c.id },
      })
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, limit)
  }

  function searchCommunities(q: string, limit: number): SearchHit[] {
    const blocked = blockedSet()
    const hits: SearchHit[] = []
    for (const c of deps.getConversations() || []) {
      if (!canSeeCommunity(c, blocked)) continue
      const title = c.name || (c as any).title || "Community"
      const score = scoreText(q, title, (c as any).description)
      if (score <= 0) continue
      hits.push({
        type: "communities",
        id: c.id,
        title,
        subtitle: (c as any).description,
        photo: (c as any).photo || c.participantPhoto,
        score,
        ref: { conversationId: c.id },
      })
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, limit)
  }

  function searchPosts(q: string, limit: number): SearchHit[] {
    const blocked = blockedSet()
    const muted = mutedSet()
    const hits: SearchHit[] = []
    for (const p of deps.getPosts() || []) {
      if (!canSeePost(p, blocked, muted)) continue
      const tags = (p.hashtags || []).join(" ")
      const score = scoreText(q, p.content, p.authorName, tags)
      if (score <= 0) continue
      hits.push({
        type: "posts",
        id: p.id,
        title: p.content.slice(0, 120) || "Post",
        subtitle: p.authorName,
        photo: p.authorPhoto || p.images?.[0],
        score,
        ref: { postId: p.id, userId: p.authorId },
      })
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, limit)
  }

  function searchListings(q: string, limit: number, servicesOnly = false): SearchHit[] {
    const list = deps.getListings?.() || []
    const hits: SearchHit[] = []
    for (const l of list) {
      if (!canSeeListing(l)) continue
      if (servicesOnly && l.kind !== "service") continue
      if (!servicesOnly && l.kind === "service") {
        // services also appear under services type; still include in listings
      }
      const score = scoreText(
        q,
        l.title,
        l.description,
        l.category,
        ...(l.tags || [])
      )
      if (score <= 0) continue
      hits.push({
        type: servicesOnly ? "services" : "listings",
        id: l.id,
        title: l.title,
        subtitle: `${l.price} ${l.currency} · ${l.category}`,
        photo: l.media?.[0],
        score,
        ref: { listingId: l.id, userId: l.sellerId },
      })
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, limit)
  }

  function searchInterests(q: string, limit: number): SearchHit[] {
    const catalog = new Set<string>([
      ...(deps.getInterestCatalog?.() || []),
      ...(deps.getProfile?.()?.interests || []),
    ])
    for (const c of deps.getCandidates() || []) {
      for (const i of c.interests || []) catalog.add(i)
    }
    const hits: SearchHit[] = []
    for (const interest of catalog) {
      const score = scoreText(q, interest)
      if (score <= 0) continue
      hits.push({
        type: "interests",
        id: `interest:${norm(interest)}`,
        title: interest,
        score,
        ref: { interest },
      })
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, limit)
  }

  function searchProfessions(q: string, limit: number): SearchHit[] {
    const set = new Set<string>()
    const profileProf = deps.getProfile?.()?.profession
    if (profileProf) set.add(profileProf)
    for (const c of deps.getCandidates() || []) {
      const p = (c as any).profession
      if (p) set.add(String(p))
    }
    const hits: SearchHit[] = []
    for (const profession of set) {
      const score = scoreText(q, profession)
      if (score <= 0) continue
      hits.push({
        type: "profession",
        id: `profession:${norm(profession)}`,
        title: profession,
        score,
        ref: { profession },
      })
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, limit)
  }

  function searchHashtags(q: string, limit: number): SearchHit[] {
    const counts = new Map<string, number>()
    const rawQ = norm(q).replace(/^#/, "")
    for (const p of deps.getPosts() || []) {
      if (isSoftDeleted(p as any)) continue
      const tags = p.hashtags?.length
        ? p.hashtags.map((t) => t.replace(/^#/, "").toLowerCase())
        : extractHashtags(p.content || "")
      for (const t of tags) {
        counts.set(t, (counts.get(t) || 0) + 1)
      }
    }
    const hits: SearchHit[] = []
    for (const [tag, count] of counts) {
      const score = scoreText(rawQ, tag) + Math.min(count, 10)
      if (rawQ && score <= 0) continue
      if (!rawQ) {
        hits.push({
          type: "hashtags",
          id: `tag:${tag}`,
          title: `#${tag}`,
          subtitle: `${count} posts`,
          score: count,
          ref: { tag },
        })
        continue
      }
      hits.push({
        type: "hashtags",
        id: `tag:${tag}`,
        title: `#${tag}`,
        subtitle: `${count} posts`,
        score,
        ref: { tag },
      })
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, limit)
  }

  const ALL_TYPES: SearchEntityType[] = [
    "people",
    "communities",
    "posts",
    "listings",
    "services",
    "interests",
    "profession",
    "hashtags",
  ]

  return {
    /**
     * Universal search entry — use from every screen.
     */
    search(input: SearchQuery): SearchResponse {
      const q = (input.q || "").trim()
      const limit = input.limit ?? 8
      const types = input.type
        ? [input.type]
        : input.types?.length
          ? input.types
          : ALL_TYPES

      if (!q && !types.includes("hashtags")) {
        return { query: q, hits: [], counts: {} }
      }

      const hits: SearchHit[] = []
      const counts: Partial<Record<SearchEntityType, number>> = {}

      const run = (type: SearchEntityType, fn: () => SearchHit[]) => {
        if (!types.includes(type)) return
        const part = fn()
        counts[type] = part.length
        hits.push(...part)
      }

      run("people", () => searchPeople(q, limit))
      run("communities", () => searchCommunities(q, limit))
      run("posts", () => searchPosts(q, limit))
      run("listings", () => searchListings(q, limit, false))
      run("services", () => searchListings(q, limit, true))
      run("interests", () => searchInterests(q, limit))
      run("profession", () => searchProfessions(q, limit))
      run("hashtags", () => searchHashtags(q, limit))

      hits.sort((a, b) => b.score - a.score)

      return {
        query: q,
        hits: hits.slice(0, input.limit ?? 40),
        counts,
      }
    },

    searchType(type: SearchEntityType, q: string, limit = 20): SearchHit[] {
      return this.search({ q, type, limit }).hits
    },

    /** Discovery/Find compatibility — people only */
    searchPeople(q: string, limit = 20): SearchHit[] {
      return searchPeople(q, limit)
    },

    /** Marketplace compatibility */
    searchListings(q: string, limit = 20): SearchHit[] {
      return searchListings(q, limit, false)
    },
  }
}

export type SearchDomain = ReturnType<typeof createSearchDomain>
