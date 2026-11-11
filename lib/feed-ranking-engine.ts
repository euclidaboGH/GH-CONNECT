// Advanced Feed Ranking and Filtering Engine
// Implements intelligent feed sorting without changing existing Post data structure

import type { Post, Profile, FeedFilter, PostEngagementMetrics, PostVisibilityReason } from "@/lib/ghc-types"
import { inspirationBoost } from "@/lib/feed-profile-experience"
import { isExcludedFromPublicFeed } from "@/lib/feed/essential-controls"

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
  /** Explicit topic controls; exclusions are hard filters, inclusions narrow the lane. */
  includedTopics?: string[]
  excludedTopics?: string[]
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

/**
 * Privacy and user-control suppression is a hard feed constraint, not a
 * ranking signal. Every feed lane must apply the same block/mute policy.
 */
function getSuppressedAuthorIds(context: FeedContext): Set<string> {
  return new Set([
    ...(context.blockedUserIds || []),
    ...(context.mutedUserIds || []),
  ].map((id) => String(id).trim()).filter(Boolean))
}

function isSuppressedAuthor(post: Post, suppressedAuthorIds: Set<string>): boolean {
  return suppressedAuthorIds.has(String(post.authorId || "").trim())
}

/** Normalize post topics once for deterministic, user-controlled feed filtering. */
export function getPostTopicSet(post: Post): Set<string> {
  const supplied = Array.isArray(post.hashtags) ? post.hashtags : []
  const extracted = extractHashtags(String(post.content || ""))
  return new Set([...supplied, ...extracted]
    .map((value) => String(value || "").replace(/^#/, "").trim().toLowerCase())
    .filter((value) => /^[\p{L}\p{N}_]{2,32}$/u.test(value)))
}

function matchesTopicControls(post: Post, context: FeedContext): boolean {
  const topics = getPostTopicSet(post)
  const excluded = new Set((context.excludedTopics || []).map((v) => String(v).trim().toLowerCase()).filter(Boolean))
  if ([...topics].some((topic) => excluded.has(topic))) return false
  const included = (context.includedTopics || []).map((v) => String(v).trim().toLowerCase()).filter(Boolean)
  return included.length === 0 || included.some((topic) => topics.has(topic))
}

function compareRankedPosts(a: RankedPost, b: RankedPost): number {
  return (b.score - a.score)
    || ((b.post.createdAt || 0) - (a.post.createdAt || 0))
    || String(b.post.id).localeCompare(String(a.post.id))
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
  const safeCount = (value: unknown, cap = 1_000_000) => {
    const number = Number(value ?? 0)
    return Number.isFinite(number) ? Math.max(0, Math.min(cap, number)) : 0
  }
  const likes = safeCount(post.engagement?.likes ?? post.likes)
  const comments = safeCount(post.engagement?.comments ?? post.comments?.length)
  const saves = safeCount(post.engagement?.saves)
  const shares = safeCount(post.engagement?.shares)
  const up = safeCount((post as Post & { upvoteCount?: number }).upvoteCount ?? (post as any).upvote_count)
  const down = safeCount((post as Post & { downvoteCount?: number }).downvoteCount ?? (post as any).downvote_count)
  // Discussion & saves dominate; content upvotes beat passive likes; downvotes soft-penalize
  return comments * 3 + saves * 2.5 + shares * 2 + up * 1.2 + likes * 0.2 - down * 0.8
}

// Calculate engagement score for ranking
export function calculateEngagementScore(post: Post): number {
  if (!post.engagement) {
    return calculateContributionScore(post)
  }

  const { likes, comments, shares, views, saves, clicks } = post.engagement
  const safeCount = (value: unknown, cap = 1_000_000) => {
    const number = Number(value ?? 0)
    return Number.isFinite(number) ? Math.max(0, Math.min(cap, number)) : 0
  }
  let score = 0

  // Contribution-first weights
  score += safeCount(likes) * 0.4
  score += safeCount(comments) * 3
  score += safeCount(shares) * 2
  score += safeCount(saves) * 2.5
  score += safeCount(clicks) * 0.5

  // View-based scoring (capped so view-bait does not dominate)
  const safeViews = safeCount(views)
  if (safeViews > 0) {
    const engagementRate = (score / Math.max(safeViews, 1)) * 100
    score *= 1 + Math.min(engagementRate * 0.008, 0.35)
  }

  // Time-based decay
  const createdAt = Number(post.createdAt)
  const hoursOld = Number.isFinite(createdAt) ? Math.max(0, (Date.now() - createdAt) / (1000 * 60 * 60)) : 0
  const ageDecay = Math.pow(0.95, Math.min(hoursOld, 24 * 365))
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
  const suppressedAuthorIds = getSuppressedAuthorIds(context)
  const ranked = posts
    .filter(
      (post) =>
        !isSuppressedAuthor(post, suppressedAuthorIds) &&
        matchesTopicControls(post, context) &&
        !post.isDraft &&
        !post.isScheduled &&
        matchesLocationLane(post, context)
    )
    .map((post): RankedPost => {
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
    .sort(compareRankedPosts)

  return ranked
}

// Rank posts for "Following" feed
export function rankFollowingFeed(posts: Post[], context: FeedContext): RankedPost[] {
  const suppressedAuthorIds = getSuppressedAuthorIds(context)
  const ranked = posts
    .filter(
      (post) =>
        context.followingIds.includes(post.authorId) &&
        !post.isDraft &&
        !post.isScheduled &&
        !isSuppressedAuthor(post, suppressedAuthorIds) &&
        matchesTopicControls(post, context)
    )
    .map((post): RankedPost => {
      // Pure Following: chronological only (newest first). No engagement ranking.
      const score = post.createdAt || 0
      const reason: PostVisibilityReason = {
        reason: `From ${post.authorName}`,
        category: "following",
      }
      return { post, score, reason }
    })
    .sort(compareRankedPosts)

  return ranked
}

// Rank posts for "Nearby" feed (location-based)
function haversineKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const toRad = (value: number) => (value * Math.PI) / 180
  const earthRadiusKm = 6371
  const dLat = toRad(b.latitude - a.latitude)
  const dLon = toRad(b.longitude - a.longitude)
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)))
}

export function rankNearbyFeed(posts: Post[], context: FeedContext): RankedPost[] {
  if (!context.geolocation) return []
  const suppressedAuthorIds = getSuppressedAuthorIds(context)

  return posts
    .filter((post) => !post.isDraft && !post.isScheduled && !isSuppressedAuthor(post, suppressedAuthorIds) && matchesTopicControls(post, context))
    .map((post) => {
      const coordinates = post.location
      if (!coordinates || !Number.isFinite(coordinates.latitude) || !Number.isFinite(coordinates.longitude)) return null
      const distanceKm = haversineKm(context.geolocation!, coordinates)
      let score = Math.max(0, 60 - Math.min(distanceKm, 60))
      score += calculateEngagementScore(post) * 0.3
      const hoursOld = Math.max(0, (Date.now() - post.createdAt) / (1000 * 60 * 60))
      if (hoursOld < 24) score += 20
      const reason: PostVisibilityReason = {
        reason: distanceKm < 1 ? "Happening very close to you" : `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km away`,
        category: "nearby",
      }
      return { post, score, reason }
    })
    .filter((item): item is RankedPost => Boolean(item))
    .sort(compareRankedPosts)
}

// Rank posts for "Trending" feed
export function rankTrendingFeed(posts: Post[], context: FeedContext): RankedPost[] {
  const suppressedAuthorIds = getSuppressedAuthorIds(context)
  const ranked = posts
    .filter((post) => !post.isDraft && !post.isScheduled && !isSuppressedAuthor(post, suppressedAuthorIds) && matchesTopicControls(post, context))
    .map((post) => {
      const engagementScore = calculateEngagementScore(post)
      const timeRecency = Math.max(0, (Date.now() - post.createdAt) / (1000 * 60 * 60)) // hours

      // Trending algorithm: engagement * time decay
      let score = engagementScore * Math.pow(0.8, Math.min(timeRecency, 24))

      const reason: PostVisibilityReason = {
        reason: "Rising through recent discussion, saves and shares",
        category: "trending",
        shortLabel: "Trending",
      }
      return { post, score, reason }
    })
    .sort(compareRankedPosts)

  return ranked
}

// Rank posts for "Latest" feed
export function rankLatestFeed(posts: Post[], context: FeedContext): RankedPost[] {
  const suppressedAuthorIds = getSuppressedAuthorIds(context)
  const ranked = posts
    .filter((post) => !post.isDraft && !post.isScheduled && !isSuppressedAuthor(post, suppressedAuthorIds) && matchesTopicControls(post, context))
    .map((post): RankedPost => {
      // Latest is strictly chronological. Following status must never reorder it.
      const score = post.createdAt || 0

      const reason: PostVisibilityReason = {
        reason: "Latest posts",
        category: "recency",
      }
      return { post, score, reason }
    })
    .sort(compareRankedPosts)

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
        matchesTopicControls(post, context) &&
        !post.isDraft &&
        !post.isScheduled &&
        friends.has(post.authorId)
    )
    .map((post): RankedPost => {
      const reason: PostVisibilityReason = {
        reason: "From friends",
        category: "network",
      }
      return {
        post,
        score: calculateEngagementScore(post) + (Date.now() - post.createdAt < 86400000 ? 20 : 0),
        reason,
      }
    })
    .sort(compareRankedPosts)
}

/** Communities mode — posts tagged with community or from community-linked authors */
export function rankCommunitiesFeed(posts: Post[], context: FeedContext): RankedPost[] {
  const communities = new Set(context.communityIds || [])
  const blocked = new Set([...(context.blockedUserIds || []), ...(context.mutedUserIds || [])])
  return posts
    .filter((post) => {
      if (isExcludedFromPublicFeed(post, blocked) || !matchesTopicControls(post, context)) return false
      if (!communities.size) {
        // Soft: show posts that declare a communityId / audience community
        return Boolean((post as any).communityId || (post as any).audience === "community")
      }
      const cid = (post as any).communityId as string | undefined
      return cid ? communities.has(cid) : false
    })
    .map((post): RankedPost => {
      const reason: PostVisibilityReason = {
        reason: "From communities",
        category: "community",
      }
      return {
        post,
        score: calculateEngagementScore(post),
        reason,
      }
    })
    .sort(compareRankedPosts)
}

/** Prevent a single author from monopolising For You while preserving score order. */
export function diversifyRankedFeed(items: RankedPost[], maxConsecutiveAuthor = 2): RankedPost[] {
  if (items.length < 3) return items
  const remaining = [...items]
  const out: RankedPost[] = []
  while (remaining.length) {
    const recent = out.slice(-maxConsecutiveAuthor)
    const blockedAuthor = recent.length === maxConsecutiveAuthor && recent.every((x) => x.post.authorId === recent[0].post.authorId)
      ? recent[0].post.authorId
      : null
    let index = blockedAuthor ? remaining.findIndex((x) => x.post.authorId !== blockedAuthor) : 0
    if (index < 0) index = 0
    out.push(remaining.splice(index, 1)[0])
  }
  return out
}

// Main feed ranking function — one content system, mode = filter/rank strategy

function rankSavedFeed(posts: Post[], context: FeedContext): RankedPost[] {
  const saved = new Set((context.savedPostIds || []).map(String))
  const suppressedAuthorIds = getSuppressedAuthorIds(context)
  return posts
    .filter((p) => saved.has(String(p.id)) && !p.isDraft && !p.isScheduled && !isSuppressedAuthor(p, suppressedAuthorIds) && matchesTopicControls(p, context))
    .map((post) => ({
      post,
      score: 100,
      reason: {
        reason: "Saved by you",
        category: "saved",
        shortLabel: "Saved",
      },
    }))
}

export function rankFeed(
  posts: Post[],
  filterType: FeedFilter,
  context: FeedContext
): RankedPost[] {
  switch (filterType) {
    case "for-you":
      return diversifyRankedFeed(rankForYouFeed(posts, context))
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
    case "saved":
      return rankSavedFeed(posts, context)
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
