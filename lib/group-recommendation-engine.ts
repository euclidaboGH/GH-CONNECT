// Group Recommendation Engine - Efficient, memoized recommendations
import type { Profile, Settings, Conversation } from "@/lib/ghc-types"

export type RecommendationReason = "interests" | "activity" | "nearby" | "popular" | "friends"

export interface GroupRecommendation {
  groupId: string
  groupName: string
  description: string
  icon: string
  category: string
  members: number
  onlineMembers: number
  matchType: "interests" | "activity" | "nearby"
  score: number
  reasons: string[]
  activity: "high" | "medium" | "low"
  distanceKm?: number
  matchingInterests: string[]
  isTrending: boolean
}

interface GroupData {
  id: string
  name: string
  description: string
  icon: string
  category: string
  members: number
  onlineMembers: number
  city: string
  country: string
  interests: string[]
  messageCount24h: number // activity indicator
  createdAt: number
  lastActivity: number
}

// In-memory cache for recommendations (TTL: 5 minutes)
const recommendationCache = new Map<string, { data: GroupRecommendation[]; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Performance optimization: Memoize interest matching
const interestMatchCache = new Map<string, Set<string>>()
const profileScoreCache = new Map<string, number>()

function getInterestSet(interests: string[]): Set<string> {
  const key = interests.sort().join("|")
  if (!interestMatchCache.has(key)) {
    interestMatchCache.set(key, new Set(interests.map((i) => i.toLowerCase())))
  }
  return interestMatchCache.get(key)!
}

export function calculateDistance(
  userCity: string,
  userCountry: string,
  groupCity: string,
  groupCountry: string
): number | undefined {
  // Simplified distance calculation
  if (userCountry !== groupCountry) return undefined

  if (userCity.toLowerCase() === groupCity.toLowerCase()) return 0

  // Rough estimation: 20km per city (for demo purposes)
  return 20
}

function calculateInterestMatch(userInterests: string[], groupInterests: string[]): { score: number; matches: string[] } {
  const userSet = getInterestSet(userInterests)
  const groupSet = getInterestSet(groupInterests)

  let matchCount = 0
  const matches: string[] = []

  for (const interest of groupSet) {
    if (userSet.has(interest)) {
      matchCount++
      matches.push(interest)
    }
  }

  const score = groupSet.size > 0 ? Math.min(matchCount / groupSet.size, 1) : 0

  return { score, matches }
}

function generateRecommendationReasons(
  matchType: "interests" | "activity" | "nearby",
  matchingInterests: string[],
  isTrending: boolean,
  onlineCount: number,
  distance?: number,
  memberCount?: number,
  messageCount?: number
): string[] {
  const reasons: string[] = []

  // Interest-based reasons - prioritized
  if (matchingInterests.length > 0) {
    if (matchingInterests.length >= 3) {
      reasons.push(`${matchingInterests.length} shared interests: ${matchingInterests.slice(0, 2).join(", ")}...`)
    } else if (matchingInterests.length === 2) {
      reasons.push(`Both interested in ${matchingInterests.join(" & ")}`)
    } else {
      reasons.push(`Shares your interest in ${matchingInterests[0]}`)
    }
  }

  // Activity-based reasons - actionable
  if (messageCount && messageCount > 100) {
    reasons.push("Very active group with conversations every hour")
  } else if (messageCount && messageCount > 50) {
    reasons.push("Trending now - lots of discussions happening")
  } else if (messageCount && messageCount > 20) {
    reasons.push("Regularly active - new messages daily")
  }

  // Online member specific reasons
  if (onlineCount > 50) {
    reasons.push(`${onlineCount} members online right now`)
  } else if (onlineCount > 20) {
    reasons.push(`${onlineCount} members active now`)
  } else if (onlineCount > 5 && !reasons.some((r) => r.includes("online"))) {
    reasons.push("Members chatting now")
  }

  // Location-based reasons - specific
  if (matchType === "nearby" && distance !== undefined) {
    if (distance === 0) {
      reasons.push("Local community in your city")
    } else if (distance <= 20) {
      reasons.push("Local members - network nearby")
    }
  }

  // Growth & size indicators - supportive detail
  if (memberCount && memberCount > 2000) {
    reasons.push("Established community with 2000+ members")
  } else if (memberCount && memberCount > 1000) {
    reasons.push("Popular & thriving group")
  } else if (memberCount && memberCount > 500) {
    reasons.push("Growing active community")
  }

  return reasons.length > 0 ? reasons : ["Recommended for you"]
}

export function generateGroupRecommendations(
  profile: Profile,
  settings: Settings,
  allGroups: GroupData[],
  joinedGroupIds: string[]
): GroupRecommendation[] {
  // Check cache first
  const cacheKey = `${profile.displayName}|${JSON.stringify(settings.locationRadius)}`
  const cached = recommendationCache.get(cacheKey)

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }

  const recommendations: GroupRecommendation[] = []
  const now = Date.now()
  const recentActivityThreshold = 24 * 60 * 60 * 1000 // 24 hours

  // Filter: exclude already joined groups
  const availableGroups = allGroups.filter((g) => !joinedGroupIds.includes(g.id))

  // Score each group
  for (const group of availableGroups) {
    let totalScore = 0
    const matchReasons: { type: "interests" | "activity" | "nearby"; score: number; data: any }[] = []

    // 1. Interest matching (45% weight - primary signal)
    const { score: interestScore, matches: matchingInterests } = calculateInterestMatch(
      profile.interests,
      group.interests
    )
    if (interestScore > 0) {
      // Boost score for high interest match
      const boostedInterestScore = interestScore >= 0.6 ? Math.min(1, interestScore * 1.1) : interestScore
      totalScore += boostedInterestScore * 0.45
      matchReasons.push({
        type: "interests",
        score: boostedInterestScore,
        data: matchingInterests,
      })
    }

    // 2. Activity matching (30% weight)
    const isRecent = now - group.lastActivity < recentActivityThreshold
    let activityScore = 0
    if (group.messageCount24h > 100) {
      activityScore = 1 // Very active
    } else if (group.messageCount24h > 50) {
      activityScore = 0.85 // Active
    } else if (group.messageCount24h > 20 && isRecent) {
      activityScore = 0.65 // Moderately active
    } else if (isRecent) {
      activityScore = 0.4 // Recently active
    } else {
      activityScore = 0.1 // Inactive
    }
    totalScore += activityScore * 0.3
    matchReasons.push({
      type: "activity",
      score: activityScore,
      data: { isTrending: group.messageCount24h > 50 },
    })

    // 3. Location matching (25% weight)
    const distance = calculateDistance(profile.city, profile.country, group.city, group.country)
    let locationScore = 0
    if (distance !== undefined) {
      locationScore = distance === 0 ? 1 : Math.max(0, 1 - distance / (settings.locationRadius || 50))
      totalScore += locationScore * 0.25
      matchReasons.push({
        type: "nearby",
        score: locationScore,
        data: { distance },
      })
    }

    // Determine primary match type
    let primaryMatchType: "interests" | "activity" | "nearby" = "activity"
    const bestMatch = matchReasons.reduce((prev, curr) => (curr.score > prev.score ? curr : prev))
    if (bestMatch.type) primaryMatchType = bestMatch.type

    // Generate recommendation only if score is above threshold (lowered from 0.3 to 0.25 for more diversity)
    if (totalScore > 0.25) {
      const matchingInterests = matchReasons.find((m) => m.type === "interests")?.data || []
      const isTrending = matchReasons.find((m) => m.type === "activity")?.data?.isTrending || false
      const distData = matchReasons.find((m) => m.type === "nearby")?.data?.distance

      const activity: "high" | "medium" | "low" =
        group.messageCount24h > 50 ? "high" : group.messageCount24h > 20 ? "medium" : "low"

      const reasons = generateRecommendationReasons(
        primaryMatchType,
        matchingInterests,
        isTrending,
        group.onlineMembers,
        distData,
        group.members,
        group.messageCount24h
      )

      recommendations.push({
        groupId: group.id,
        groupName: group.name,
        description: group.description,
        icon: group.icon,
        category: group.category,
        members: group.members,
        onlineMembers: group.onlineMembers,
        matchType: primaryMatchType,
        score: totalScore,
        reasons,
        activity,
        distanceKm: distData,
        matchingInterests,
        isTrending,
      })
    }
  }

  // Sort by score and limit to top 8 (increased from 6 for better discovery)
  const sorted = recommendations.sort((a, b) => b.score - a.score).slice(0, 8)

  // Cache the results
  recommendationCache.set(cacheKey, { data: sorted, timestamp: now })

  return sorted
}

// Efficient bulk recommendation generator for initial load
export function generateBulkRecommendations(
  profile: Profile,
  settings: Settings,
  allGroups: GroupData[],
  conversationIds: string[]
): GroupRecommendation[] {
  return generateGroupRecommendations(profile, settings, allGroups, conversationIds)
}

// Clear cache when data changes
export function invalidateRecommendationCache(): void {
  recommendationCache.clear()
  interestMatchCache.clear()
}
