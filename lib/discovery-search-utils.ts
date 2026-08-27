/**
 * Discovery Search Utilities
 * Provides search, history, and personalization features
 */

import type { Candidate, Post } from "./ghc-types"
import { RecentSearch } from "./discovery-features-engine"

// Search cache for optimization
interface SearchCache {
  query: string
  results: any[]
  timestamp: number
  ttl: number // in ms
}

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Execute multi-type search
 */
export interface SearchResult {
  people: Candidate[]
  posts: Post[]
  communities: any[]
  businesses: any[]
}

export function performSearch(
  query: string,
  candidates: Candidate[],
  posts: Post[],
  communities: any[] = [],
  businesses: any[] = []
): SearchResult {
  const lowerQuery = query.toLowerCase().trim()

  if (!lowerQuery) {
    return {
      people: [],
      posts: [],
      communities: [],
      businesses: [],
    }
  }

  // Search people
  const people = candidates.filter(
    (c) =>
      c.name.toLowerCase().includes(lowerQuery) ||
      c.interests.some((i) => i.toLowerCase().includes(lowerQuery)) ||
      (c.bio?.toLowerCase().includes(lowerQuery) ?? false)
  )

  // Search posts
  const postsResults = posts.filter(
    (p) =>
      p.content.toLowerCase().includes(lowerQuery) ||
      p.authorName.toLowerCase().includes(lowerQuery)
  )

  // Search communities (mock)
  const communitiesResults = communities.filter(
    (c) =>
      c.name?.toLowerCase().includes(lowerQuery) ||
      c.description?.toLowerCase().includes(lowerQuery)
  )

  // Search businesses (mock)
  const businessesResults = businesses.filter(
    (b) =>
      b.name?.toLowerCase().includes(lowerQuery) ||
      b.category?.toLowerCase().includes(lowerQuery)
  )

  return {
    people,
    posts: postsResults,
    communities: communitiesResults,
    businesses: businessesResults,
  }
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
  const lowerQuery = query.toLowerCase()

  return candidates
    .map((candidate) => {
      let score = 0
      let matchType: "name" | "interest" | "bio" | "location" = "name"

      // Name match (highest priority)
      if (candidate.name.toLowerCase().includes(lowerQuery)) {
        score = 100
        matchType = "name"
      }
      // Interest match
      else if (candidate.interests.some((i) => i.toLowerCase().includes(lowerQuery))) {
        score = 80
        matchType = "interest"
      }
      // Bio match
      else if ((candidate.bio?.toLowerCase() ?? "").includes(lowerQuery)) {
        score = 60
        matchType = "bio"
      }
      // Location match
      else if (candidate.location.toLowerCase().includes(lowerQuery)) {
        score = 40
        matchType = "location"
      }

      // Apply recency bonus
      const age = Date.now() - (candidate as any).joinedAt
      if (age < 7 * 24 * 60 * 60 * 1000) score += 20

      // Apply verification bonus
      if ((candidate as any).isVerified) score += 15

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
      const stored = localStorage.getItem(this.storageKey)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }

  addSearch(query: string, type: "person" | "community" | "business" | "event" = "person"): void {
    const history = this.getHistory()

    // Avoid duplicates - remove if exists
    const filtered = history.filter((s) => s.query !== query)

    // Add new search
    const newSearch: RecentSearch = {
      id: `search-${Date.now()}`,
      query,
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
  const sameInterests = allCandidates.filter((c) =>
    c.interests.some((i) => userInterests.includes(i))
  )
  if (sameInterests.length > 0) {
    recommendations.push({
      candidates: sameInterests,
      reason: "Similar interests",
      weight: 10,
    })
  }

  // Same location
  const sameLocation = allCandidates.filter((c) => c.location === userLocation)
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
  const verified = allCandidates.filter((c) => (c as any).isVerified)
  if (verified.length > 0) {
    recommendations.push({
      candidates: verified,
      reason: "Verified profiles",
      weight: 7,
    })
  }

  // New members
  const newMembers = allCandidates.filter((c) => {
    const joinedAt = (c as any).joinedAt
    if (!joinedAt) return false
    const daysSinceJoined = (Date.now() - joinedAt) / (24 * 60 * 60 * 1000)
    return daysSinceJoined < 7
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
    professions.some((p) => (c as any).profession?.toLowerCase().includes(p.toLowerCase()))
  )
}

export function filterByEducation(
  candidates: Candidate[],
  educationLevels: string[]
): Candidate[] {
  if (educationLevels.length === 0) return candidates
  return candidates.filter((c) =>
    educationLevels.some((e) => (c as any).education?.toLowerCase().includes(e.toLowerCase()))
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
    .map((p) => ({
      type: p.images.length > 0 ? "photo" : "post",
      id: p.id,
      thumbnail: p.images[0] || "/placeholder.svg",
      title: p.content.substring(0, 50),
      author: p.authorName,
      likes: p.likes,
    }))
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

export function searchMessages(
  query: string,
  conversations: any[]
): MessageSearchResult[] {
  const results: MessageSearchResult[] = []
  const lowerQuery = query.toLowerCase()

  conversations.forEach((conv) => {
    if ((conv.messages || []).length === 0) return

    conv.messages.forEach((msg: any) => {
      if (msg.content?.toLowerCase().includes(lowerQuery)) {
        results.push({
          id: msg.id,
          conversationId: conv.id,
          content: msg.content,
          senderName: msg.senderName,
          timestamp: msg.timestamp,
          preview: msg.content.substring(0, 100),
        })
      }
    })
  })

  return results.sort((a, b) => b.timestamp - a.timestamp).slice(0, 20)
}

/**
 * Cache management
 */
export class SearchCache {
  private cache: Map<string, SearchCache> = new Map()

  get(query: string): any[] | null {
    const cached = this.cache.get(query)
    if (!cached) return null

    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(query)
      return null
    }

    return cached.results
  }

  set(query: string, results: any[], ttl: number = CACHE_TTL): void {
    this.cache.set(query, {
      query,
      results,
      timestamp: Date.now(),
      ttl,
    })
  }

  clear(): void {
    this.cache.clear()
  }
}
