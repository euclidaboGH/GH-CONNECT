// Unified Post and Comment Features Index
// Consolidates all post/comment enhancements with no duplicate logic

// Re-export all validation and comment features
export * from "@/lib/post-validation"
export * from "@/lib/comment-features-engine"
export * from "@/lib/link-preview-service"
export * from "@/lib/post-actions-engine"

// Type aggregation for convenience
export type {
  Post,
  PostComment,
  LinkPreview,
  PostEngagementMetrics,
} from "@/lib/ghc-types"

export type {
  ValidationResult,
  CommentValidation,
  MentionValidation,
} from "@/lib/post-validation"

export type {
  EnhancedCommentData,
  CommentMediaData,
  NestedReply,
  CommentSortType,
  CommentStats,
  CommentThread,
  CommentModeration,
  CommentActivity,
} from "@/lib/comment-features-engine"

export type {
  LinkStats,
  UrlPattern,
  PlatformPreview,
} from "@/lib/link-preview-service"

export type {
  UserAction,
  PostActionState,
  PostMetadata,
  FollowAction,
  UserRestriction,
  PostReport,
  BookmarkCollection,
  QuoteRepost,
} from "@/lib/post-actions-engine"

// Convenience re-exports with clear organization
export {
  // Validation
  validatePostContent,
  validateCommentText,
  validateQuoteText,
  validateCommentFull,
  extractMentions,
  extractHashtags,
  extractUrls,
  extractEmojis,
  validateMentions,
  validateHashtags,
  validateUrls,
  validateEmojis,
  validateReactionEmoji,
  validateImage,
  validateGif,
  validateVoiceRecording,
  validateAttachments,
  sanitizeText,
  sanitizeForDisplay,
  detectSpam,
} from "@/lib/post-validation"

export {
  // Comments
  createNestedReply,
  addReplyToComment,
  removeReplyFromComment,
  findCommentById,
  findParentComment,
  sortComments,
  flattenComments,
  getAllReplies,
  // Reactions
  addReactionToComment,
  removeReactionFromComment,
  getReactionCount,
  getTotalReactions,
  hasUserReacted,
  // Pinning
  pinComment,
  unpinComment,
  getPinnedComments,
  // Editing
  editComment,
  // Content extraction
  extractMentionsFromComment,
  extractHashtagsFromComment,
  // Stats
  calculateCommentStats,
  // Threading
  getCommentThread,
  getCommentDepth,
  // Moderation
  hideComment,
  detectSpamInComment,
  // Activity
  getCommentActivity,
  // Batch operations
  hideComments,
  pinComments,
  unpinComments,
} from "@/lib/comment-features-engine"

export {
  // Link cache
  LinkPreviewCache,
  // Link extraction
  extractLinkPreview,
  getFaviconUrl,
  isValidUrl,
  isValidProtocol,
  extractUrls,
  openLink,
  wrapLinkForAnalytics,
  isShortened,
  getPreviewForPlatform,
  generateShareUrl,
  createShareablePreview,
  normalizeUrl,
  detectUrlPattern,
  // Link stats
  createLinkStats,
  recordLinkClick,
  recordLinkView,
  recordLinkShare,
} from "@/lib/link-preview-service"

export {
  // User actions
  createUserAction,
  createActionState,
  updateActionState,
  // Post metadata
  createPostMetadata,
  trackPostView,
  trackPostCopy,
  addShareLink,
  addReportReason,
  trackPostHide,
  trackNotInterested,
  // Follow/unfollow
  createFollowAction,
  // Block/mute
  createUserRestriction,
  // Reporting
  createPostReport,
  // Utilities
  copyPostLink,
  copyToClipboard,
  // Collections
  createBookmarkCollection,
  // Quote reposts
  createQuoteRepost,
} from "@/lib/post-actions-engine"

// Constants for UI
export const REACTION_EMOJIS = [
  "👍", // Like
  "❤️", // Love
  "😂", // Haha
  "😮", // Wow
  "😢", // Sad
  "😠", // Angry
  "🔥", // Fire
  "💯", // 100
  "😍", // Heart eyes
  "🙌", // Raised hands
]

export const COMMENT_SORT_OPTIONS = ["newest", "oldest", "mostReacted", "pinned", "relevance"] as const

export const POST_ACTION_TYPES = [
  "view",
  "like",
  "unlike",
  "comment",
  "share",
  "bookmark",
  "report",
  "hide",
  "not_interested",
  "mute",
  "block",
  "follow",
  "unfollow",
] as const

export const REPORT_REASONS = [
  "Inappropriate content",
  "Misinformation",
  "Hate speech",
  "Harassment",
  "Spam",
  "Copyright infringement",
  "Other",
] as const

// Integrated validation helper combining multiple checks
export interface ComprehensivePostValidation {
  text: ValidationResult
  mentions?: MentionValidation
  hashtags?: { valid: boolean; hashtags: string[] }
  urls?: { valid: boolean; urls: string[]; invalid: string[] }
  emojis?: { valid: boolean; emojis: string[] }
  isSpam?: boolean
}

export function validatePostComprehensive(
  text: string,
  options: {
    checkMentions?: boolean
    checkHashtags?: boolean
    checkUrls?: boolean
    checkEmojis?: boolean
    checkSpam?: boolean
    validUserIds?: string[]
  } = {}
): ComprehensivePostValidation {
  const result: ComprehensivePostValidation = {
    text: validatePostContent(text),
  }

  if (!result.text.valid) {
    return result
  }

  if (options.checkMentions) {
    result.mentions = validateMentions(text, options.validUserIds || [])
  }

  if (options.checkHashtags) {
    result.hashtags = validateHashtags(text)
  }

  if (options.checkUrls) {
    result.urls = validateUrls(text)
  }

  if (options.checkEmojis) {
    result.emojis = validateEmojis(text)
  }

  if (options.checkSpam) {
    result.isSpam = detectSpam(text).isSpam
  }

  return result
}

// Feature initialization helper
export interface PostCommentEnhancementsConfig {
  enableCommentReactions?: boolean
  enableNestedReplies?: boolean
  enableCommentEditing?: boolean
  enablePinning?: boolean
  enableLinkPreviews?: boolean
  enableMentions?: boolean
  enableHashtags?: boolean
  maxCommentLength?: number
  maxReplyDepth?: number
  enableSpamDetection?: boolean
}

export const DEFAULT_ENHANCEMENTS_CONFIG: PostCommentEnhancementsConfig = {
  enableCommentReactions: true,
  enableNestedReplies: true,
  enableCommentEditing: true,
  enablePinning: true,
  enableLinkPreviews: true,
  enableMentions: true,
  enableHashtags: true,
  maxCommentLength: 5000,
  maxReplyDepth: 5,
  enableSpamDetection: true,
}

export function initializePostCommentEnhancements(
  config: PostCommentEnhancementsConfig = {}
): PostCommentEnhancementsConfig {
  return {
    ...DEFAULT_ENHANCEMENTS_CONFIG,
    ...config,
  }
}
