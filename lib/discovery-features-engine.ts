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

  // Interest filter
  if (filters.interests.length > 0) {
    filtered = filtered.filter((c) =>
      filters.interests.some((interest) => c.interests.includes(interest))
    )
  }

  // Location filter
  if (filters.location) {
    filtered = filtered.filter((c) =>
      c.location.toLowerCase().includes(filters.location.toLowerCase())
    )
  }

  // Online filter
  if (filters.online) {
    filtered = filtered.filter((c) => (c as any).isOnline === true)
  }

  // Verified filter
  if (filters.verified) {
    filtered = filtered.filter((c) => (c as any).isVerified === true)
  }

  // Distance filter (mock: based on location similarity)
  if (filters.distance < 50) {
    filtered = filtered.filter((c) => (c as any).distance <= filters.distance)
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
  return [...candidates].sort((a, b) => {
    // Shared interests score
    const aSharedInterests = a.interests.filter((i) =>
      userInterests.includes(i)
    ).length
    const bSharedInterests = b.interests.filter((i) =>
      userInterests.includes(i)
    ).length

    // Same location bonus
    const aSameLocation = a.location === userLocation ? 10 : 0
    const bSameLocation = b.location === userLocation ? 10 : 0

    // Verified bonus
    const aVerifiedBonus = (a as any).isVerified ? 5 : 0
    const bVerifiedBonus = (b as any).isVerified ? 5 : 0

    const aScore = aSharedInterests + aSameLocation + aVerifiedBonus
    const bScore = bSharedInterests + bSameLocation + bVerifiedBonus

    return bScore - aScore
  })
}

/**
 * Get trending candidates based on engagement
 */
export function getTrendingCandidates(candidates: Candidate[]): Candidate[] {
  return [...candidates]
    .sort(
      (a, b) =>
        ((b as any).engagement || 0) - ((a as any).engagement || 0)
    )
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
  return candidates
    .filter((c) => (c as any).distance <= maxDistance)
    .sort((a, b) => ((a as any).distance || 0) - ((b as any).distance || 0))
    .slice(0, 6)
}

/**
 * Get verified accounts
 */
export function getVerifiedAccounts(candidates: Candidate[]): Candidate[] {
  return candidates.filter((c) => (c as any).isVerified === true).slice(0, 6)
}

/**
 * Get online users
 */
export function getOnlineUsers(candidates: Candidate[]): Candidate[] {
  return candidates.filter((c) => (c as any).isOnline === true).slice(0, 10)
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
  items: any[],
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
      (acc, section) => ({ ...acc, [section]: false }),
      {}
    ),
    hasError: sections.reduce(
      (acc, section) => ({ ...acc, [section]: null }),
      {}
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

export function getNextPage(
  items: any[],
  currentPage: number,
  pageSize: number
): any[] {
  const start = currentPage * pageSize
  const end = start + pageSize
  return items.slice(start, end)
}

export function canLoadMore(
  items: any[],
  currentPage: number,
  pageSize: number
): boolean {
  return (currentPage + 1) * pageSize < items.length
}
