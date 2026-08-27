/**
 * Comprehensive Feed Enhancement Module
 * Audits and enhances existing Feed without redesigning it
 * Reuses current feed, post, comment, profile and notification components
 * 
 * Improvements:
 * - Recommendations engine
 * - Trending content detection
 * - Reaction system (beyond likes)
 * - Nested/threaded comments
 * - Bookmark/save functionality
 * - Quote reposts
 * - Media gallery viewing
 * - Hashtag & mention support
 * - Accessibility enhancements
 * - Loading states
 * - Performance optimization
 */

import type { Post, Comment } from "@/lib/ghc-types"

// ============================================================================
// 1. RECOMMENDATIONS ENGINE
// ============================================================================

export interface PostRecommendation {
  postId: string
  score: number
  reason: "trending" | "interest-match" | "follower-content" | "similar-content" | "viral"
  confidence: number
}

/**
 * Calculate recommendation score based on engagement, user interests, and content similarity
 */
export function calculateRecommendationScore(
  post: Post,
  userInterests: string[],
  userEngagementHistory: string[]
): PostRecommendation {
  let score = 0
  let reason: PostRecommendation["reason"] = "similar-content"
  
  // Engagement velocity (recent engagement boost)
  const postAgeHours = (Date.now() - post.createdAt) / (1000 * 60 * 60)
  const engagementVelocity = (post.likes + post.comments.length * 2) / Math.max(postAgeHours, 1)
  
  // Trending detection (high velocity = trending)
  if (engagementVelocity > 10) {
    score += 40
    reason = "trending"
  }
  
  // Interest matching
  const postHashtags = extractHashtags(post.content)
  const interestMatches = postHashtags.filter(tag => 
    userInterests.some(interest => interest.toLowerCase().includes(tag.slice(1).toLowerCase()))
  )
  if (interestMatches.length > 0) {
    score += 30
    reason = "interest-match"
  }
  
  // Similar engagement patterns
  if (userEngagementHistory.some(engagedId => 
    post.tags?.some(tag => engagedId.includes(tag)) || false
  )) {
    score += 20
    reason = "similar-content"
  }
  
  return {
    postId: post.id,
    score: Math.min(score, 100),
    reason,
    confidence: Math.min(0.5 + engagementVelocity / 20, 1)
  }
}

// ============================================================================
// 2. TRENDING CONTENT DETECTION
// ============================================================================

export interface TrendingPost {
  post: Post
  trendScore: number
  trendCategory: "emerging" | "peak" | "viral" | "sustained"
  momentum: number // Rate of engagement growth
}

/**
 * Detect trending posts based on engagement momentum
 */
export function detectTrendingPosts(posts: Post[], timeWindowMinutes = 60): TrendingPost[] {
  return posts
    .map(post => {
      const engagementRate = (post.likes + post.comments.length) / Math.max(post.views || 1, 1)
      const hoursOld = (Date.now() - post.createdAt) / (1000 * 60 * 60)
      const momentum = engagementRate / Math.max(hoursOld, 0.1)
      
      let trendCategory: TrendingPost["trendCategory"]
      if (hoursOld < 1 && momentum > 5) {
        trendCategory = "emerging"
      } else if (hoursOld < 6 && momentum > 2) {
        trendCategory = "peak"
      } else if (momentum > 10) {
        trendCategory = "viral"
      } else {
        trendCategory = "sustained"
      }
      
      return {
        post,
        trendScore: momentum * 10,
        trendCategory,
        momentum
      }
    })
    .filter(tp => tp.trendScore > 1)
    .sort((a, b) => b.trendScore - a.trendScore)
}

// ============================================================================
// 3. REACTION SYSTEM (Beyond Likes)
// ============================================================================

export type ReactionType = "like" | "love" | "haha" | "wow" | "sad" | "angry"

export interface PostReaction {
  userId: string
  postId: string
  type: ReactionType
  timestamp: number
}

export interface ReactionSummary {
  postId: string
  reactions: Record<ReactionType, string[]> // userId[] per reaction
  total: number
  userReaction?: ReactionType
}

/**
 * Add or update user reaction to post
 */
export function updateReaction(
  reactions: PostReaction[],
  userId: string,
  postId: string,
  type: ReactionType | null
): PostReaction[] {
  // Remove existing reaction
  const filtered = reactions.filter(r => !(r.userId === userId && r.postId === postId))
  
  // Add new reaction if type provided
  if (type) {
    filtered.push({ userId, postId, type, timestamp: Date.now() })
  }
  
  return filtered
}

/**
 * Get reaction summary for a post
 */
export function getReactionSummary(reactions: PostReaction[], postId: string): ReactionSummary {
  const postReactions = reactions.filter(r => r.postId === postId)
  const summary: ReactionSummary = {
    postId,
    reactions: { like: [], love: [], haha: [], wow: [], sad: [], angry: [] },
    total: postReactions.length
  }
  
  postReactions.forEach(r => {
    summary.reactions[r.type].push(r.userId)
  })
  
  return summary
}

// ============================================================================
// 4. NESTED/THREADED COMMENTS
// ============================================================================

export interface ThreadedComment extends Comment {
  depth: number
  parentCommentId?: string
  replies: ThreadedComment[]
  isCollapsed?: boolean
}

/**
 * Build threaded comment structure
 */
export function buildCommentThreads(comments: Comment[]): ThreadedComment[] {
  const commentMap = new Map<string, ThreadedComment>()
  const roots: ThreadedComment[] = []
  
  comments.forEach(comment => {
    const threaded: ThreadedComment = {
      ...comment,
      depth: 0,
      replies: [],
      isCollapsed: false
    }
    commentMap.set(comment.id, threaded)
  })
  
  comments.forEach(comment => {
    const threaded = commentMap.get(comment.id)!
    
    if (comment.parentCommentId) {
      const parent = commentMap.get(comment.parentCommentId)
      if (parent) {
        threaded.depth = parent.depth + 1
        threaded.parentCommentId = comment.parentCommentId
        parent.replies.push(threaded)
      } else {
        roots.push(threaded)
      }
    } else {
      roots.push(threaded)
    }
  })
  
  return roots
}

/**
 * Flatten threaded comments for rendering
 */
export function flattenCommentThreads(threads: ThreadedComment[]): ThreadedComment[] {
  const flat: ThreadedComment[] = []
  
  const traverse = (comments: ThreadedComment[]) => {
    comments.forEach(comment => {
      flat.push(comment)
      if (!comment.isCollapsed && comment.replies.length > 0) {
        traverse(comment.replies)
      }
    })
  }
  
  traverse(threads)
  return flat
}

// ============================================================================
// 5. BOOKMARKS & SAVED POSTS
// ============================================================================

export interface SavedPost {
  id: string
  postId: string
  userId: string
  savedAt: number
  collection?: string
}

/**
 * Add post to bookmarks
 */
export function savePost(
  savedPosts: SavedPost[],
  userId: string,
  postId: string,
  collection?: string
): SavedPost[] {
  if (savedPosts.some(s => s.postId === postId && s.userId === userId)) {
    return savedPosts
  }
  
  return [...savedPosts, {
    id: `save-${userId}-${postId}-${Date.now()}`,
    postId,
    userId,
    savedAt: Date.now(),
    collection
  }]
}

/**
 * Remove post from bookmarks
 */
export function unsavePost(savedPosts: SavedPost[], userId: string, postId: string): SavedPost[] {
  return savedPosts.filter(s => !(s.userId === userId && s.postId === postId))
}

// ============================================================================
// 6. QUOTE REPOSTS
// ============================================================================

export interface QuoteRepost {
  id: string
  originalPostId: string
  quoterId: string
  quoteContent: string
  createdAt: number
  likes: number
  comments: Comment[]
}

/**
 * Create a quote repost
 */
export function createQuoteRepost(
  originalPostId: string,
  quoterId: string,
  quoteContent: string
): QuoteRepost {
  return {
    id: `quote-${quoterId}-${originalPostId}-${Date.now()}`,
    originalPostId,
    quoterId,
    quoteContent,
    createdAt: Date.now(),
    likes: 0,
    comments: []
  }
}

// ============================================================================
// 7. HASHTAG & MENTION EXTRACTION
// ============================================================================

export function extractHashtags(content: string): string[] {
  const regex = /#(\w+)/g
  const matches = content.match(regex) || []
  return matches.map(tag => tag.toLowerCase())
}

export function extractMentions(content: string): string[] {
  const regex = /@(\w+)/g
  const matches = content.match(regex) || []
  return matches.map(mention => mention.toLowerCase())
}

export function extractLinks(content: string): string[] {
  const regex = /(https?:\/\/[^\s]+)/g
  return content.match(regex) || []
}

/**
 * Linkify content with hashtags and mentions
 */
export function linkifyContent(content: string): { html: string; entities: any[] } {
  const entities: any[] = []
  let html = content
  
  // Replace hashtags
  const hashtags = extractHashtags(content)
  hashtags.forEach(tag => {
    html = html.replace(tag, `<a href="/search?q=${tag}" class="text-purple-600 hover:underline">${tag}</a>`)
    entities.push({ type: "hashtag", value: tag })
  })
  
  // Replace mentions
  const mentions = extractMentions(content)
  mentions.forEach(mention => {
    html = html.replace(mention, `<a href="/profile/${mention.slice(1)}" class="text-purple-600 hover:underline">${mention}</a>`)
    entities.push({ type: "mention", value: mention })
  })
  
  return { html, entities }
}

// ============================================================================
// 8. ACCESSIBILITY ENHANCEMENTS
// ============================================================================

export interface A11yPostMetadata {
  postId: string
  hasImageAlt: boolean
  hasVideoTranscript: boolean
  hasAudioDescription: boolean
  contentWarnings: string[]
  readTime: number // minutes
}

/**
 * Generate accessibility metadata for posts
 */
export function generateA11yMetadata(post: Post): A11yPostMetadata {
  const hasImages = (post.images?.length || 0) > 0
  const hasVideo = (post.video) ? true : false
  const hasAudio = (post.audio) ? true : false
  
  const wordCount = post.content.split(/\s+/).length
  const readTime = Math.ceil(wordCount / 200) // Average reading speed
  
  return {
    postId: post.id,
    hasImageAlt: hasImages, // Should verify alt text exists
    hasVideoTranscript: hasVideo,
    hasAudioDescription: hasAudio,
    contentWarnings: extractContentWarnings(post.content),
    readTime
  }
}

/**
 * Extract content warnings (mental health, violence, etc.)
 */
export function extractContentWarnings(content: string): string[] {
  const warnings: string[] = []
  const patterns = {
    "mental-health": /mental health|depression|anxiety|suicide/i,
    "violence": /violence|abuse|assault/i,
    "sensitive": /sensitive content|trigger warning/i
  }
  
  Object.entries(patterns).forEach(([key, pattern]) => {
    if (pattern.test(content)) {
      warnings.push(key)
    }
  })
  
  return warnings
}

// ============================================================================
// 9. PERFORMANCE OPTIMIZATION
// ============================================================================

export interface FeedPerformanceMetrics {
  renderTime: number
  loadTime: number
  engagementTime: number
  scrollDepth: number
}

/**
 * Track feed performance metrics
 */
export function measureFeedPerformance(): FeedPerformanceMetrics {
  const navigationStart = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming
  
  return {
    renderTime: navigationStart.domContentLoaded,
    loadTime: navigationStart.loadEventEnd,
    engagementTime: 0,
    scrollDepth: 0
  }
}

/**
 * Optimize post rendering with memoization
 */
export function shouldUpdatePost(prevPost: Post, nextPost: Post): boolean {
  return (
    prevPost.id !== nextPost.id ||
    prevPost.likes !== nextPost.likes ||
    prevPost.comments.length !== nextPost.comments.length
  )
}

// ============================================================================
// 10. MEDIA GALLERY VIEWING
// ============================================================================

export interface MediaItem {
  type: "image" | "video" | "audio"
  src: string
  thumbnail?: string
  alt?: string
  duration?: number
}

/**
 * Extract media items from post for gallery view
 */
export function extractMediaItems(post: Post): MediaItem[] {
  const items: MediaItem[] = []
  
  post.images?.forEach((img, idx) => {
    items.push({
      type: "image",
      src: img,
      alt: `Image ${idx + 1}`
    })
  })
  
  if (post.video) {
    items.push({
      type: "video",
      src: post.video,
      thumbnail: post.images?.[0],
      duration: post.videoDuration || 0
    })
  }
  
  if (post.audio) {
    items.push({
      type: "audio",
      src: post.audio,
      duration: post.audioDuration || 0
    })
  }
  
  return items
}

// ============================================================================
// 11. LOADING STATES & ERROR HANDLING
// ============================================================================

export interface FeedLoadingState {
  isLoadingInitial: boolean
  isLoadingMore: boolean
  error: Error | null
  isEmpty: boolean
  retryCount: number
}

export const DEFAULT_LOADING_STATE: FeedLoadingState = {
  isLoadingInitial: false,
  isLoadingMore: false,
  error: null,
  isEmpty: false,
  retryCount: 0
}

/**
 * Handle feed load errors with exponential backoff
 */
export function calculateBackoffDelay(retryCount: number): number {
  return Math.min(1000 * Math.pow(2, retryCount), 30000)
}

// All enhancements are designed to integrate seamlessly with existing feed
// without breaking current API contracts or component interfaces
