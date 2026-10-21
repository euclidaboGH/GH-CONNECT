/**
 * Discovery Search Utilities
 * Provides search, history, and personalization features
 */

import type { Candidate, Conversation, Message, Post } from "./ghc-types"
import type { RecentSearch } from "./discovery-features-engine"

// Search cache entry shape (distinct from the exported SearchCache class below)
interface SearchCacheEntry {
  query: string
  results: SearchResult
  timestamp: number
  ttl: number // in ms
}

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Execute multi-type search
 */
export interface DiscoverySearchCommunity {
  name?: string | null
  description?: string | null
}

export interface DiscoverySearchBusiness {
  name?: string | null
  category?: string | null
}

export interface SearchResult {
  people: Candidate[]
  posts: Post[]
  communities: DiscoverySearchCommunity[]
  businesses: DiscoverySearchBusiness[]
}

function timestampOf(value: number | string | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    // Support epoch seconds from older profile adapters and epoch milliseconds from the app.
    return value < 100_000_000_000 ? value * 1000 : value
  }
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value)
    if (Number.isFinite(numeric) && numeric > 0) return numeric < 100_000_000_000 ? numeric * 1000 : numeric
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function normalizeSearchText(value: unknown): string {
  return typeof value === "string" ? value.normalize("NFKC").toLocaleLowerCase().trim() : ""
}

export function performSearch(
  query: string,
  candidates: Candidate[],
  posts: Post[],
  communities: DiscoverySearchCommunity[] = [],
  businesses: DiscoverySearchBusiness[] = []
): SearchResult {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return { people: [], posts: [], communities: [], businesses: [] }

  const people = candidates.filter((candidate) => {
    const name = normalizeSearchText(candidate.name)
    const bio = normalizeSearchText(candidate.bio)
    const interests = Array.isArray(candidate.interests) ? candidate.interests : []
    return name.includes(normalizedQuery) || bio.includes(normalizedQuery) || interests.some((interest) => normalizeSearchText(interest).includes(normalizedQuery))
  })

  const postsResults = posts.filter((post) =>
    normalizeSearchText(post.content).includes(normalizedQuery) || normalizeSearchText(post.authorName).includes(normalizedQuery)
  )
  const communitiesResults = communities.filter((community) =>
    normalizeSearchText(community.name).includes(normalizedQuery) || normalizeSearchText(community.description).includes(normalizedQuery)
  )
  const businessesResults = businesses.filter((business) =>
    normalizeSearchText(business.name).includes(normalizedQuery) || normalizeSearchText(business.category).includes(normalizedQuery)
  )

  return { people, posts: postsResults, communities: communitiesResults, businesses: businessesResults }
}

/**
 * Smart search with relevance scoring
 */
export interface ScoredResult<T> {
  item: T
  score: number
  matchType: "name" | "interest" | "bio" | "location"
}

export function scoreSearchResults<T extends Candidate>(
  candidates: T[],
  query: string
): ScoredResult<T>[] {
  const lowerQuery = normalizeSearchText(query)
  if (!lowerQuery) return []

  return candidates
    .map((candidate) => {
      let score = 0
      let matchType: "name" | "interest" | "bio" | "location" = "name"

      // Name match (highest priority)
      if (normalizeSearchText(candidate.name).includes(lowerQuery)) {
        score = 100
        matchType = "name"
      }
      // Interest match
      else if ((candidate.interests ?? []).some((i) => normalizeSearchText(i).includes(lowerQuery))) {
        score = 80
        matchType = "interest"
      }
      // Bio match
      else if (normalizeSearchText(candidate.bio).includes(lowerQuery)) {
        score = 60
        matchType = "bio"
      }
      // Location match
      else if (normalizeSearchText(candidate.location).includes(lowerQuery)) {
        score = 40
        matchType = "location"
      }

      // Do not let recency or verification turn a non-match into a search result.
      if (score === 0) return { item: candidate, score, matchType }

      // Apply recency bonus only after a real query match exists.
      const joinedAt = timestampOf(candidate.joinedAt)
      const age = joinedAt === null ? null : Date.now() - joinedAt
      if (age !== null && age >= 0 && age < 7 * 24 * 60 * 60 * 1000) score += 20

      // Apply verification bonus; canonical verification remains supported alongside legacy aliases.
      if (candidate.verified || candidate.isVerified) score += 15

      return {
        item: candidate,
        score,
        matchType,
      }
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
}

/**
 * Search history management
 */
export class SearchHistoryManager {
  private storageKey = "discovery_search_history"
  private maxItems = 20

  getHistory(): RecentSearch[] {
    try {
      if (typeof window === "undefined") return []
      const stored = window.localStorage.getItem(this.storageKey)
      if (!stored) return []
      const parsed: unknown = JSON.parse(stored)
      if (!Array.isArray(parsed)) return []
      return parsed.filter((item): item is RecentSearch => {
        if (!item || typeof item !== "object") return false
        const value = item as Partial<RecentSearch>
        return typeof value.id === "string" && typeof value.query === "string" &&
          ["person", "community", "business", "event"].includes(String(value.type)) &&
          typeof value.timestamp === "number" && Number.isFinite(value.timestamp)
      })
    } catch {
      return []
    }
  }

  addSearch(query: string, type: "person" | "community" | "business" | "event" = "person"): void {
    const normalizedQuery = query.normalize("NFKC").trim().replace(/\s+/g, " ").slice(0, 160)
    if (!normalizedQuery) return
    const history = this.getHistory()

    // Avoid duplicates - remove if exists
    const filtered = history.filter((s) => normalizeSearchText(s.query) !== normalizeSearchText(normalizedQuery))

    // Add new search
    const newSearch: RecentSearch = {
      id: `search-${Date.now()}`,
      query: normalizedQuery,
      type,
      timestamp: Date.now(),
    }

    // Keep max items
    const updated = [newSearch, ...filtered].slice(0, this.maxItems)

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(updated))
    } catch {
      // Storage full, clear old items
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(updated.slice(0, 5)))
      } catch {
        // Fail silently
      }
    }
  }

  clearHistory(): void {
    try {
      localStorage.removeItem(this.storageKey)
    } catch {
      // Fail silently
    }
  }

  removeSearch(id: string): void {
    const history = this.getHistory().filter((s) => s.id !== id)
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(history))
    } catch {
      // Fail silently
    }
  }
}

/**
 * Personalized recommendations based on user profile
 */
export interface PersonalizedRecommendation {
  candidates: Candidate[]
  reason: string
  weight: number
}

export function getPersonalizedRecommendations(
  allCandidates: Candidate[],
  userInterests: string[],
  userLocation: string,
  userAge: number
): PersonalizedRecommendation[] {
  const recommendations: PersonalizedRecommendation[] = []

  // Same interests
  const interestSet = new Set(userInterests.map(normalizeSearchText).filter(Boolean))
  const sameInterests = allCandidates.filter((candidate) =>
    (candidate.interests ?? []).some((interest) => interestSet.has(normalizeSearchText(interest)))
  )
  if (sameInterests.length > 0) {
    recommendations.push({
      candidates: sameInterests,
      reason: "Similar interests",
      weight: 10,
    })
  }

  // Same location
  const normalizedLocation = normalizeSearchText(userLocation)
  const sameLocation = allCandidates.filter((candidate) => normalizeSearchText(candidate.location) === normalizedLocation && Boolean(normalizedLocation))
  if (sameLocation.length > 0) {
    recommendations.push({
      candidates: sameLocation,
      reason: "From your area",
      weight: 8,
    })
  }

  // Similar age
  const ageRange = 5
  const similarAge = allCandidates.filter(
    (c) => c.age >= userAge - ageRange && c.age <= userAge + ageRange
  )
  if (similarAge.length > 0) {
    recommendations.push({
      candidates: similarAge,
      reason: "Similar age",
      weight: 6,
    })
  }

  // Verified users
  const verified = allCandidates.filter((c) => c.verified || c.isVerified)
  if (verified.length > 0) {
    recommendations.push({
      candidates: verified,
      reason: "Verified profiles",
      weight: 7,
    })
  }

  // New members
  const newMembers = allCandidates.filter((c) => {
    const joinedAt = timestampOf(c.joinedAt)
    if (joinedAt === null) return false
    const daysSinceJoined = (Date.now() - joinedAt) / (24 * 60 * 60 * 1000)
    return daysSinceJoined >= 0 && daysSinceJoined < 7
  })
  if (newMembers.length > 0) {
    recommendations.push({
      candidates: newMembers,
      reason: "New members",
      weight: 5,
    })
  }

  return recommendations.sort((a, b) => b.weight - a.weight)
}

/**
 * Advanced filtering helpers
 */
export function filterByProfession(
  candidates: Candidate[],
  professions: string[]
): Candidate[] {
  if (professions.length === 0) return candidates
  return candidates.filter((c) =>
    professions.some((p) => c.profession?.toLowerCase().includes(p.toLowerCase()))
  )
}

export function filterByEducation(
  candidates: Candidate[],
  educationLevels: string[]
): Candidate[] {
  if (educationLevels.length === 0) return candidates
  return candidates.filter((c) =>
    educationLevels.some((e) => c.education?.toLowerCase().includes(e.toLowerCase()))
  )
}

/**
 * Media search helpers
 */
export interface MediaSearchResult {
  type: "photo" | "video" | "post"
  id: string
  thumbnail: string
  title: string
  author: string
  likes: number
}

export function searchMedia(
  query: string,
  posts: Post[]
): MediaSearchResult[] {
  return posts
    .filter(
      (p) =>
        p.content.toLowerCase().includes(query.toLowerCase()) ||
        p.authorName.toLowerCase().includes(query.toLowerCase())
    )
    .map((p): MediaSearchResult => {
      const mediaType: MediaSearchResult["type"] =
        Array.isArray(p.images) && p.images.length > 0 ? "photo" : "post"
      return {
        type: mediaType,
        id: p.id,
        thumbnail: (Array.isArray(p.images) && p.images[0]) || "/placeholder.svg",
        title: p.content.substring(0, 50),
        author: p.authorName,
        likes: p.likes,
      }
    })
    .slice(0, 12)
}

/**
 * Message search within conversations
 */
export interface MessageSearchResult {
  id: string
  conversationId: string
  content: string
  senderName: string
  timestamp: number
  preview: string
}

/**
 * Search durable conversation messages using the canonical Message.text and
 * Message.createdAt fields. Legacy content/timestamp aliases are read only for
 * compatibility with older local records; malformed records are ignored.
 */
export function searchMessages(query: string, conversations: Conversation[]): MessageSearchResult[] {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return []
  const results: MessageSearchResult[] = []

  for (const conversation of conversations) {
    if (!Array.isArray(conversation.messages)) continue
    for (const message of conversation.messages) {
      const legacy = message as Message & { content?: string; timestamp?: number; senderName?: string }
      const content = typeof message.text === "string" ? message.text : (typeof legacy.content === "string" ? legacy.content : "")
      if (!content || !normalizeSearchText(content).includes(normalizedQuery)) continue
      const timestamp = Number.isFinite(message.createdAt) ? message.createdAt : (Number.isFinite(legacy.timestamp) ? Number(legacy.timestamp) : 0)
      const senderName = typeof legacy.senderName === "string" && legacy.senderName.trim()
        ? legacy.senderName.trim()
        : conversation.conversationType === "group"
          ? "Group member"
          : (message.senderId === conversation.participantId ? conversation.participantName : "You")
      results.push({
        id: message.id,
        conversationId: conversation.id,
        content,
        senderName,
        timestamp,
        preview: content.slice(0, 100),
      })
    }
  }

  return results.sort((a, b) => b.timestamp - a.timestamp || a.id.localeCompare(b.id)).slice(0, 20)
}

/**
 * Cache management
 */
export class SearchCache {
  private cache: Map<string, SearchCacheEntry> = new Map()
  private readonly maxEntries = 100

  get(query: string): SearchResult | null {
    const key = normalizeSearchText(query)
    if (!key) return null
    const cached = this.cache.get(key)
    if (!cached) return null

    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key)
      return null
    }

    // Refresh insertion order and return independent arrays so callers cannot mutate
    // the cache's collection structure for later searches.
    this.cache.delete(key)
    this.cache.set(key, cached)
    return {
      people: [...cached.results.people],
      posts: [...cached.results.posts],
      communities: [...cached.results.communities],
      businesses: [...cached.results.businesses],
    }
  }

  set(query: string, results: SearchResult, ttl: number = CACHE_TTL): void {
    const key = normalizeSearchText(query)
    if (!key || !Number.isFinite(ttl) || ttl <= 0) return
    this.cache.delete(key)
    this.cache.set(key, {
      query: key,
      results: {
        people: [...results.people],
        posts: [...results.posts],
        communities: [...results.communities],
        businesses: [...results.businesses],
      },
      timestamp: Date.now(),
      ttl,
    })
    while (this.cache.size > this.maxEntries) {
      const oldestKey = this.cache.keys().next().value
      if (typeof oldestKey !== "string") break
      this.cache.delete(oldestKey)
    }
  }

  clear(): void {
    this.cache.clear()
  }
}
