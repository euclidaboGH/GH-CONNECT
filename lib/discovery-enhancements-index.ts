/**
 * Discovery Enhancements Index
 * Central export point for all discovery features
 * Reuses existing components: SearchBar, FilterPanel, UserCard, ProfilePreviewModal
 */

// Export all discovery features
export {
  type DiscoverySection,
  type SectionConfig,
  DISCOVERY_SECTIONS,
  type DiscoveryFilters,
  DEFAULT_FILTERS,
  type RecentSearch,
  type SmartSuggestion,
  applyDiscoveryFilters,
  rankSuggestions,
  getTrendingCandidates,
  getNearbyCandidates,
  getVerifiedAccounts,
  getOnlineUsers,
  formatRecentSearch,
  extractSearchSuggestions,
  shouldShowSection,
  type SectionHeader,
  getSectionHeader,
  type QuickAction,
  getQuickActions,
  type LoadingState,
  initializeLoadingState,
  type PaginationState,
  getNextPage,
  canLoadMore,
} from "./discovery-features-engine"

// Export all search utilities
export {
  type SearchResult,
  performSearch,
  type ScoredResult,
  scoreSearchResults,
  SearchHistoryManager,
  type PersonalizedRecommendation,
  getPersonalizedRecommendations,
  filterByProfession,
  filterByEducation,
  type MediaSearchResult,
  searchMedia,
  type MessageSearchResult,
  searchMessages,
  SearchCache,
} from "./discovery-search-utils"

// Convenience exports
export const DiscoveryEngine = {
  // Features
  sections: DISCOVERY_SECTIONS,
  filters: DEFAULT_FILTERS,
  
  // Operations
  apply: applyDiscoveryFilters,
  rank: rankSuggestions,
  getTrending: getTrendingCandidates,
  getNearby: getNearbyCandidates,
  getVerified: getVerifiedAccounts,
  getOnline: getOnlineUsers,
  
  // Search
  search: performSearch,
  scoreResults: scoreSearchResults,
  
  // Recommendations
  recommend: getPersonalizedRecommendations,
  
  // Filters
  filterByProfession,
  filterByEducation,
  
  // Media
  searchMedia,
  searchMessages,
}

/**
 * Initialize discovery state for a new user
 */
export function initializeDiscoveryState() {
  return {
    filters: DEFAULT_FILTERS,
    recentSearches: [],
    loadingState: initializeLoadingState(),
    selectedSections: Object.keys(DISCOVERY_SECTIONS) as DiscoverySection[],
  }
}

/**
 * Helper to merge discovery filters
 */
export function mergeFilters(
  current: DiscoveryFilters,
  updates: Partial<DiscoveryFilters>
): DiscoveryFilters {
  return {
    ...current,
    ...updates,
  }
}

/**
 * Helper to validate filter combinations
 */
export function isValidFilterCombination(filters: DiscoveryFilters): boolean {
  // Don't allow too restrictive filters
  if (
    filters.distance < 5 &&
    filters.interests.length > 5 &&
    filters.education.length > 3 &&
    filters.profession.length > 3
  ) {
    return false
  }

  // Valid combinations
  return true
}

/**
 * Get filter summary for display
 */
export function getFilterSummary(filters: DiscoveryFilters): string[] {
  const summary: string[] = []

  if (filters.interests.length > 0) {
    summary.push(`${filters.interests.length} interest${filters.interests.length > 1 ? "s" : ""}`)
  }

  if (filters.profession.length > 0) {
    summary.push(`${filters.profession.length} profession${filters.profession.length > 1 ? "s" : ""}`)
  }

  if (filters.education.length > 0) {
    summary.push(`${filters.education.length} education level${filters.education.length > 1 ? "s" : ""}`)
  }

  if (filters.location) {
    summary.push(`Near ${filters.location}`)
  }

  if (filters.distance < 50) {
    summary.push(`${filters.distance}km radius`)
  }

  if (filters.verified) {
    summary.push("Verified only")
  }

  if (filters.online) {
    summary.push("Online now")
  }

  return summary
}

/**
 * Quick access to common filter presets
 */
export const FILTER_PRESETS = {
  verified: {
    ...DEFAULT_FILTERS,
    verified: true,
  },
  online: {
    ...DEFAULT_FILTERS,
    online: true,
  },
  nearby: {
    ...DEFAULT_FILTERS,
    distance: 10,
  },
  newUsers: {
    ...DEFAULT_FILTERS,
    // Would filter by joinedAt < 7 days
  },
}

/**
 * Discovery analytics helpers
 */
export interface DiscoveryAnalytics {
  searchesPerformed: number
  sectionViews: Record<DiscoverySection, number>
  quickActionsUsed: Record<string, number>
}

export function createAnalyticsTracker(): DiscoveryAnalytics {
  return {
    searchesPerformed: 0,
    sectionViews: Object.keys(DISCOVERY_SECTIONS).reduce(
      (acc, section) => ({ ...acc, [section]: 0 }),
      {}
    ),
    quickActionsUsed: {
      follow: 0,
      message: 0,
      invite: 0,
      viewProfile: 0,
    },
  }
}
