/**
 * Discovery / Find domain — canonical owner of people & entity discovery.
 *
 * Surfaces (same candidate pool, different filters/ranks):
 *   People · Recommended · Friends · Professionals · Communities ·
 *   New users · Nearby (when permitted) · Search results
 *
 * Recommendations use one scoring pipeline (no second recommendation engine).
 * Reuses discovery-features-engine + discovery-search-utils.
 */

import type { Candidate, Profile } from "../ghc-types"
import {
  applyDiscoveryFilters,
  getTrendingCandidates,
  getNearbyCandidates,
  getVerifiedAccounts,
  getOnlineUsers,
  type DiscoveryFilters,
  DEFAULT_FILTERS,
} from "../discovery-features-engine"
import {
  performSearch,
  getPersonalizedRecommendations,
  filterByProfession,
  filterByEducation,
  scoreSearchResults,
} from "../discovery-search-utils"
import { filterDiscoveryCandidates, resolveBlockedIds } from "../block-enforcement"

export type FindSurface =
  | "people"
  | "recommended"
  | "friends"
  | "professionals"
  | "communities"
  | "new"
  | "nearby"
  | "search"

export interface RecommendationSignals {
  mutualConnectionIds?: string[]
  sharedInterestBoost?: boolean
  communityIds?: string[]
  profession?: string
  education?: string
  locationEnabled?: boolean
  activityBoost?: boolean
  followingIds?: string[]
  intentions?: string[] // user-selected modes: dating, friendship, networking
}

export interface ScoredCandidate {
  candidate: Candidate
  score: number
  reasons: string[]
}

export function createDiscoveryDomain(deps: {
  currentUserId?: string
  getCandidates: () => Candidate[]
  getProfile: () => Profile
  getBlockedUsers: () => string[]
  getMutedUsers?: () => string[]
  getFollowingIds?: () => string[]
  getFriendIds?: () => string[]
  /** When location discovery is allowed by settings */
  locationDiscoveryEnabled?: () => boolean
}) {
  const me = deps.currentUserId || "current-user"

  function safePool(extraExclude: string[] = []): Candidate[] {
    const blocked = resolveBlockedIds({
      blockedUsers: [
        ...deps.getBlockedUsers(),
        ...(deps.getMutedUsers?.() || []),
        me,
        ...extraExclude,
      ],
    })
    return filterDiscoveryCandidates(deps.getCandidates() || [], blocked)
  }

  /**
   * Single recommendation scorer — consolidates personalized helpers + graph signals.
   */
  function scoreCandidates(
    pool: Candidate[],
    signals: RecommendationSignals = {}
  ): ScoredCandidate[] {
    const profile = deps.getProfile()
    const interests = profile.interests || []
    const location = [profile.city, profile.country].filter(Boolean).join(", ")
    const following = new Set(signals.followingIds || deps.getFollowingIds?.() || [])
    const friends = new Set(deps.getFriendIds?.() || [])
    const mutuals = new Set(signals.mutualConnectionIds || [])
    const locationOk = signals.locationEnabled ?? deps.locationDiscoveryEnabled?.() ?? true

    // Baseline buckets from existing personalized engine (not a second system)
    const buckets = getPersonalizedRecommendations(
      pool,
      interests,
      location,
      typeof profile.age === "number" ? profile.age : 25
    )
    const weightById = new Map<string, { score: number; reasons: string[] }>()

    for (const bucket of buckets) {
      for (const c of bucket.candidates) {
        const cur = weightById.get(c.id) || { score: 0, reasons: [] }
        cur.score += bucket.weight
        if (!cur.reasons.includes(bucket.reason)) cur.reasons.push(bucket.reason)
        weightById.set(c.id, cur)
      }
    }

    for (const c of pool) {
      const cur = weightById.get(c.id) || { score: 0, reasons: [] }

      // Mutual connections
      if (mutuals.has(c.id)) {
        cur.score += 12
        cur.reasons.push("Mutual connections")
      }

      // Already following — slight demote for "discover new"
      if (following.has(c.id)) {
        cur.score -= 3
      }

      // Friends still discoverable for "people" but demote in recommended
      if (friends.has(c.id)) {
        cur.score -= 5
      }

      // Shared interests (reinforce)
      if (signals.sharedInterestBoost !== false) {
        const shared = (c.interests || []).filter((i) => interests.includes(i)).length
        if (shared > 0) {
          cur.score += shared * 3
          if (!cur.reasons.includes("Similar interests")) cur.reasons.push("Similar interests")
        }
      }

      // Profession / education
      if (signals.profession && (c as any).profession === signals.profession) {
        cur.score += 8
        cur.reasons.push("Same profession")
      }
      if (signals.education && (c as any).education === signals.education) {
        cur.score += 5
        cur.reasons.push("Similar education")
      }

      // Location only when permitted
      if (locationOk && location && c.location && c.location === location) {
        cur.score += 6
        if (!cur.reasons.includes("From your area")) cur.reasons.push("From your area")
      }

      // Activity / online
      if (signals.activityBoost !== false && c.online) {
        cur.score += 4
        cur.reasons.push("Active now")
      }

      // Intentions vs candidate relationshipType if present
      const intentions = signals.intentions || (profile.primaryMode ? [profile.primaryMode] : [])
      const candTypes = (c as any).relationshipType as string[] | undefined
      if (intentions.length && Array.isArray(candTypes)) {
        const overlap = candTypes.filter((t) => intentions.includes(t)).length
        if (overlap) {
          cur.score += overlap * 4
          cur.reasons.push("Matching intentions")
        }
      }

      // Verified
      if (c.verified) {
        cur.score += 3
      }

      weightById.set(c.id, cur)
    }

    return pool
      .map((candidate) => {
        const meta = weightById.get(candidate.id) || { score: 0, reasons: [] as string[] }
        return { candidate, score: meta.score, reasons: meta.reasons }
      })
      .sort((a, b) => b.score - a.score)
  }

  return {
    /** Raw pool after block/mute (all Find surfaces start here) */
    people(excludeIds: string[] = []): Candidate[] {
      return safePool(excludeIds)
    },

    recommended(signals?: RecommendationSignals, limit = 20): ScoredCandidate[] {
      const scored = scoreCandidates(safePool(), signals)
      return scored.filter((s) => s.score > 0).slice(0, limit)
    },

    /** Friend-like suggestions (not already friends) */
    suggestedFriends(limit = 15): ScoredCandidate[] {
      const friends = new Set(deps.getFriendIds?.() || [])
      const pool = safePool().filter((c) => !friends.has(c.id))
      return scoreCandidates(pool, { sharedInterestBoost: true }).slice(0, limit)
    },

    professionals(profession?: string, limit = 15): Candidate[] {
      const pool = safePool()
      const prof = profession || deps.getProfile().profession
      const filtered = prof
        ? filterByProfession(pool, [prof])
        : pool.filter((c) => Boolean((c as any).profession))
      return scoreCandidates(filtered, { profession: prof })
        .map((s) => s.candidate)
        .slice(0, limit)
    },

    /** Placeholder community cards from candidate tags until community entities exist */
    communities(limit = 10): Candidate[] {
      return safePool()
        .filter((c) => (c as any).community || (c.interests || []).length >= 3)
        .slice(0, limit)
    },

    newUsers(limit = 15): Candidate[] {
      const week = 7 * 24 * 60 * 60 * 1000
      const pool = safePool().filter((c) => {
        const joined = (c as any).joinedAt as number | undefined
        if (joined) return Date.now() - joined < week
        return false
      })
      if (pool.length) return scoreCandidates(pool).map((s) => s.candidate).slice(0, limit)
      return getOnlineUsers(safePool()).slice(0, limit)
    },

    nearby(limit = 12): Candidate[] {
      if (deps.locationDiscoveryEnabled && !deps.locationDiscoveryEnabled()) return []
      const profile = deps.getProfile()
      const loc = [profile.city, profile.country].filter(Boolean).join(", ")
      return getNearbyCandidates(safePool(), loc || "Unknown", 50).slice(0, limit)
    },

    search(query: string, filters?: Partial<DiscoveryFilters>): Candidate[] {
      const pool = safePool()
      const merged = { ...DEFAULT_FILTERS, ...(filters || {}) }
      const filtered = applyDiscoveryFilters(pool, merged as DiscoveryFilters)
      if (!(query || "").trim()) return filtered
      const results = performSearch(query, filtered, [])
      return results
        .filter((r) => (r as any).type === "candidate" || (r as any).item)
        .map((r) => ((r as any).item || r) as Candidate)
        .filter((c) => c && typeof c === "object" && "id" in c)
    },

    trending(limit = 12): Candidate[] {
      return getTrendingCandidates(safePool()).slice(0, limit)
    },

    verified(limit = 12): Candidate[] {
      return getVerifiedAccounts(safePool()).slice(0, limit)
    },

    online(limit = 12): Candidate[] {
      const online = safePool().filter((c) => c.online || (c as any).isOnline)
      return online.slice(0, limit)
    },

    /** Unified Find entry — surface selects strategy over the same pool */
    find(
      surface: FindSurface,
      options?: {
        query?: string
        filters?: Partial<DiscoveryFilters>
        signals?: RecommendationSignals
        limit?: number
        profession?: string
      }
    ): Candidate[] | ScoredCandidate[] {
      const limit = options?.limit ?? 20
      switch (surface) {
        case "people":
          return this.people().slice(0, limit)
        case "recommended":
          return this.recommended(options?.signals, limit)
        case "friends":
          return this.suggestedFriends(limit)
        case "professionals":
          return this.professionals(options?.profession, limit)
        case "communities":
          return this.communities(limit)
        case "new":
          return this.newUsers(limit)
        case "nearby":
          return this.nearby(limit)
        case "search":
          return this.search(options?.query || "", options?.filters).slice(0, limit)
        default:
          return this.recommended(options?.signals, limit)
      }
    },
  }
}

export type DiscoveryDomain = ReturnType<typeof createDiscoveryDomain>
/** Alias for product naming */
export type FindDomain = DiscoveryDomain
