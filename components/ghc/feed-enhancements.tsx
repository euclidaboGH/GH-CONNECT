"use client"

import { ActionSheet, ActionSheetItem, closeAllActionSheets } from "./action-sheet"

import { useState, useEffect } from "react"
import { Heart, MessageCircle, Share2, MoreVertical, Bookmark, Link as LinkIcon, Eye, X, Flag, Volume2, Slash, ThumbsDown, AtSign, Hash, Smile, Image as ImageIcon, Mic, RotateCw as Repeat2, Reply } from "lucide-react"
import type { Post, PostComment } from "@/lib/ghc-types"
import { isOwnAuthor, canEditComment, canDeleteComment } from "@/lib/ownership"
import { timeAgo } from "@/lib/ghc-data"
import { LazyImage } from "./lazy-image"
import { ReportChooser } from "./report-chooser"

// Post Menu with all actions
interface PostMenuProps {
  post: Post
  isOpen: boolean
  onClose: () => void
  onEdit?: () => void
  onDelete?: () => void
  onHide?: () => void
  onNotInterested?: () => void
  onReport?: (reason: string) => void
  onMute?: () => void
  onBlock?: () => void
  onBookmark?: () => void
  onCopyLink?: () => void
  isBookmarked?: boolean
}

export function PostMenu({
  post,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onHide,
  onNotInterested,
  onReport,
  onMute,
  onBlock,
  onBookmark,
  onCopyLink,
  isBookmarked,
}: PostMenuProps) {
  const [showReportOptions, setShowReportOptions] = useState(false)
  const reportReasons = ["Spam", "Harassment", "Hate speech", "Misinformation", "Other"]

  useEffect(() => {
    if (!isOpen) return
    const onCloseAll = () => onClose()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    // Register after tick so our own open does not immediately close us
    const tid = window.setTimeout(() => {
      window.addEventListener("ghc:close-action-sheets", onCloseAll)
    }, 0)
    window.addEventListener("keydown", onKey)
    window.addEventListener("ghc:navigate-tab", onCloseAll)
    return () => {
      window.clearTimeout(tid)
      window.removeEventListener("ghc:close-action-sheets", onCloseAll)
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("ghc:navigate-tab", onCloseAll)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-end bg-black/40" onClick={onClose}>
      <div
        className="mb-[calc(4.25rem+env(safe-area-inset-bottom))] max-h-[min(70vh,28rem)] w-full space-y-1 overflow-y-auto overscroll-contain rounded-t-3xl border border-border bg-card p-3 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">Post Options</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        {/* Owner actions */}
        {onEdit && (
          <button onClick={onEdit} className="w-full text-left px-4 py-2 hover:bg-gray-50 rounded-lg text-sm font-semibold text-gray-900">
            Edit post
          </button>
        )}

        {onDelete && (
          <button onClick={onDelete} className="w-full text-left px-4 py-2 hover:bg-red-50 rounded-lg text-sm font-semibold text-red-600">
            Delete post
          </button>
        )}

        {/* Engagement actions */}
        {onBookmark && (
          <button
            onClick={onBookmark}
            className="w-full text-left px-4 py-2 hover:bg-blue-50 rounded-lg text-sm font-semibold text-gray-900 flex items-center gap-2"
          >
            <Bookmark size={16} fill={isBookmarked ? "currentColor" : "none"} />
            {isBookmarked ? "Remove from saved" : "Save post"}
          </button>
        )}

        {onCopyLink && (
          <button
            onClick={onCopyLink}
            className="w-full text-left px-4 py-2 hover:bg-purple-50 rounded-lg text-sm font-semibold text-gray-900 flex items-center gap-2"
          >
            <LinkIcon size={16} />
            Copy link
          </button>
        )}

        {/* Hide/Filter actions */}
        {onHide && (
          <button
            onClick={onHide}
            className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded-lg text-sm font-semibold text-gray-900 flex items-center gap-2"
          >
            <Eye size={16} />
            Hide post
          </button>
        )}

        {onNotInterested && (
          <button
            onClick={onNotInterested}
            className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded-lg text-sm font-semibold text-gray-900 flex items-center gap-2"
          >
            <ThumbsDown size={16} />
            Not interested
          </button>
        )}

        {onMute && (
          <button
            onClick={onMute}
            className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded-lg text-sm font-semibold text-gray-900 flex items-center gap-2"
          >
            <Volume2 size={16} />
            Mute
          </button>
        )}

        {/* Danger zone */}
        {!showReportOptions && onReport && (
          <button
            onClick={() => setShowReportOptions(true)}
            className="w-full text-left px-4 py-2 hover:bg-red-50 rounded-lg text-sm font-semibold text-red-600 flex items-center gap-2"
          >
            <Flag size={16} />
            Report post
          </button>
        )}

        {showReportOptions && (
          <div className="space-y-1">
            {reportReasons.map((reason) => (
              <button
                key={reason}
                onClick={() => {
                  onReport?.(reason)
                  onClose()
                }}
                className="w-full text-left px-4 py-2 hover:bg-red-50 rounded-lg text-xs font-semibold text-red-600 ml-4"
              >
                • {reason}
              </button>
            ))}
          </div>
        )}

        {onBlock && (
          <button
            onClick={onBlock}
            className="w-full text-left px-4 py-2 hover:bg-red-50 rounded-lg text-sm font-semibold text-red-600 flex items-center gap-2"
          >
            <Slash size={16} />
            Block user
          </button>
        )}
      </div>
    </div>
  )
}

// Comment Reactions Component
interface CommentReactionsProps {
  reactions?: Record<string, string[]>
  onAddReaction?: (emoji: string) => void
  onRemoveReaction?: (emoji: string) => void
}

export function CommentReactions({
  reactions = {},
  onAddReaction,
  onRemoveReaction,
}: CommentReactionsProps) {
  const commonEmojis = ["👍", "❤️", "😂", "😮", "😢", "😡"]

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {Object.entries(reactions).map(([emoji, users]) => (
        <button
          key={emoji}
          onClick={() => onRemoveReaction?.(emoji)}
          className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-xs font-semibold flex items-center gap-1 transition-colors"
        >
          {emoji} {users.length}
        </button>
      ))}
      {onAddReaction && (
        <button
          onClick={() => {
            const emoji = commonEmojis[Math.floor(Math.random() * commonEmojis.length)]
            onAddReaction(emoji)
          }}
          className="w-6 h-6 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full text-xs transition-colors"
          title="Add reaction"
        >
          <Smile size={14} />
        </button>
      )}
    </div>
  )
}

// Enhanced Comment Component with nested replies
interface EnhancedCommentProps {
  comment: PostComment
  onReply?: (commentId: string) => void
  onEdit?: (commentId: string, text?: string) => void
  onDelete?: (commentId: string) => void
  onPin?: (commentId: string) => void
  onAddReaction?: (commentId: string, emoji: string) => void
  onRemoveReaction?: (commentId: string, emoji: string) => void
  onReport?: (commentId: string, reason: string) => void
  depth?: number
}

export function EnhancedComment({
  comment,
  onReply,
  onEdit,
  onDelete,
  onPin,
  onAddReaction,
  onRemoveReaction,
  onReport,
  depth = 0,
  postAuthorId,
  currentUserId = "current-user",
}: EnhancedCommentProps & { postAuthorId?: string; currentUserId?: string }) {
  const [showActions, setShowActions] = useState(false)
  const [expandedReplies, setExpandedReplies] = useState(depth > 0)
  const [isEditing, setIsEditing] = useState(false)
  const [localEditText, setLocalEditText] = useState(comment.text || "")
  if (!comment || !comment.id) return null
  const replies = Array.isArray((comment as PostComment & { replies?: PostComment[] }).replies)
    ? ((comment as PostComment & { replies?: PostComment[] }).replies || []).filter((r) => r && r.id)
    : []

  const isCommentOwner = isOwnAuthor(comment.authorId, comment.authorName)
  const isPostOwner = isOwnAuthor(postAuthorId)
  const canEditThis = Boolean(onEdit) && canEditComment(comment.authorId, comment.authorName)
  const canDeleteThis = Boolean(onDelete) && canDeleteComment(comment.authorId, comment.authorName, postAuthorId)

  return (
    <div className={`${depth > 0 ? "ml-3 border-l-2 border-emerald-200/80 pl-3 relative" : ""} py-1.5`}>
      {/* Comment header */}
      <div className="flex items-start gap-2">
        <LazyImage
          src={comment.authorPhoto || `/avatars/${String(comment.authorName || "member").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.svg`}
          alt={comment.authorName || "Member"}
          className={`${depth > 0 ? "h-6 w-6" : "h-8 w-8"} shrink-0 rounded-full object-cover`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="font-bold text-xs text-gray-900">{comment.authorName}</p>
              <span className="text-[10px] text-gray-500">{timeAgo(comment.createdAt)}</span>
            </div>
            {comment.isPinned && <span className="text-xs text-emerald-600 font-bold">📌 Pinned</span>}
          </div>

          {/* Comment content / inline edit */}
          {isEditing ? (
            <div className="mt-1 space-y-2">
              <textarea
                value={localEditText}
                onChange={(e) => setLocalEditText(e.target.value.slice(0, 1000))}
                className="w-full resize-none rounded-xl border border-emerald-300 bg-white p-2 text-xs text-gray-900 outline-none focus:ring-2 focus:ring-emerald-100"
                rows={2}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-emerald-600 px-3 py-1 text-[11px] font-bold text-white"
                  onClick={() => {
                    const v = localEditText.trim()
                    if (!v) return
                    onEdit?.(comment.id, v)
                    setIsEditing(false)
                  }}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-gray-200 px-3 py-1 text-[11px] font-bold text-gray-700"
                  onClick={() => {
                    setLocalEditText(comment.text || "")
                    setIsEditing(false)
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-700 leading-relaxed mt-1 whitespace-pre-wrap">{(comment.text ?? "").trim()}</p>
          )}

          {/* Media attachments */}
          {comment.mediaAttachments && comment.mediaAttachments.length > 0 && (
            <div className="flex gap-2 mt-2">
              {comment.mediaAttachments.map((media) => (
                <div
                  key={media.id}
                  className="w-16 h-16 rounded overflow-hidden bg-gray-100 flex items-center justify-center text-xs text-gray-500"
                >
                  {media.type === "image" && media.url ? (
                    <img src={media.url} alt="attachment" className="w-full h-full object-cover" />
                  ) : media.type === "gif" ? (
                    <span>GIF</span>
                  ) : media.type === "voice" ? (
                    <Mic size={12} />
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {/* Reactions */}
          {comment.reactions && Object.keys(comment.reactions).length > 0 && (
            <div className="mt-2">
              <CommentReactions
                reactions={comment.reactions}
                onAddReaction={(emoji) => onAddReaction?.(comment.id, emoji)}
                onRemoveReaction={(emoji) => onRemoveReaction?.(comment.id, emoji)}
              />
            </div>
          )}

          {/* Comment actions — ownership gated */}
          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500">
            <button
              type="button"
              onClick={() => onReply?.(comment.id)}
              className="hover:text-emerald-700 flex items-center gap-1 transition-colors"
            >
              <Reply size={12} />
              Reply
            </button>
            {canEditThis && !isEditing && (
              <button
                type="button"
                onClick={() => {
                  setLocalEditText(comment.text || "")
                  setIsEditing(true)
                }}
                className="hover:text-emerald-700 transition-colors"
              >
                Edit
              </button>
            )}
            {canDeleteThis && (
              <button
                type="button"
                onClick={() => onDelete?.(comment.id)}
                className="hover:text-red-600 transition-colors"
              >
                Delete
              </button>
            )}
            {onReport && !isCommentOwner && (
              <ReportChooser onSubmit={(reason) => onReport(comment.id, reason)} />
            )}
            {onPin && isPostOwner && (
              <button
                type="button"
                onClick={() => onPin(comment.id)}
                className="hover:text-emerald-700 flex items-center gap-1 transition-colors"
              >
                📌
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowActions(!showActions)}
              className="hover:text-gray-700 transition-colors ml-auto"
              aria-label="More actions"
            >
              <MoreVertical size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Nested replies — collapsible "View N replies" */}
      {replies.length > 0 && depth < 3 && (
        <div className="mt-1">
          {!expandedReplies ? (
            <button
              type="button"
              onClick={() => setExpandedReplies(true)}
              className="ml-10 mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:underline"
            >
              View {replies.length} {replies.length === 1 ? "reply" : "replies"}
            </button>
          ) : (
            <>
              <div className="mt-2 space-y-1">
                {replies.map((reply) => (
                  <EnhancedComment
                    key={reply.id}
                    comment={reply}
                    onReply={onReply}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onPin={onPin}
                    onAddReaction={onAddReaction}
                    onRemoveReaction={onRemoveReaction}
                    onReport={onReport}
                    depth={depth + 1}
                    postAuthorId={postAuthorId}
                    currentUserId={currentUserId}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setExpandedReplies(false)}
                className="ml-9 mt-1 text-[11px] font-semibold text-gray-500 hover:underline"
              >
                Hide replies
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// Post Content with mentions and hashtags highlighting
interface EnhancedPostContentProps {
  content: string
  onMentionClick?: (userId: string) => void
  onHashtagClick?: (hashtag: string) => void
  onLinkClick?: (url: string) => void
}

export function EnhancedPostContent({
  content,
  onMentionClick,
  onHashtagClick,
  onLinkClick,
}: EnhancedPostContentProps) {
  const parts = content.split(/(@\w+|#\w+|https?:\/\/\S+)/g)

  return (
    <p className="text-[15px] leading-7 text-gray-800 whitespace-pre-wrap break-words">
      {parts.map((part, idx) => {
        if (part.startsWith("@")) {
          return (
            <button
              key={idx}
              onClick={() => onMentionClick?.(part.slice(1))}
              className="text-blue-600 hover:underline"
            >
              {part}
            </button>
          )
        }
        if (part.startsWith("#")) {
          return (
            <button
              key={idx}
              onClick={() => onHashtagClick?.(part.slice(1))}
              className="text-blue-600 hover:underline"
            >
              {part}
            </button>
          )
        }
        if (part.startsWith("http")) {
          return (
            <button
              key={idx}
              onClick={() => onLinkClick?.(part)}
              className="text-blue-600 hover:underline"
            >
              {part.slice(0, 30)}...
            </button>
          )
        }
        return part
      })}
    </p>
  )
}

// Link Preview Component
interface LinkPreviewProps {
  title?: string | null
  description?: string | null
  image?: string | null
  domain: string
  url: string
  onClick?: () => void
}

export function LinkPreview({
  title,
  description,
  image,
  domain,
  url,
  onClick,
}: LinkPreviewProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 w-full overflow-hidden rounded-lg border border-gray-200 transition-colors hover:border-gray-300"
    >
      <div className="flex gap-3 p-2">
        {image && (
          <img
            src={image}
            alt=""
            className="h-16 w-16 flex-shrink-0 rounded object-cover"
          />
        )}
        <div className="min-w-0 flex-1 text-left">
          {title && (
            <p className="line-clamp-2 text-xs font-semibold text-gray-900">{title}</p>
          )}
          {description && (
            <p className="line-clamp-2 text-xs text-gray-600">{description}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">{domain || url}</p>
        </div>
      </div>
    </button>
  )
}

// Quote Repost Component
interface QuoteRepostProps {
  originalPost: Post
  quoteText: string
  onViewOriginal?: () => void
}

export function QuoteRepost({
  originalPost,
  quoteText,
  onViewOriginal,
}: QuoteRepostProps) {
  return (
    <div className="mt-2 border border-gray-200 rounded-lg p-2 bg-gray-50">
      <p className="text-xs text-gray-600 mb-2">Quoting {originalPost.authorName}</p>
      <div className="border-l-2 border-gray-300 pl-2 mb-2">
        <p className="text-xs text-gray-700 truncate">{originalPost.content}</p>
      </div>
      <p className="text-xs text-gray-800 font-semibold">{quoteText}</p>
      {onViewOriginal && (
        <button
          onClick={onViewOriginal}
          className="mt-1 text-xs text-blue-600 hover:underline"
        >
          View original
        </button>
      )}
    </div>
  )
}

// Share Menu
interface ShareMenuProps {
  postId: string
  onShare: (platform: "twitter" | "facebook" | "linkedin" | "copy") => void
  isOpen: boolean
  onClose: () => void
}

export function ShareMenu({
  postId,
  onShare,
  isOpen,
  onClose,
}: ShareMenuProps) {
  if (!isOpen) return null

  const platforms = [
    { id: "twitter", label: "Twitter", emoji: "𝕏" },
    { id: "facebook", label: "Facebook", emoji: "f" },
    { id: "linkedin", label: "LinkedIn", emoji: "in" },
    { id: "copy", label: "Copy link", emoji: "🔗" },
  ]

  return (
    <div className="absolute bottom-full right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg p-2 space-y-1 z-50">
      {platforms.map((platform) => (
        <button
          key={platform.id}
          onClick={() => {
            onShare(platform.id as "twitter" | "facebook" | "linkedin" | "copy")
            onClose()
          }}
          className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded text-xs font-semibold text-gray-900 flex items-center gap-2 transition-colors"
        >
          <span className="text-sm">{platform.emoji}</span>
          {platform.label}
        </button>
      ))}
    </div>
  )
}

// Comment Input with media and mentions support
interface CommentInputProps {
  onSubmit: (text: string, attachments?: any[]) => void
  placeholder?: string
  showMediaButtons?: boolean
  onMediaClick?: () => void
  onEmojiClick?: () => void
}

export function CommentInput({
  onSubmit,
  placeholder = "Add a comment...",
  showMediaButtons = true,
  onMediaClick,
  onEmojiClick,
}: CommentInputProps) {
  const [text, setText] = useState("")

  const handleSubmit = () => {
    if (text.trim()) {
      onSubmit(text)
      setText("")
    }
  }

  return (
    <div className="border-t border-gray-200 p-3 space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        rows={2}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.ctrlKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
            handleSubmit()
          }
        }}
      />
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {showMediaButtons && (
            <>
              <button
                onClick={onMediaClick}
                className="p-2 hover:bg-gray-100 rounded transition-colors text-gray-500 hover:text-gray-700"
                title="Add media"
              >
                <ImageIcon size={14} />
              </button>
              <button
                onClick={onMediaClick}
                className="p-2 hover:bg-gray-100 rounded transition-colors text-gray-500 hover:text-gray-700"
                title="Add voice"
              >
                <Mic size={14} />
              </button>
            </>
          )}
          {onEmojiClick && (
            <button
              onClick={onEmojiClick}
              className="p-2 hover:bg-gray-100 rounded transition-colors text-gray-500 hover:text-gray-700"
              title="Add emoji"
            >
              <Smile size={14} />
            </button>
          )}
        </div>
        <button
          onClick={handleSubmit}
          disabled={!text.trim()}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded text-xs font-bold transition-colors"
        >
          Post
        </button>
      </div>
    </div>
  )
}
