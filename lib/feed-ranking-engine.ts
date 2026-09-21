// Advanced Feed Ranking and Filtering Engine
// Implements intelligent feed sorting without changing existing Post data structure

import type { Post, Profile, FeedFilter, PostEngagementMetrics, PostVisibilityReason } from "@/lib/ghc-types"
import { inspirationBoost } from "@/lib/feed-profile-experience"

export interface RankedPost {
  post: Post
  score: number
  reason: PostVisibilityReason
  lastInteractionTime?: number
}

export type FeedLocationLane = "city" | "country" | "worldwide"
/** Soft intention bias for For You — user-controlled, not a dating claim */
export type FeedIntentionBias = "balanced" | "friendship" | "professional" | "dating"

export interface FeedContext {
  userProfile: Profile
  userInterests: string[]
  recentlyEngagedPostIds: string[]
  blockedUserIds: string[]
  mutedUserIds?: string[]
  followingIds: string[]
  friendIds?: string[]
  /** Author ids or community ids associated with community posts */
  communityIds?: string[]
  savedPostIds: string[]
  viewedPostIds: string[]
  geolocation?: { latitude: number; longitude: number }
  /** City · Country · Worldwide soft filter for For You */
  locationLane?: FeedLocationLane
  /** Intention soft-weight for For You */
  intentionBias?: FeedIntentionBias
  /** Focus mode: prefer following/friends, demote pure trending */
  focusMode?: boolean
}

// Extract hashtags from content
export function extractHashtags(content: string): string[] {
  const regex = /#(\w+)/g
  const matches = content.match(regex) || []
  return matches.map((tag) => tag.toLowerCase())
}

// Extract mentions from content
export function extractMentions(content: string): string[] {
  const regex = /@(\w+)/g
  const matches = content.match(regex) || []
  return matches.map((mention) => mention.toLowerCase())
}

// Parse links from content
export function extractLinks(content: string): string[] {
  const regex = /(https?:\/\/[^\s]+)/g
  return content.match(regex) || []
}

// Generate link preview (simulated - in production would fetch OG tags)
export function generateLinkPreview(url: string): any {
  return {
    url,
    title: new URL(url).hostname,
    description: "Link preview",
    image: null,
    domain: new URL(url).hostname,
  }
}

/**
 * Contribution-oriented score: comments & saves > raw likes.
 * Fights pure engagement-bait ranking.
 */
export function calculateContributionScore(post: Post): number {
  const likes = post.engagement?.likes ?? post.likes ?? 0
  const comments = post.engagement?.comments ?? post.comments?.length ?? 0
  const saves = post.engagement?.saves ?? 0
  const shares = post.engagement?.shares ?? 0
  // Helpful discussion and saves outweigh passive likes
  return comments * 3 + saves * 2.5 + shares * 2 + likes * 0.35
}

// Calculate engagement score for ranking
export function calculateEngagementScore(post: Post): number {
  if (!post.engagement) {
    return calculateContributionScore(post)
  }

  const { likes, comments, shares, views, saves, clicks, avgEngagementTime } = post.engagement
  let score = 0

  // Contribution-first weights
  score += likes * 0.4
  score += comments * 3
  score += shares * 2
  score += saves * 2.5
  score += (clicks || 0) * 0.5

  // View-based scoring (capped so view-bait does not dominate)
  if (views > 0) {
    const engagementRate = (score / Math.max(views, 1)) * 100
    score *= 1 + Math.min(engagementRate * 0.008, 0.35)
  }

  // Time-based decay
  const hoursOld = (Date.now() - post.createdAt) / (1000 * 60 * 60)
  const ageDecay = Math.pow(0.95, hoursOld)
  score *= ageDecay

  return Math.floor(score)
}

function postLocationBlob(post: Post): string {
  const p = post as Post & { location?: string; city?: string; country?: string; authorLocation?: string }
  return `${p.location || ""} ${p.city || ""} ${p.country || ""} ${p.authorLocation || ""}`.toLowerCase()
}

function matchesLocationLane(post: Post, context: FeedContext): boolean {
  const lane = context.locationLane || "worldwide"
  if (lane === "worldwide") return true
  const blob = postLocationBlob(post)
  if (!blob.trim()) return lane !== "city" // unknown location OK for country-wide soft lane
  const city = (context.userProfile.city || "").toLowerCase()
  const country = (context.userProfile.country || "").toLowerCase()
  if (lane === "city" && city) return blob.includes(city)
  if (lane === "country" && country) return blob.includes(country)
  return true
}

function intentionBoost(post: Post, bias: FeedIntentionBias | undefined): { score: number; hit: boolean } {
  if (!bias || bias === "balanced") return { score: 0, hit: false }
  const text = `${post.content || ""} ${(post.hashtags || []).join(" ")}`.toLowerCase()
  if (bias === "professional") {
    const hit = /work|career|job|startup|business|tech|mentor|hire|portfolio|project/.test(text)
    return { score: hit ? 22 : -4, hit }
  }
  if (bias === "dating") {
    const hit = /date|relationship|single|love|romance|partner/.test(text)
    return { score: hit ? 18 : -3, hit }
  }
  // friendship
  const hit = /friend|hobby|community|hangout|game|music|travel|sport/.test(text)
  return { score: hit ? 20 : -2, hit }
}

// Rank posts for "For You" feed — quality & intention aware
export function rankForYouFeed(posts: Post[], context: FeedContext): RankedPost[] {
  const ranked = posts
    .filter(
      (post) =>
        !context.blockedUserIds.includes(post.authorId) &&
        !post.isDraft &&
        !post.isScheduled &&
        matchesLocationLane(post, context)
    )
    .map((post) => {
      let score = 0
      let reason: PostVisibilityReason = {
        reason: "Suggested for you",
        category: "personalization",
        shortLabel: "For you",
      }

      // 1. Friends (strong network signal)
      if (context.friendIds?.includes(post.authorId)) {
        score += 40
        reason = {
          reason: `From ${post.authorName}, a connection`,
          category: "friends",
          shortLabel: "Friends",
        }
      }

      // 2. Following
      if (context.followingIds.includes(post.authorId)) {
        score += 32
        reason = {
          reason: `From ${post.authorName}, who you follow`,
          category: "following",
          shortLabel: "Following",
        }
      }

      // 3. Recent engagement
      if (context.recentlyEngagedPostIds.includes(post.id)) {
        score += 28
        if (reason.category === "personalization") {
          reason = {
            reason: "Because you engaged with similar posts",
            category: "engagement",
            shortLabel: "Similar",
          }
        }
      }

      // 4. Shared interests
      const postHashtags = post.hashtags || extractHashtags(post.content || "")
      const interestMatches = postHashtags.filter((tag) =>
        context.userInterests.some(
          (interest) =>
            interest.toLowerCase().includes(tag.toLowerCase()) ||
            tag.toLowerCase().includes(interest.toLowerCase())
        )
      ).length
      const contentInterest = context.userInterests.filter((i) =>
        (post.content || "").toLowerCase().includes(i.toLowerCase())
      ).length
      const totalInterest = interestMatches + contentInterest
      if (totalInterest > 0) {
        score += totalInterest * 18
        reason = {
          reason: `Shared interests${postHashtags[0] ? ` · #${postHashtags[0].replace(/^#/, "")}` : ""}`,
          category: "interest",
          shortLabel: "Interests",
        }
      }

      // 5. Contribution quality (not raw likes)
      const contribution = calculateContributionScore(post)
      score += Math.min(contribution, 40)
      if (contribution >= 12 && (reason.category === "personalization" || reason.category === "trending")) {
        reason = {
          reason: "Active discussion and saves — quality signal",
          category: "contribution",
          shortLabel: "Quality",
        }
        if ((post as any)._trendingBoost || (post.likes || 0) + (post.comments?.length || 0) > 12) {
          // soft label when engagement is high — not a ranking lie
          reason = {
            reason: "Rising engagement in your network",
            category: "trending",
            shortLabel: "Trending",
          }
        }
      }

      // 6. Intention soft-weight (user-controlled)
      const intent = intentionBoost(post, context.intentionBias)
      score += intent.score
      if (intent.hit && context.intentionBias && context.intentionBias !== "balanced") {
        reason = {
          reason: `Aligned with your ${context.intentionBias} focus`,
          category: "intention",
          shortLabel:
            context.intentionBias === "professional"
              ? "Pro"
              : context.intentionBias === "dating"
                ? "Dating"
                : "Friends",
        }
      }

      // 7. Location lane label when geo text matches
      const lane = context.locationLane || "worldwide"
      if (lane !== "worldwide" && matchesLocationLane(post, context) && postLocationBlob(post).trim()) {
        score += lane === "city" ? 16 : 10
        if (reason.category === "personalization") {
          reason = {
            reason:
              lane === "city"
                ? `Near ${context.userProfile.city || "your city"}`
                : `In ${context.userProfile.country || "your country"}`,
            category: "location",
            shortLabel: lane === "city" ? "City" : "Country",
          }
        }
      }

      // 8. Focus mode: prefer network, demote pure viral
      if (context.focusMode) {
        if (context.followingIds.includes(post.authorId) || context.friendIds?.includes(post.authorId)) {
          score += 25
        } else {
          score -= 12
        }
      }

      // 9. Not recently viewed
      if (!context.viewedPostIds.includes(post.id)) score += 8

      // 10. Inspiration / constructive content
      const boost = inspirationBoost(post.content || "")
      if (boost > 0) {
        score += boost
        if (reason.category === "personalization" || reason.category === "trending") {
          reason = {
            reason: "Inspiring or growth-focused content",
            category: "inspiration",
            shortLabel: "Inspire",
          }
        }
      }

      // 11. Community association (soft)
      if (context.communityIds?.length && (post as any).communityId && context.communityIds.includes((post as any).communityId)) {
        score += 24
        reason = {
          reason: "From a community you belong to",
          category: "community",
          shortLabel: "Community",
        }
      }

      if (!reason.reason) {
        reason = { reason: "Suggested for you", category: "personalization", shortLabel: "For you" }
      }

      return { post, score, reason }
    })
    .sort((a, b) => b.score - a.score)

  return ranked
}

// Rank posts for "Following" feed
export function rankFollowingFeed(posts: Post[], context: FeedContext): RankedPost[] {
  const ranked = posts
    .filter(
      (post) =>
        context.followingIds.includes(post.authorId) &&
        !post.isDraft &&
        !post.isScheduled &&
        !context.blockedUserIds.includes(post.authorId)
    )
    .map((post) => {
      // Pure Following: chronological only (newest first). No engagement ranking.
      const score = post.createdAt || 0
      return {
        post,
        score,
        reason: {
          reason: `From ${post.authorName}`,
          category: "following",
        },
      }
    })
    .sort((a, b) => b.score - a.score)

  return ranked
}

// Rank posts for "Nearby" feed (location-based)
export function rankNearbyFeed(posts: Post[], context: FeedContext): RankedPost[] {
  if (!context.geolocation) {
    return []
  }

  const ranked = posts
    .filter((post) => !post.isDraft && !post.isScheduled && !context.blockedUserIds.includes(post.authorId))
    .map((post) => {
      let score = 0

      // Simulate location relevance (in production, would use actual coords)
      score += 50

      // Engagement boost
      score += calculateEngagementScore(post) * 0.3

      // Recent events boost
      const hoursOld = (Date.now() - post.createdAt) / (1000 * 60 * 60)
      if (hoursOld < 24) {
        score += 20
      }

      return {
        post,
        score,
        reason: {
          reason: "Happening nearby",
          category: "personalization",
        },
      }
    })
    .sort((a, b) => b.score - a.score)

  return ranked
}

// Rank posts for "Trending" feed
export function rankTrendingFeed(posts: Post[], context: FeedContext): RankedPost[] {
  const ranked = posts
    .filter((post) => !post.isDraft && !post.isScheduled && !context.blockedUserIds.includes(post.authorId))
    .map((post) => {
      const engagementScore = calculateEngagementScore(post)
      const timeRecency = (Date.now() - post.createdAt) / (1000 * 60 * 60) // hours

      // Trending algorithm: engagement * time decay
      let score = engagementScore * Math.pow(0.8, Math.min(timeRecency, 24))

      return {
        post,
        score,
        reason: {
          reason: `Trending with ${post.likes} likes`,
          category: "trending",
        },
      }
    })
    .sort((a, b) => b.score - a.score)

  return ranked
}

// Rank posts for "Latest" feed
export function rankLatestFeed(posts: Post[], context: FeedContext): RankedPost[] {
  const ranked = posts
    .filter((post) => !post.isDraft && !post.isScheduled && !context.blockedUserIds.includes(post.authorId))
    .map((post) => {
      let score = Date.now() - post.createdAt

      // Bonus for following
      if (context.followingIds.includes(post.authorId)) {
        score *= 1.2
      }

      return {
        post,
        score,
        reason: {
          reason: "Latest posts",
          category: "recency",
        },
      }
    })
    .sort((a, b) => b.score - a.score)

  return ranked
}

/** Friends mode — posts from friend graph (same store, different filter) */
export function rankFriendsFeed(posts: Post[], context: FeedContext): RankedPost[] {
  const friends = new Set(context.friendIds || [])
  const blocked = new Set([...(context.blockedUserIds || []), ...(context.mutedUserIds || [])])
  return posts
    .filter(
      (post) =>
        !blocked.has(post.authorId) &&
        !post.isDraft &&
        !post.isScheduled &&
        friends.has(post.authorId)
    )
    .map((post) => ({
      post,
      score: calculateEngagementScore(post) + (Date.now() - post.createdAt < 86400000 ? 20 : 0),
      reason: { reason: "From friends", category: "network" as const },
    }))
    .sort((a, b) => b.score - a.score)
}

/** Communities mode — posts tagged with community or from community-linked authors */
export function rankCommunitiesFeed(posts: Post[], context: FeedContext): RankedPost[] {
  const communities = new Set(context.communityIds || [])
  const blocked = new Set([...(context.blockedUserIds || []), ...(context.mutedUserIds || [])])
  return posts
    .filter((post) => {
      if (blocked.has(post.authorId) || post.isDraft || post.isScheduled) return false
      if (!communities.size) {
        // Soft: show posts that declare a communityId / audience community
        return Boolean((post as any).communityId || (post as any).audience === "community")
      }
      const cid = (post as any).communityId as string | undefined
      return cid ? communities.has(cid) : false
    })
    .map((post) => ({
      post,
      score: calculateEngagementScore(post),
      reason: { reason: "From communities", category: "network" as const },
    }))
    .sort((a, b) => b.score - a.score)
}

// Main feed ranking function — one content system, mode = filter/rank strategy
export function rankFeed(
  posts: Post[],
  filterType: FeedFilter,
  context: FeedContext
): RankedPost[] {
  switch (filterType) {
    case "for-you":
      return rankForYouFeed(posts, context)
    case "following":
      return rankFollowingFeed(posts, context)
    case "friends":
      return rankFriendsFeed(posts, context)
    case "communities":
      return rankCommunitiesFeed(posts, context)
    case "nearby":
      return rankNearbyFeed(posts, context)
    case "trending":
      return rankTrendingFeed(posts, context)
    case "latest":
      return rankLatestFeed(posts, context)
    default:
      return rankForYouFeed(posts, context)
  }
}

// Get reason why post is shown
export function getVisibilityReason(rankedPost: RankedPost): PostVisibilityReason {
  return rankedPost.reason
}

// Calculate visibility breakdown
export function calculateVisibilityBreakdown(post: Post): Record<string, number> {
  return {
    engagement: post.engagement?.likes || post.likes,
    comments: post.comments.length,
    shares: post.engagement?.shares || 0,
    saves: post.engagement?.saves || 0,
    views: post.engagement?.views || 0,
  }
}
