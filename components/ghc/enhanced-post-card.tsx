"use client"

import { memo, useState, useRef, useEffect } from "react"
import { Heart, MessageCircle, Share2, MoreVertical, Bookmark, Link as LinkIcon, Eye, X, ShieldCheck, Pencil, Trash2, Pin, Archive, Copy } from "lucide-react"
import type { Post, PostReaction, LinkPreview } from "@/lib/ghc-types"
import { timeAgo, generateId } from "@/lib/ghc-data"
import { LazyImage } from "./lazy-image"
import { ActionIconButton } from "./action-controls"
import { ActionSheet, ActionSheetItem, closeAllActionSheets } from "./action-sheet"
import { SpecialPostBody, detectSpecialPost } from "./feed-special-blocks"
import { resolveAvatarUrl } from "@/lib/avatar"
import { isOwnAuthor } from "@/lib/ownership"
import { ImageSkeleton } from "./skeleton-loaders"
import { ReportChooser } from "./report-chooser"

const REACTIONS: PostReaction[] = [
  { type: "like", emoji: "👍", label: "Like" },
  { type: "support", emoji: "💪", label: "Support" },
  { type: "inspire", emoji: "✨", label: "Inspire" },
  { type: "insight", emoji: "💡", label: "Insightful" },
  { type: "celebrate", emoji: "🎉", label: "Celebrate" },
  { type: "love", emoji: "❤️", label: "Love" },
]

interface EnhancedPostCardProps {
  post: Post
  isLiked: boolean
  isSaved: boolean
  isOwnPost?: boolean
  onLike: (postId: string, isDouble?: boolean) => void
  onComment: (postId: string) => void
  onShare: (postId: string) => void
  onSave: (postId: string) => void
  onDelete?: (postId: string) => void
  onEdit?: (postId: string, content: string) => void
  onPin?: (postId: string) => void
  onHide?: (postId: string) => void
  onArchive?: (postId: string) => void
  onNotInterested?: (postId: string) => void
  onMute?: (postId: string) => void
  onReport?: (postId: string, reason: string) => void
  onBlock?: (postId: string) => void
  onCopyLink?: (postId: string) => void
  onInsights?: (postId: string) => void
  onOpenMedia?: (url: string, caption?: string) => void
  onShowVisibilityReason: (postId: string) => void
  visibilityReason?: { reason: string; category: string }
  onOpenProfile?: (userId: string) => void
}

function EnhancedPostCardInner({
  post,
  isLiked,
  isSaved,
  isOwnPost = false,
  onLike,
  onComment,
  onShare,
  onSave,
  onDelete,
  onEdit,
  onPin,
  onHide,
  onArchive,
  onNotInterested,
  onMute,
  onReport,
  onBlock,
  onCopyLink,
  onInsights,
  onOpenMedia,
  onShowVisibilityReason,
  visibilityReason,
  onOpenProfile,
}: EnhancedPostCardProps) {
  const [showReactions, setShowReactions] = useState(false)
  const [lastTapTime, setLastTapTime] = useState(0)
  const [tapCount, setTapCount] = useState(0)
  const isOwn = Boolean(isOwnPost || isOwnAuthor(post.authorId, post.authorName))
  const [showMenu, setShowMenu] = useState(false)
  const [editingPost, setEditingPost] = useState(false)
  const [draftContent, setDraftContent] = useState(post.content ?? "")
  const [imageIndex, setImageIndex] = useState(0)
  const [contentExpanded, setContentExpanded] = useState(false)
  const pressTimerRef = useRef<NodeJS.Timeout>()
  const doubleTapTimerRef = useRef<NodeJS.Timeout>()
  const containerRef = useRef<HTMLDivElement>(null)

  // Double-tap to like
  const handleImageTap = () => {
    const now = Date.now()
    const timeSinceLastTap = now - lastTapTime
    setLastTapTime(now)

    if (timeSinceLastTap < 300 && tapCount > 0) {
      // Double tap detected
      if (!isLiked) {
        onLike(post.id, true)
        showDoubleTapAnimation()
      }
      setTapCount(0)
    } else {
      setTapCount(1)
      doubleTapTimerRef.current = setTimeout(() => {
        setTapCount(0)
      }, 300)
    }
  }

  const showDoubleTapAnimation = () => {
    // Visual feedback for double tap
    if (containerRef.current) {
      const el = document.createElement("div")
      el.textContent = "❤️"
      el.style.position = "fixed"
      el.style.fontSize = "48px"
      el.style.pointerEvents = "none"
      el.style.animation = "float-up 0.8s ease-out forwards"
      const rect = containerRef.current.getBoundingClientRect()
      el.style.left = rect.left + rect.width / 2 - 24 + "px"
      el.style.top = rect.top + rect.height / 2 - 24 + "px"
      document.body.appendChild(el)
      setTimeout(() => el.remove(), 800)
    }
  }

  // Long-press for quick reactions
  const handleLongPress = () => {
    pressTimerRef.current = setTimeout(() => {
      setShowReactions(true)
    }, 500)
  }

  const handlePressEnd = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
    }
  }

  const handleQuickReaction = (reaction: PostReaction) => {
    // Trigger reaction animation and haptic feedback
    if ("vibrate" in navigator) {
      navigator.vibrate(100)
    }
    setShowReactions(false)
    // In production, would send reaction to backend
  }

  // Media gallery navigation
  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation()
    setImageIndex(Math.max(0, imageIndex - 1))
  }

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation()
    setImageIndex(Math.min(post.images.length - 1, imageIndex + 1))
  }

  // Parse hashtags and mentions from content
  const parseContent = (content: string | null | undefined) => {
    const safeContent = (content ?? "")
    const parts: (string | { type: "hashtag" | "mention"; value: string })[] = []
    let lastIndex = 0

    const regex = /(#\w+)|(@\w+)/g
    let match

    while ((match = regex.exec(safeContent)) !== null) {
      if (match.index > lastIndex) {
        parts.push(safeContent.slice(lastIndex, match.index))
      }
      if (match[0].startsWith("#")) {
        parts.push({ type: "hashtag", value: match[0] })
      } else {
        parts.push({ type: "mention", value: match[0] })
      }
      lastIndex = regex.lastIndex
    }

    if (lastIndex < safeContent.length) {
      parts.push(safeContent.slice(lastIndex))
    }

    return parts
  }

  const contentParts = parseContent(post.content)

  return (
    <div
      ref={containerRef}
      className="overflow-hidden rounded-2xl border border-border/70 bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2 flex-1">
          <button type="button" onClick={() => onOpenProfile?.(post.authorId)} className="relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" aria-label={`Open ${post.authorName}'s profile`}>
            <LazyImage
              src={resolveAvatarUrl(post.authorPhoto, { seed: post.authorId || post.authorName || "member", size: 96 })}
              alt={post.authorName}
              className="h-11 w-11 rounded-full object-cover bg-muted"
            />
            {(post as Post & { authorOnline?: boolean }).authorOnline && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" title="Online now" aria-label="Online now" />}
            {(post as Post & { authorVerified?: boolean }).authorVerified && <span className="absolute -right-1 -top-1 rounded-full bg-white p-0.5 text-blue-600 shadow-sm" title="Verified profile" aria-label="Verified profile"><ShieldCheck size={11} /></span>}
          </button>
          <div className="min-w-0 flex-1">
            <button type="button" onClick={() => onOpenProfile?.(post.authorId)} className="block max-w-full truncate text-left text-sm font-bold text-foreground hover:text-primary">{post.authorName}</button>
            <div className="flex flex-wrap items-center gap-1">
              {(() => {
                const p = post as Post & { authorProfession?: string; authorTitle?: string; communityName?: string }
                const ctx = p.authorProfession || p.authorTitle || p.communityName
                return ctx ? <span className="truncate text-[10px] font-medium text-muted-foreground">{ctx}</span> : null
              })()}
              <p className="text-xs text-muted-foreground">
                {timeAgo(post.createdAt)}
                {(post.isEdited || post.editedAt) && (
                  <span className="ml-1 text-[10px] font-semibold">· Edited</span>
                )}
              </p>
              {(() => {
                const hasVideo = Boolean(post.video)
                const realImages = (post.images || []).filter((u) => typeof u === "string" && u.trim() && !u.includes("placeholder"))
                const hasImage = realImages.length > 0
                const special = detectSpecialPost(post.content)
                const isPoll = Boolean((post as Post & { poll?: unknown }).poll) || special === "poll"
                const isChallenge = special === "challenge"
                const isListing = Boolean((post as Post & { listingId?: string }).listingId)
                const label = isListing ? "Listing" : isPoll ? "Poll" : isChallenge ? "Challenge" : hasVideo ? "Video" : hasImage ? "Photo" : null
                if (!label) return null
                return (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </span>
                )
              })()}
              {post.isScheduled && <span className="text-[10px] bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded">Scheduled</span>}
              {post.isDraft && <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Draft</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {visibilityReason && (
            <button
              type="button"
              onClick={() => onShowVisibilityReason(post.id)}
              className="max-w-[9rem] truncate rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 transition hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200"
              title={visibilityReason.reason || "Why am I seeing this?"}
              aria-label={`Why am I seeing this: ${visibilityReason.reason}`}
            >
              {(visibilityReason as { shortLabel?: string }).shortLabel || visibilityReason.reason?.split(" ")[0] || "Why"}
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              if (!showMenu) closeAllActionSheets()
              setShowMenu(!showMenu)
            }}
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground active:scale-90"
            aria-label="Post options"
            aria-expanded={showMenu}
          >
            <MoreVertical size={16} />
          </button>
        </div>
      </div>

      <ActionSheet
        open={showMenu}
        onClose={() => setShowMenu(false)}
        title={isOwn ? "Your post" : "Post options"}
      >
        {isOwn && onEdit && (
          <ActionSheetItem icon={<Pencil size={16} />} onClick={() => { setDraftContent(post.content ?? ""); setEditingPost(true); setShowMenu(false) }}>
            Edit post
          </ActionSheetItem>
        )}
        {isOwn && onPin && (
          <ActionSheetItem icon={<Pin size={16} />} onClick={() => { onPin(post.id); setShowMenu(false) }}>
            Pin post
          </ActionSheetItem>
        )}
        {isOwn && onInsights && (
          <ActionSheetItem icon={<Eye size={16} />} onClick={() => { onInsights(post.id); setShowMenu(false) }}>
            Insights
          </ActionSheetItem>
        )}
        {isOwn && onArchive && (
          <ActionSheetItem icon={<Archive size={16} />} onClick={() => { onArchive(post.id); setShowMenu(false) }}>
            Archive
          </ActionSheetItem>
        )}
        {isOwn && onDelete && (
          <ActionSheetItem destructive onClick={() => { if (window.confirm("Delete this post? This cannot be undone.")) onDelete(post.id); setShowMenu(false) }}>
            Delete post
          </ActionSheetItem>
        )}
        {onSave && (
          <ActionSheetItem icon={<Bookmark size={16} />} onClick={() => { onSave(post.id); setShowMenu(false) }}>
            {isSaved ? "Remove from saved" : "Save post"}
          </ActionSheetItem>
        )}
        {onCopyLink && (
          <ActionSheetItem icon={<LinkIcon size={16} />} onClick={() => { onCopyLink(post.id); setShowMenu(false) }}>
            Copy link
          </ActionSheetItem>
        )}
        {!isOwn && onHide && (
          <ActionSheetItem onClick={() => { onHide(post.id); setShowMenu(false) }}>Hide post</ActionSheetItem>
        )}
        {!isOwn && onNotInterested && (
          <ActionSheetItem onClick={() => { onNotInterested(post.id); setShowMenu(false) }}>Not interested</ActionSheetItem>
        )}
        {!isOwn && onMute && (
          <ActionSheetItem onClick={() => { onMute(post.id); setShowMenu(false) }}>Mute author</ActionSheetItem>
        )}
        {!isOwn && onReport && (
          <div className="px-2 py-1">
            <ReportChooser label="Report post" targetType="post" targetId={post.id} onSubmit={(reason) => { onReport(post.id, reason); setShowMenu(false) }} />
          </div>
        )}
        {!isOwn && onBlock && (
          <ActionSheetItem destructive onClick={() => { onBlock(post.id); setShowMenu(false) }}>Block author</ActionSheetItem>
        )}
      </ActionSheet>

      {editingPost && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Edit post"><div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"><h2 className="text-lg font-bold text-gray-900">Edit Post</h2><textarea autoFocus value={draftContent} onChange={(event) => setDraftContent(event.target.value)} className="mt-4 min-h-32 w-full resize-y rounded-xl border border-gray-200 p-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" maxLength={5000} /><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setEditingPost(false)} className="rounded-xl px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100">Cancel</button><button type="button" disabled={!draftContent.trim()} onClick={() => { onEdit?.(post.id, draftContent.trim()); setEditingPost(false) }} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">Save changes</button></div></div></div>}

      {/* Content with rich formatting */}
      <div className="p-4">
        {detectSpecialPost(post.content) ? (
          <SpecialPostBody content={post.content || ""} />
        ) : (
          <>
            <div
              className={`mb-1 break-words text-[15px] sm:text-base leading-relaxed text-foreground ${
                !contentExpanded && (post.content?.length || 0) > 220 ? "line-clamp-5" : ""
              }`}
            >
              {contentParts.map((part, idx) => {
                if (typeof part === "string") {
                  return <span key={idx}>{part}</span>
                }
                if (part.type === "hashtag") {
                  return (
                    <button
                      key={idx}
                      type="button"
                      className="text-emerald-700 hover:underline dark:text-emerald-400"
                    >
                      {part.value}
                    </button>
                  )
                }
                if (part.type === "mention") {
                  return (
                    <button
                      key={idx}
                      type="button"
                      className="text-emerald-700 hover:underline dark:text-emerald-400"
                      onClick={() => onOpenProfile?.(String(part.value || "").replace(/^@/, ""))}
                    >
                      {part.value}
                    </button>
                  )
                }
                return null
              })}
            </div>
            {(post.content?.length || 0) > 220 && (
              <button
                type="button"
                onClick={() => setContentExpanded((v) => !v)}
                className="mb-3 text-[13px] font-bold text-emerald-700 hover:text-emerald-800"
              >
                {contentExpanded ? "Show less" : "more"}
              </button>
            )}
          </>
        )}

        {/* Link preview */}
        {post.linkPreview && (
          <a
            href={post.linkPreview.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block mb-2 border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 transition"
          >
            <div className="flex gap-2 p-2 bg-gray-50 hover:bg-gray-100">
              {post.linkPreview.image && (
                <LazyImage
                  src={post.linkPreview.image}
                  alt={post.linkPreview.title || "Link"}
                  className="h-12 w-12 rounded-xl object-cover"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate">{post.linkPreview.title}</p>
                <p className="text-xs text-gray-500 truncate">{post.linkPreview.domain}</p>
              </div>
            </div>
          </a>
        )}

        {/* Media gallery with improved viewing */}
        {Array.isArray(post.images) && post.images.filter((u) => typeof u === "string" && u.trim() && !u.includes("placeholder")).length > 0 && (
          <div
            className="relative mb-2 aspect-[4/5] max-h-[28rem] w-full overflow-hidden rounded-xl sm:aspect-video bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 group cursor-pointer"
            onClick={handleImageTap}
            onMouseDown={handleLongPress}
            onMouseUp={handlePressEnd}
            onTouchStart={handleLongPress}
            onTouchEnd={handlePressEnd}
          >
            <LazyImage
              src={(post.images.filter((u) => typeof u === "string" && u.trim() && !u.includes("placeholder"))[Math.min(imageIndex, post.images.length - 1)] || post.images[0])}
              alt={`Post image ${imageIndex + 1}`}
              className="absolute inset-0 h-full w-full object-cover"
            />

            {/* Navigation arrows */}
            {post.images.length > 1 && (
              <>
                <button
                  onClick={handlePrevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ←
                </button>
                <button
                  onClick={handleNextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  →
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white px-2 py-1 rounded-full text-xs">
                  {imageIndex + 1} / {post.images.length}
                </div>
              </>
            )}

            {/* Quick reactions overlay */}
            {showReactions && (
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center gap-2 z-40">
                {REACTIONS.map((reaction) => (
                  <button
                    key={reaction.type}
                    onClick={() => handleQuickReaction(reaction)}
                    className="w-12 h-12 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-2xl transform hover:scale-125 transition-transform"
                    title={reaction.label}
                  >
                    {reaction.emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quote repost */}
        {post.quoteOf && (
          <div className="mb-2 p-2 border border-gray-300 rounded-lg bg-gray-50 text-xs text-gray-600">
            <p className="font-semibold mb-1">Quoted post</p>
            <p className="text-gray-600">Original post content preview...</p>
          </div>
        )}
      </div>

      {/* Engagement stats */}
      {post.engagement && (
        <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 space-y-1">
          <div className="flex justify-between">
            <span>{post.engagement.views} views</span>
            <span>{post.engagement.saves} saved</span>
          </div>
        </div>
      )}

      {/* Primary actions — equal weight, 44px targets, clear active states */}
      <div className="grid grid-cols-4 items-center border-t border-border/60 bg-card/95 px-0.5 py-1.5" role="toolbar" aria-label="Post actions">
        <ActionIconButton
          label={isLiked ? "Unlike" : "Like"}
          tone="rose"
          active={isLiked}
          count={Math.max(0, Number(post.engagement?.likes ?? post.likes ?? 0) + (isLiked ? 1 : 0))}
          icon={<Heart size={20} fill={isLiked ? "currentColor" : "none"} aria-hidden />}
          onClick={() => onLike(post.id)}
        />
        <ActionIconButton
          label="Comment"
          count={Array.isArray(post.comments) ? post.comments.length : 0}
          icon={<MessageCircle size={20} aria-hidden />}
          onClick={() => onComment(post.id)}
        />
        <ActionIconButton
          label={isSaved ? "Unsave" : "Save"}
          tone="amber"
          active={isSaved}
          icon={<Bookmark size={20} fill={isSaved ? "currentColor" : "none"} aria-hidden />}
          onClick={() => onSave(post.id)}
        />
        <ActionIconButton
          label="Share"
          icon={<Share2 size={20} aria-hidden />}
          onClick={() => onShare(post.id)}
        />
      </div>
    </div>
  )
}

export const EnhancedPostCard = memo(EnhancedPostCardInner)

// Visibility reason tooltip
/** Compact contribution signal for quality-first ranking transparency */
export function ContributionHint({ post }: { post: Post }) {
  const comments = post.engagement?.comments ?? post.comments?.length ?? 0
  const saves = post.engagement?.saves ?? 0
  if (comments + saves < 3) return null
  return (
    <p className="gh-type-meta px-1 text-muted-foreground">
      Quality signals: {comments > 0 ? `${comments} comments` : ""}
      {comments > 0 && saves > 0 ? " · " : ""}
      {saves > 0 ? `${saves} saves` : ""}
    </p>
  )
}

export function VisibilityReasonTooltip({
  reason,
  onClose,
}: {
  reason: { reason: string; category: string }
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50">
      <div className="w-full bg-white rounded-t-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Why am I seeing this?</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-gray-700">{reason.reason}</p>
          <div className="flex gap-2">
            <button className="flex-1 py-2 px-3 bg-gray-100 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-200">
              See less like this
            </button>
            <button className="flex-1 py-2 px-3 bg-blue-100 rounded-lg text-sm font-semibold text-blue-700 hover:bg-blue-200">
              Learn more
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
