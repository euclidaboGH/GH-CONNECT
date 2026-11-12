// Advanced search and filtering utilities

import type { Candidate, Profile, Post } from "./ghc-types"

export const searchUtils = {
  // Search candidates by name, bio, interests
  searchCandidates: (candidates: Candidate[], query: string): Candidate[] => {
    if (!query.trim()) return candidates

    const q = query.toLowerCase()
    return candidates.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.bio.toLowerCase().includes(q) ||
        c.interests.some((i) => i.toLowerCase().includes(q))
    )
  },

  // Filter candidates by age range
  filterByAge: (candidates: Candidate[], minAge: number, maxAge: number): Candidate[] => {
    return candidates.filter((c) => c.age >= minAge && c.age <= maxAge)
  },

  // Text-only location matching is intentionally not presented as a radius.
  // A real distance filter requires trusted coordinates and a geospatial index.
  filterByLocation: (candidates: Candidate[], location: string, _radius: number): Candidate[] => {
    const target = normalizeLocation(location)
    if (!target) return candidates
    const targetParts = splitLocationParts(target)
    return candidates.filter((candidate) => {
      const candidateLocation = normalizeLocation(candidate.location)
      if (!candidateLocation) return false
      const candidateParts = splitLocationParts(candidateLocation)
      return candidateParts.some((part) => targetParts.includes(part))
    })
  },

  // Filter by interests overlap
  filterByInterests: (
    candidates: Candidate[],
    userInterests: string[]
  ): Candidate[] => {
    return candidates.filter((c) => {
      const overlap = c.interests.filter((i) => userInterests.includes(i)).length
      return overlap > 0
    })
  },

  // Get candidates with highest interest match
  rankByInterestMatch: (candidates: Candidate[], userInterests: string[]): Candidate[] => {
    return [...candidates].sort((a, b) => {
      const aMatch = a.interests.filter((i) => userInterests.includes(i)).length
      const bMatch = b.interests.filter((i) => userInterests.includes(i)).length
      return bMatch - aMatch
    })
  },

  // Search posts by content
  searchPosts: (posts: Post[], query: string): Post[] => {
    if (!query.trim()) return posts

    const q = query.toLowerCase()
    return posts.filter(
      (p) =>
        p.content.toLowerCase().includes(q) ||
        p.authorName.toLowerCase().includes(q)
    )
  },

  // Sort posts by date
  sortPostsByDate: (posts: Post[], order: "asc" | "desc" = "desc"): Post[] => {
    return [...posts].sort((a, b) =>
      order === "desc" ? b.createdAt - a.createdAt : a.createdAt - b.createdAt
    )
  },

  // Sort posts by popularity
  sortPostsByPopularity: (posts: Post[]): Post[] => {
    return [...posts].sort((a, b) => {
      const aScore = a.likes + a.comments.length * 2
      const bScore = b.likes + b.comments.length * 2
      return bScore - aScore
    })
  },

  // Get trending posts (popular recent posts)
  getTrendingPosts: (posts: Post[], days: number = 7): Post[] => {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    const recent = posts.filter((p) => p.createdAt > cutoff)
    return searchUtils.sortPostsByPopularity(recent)
  },

  // Deduplicate candidates
  deduplicateCandidates: (candidates: Candidate[]): Candidate[] => {
    const seen = new Set<string>()
    return candidates.filter((c) => {
      if (seen.has(c.id)) return false
      seen.add(c.id)
      return true
    })
  },
}

// Normalize city/country labels without manufacturing geographic distance.
function normalizeLocation(value: unknown): string {
  return typeof value === "string"
    ? value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim()
    : ""
}

function splitLocationParts(value: string): string[] {
  return value.split(/[,;|]/).map((part) => part.trim()).filter(Boolean)
}

// Advanced filtering with multiple criteria
export interface FilterCriteria {
  ageMin?: number
  ageMax?: number
  location?: string
  /** Legacy field: text-only location labels cannot enforce a geographic radius. */
  radius?: number
  interests?: string[]
  verified?: boolean
  online?: boolean
}

export function applyFilters(candidates: Candidate[], criteria: FilterCriteria): Candidate[] {
  let filtered = [...candidates]

  if (criteria.ageMin !== undefined || criteria.ageMax !== undefined) {
    filtered = searchUtils.filterByAge(
      filtered,
      criteria.ageMin ?? 18,
      criteria.ageMax ?? 120
    )
  }

  if (criteria.verified !== undefined) {
    filtered = filtered.filter((c) => c.verified === criteria.verified)
  }

  if (criteria.online !== undefined) {
    filtered = filtered.filter((c) => c.online === criteria.online)
  }

  if (criteria.interests && criteria.interests.length > 0) {
    filtered = filtered.filter((c) => {
      const overlap = c.interests.filter((i) => criteria.interests!.includes(i)).length
      return overlap > 0
    })
  }

  if (criteria.location) {
    filtered = searchUtils.filterByLocation(
      filtered,
      criteria.location,
      criteria.radius ?? 50
    )
  }

  return searchUtils.deduplicateCandidates(filtered)
}
