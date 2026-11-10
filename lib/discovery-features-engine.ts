/**
 * Discovery Features Engine
 * Provides sectioning, filtering, search, and content discovery capabilities
 * Reuses existing candidate/profile/post components
 */

import type { Candidate, Post } from "./ghc-types"

// Section Types
export type DiscoverySection = 
  | "trending"
  | "nearby"
  | "suggested-friends"
  | "suggested-creators"
  | "communities"
  | "businesses"
  | "marketplace"
  | "events"
  | "videos"
  | "popular-posts"
  | "live"

export interface SectionConfig {
  id: DiscoverySection
  title: string
  icon: string
  component: string // Component to render section
  limit: number // Items to show
}

export const DISCOVERY_SECTIONS: Record<DiscoverySection, SectionConfig> = {
  trending: {
    id: "trending",
    title: "Trending Now",
    icon: "🔥",
    component: "TrendingSection",
    limit: 8,
  },
  nearby: {
    id: "nearby",
    title: "Nearby",
    icon: "📍",
    component: "NearbySection",
    limit: 6,
  },
  "suggested-friends": {
    id: "suggested-friends",
    title: "Suggested Friends",
    icon: "👥",
    component: "SuggestedFriendsSection",
    limit: 5,
  },
  "suggested-creators": {
    id: "suggested-creators",
    title: "Creators to Follow",
    icon: "⭐",
    component: "CreatorsSection",
    limit: 6,
  },
  communities: {
    id: "communities",
    title: "Communities",
    icon: "🏘️",
    component: "CommunitiesSection",
    limit: 4,
  },
  businesses: {
    id: "businesses",
    title: "Businesses",
    icon: "🏪",
    component: "BusinessesSection",
    limit: 4,
  },
  marketplace: {
    id: "marketplace",
    title: "Marketplace",
    icon: "🛍️",
    component: "MarketplaceSection",
    limit: 5,
  },
  events: {
    id: "events",
    title: "Events",
    icon: "🎪",
    component: "EventsSection",
    limit: 4,
  },
  videos: {
    id: "videos",
    title: "Popular Videos",
    icon: "🎥",
    component: "VideosSection",
    limit: 6,
  },
  "popular-posts": {
    id: "popular-posts",
    title: "Popular Posts",
    icon: "📱",
    component: "PopularPostsSection",
    limit: 5,
  },
  live: {
    id: "live",
    title: "Live Now",
    icon: "🔴",
    component: "LiveSection",
    limit: 3,
  },
}

// Filter Types
export interface DiscoveryFilters {
  interests: string[]
  profession: string[]
  education: string[]
  location: string
  verified: boolean
  online: boolean
  communities: string[]
  distance: number // in km
}

export const DEFAULT_FILTERS: DiscoveryFilters = {
  interests: [],
  profession: [],
  education: [],
  location: "",
  verified: false,
  online: false,
  communities: [],
  distance: 50,
}

// Recent Searches
export interface RecentSearch {
  id: string
  query: string
  type: "person" | "community" | "business" | "event"
  timestamp: number
}

// Smart Suggestions
export interface SmartSuggestion {
  id: string
  reason: string // "Similar interests", "From your network", etc.
  priority: number // Higher = show first
}

// Filter Operations
export function applyDiscoveryFilters(
  candidates: Candidate[],
  filters: DiscoveryFilters
): Candidate[] {
  let filtered = [...candidates]

  const normalize = (value: string | null | undefined) => (value ?? "").normalize("NFKC").trim().toLocaleLowerCase()
  const interests = filters.interests.map(normalize).filter(Boolean)
  const professions = filters.profession.map(normalize).filter(Boolean)
  const education = filters.education.map(normalize).filter(Boolean)
  const location = normalize(filters.location)

  if (interests.length) {
    filtered = filtered.filter((candidate) => {
      const candidateInterests = new Set((candidate.interests ?? []).map(normalize))
      return interests.some((interest) => candidateInterests.has(interest))
    })
  }

  if (professions.length) {
    filtered = filtered.filter((candidate) => professions.includes(normalize(candidate.profession)))
  }

  if (education.length) {
    filtered = filtered.filter((candidate) => education.includes(normalize(candidate.education)))
  }

  if (location) {
    filtered = filtered.filter((candidate) => normalize(candidate.location).includes(location))
  }

  if (filters.online) {
    filtered = filtered.filter((candidate) => candidate.isOnline === true || candidate.online === true)
  }

  if (filters.verified) {
    filtered = filtered.filter((candidate) => candidate.isVerified === true || candidate.verified === true)
  }

  // Only apply the optional proximity cap when the user narrows the default 50 km range.
  // Unknown distance is not treated as zero: that would incorrectly label an unlocated
  // profile as nearby.
  if (Number.isFinite(filters.distance) && filters.distance >= 0 && filters.distance < 50) {
    filtered = filtered.filter((candidate) =>
      typeof candidate.distance === "number" && Number.isFinite(candidate.distance) &&
      candidate.distance >= 0 && candidate.distance <= filters.distance
    )
  }

  return filtered
}

/**
 * Smart suggestion ranking
 */
export function rankSuggestions(
  candidates: Candidate[],
  userInterests: string[],
  userLocation: string
): Candidate[] {
  const normalize = (value: string) => value.normalize("NFKC").trim().toLocaleLowerCase()
  const interestSet = new Set(userInterests.map(normalize).filter(Boolean))
  const location = normalize(userLocation)
  const score = (candidate: Candidate) => {
    const shared = (candidate.interests ?? []).filter((interest) => interestSet.has(normalize(interest))).length
    const sameLocation = location && normalize(candidate.location) === location ? 10 : 0
    const verified = candidate.isVerified || candidate.verified ? 5 : 0
    return shared + sameLocation + verified
  }
  return [...candidates].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id))
}

/**
 * Get trending candidates based on engagement
 */
export function getTrendingCandidates(candidates: Candidate[]): Candidate[] {
  return [...candidates]
    .sort((a, b) => {
      const aEngagement = typeof a.engagement === "number" && Number.isFinite(a.engagement) ? a.engagement : 0
      const bEngagement = typeof b.engagement === "number" && Number.isFinite(b.engagement) ? b.engagement : 0
      return bEngagement - aEngagement || a.id.localeCompare(b.id)
    })
    .slice(0, 8)
}

/**
 * Get nearby candidates by distance
 */
export function getNearbyCandidates(
  candidates: Candidate[],
  userLocation: string,
  maxDistance: number = 50
): Candidate[] {
  const normalizedLocation = userLocation.trim().normalize("NFKC").toLocaleLowerCase()
  return candidates
    .filter((candidate) => typeof candidate.distance === "number" && Number.isFinite(candidate.distance) && candidate.distance >= 0 && candidate.distance <= maxDistance)
    .sort((a, b) => {
      const distanceDelta = (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY)
      if (distanceDelta !== 0) return distanceDelta
      const aLocal = normalizedLocation && a.location.normalize("NFKC").toLocaleLowerCase().includes(normalizedLocation) ? 0 : 1
      const bLocal = normalizedLocation && b.location.normalize("NFKC").toLocaleLowerCase().includes(normalizedLocation) ? 0 : 1
      return aLocal - bLocal || a.id.localeCompare(b.id)
    })
    .slice(0, 6)
}

/**
 * Get verified accounts
 */
export function getVerifiedAccounts(candidates: Candidate[]): Candidate[] {
  return candidates.filter((candidate) => candidate.isVerified === true || candidate.verified === true).slice(0, 6)
}

/**
 * Get online users
 */
export function getOnlineUsers(candidates: Candidate[]): Candidate[] {
  return candidates.filter((candidate) => candidate.isOnline === true || candidate.online === true).slice(0, 10)
}

/**
 * Format recent searches
 */
export function formatRecentSearch(search: RecentSearch): string {
  const now = Date.now()
  const diff = now - search.timestamp

  if (diff < 60000) return "Just now"
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

/**
 * Extract search suggestions from query
 */
export function extractSearchSuggestions(query: string): string[] {
  if (!query.trim()) return []

  // Split by special characters and filter
  return query
    .split(/[,\s]+/)
    .filter((word) => word.length > 2)
    .slice(0, 3)
}

/**
 * Calculate discovery section visibility
 */
export function shouldShowSection(
  section: DiscoverySection,
  items: readonly unknown[],
  userEngagementLevel: string = "normal"
): boolean {
  if (items.length === 0) return false

  // Show fewer sections for new users
  if (userEngagementLevel === "new") {
    return ["trending", "suggested-friends", "nearby"].includes(section)
  }

  return true
}

/**
 * Build section header metadata
 */
export interface SectionHeader {
  title: string
  icon: string
  action?: {
    label: string
    handler: () => void
  }
}

export function getSectionHeader(
  section: DiscoverySection,
  itemCount: number
): SectionHeader {
  const config = DISCOVERY_SECTIONS[section]
  return {
    title: config.title,
    icon: config.icon,
    action:
      itemCount > config.limit
        ? {
            label: "See all",
            handler: () => {
              // Navigate to section detail
            },
          }
        : undefined,
  }
}

/**
 * Quick action helpers
 */
export interface QuickAction {
  id: string
  label: string
  icon: string
  handler: () => void | Promise<void>
  variant: "primary" | "secondary" | "ghost"
}

export function getQuickActions(
  candidate: Candidate,
  onFollow: (id: string) => void,
  onMessage: (id: string) => void,
  onInvite: (id: string) => void,
  onViewProfile: (candidate: Candidate) => void
): QuickAction[] {
  return [
    {
      id: "follow",
      label: "Follow",
      icon: "👥",
      handler: () => onFollow(candidate.id),
      variant: "primary",
    },
    {
      id: "message",
      label: "Message",
      icon: "💬",
      handler: () => onMessage(candidate.id),
      variant: "primary",
    },
    {
      id: "invite",
      label: "Invite",
      icon: "📨",
      handler: () => onInvite(candidate.id),
      variant: "secondary",
    },
    {
      id: "profile",
      label: "View Profile",
      icon: "👤",
      handler: () => onViewProfile(candidate),
      variant: "ghost",
    },
  ]
}

/**
 * Loading state helpers
 */
export interface LoadingState {
  isSectionLoading: Record<DiscoverySection, boolean>
  hasError: Record<DiscoverySection, string | null>
}

export function initializeLoadingState(): LoadingState {
  const sections = Object.keys(DISCOVERY_SECTIONS) as DiscoverySection[]
  return {
    isSectionLoading: sections.reduce(
      (acc, section) => {
        acc[section] = false
        return acc
      },
      {} as Record<DiscoverySection, boolean>
    ),
    hasError: sections.reduce(
      (acc, section) => {
        acc[section] = null
        return acc
      },
      {} as Record<DiscoverySection, string | null>
    ),
  }
}

/**
 * Smooth pagination with loading states
 */
export interface PaginationState {
  page: number
  pageSize: number
  hasMore: boolean
  isLoading: boolean
}

export function getNextPage<T>(
  items: readonly T[],
  currentPage: number,
  pageSize: number
): T[] {
  if (!Number.isInteger(currentPage) || currentPage < 0 || !Number.isInteger(pageSize) || pageSize <= 0) return []
  const start = currentPage * pageSize
  return items.slice(start, start + pageSize)
}

export function canLoadMore<T>(
  items: readonly T[],
  currentPage: number,
  pageSize: number
): boolean {
  if (!Number.isInteger(currentPage) || currentPage < 0 || !Number.isInteger(pageSize) || pageSize <= 0) return false
  return (currentPage + 1) * pageSize < items.length
}
