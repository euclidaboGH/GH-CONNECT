// Advanced Search and Filtering Engine with Fuzzy Matching & Recommendations

import type { Candidate, Post, Conversation, Profile } from "@/lib/ghc-types"

interface SearchFilters {
  query?: string
  ageMin?: number
  ageMax?: number
  location?: string
  interests?: string[]
  verified?: boolean
  online?: boolean
  relationshipType?: string[]
  sortBy?: "relevance" | "recent" | "online" | "distance"
  /** Platform block set — search must never return blocked users/authors */
  blockedUserIds?: string[]
}

interface SearchResult<T> {
  item: T
  score: number
  matchReason: string[]
}

// Levenshtein distance for fuzzy matching
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []
  const aLen = a.length
  const bLen = b.length

  for (let i = 0; i <= bLen; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= aLen; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= bLen; i++) {
    for (let j = 1; j <= aLen; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  return matrix[bLen][aLen]
}

// Fuzzy match score (0-1)
function fuzzyMatch(query: string, text: string): number {
  const distance = levenshteinDistance(query.toLowerCase(), text.toLowerCase())
  const maxLength = Math.max(query.length, text.length)
  return Math.max(0, 1 - distance / maxLength)
}

export const searchEngine = {
  tokenize: (query: string): string[] => {
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((t) => t.length > 1)
  },

  calculateSimilarity: (str1: string, str2: string): number => {
    const s1 = str1.toLowerCase()
    const s2 = str2.toLowerCase()
    if (s1 === s2) return 1
    if (s1.includes(s2) || s2.includes(s1)) return 0.85
    return fuzzyMatch(s1, s2)
  },

  // Enhanced candidate search with fuzzy matching
  searchCandidates: (
    candidates: Candidate[],
    filters: SearchFilters
  ): SearchResult<Candidate>[] => {
    const blocked = new Set(filters.blockedUserIds || [])
    const pool = blocked.size
      ? candidates.filter((c) => !blocked.has(c.id))
      : candidates
    let results = pool.map((candidate) => {
      const matchReasons: string[] = []
      let score = 1.0

      // Text search with fuzzy matching
      if (filters.query) {
        const tokens = searchEngine.tokenize(filters.query)
        let queryScore = 0
        let matchedTokens = 0

        tokens.forEach((token) => {
          const nameSim = searchEngine.calculateSimilarity(candidate.name, token)
          const bioSim = searchEngine.calculateSimilarity(candidate.bio, token)
          const interestMatch = candidate.interests.some((i) =>
            searchEngine.calculateSimilarity(i, token) > 0.7
          )

          const maxSim = Math.max(nameSim, bioSim, interestMatch ? 0.9 : 0)
          if (maxSim > 0.6) {
            queryScore += maxSim
            matchedTokens++
            if (nameSim > 0.8) matchReasons.push(`Matches name "${token}"`)
            else if (interestMatch) matchReasons.push(`Interested in ${token}`)
          }
        })

        score *= (queryScore / Math.max(tokens.length, 1)) * 0.8
      }

      // Interest matching
      if (filters.interests && filters.interests.length > 0) {
        const sharedInterests = candidate.interests.filter((i) =>
          filters.interests!.some((f) =>
            searchEngine.calculateSimilarity(i, f) > 0.7
          )
        )
        const interestBonus = (sharedInterests.length / Math.max(candidate.interests.length, 1)) * 0.5
        score *= 1 + interestBonus
        if (sharedInterests.length > 0) {
          matchReasons.push(`${sharedInterests.length} shared interest${sharedInterests.length > 1 ? "s" : ""}`)
        }
      }

      // Verified bonus
      if (filters.verified === true && candidate.verified) {
        score *= 1.1
        matchReasons.push("Verified profile")
      }

      // Online status
      if (filters.online && candidate.online) {
        score *= 1.15
        matchReasons.push("Online now")
      }

      // Recency bonus
      const daysSinceActive = (Date.now() - candidate.lastSeen) / (1000 * 60 * 60 * 24)
      if (daysSinceActive < 1) score *= 1.2
      else if (daysSinceActive < 7) score *= 1.1

      return { item: candidate, score, matchReason: matchReasons }
    })

    // Apply filters
    if (filters.query) {
      results = results.filter((r) => r.score > 0.3)
    }
    if (filters.ageMin) {
      results = results.filter((r) => r.item.age >= filters.ageMin)
    }
    if (filters.ageMax) {
      results = results.filter((r) => r.item.age <= filters.ageMax)
    }
    if (filters.verified === true) {
      results = results.filter((r) => r.item.verified)
    }
    if (filters.online === true) {
      results = results.filter((r) => r.item.online)
    }

    // Sort
    results.sort((a, b) => {
      const sortBy = filters.sortBy || "relevance"
      switch (sortBy) {
        case "recent":
          return b.item.lastSeen - a.item.lastSeen
        case "online":
          return (b.item.online ? 1 : 0) - (a.item.online ? 1 : 0)
        default:
          return b.score - a.score
      }
    })

    return results
  },

  // Enhanced post search
  searchPosts: (
    posts: Post[],
    query: string,
    blockedUserIds: string[] = []
  ): SearchResult<Post>[] => {
    const tokens = searchEngine.tokenize(query)
    const blocked = new Set(blockedUserIds)
    const pool = blocked.size
      ? posts.filter((p) => !blocked.has(p.authorId))
      : posts

    const results = pool
      .map((post) => {
        let score = 0
        const matchReasons: string[] = []

        tokens.forEach((token) => {
          const contentMatch = searchEngine.calculateSimilarity(post.content, token)
          const authorMatch = searchEngine.calculateSimilarity(post.authorName, token)

          if (contentMatch > 0.7) {
            score += contentMatch * 10
            matchReasons.push(`Found "${token}" in content`)
          }
          if (authorMatch > 0.8) {
            score += authorMatch * 5
            matchReasons.push(`From ${post.authorName}`)
          }
        })

        // Engagement bonus
        score *= 1 + (post.likes + post.comments.length) * 0.01

        // Recency bonus
        const hoursOld = (Date.now() - post.createdAt) / (1000 * 60 * 60)
        if (hoursOld < 1) score *= 1.5
        else if (hoursOld < 24) score *= 1.2

        return { item: post, score, matchReason: matchReasons }
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)

    return results
  },

  // Search conversations
  searchConversations: (
    conversations: Conversation[],
    query: string,
    blockedUserIds: string[] = []
  ): SearchResult<Conversation>[] => {
    const tokens = searchEngine.tokenize(query)
    const blocked = new Set(blockedUserIds)
    const pool = blocked.size
      ? conversations.filter(
          (c) => !(c.conversationType === "private" && c.participantId && blocked.has(c.participantId))
        )
      : conversations

    const results = pool
      .map((conv) => {
        let score = 0
        const matchReasons: string[] = []

        tokens.forEach((token) => {
          const nameMatch = searchEngine.calculateSimilarity(conv.participantName, token)
          const messageMatch = searchEngine.calculateSimilarity(conv.lastMessage, token)

          if (nameMatch > 0.8) {
            score += nameMatch * 10
            matchReasons.push(`Chatting with ${conv.participantName}`)
          }
          if (messageMatch > 0.7) {
            score += messageMatch * 5
            matchReasons.push(`Message contains "${token}"`)
          }
        })

        // Unread bonus
        if (conv.unread) score *= 1.5

        // Recent activity bonus
        const hoursOld = (Date.now() - conv.lastMessageTime) / (1000 * 60 * 60)
        if (hoursOld < 1) score *= 1.3

        return { item: conv, score, matchReason: matchReasons }
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)

    return results
  },

  // Get autocomplete suggestions
  getAutocompleteSuggestions: (
    candidates: Candidate[],
    query: string,
    limit: number = 10
  ): string[] => {
    if (query.length < 2) return []
    const suggestions = new Set<string>()
    const lowerQuery = query.toLowerCase()

    candidates.forEach((c) => {
      if (c.name.toLowerCase().includes(lowerQuery)) suggestions.add(c.name)
      c.interests.forEach((i) => {
        if (i.toLowerCase().includes(lowerQuery)) suggestions.add(i)
      })
      if (c.location.toLowerCase().includes(lowerQuery)) suggestions.add(c.location)
    })

    return Array.from(suggestions).slice(0, limit)
  },

  // Get trending terms from posts
  getTrendingTerms: (
    posts: Post[],
    limit: number = 10
  ): Array<{ term: string; count: number }> => {
    const termCounts = new Map<string, number>()

    posts.forEach((post) => {
      const tokens = searchEngine.tokenize(post.content)
      tokens.forEach((token) => {
        if (token.length >= 3) {
          termCounts.set(token, (termCounts.get(token) || 0) + 1)
        }
      })
    })

    return Array.from(termCounts.entries())
      .map(([term, count]) => ({ term, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  },

  // Get personalized recommendations
  getRecommendations: (
    userProfile: Profile,
    candidates: Candidate[],
    limit: number = 10
  ): Candidate[] => {
    const scored = candidates
      .filter((c) => c.id !== userProfile.id)
      .map((candidate) => {
        let score = 1.0

        // Interest overlap
        const sharedInterests = candidate.interests.filter((i) =>
          userProfile.interests.includes(i)
        ).length
        score *= 1 + (sharedInterests * 0.3)

        // Age preference
        const ageDiff = Math.abs(candidate.age - userProfile.age)
        score *= Math.max(0.5, 1 - ageDiff * 0.02)

        // Verification bonus
        if (candidate.verified && userProfile.verified) score *= 1.15

        // Online status
        if (candidate.online) score *= 1.1

        // Recent activity
        const daysSinceActive = (Date.now() - candidate.lastSeen) / (1000 * 60 * 60 * 24)
        if (daysSinceActive < 1) score *= 1.3
        else if (daysSinceActive < 7) score *= 1.15

        return { candidate, score }
      })
      .sort((a, b) => b.score - a.score)

    return scored.slice(0, limit).map(({ candidate }) => candidate)
  },

  buildFilterFromPreferences: (settings: any): SearchFilters => {
    return {
      ageMin: settings.ageMin,
      ageMax: settings.ageMax,
      location: settings.location,
      relationshipType: settings.relationshipType,
      verified: settings.verifiedOnly || false,
    }
  },
}
