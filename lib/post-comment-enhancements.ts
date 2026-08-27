// Post and Comment Enhancements - Unified export module
// Consolidates all new post/comment features for easy integration

// Re-export existing engines
export * from "@/lib/post-comment-engine"

// Export new features
export * from "@/lib/post-actions-engine"
export * from "@/lib/comment-features-engine"
export * from "@/lib/post-validation"
export * from "@/lib/link-preview-service"

// Convenience type aggregation
export type {
  Post,
  PostComment,
  PostReaction,
  LinkPreview,
  SavedPost,
  PostDraft,
} from "@/lib/ghc-types"

export type {
  EnhancedComment,
  CommentMedia,
  PostEnhancement,
  PostInteraction,
} from "@/lib/post-comment-engine"

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
  ValidationResult,
  CommentValidation,
} from "@/lib/post-validation"

export type {
  LinkPreviewCache as LinkPreviewCacheType,
  LinkStats,
} from "@/lib/link-preview-service"

// Convenience helpers aggregation
export {
  validateCommentText as validateComment,
  validatePostContent,
  validateQuoteText,
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
  validateCommentFull,
  sanitizeText,
  sanitizeForDisplay,
} from "@/lib/post-validation"

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
  validateMentions as validateCommentMentions,
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
  LinkPreviewCache,
  isValidUrl,
  isValidProtocol,
  extractUrls as extractUrlsFromText,
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

// Utility constants
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

// Integration helpers
export function initializePostEnhancements() {
  // Initialize link preview cache if needed
  const cache = new LinkPreviewCache()
  // Clear expired entries on init
  cache.clearExpired()
  return { cache }
}

// Common validation wrapper
export interface PostValidationOptions {
  checkMentions?: boolean
  checkHashtags?: boolean
  checkUrls?: boolean
  checkEmojis?: boolean
  validUserIds?: string[]
  maxLength?: number
}

export function validatePostWithOptions(
  text: string,
  options: PostValidationOptions = {}
): ValidationResult & { extracted?: any } {
  const result = validatePostContent(text)
  if (!result.valid) return result

  const extracted: any = {}
  const warnings: string[] = result.warnings || []

  if (options.checkMentions) {
    extracted.mentions = extractMentions(text)
    if (options.validUserIds) {
      const mentionValidation = validateMentions(text, options.validUserIds)
      if (!mentionValidation.valid) {
        warnings.push(`Invalid mentions: ${mentionValidation.invalidMentions.join(", ")}`)
      }
    }
  }

  if (options.checkHashtags) {
    extracted.hashtags = extractHashtags(text)
  }

  if (options.checkUrls) {
    extracted.urls = extractUrls(text)
  }

  if (options.checkEmojis) {
    extracted.emojis = extractEmojis(text)
  }

  return {
    valid: true,
    sanitized: result.sanitized,
    extracted: Object.keys(extracted).length > 0 ? extracted : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

// Migration helper - convert old comment format to new
export function migrateCommentFormat(oldComment: any): EnhancedCommentData {
  return {
    id: oldComment.id || "",
    authorName: oldComment.authorName || "",
    authorPhoto: oldComment.authorPhoto || "",
    text: oldComment.text || "",
    createdAt: oldComment.createdAt || Date.now(),
    replyCount: oldComment.replyCount,
    replies: oldComment.replies?.map(migrateCommentFormat),
    reactions: oldComment.reactions || {},
    isPinned: oldComment.isPinned || false,
    isEdited: oldComment.isEdited || false,
    editedAt: oldComment.editedAt,
    mediaAttachments: oldComment.mediaAttachments,
    mentions: oldComment.mentions,
    replyTo: oldComment.replyTo,
  }
}

// Remove duplicates - consolidation utility
export function removeDuplicateComments(comments: EnhancedCommentData[]): EnhancedCommentData[] {
  const seen = new Set<string>()
  const unique: EnhancedCommentData[] = []

  for (const comment of comments) {
    if (!seen.has(comment.id)) {
      seen.add(comment.id)
      unique.push({
        ...comment,
        replies: comment.replies ? removeDuplicateComments(comment.replies) : undefined,
      })
    }
  }

  return unique
}

// Batch operations helper
export interface BatchCommentOperation {
  operation: "pin" | "unpin" | "hide" | "delete" | "react"
  commentIds: string[]
  reactionEmoji?: string // for react operation
  userId?: string // for react operation
}

export function executeBatchCommentOperation(
  comments: EnhancedCommentData[],
  op: BatchCommentOperation
): EnhancedCommentData[] {
  const result = [...comments]

  for (let i = 0; i < result.length; i++) {
    if (op.commentIds.includes(result[i].id)) {
      switch (op.operation) {
        case "pin":
          result[i] = pinComment(result[i])
          break
        case "unpin":
          result[i] = unpinComment(result[i])
          break
        case "react":
          if (op.reactionEmoji && op.userId) {
            result[i] = addReactionToComment(result[i], op.reactionEmoji, op.userId)
          }
          break
        // delete and hide would be handled at post level
      }
    }

    // Process nested replies
    if (result[i].replies) {
      result[i].replies = result[i].replies?.map((reply) => {
        if (op.commentIds.includes(reply.id)) {
          switch (op.operation) {
            case "pin":
              return pinComment(reply)
            case "unpin":
              return unpinComment(reply)
            case "react":
              if (op.reactionEmoji && op.userId) {
                return addReactionToComment(reply, op.reactionEmoji, op.userId)
              }
              return reply
            default:
              return reply
          }
        }
        return reply
      })
    }
  }

  return result
}
