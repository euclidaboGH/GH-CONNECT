/**
 * Unified Post and Comment Features Index
 * Consolidates post/comment enhancements without duplicate export names.
 */

// Local imports for helpers defined in this module
import {
  validatePostContent,
  validateMentions,
  validateHashtags,
  validateUrls,
  validateEmojis,
  detectSpam,
  type ValidationResult,
  type MentionValidation,
} from "@/lib/post-validation"

// --- Value re-exports (one block per module; no star-export clashes) ---

export {
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
  createNestedReply,
  addReplyToComment,
  removeReplyFromComment,
  findCommentById,
  findParentComment,
  sortComments,
  flattenComments,
  getAllReplies,
  addReactionToComment,
  removeReactionFromComment,
  getReactionCount,
  getTotalReactions,
  hasUserReacted,
  pinComment,
  unpinComment,
  getPinnedComments,
  editComment,
  extractMentionsFromComment,
  extractHashtagsFromComment,
  calculateCommentStats,
  getCommentThread,
  getCommentDepth,
  hideComment,
  detectSpamInComment,
  getCommentActivity,
} from "@/lib/comment-features-engine"

export {
  extractLinkPreview,
  getFaviconUrl,
  isValidUrl,
  isValidProtocol,
  openLink,
  wrapLinkForAnalytics,
  isShortened,
  getPreviewForPlatform,
  createShareablePreview,
  createLinkStats,
  recordLinkClick,
  recordLinkView,
  recordLinkShare,
} from "@/lib/link-preview-service"
// LinkPreviewCache / extractUrls: import from source modules (dual type+value / name clash)

export {
  createUserAction,
  createActionState,
  updateActionState,
  createPostMetadata,
  trackPostView,
  trackPostCopy,
  addShareLink,
  addReportReason,
  trackPostHide,
  trackNotInterested,
  createFollowAction,
  createUserRestriction,
  createPostReport,
  copyPostLink,
  copyToClipboard,
  createBookmarkCollection,
  createQuoteRepost,
} from "@/lib/post-actions-engine"

// --- Type re-exports ---

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

export type { LinkStats } from "@/lib/link-preview-service"

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
