"use client"

import { memo, useState, useRef, useEffect } from "react"
import {
  MessageCircle,
  Share2,
  ThumbsUp,
  ThumbsDown,
  MoreVertical,
  Bookmark,
  Link as LinkIcon,
  Eye,
  X,
  ShieldCheck,
  Pencil,
  Trash2,
  Pin,
  Archive,
  Copy,
  ImagePlus,
  Loader2,
} from "lucide-react"
import { SafeTextWithLinks } from "./safe-external-links"
import { absoluteTimeLabel, formatRelativeTime } from "@/lib/product/essentials"
import type { Post, PostEditMedia, PostReaction, LinkPreview } from "@/lib/ghc-types"
import { timeAgo, generateId } from "@/lib/ghc-data"
import { LazyImage } from "./lazy-image"
import { PollInline, resolvePostPoll } from "./poll-inline"
import { ChallengeInline, resolvePostChallenge } from "./challenge-inline"
import { PostContentText } from "./post-content-text"
import { DurableVideo } from "./durable-video"
import { broadcastPostEngagement } from "@/lib/engagement/post-engagement"
import { isDurableMediaUrl } from "@/lib/media/durable-url"
import { downloadMedia } from "@/lib/media/download-media"
import { uploadDurableMedia } from "@/lib/media/upload-client"
import { ActionSheet, ActionSheetItem, closeAllActionSheets } from "./action-sheet"
import { SpecialPostBody, detectSpecialPost } from "./feed-special-blocks"
import { resolveAvatarUrl } from "@/lib/avatar"
import { AuthorRepChip } from "./author-rep-chip"
import { authorReputationFromPost } from "@/lib/reputation/display"
import { isOwnAuthor } from "@/lib/ownership"
import { ImageSkeleton } from "./skeleton-loaders"
import { ReportChooser } from "./report-chooser"
import { EngagementRosterSheet, type RosterKind } from "./engagement-roster-sheet"
import { socialRecordAttention, socialSetCuration } from "@/lib/social/client"
import { shouldSendAttention } from "@/lib/social/attention-client"
import { PostRewardPanel } from "@/components/ghc/post-reward/post-reward-panel"

const REACTIONS: PostReaction[] = [
  { type: "support", emoji: "💪", label: "Support" },
  { type: "inspire", emoji: "✨", label: "Inspire" },
  { type: "insight", emoji: "💡", label: "Insightful" },
  { type: "celebrate", emoji: "🎉", label: "Celebrate" },
  { type: "love", emoji: "❤️", label: "Love" },
  { type: "sad", emoji: "😢", label: "Concerned" },
]

interface EnhancedPostCardProps {
  post: Post
  /** @deprecated Post likes are not used for matching; optional legacy signal */
  isLiked?: boolean
  isSaved: boolean
  isOwnPost?: boolean
  /** @deprecated Prefer profile Like/Pass; optional legacy */
  onLike?: (postId: string, isDouble?: boolean) => void
  onReact?: (postId: string, reaction: PostReaction["type"]) => void
  onComment: (postId: string) => void
  onShare: (postId: string) => void
  onSave: (postId: string) => void
  onDelete?: (postId: string) => void
  onEdit?: (postId: string, content: string, media?: PostEditMedia) => void
  onPin?: (postId: string) => void
  onHide?: (postId: string) => void
  onArchive?: (postId: string) => void
  onNotInterested?: (postId: string) => void
  onMute?: (postId: string) => void
  onReport?: (postId: string, reason: string) => void
  onBlock?: (postId: string) => void
  onCopyLink?: (postId: string) => void
  onInsights?: (postId: string) => void
  onOpenPost?: (postId: string) => void
  /** Open clean full-screen media viewer (preferred over opening the post sheet). */
  onOpenMedia?: (payload: {
    urls: Array<string | { url: string; kind?: "image" | "video"; alt?: string }>
    index?: number
    caption?: string
    kind?: "image" | "video"
  }) => void
  onShowVisibilityReason: (postId: string) => void
  visibilityReason?: { reason: string; category: string }
  onOpenProfile?: (userId: string) => void
}

function EnhancedPostCardInner({
  post,
  isLiked = false,
  isSaved,
  isOwnPost = false,
  onLike,
  onReact,
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
  onOpenPost,
  onOpenMedia,
  onShowVisibilityReason,
  visibilityReason,
  onOpenProfile,
}: EnhancedPostCardProps) {
  const [showReactions, setShowReactions] = useState(false)
  const [curationReactionKind, setCurationReactionKind] = useState<"positive" | "negative">("positive")
  const isOwn = Boolean(isOwnPost || isOwnAuthor(post.authorId, post.authorName))
  const displayAuthor = (() => {
    const raw = String(post.authorName || "").trim()
    if (raw && raw.toLowerCase() !== "user" && raw.toLowerCase() !== "unknown") return raw
    return isOwn ? "You" : "Member"
  })()
  const realImages = (Array.isArray(post.images) ? post.images : []).filter((u): u is string => {
    if (typeof u !== "string" || !u.trim()) return false
    // Allow small inline data images for offline/emergency; durable URLs otherwise
    if (u.startsWith("data:image/") && u.length < 180_000 && !u.includes("svg")) return true
    return isDurableMediaUrl(u)
  })
  const [showMenu, setShowMenu] = useState(false)
  const [editingPost, setEditingPost] = useState(false)
  const [draftContent, setDraftContent] = useState(post.content ?? "")
  const [draftImages, setDraftImages] = useState<string[]>(() =>
    Array.isArray(post.images) ? post.images.filter((u) => typeof u === "string" && isDurableMediaUrl(u)) : [],
  )
  const [draftVideo, setDraftVideo] = useState<string | null>(
    typeof post.video === "string" && isDurableMediaUrl(post.video) ? post.video : null,
  )
  const [editMediaBusy, setEditMediaBusy] = useState(false)
  const editImageInputRef = useRef<HTMLInputElement>(null)
  const [imageIndex, setImageIndex] = useState<number>(0)
  const [mediaToolsOpen, setMediaToolsOpen] = useState(false)
  const mediaLongPressRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mediaLongPressFiredRef = useRef(false)
  const [contentExpanded, setContentExpanded] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const galleryIdentity = realImages.join("\u001f")
  useEffect(() => {
    setImageIndex(0)
    setShowReactions(false)
  }, [post.id, galleryIdentity])
  const seedChoiceRaw = String(
    (post as { viewerCurationChoice?: string }).viewerCurationChoice || ""
  ).toLowerCase()
  const seedChoice: "upvote" | "downvote" | "neutral" =
    seedChoiceRaw === "upvote" || seedChoiceRaw === "downvote" ? seedChoiceRaw : "neutral"
  const [curationChoice, setCurationChoice] = useState<"upvote" | "downvote" | "neutral">(seedChoice)
  const [rosterOpen, setRosterOpen] = useState(false)
  const [rosterKind, setRosterKind] = useState<RosterKind>("likes")
  const openRoster = (kind: RosterKind) => {
    setRosterKind(kind)
    setRosterOpen(true)
  }
  const seedUp = Number(
    (post as { upvoteCount?: number; upvote_count?: number }).upvoteCount ??
      (post as { upvote_count?: number }).upvote_count ??
      0
  )
  const seedDown = Number(
    (post as { downvoteCount?: number; downvote_count?: number }).downvoteCount ??
      (post as { downvote_count?: number }).downvote_count ??
      0
  )
  const [upvoteCount, setUpvoteCount] = useState(() => (Number.isFinite(seedUp) ? Math.max(0, seedUp) : 0))
  const [downvoteCount, setDownvoteCount] = useState(() =>
    Number.isFinite(seedDown) ? Math.max(0, seedDown) : 0
  )
  const [curationBusy, setCurationBusy] = useState(false)
  const [rewardPercentage, setRewardPercentage] = useState(100)
  const lastCurationAtRef = useRef(0)
  const curationLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const curationLongPressTriggeredRef = useRef(false)
  useEffect(() => () => {
    if (curationLongPressTimerRef.current) clearTimeout(curationLongPressTimerRef.current)
  }, [])
  const propUp = (post as { upvoteCount?: number; upvote_count?: number }).upvoteCount ?? (post as { upvote_count?: number }).upvote_count
  const propDown = (post as { downvoteCount?: number; downvote_count?: number }).downvoteCount ?? (post as { downvote_count?: number }).downvote_count
  const propViewerChoice = String((post as { viewerCurationChoice?: string }).viewerCurationChoice || "").toLowerCase()
  useEffect(() => {
    if (typeof propUp === "number" && Number.isFinite(propUp)) setUpvoteCount(Math.max(0, propUp))
    if (typeof propDown === "number" && Number.isFinite(propDown)) setDownvoteCount(Math.max(0, propDown))
    if (propViewerChoice === "upvote" || propViewerChoice === "downvote") setCurationChoice(propViewerChoice)
  }, [post.id, propUp, propDown, propViewerChoice])
  const visibleCommentCount = Math.max(0, Number(post.engagement?.comments ?? post.comments?.length ?? 0) || 0)
  const visibleShareCount = Math.max(0, Number(post.engagement?.shares ?? post.shares ?? 0) || 0)
  const visibleReactionEntries = Object.entries(post.reactionCounts || {})
    .filter(([type, count]) => type !== "like" && Number(count) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
  const reactionEmoji: Record<string, string> = { like: "❤️", love: "😍", support: "💪", inspire: "✨", insight: "💡", celebrate: "🎉", laugh: "😂", fire: "🔥", clap: "👏", wow: "😮", sad: "😢" }

  // Community review status is loaded only on its dedicated detail surface.
  // Fetching it once per feed card caused an N+1 request storm and the value
  // was not rendered here; keep feed cards lean and defer that request.

  // Deliberate curation requires a sustained press. A normal tap only opens
  // the compact reaction picker and can never move GHC.
  const startCurationLongPress = (choice: "upvote" | "downvote") => {
    if (curationLongPressTimerRef.current) clearTimeout(curationLongPressTimerRef.current)
    curationLongPressTriggeredRef.current = false
    curationLongPressTimerRef.current = setTimeout(() => {
      curationLongPressTimerRef.current = null
      curationLongPressTriggeredRef.current = true
      void handleCuration(choice)
    }, 1200)
  }

  const endCurationLongPress = (cancelled = false) => {
    if (curationLongPressTimerRef.current) {
      clearTimeout(curationLongPressTimerRef.current)
      curationLongPressTimerRef.current = null
    }
    if (cancelled) curationLongPressTriggeredRef.current = false
  }

  const handleCuration = async (choice: "upvote" | "downvote") => {
    if (curationBusy) return
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      try { window.dispatchEvent(new CustomEvent("ghc:toast", { detail: { message: "You are offline — vote when reconnected", type: "info" } })) } catch { /* */ }
      return
    }
    if (Date.now() - lastCurationAtRef.current < 400) return
    lastCurationAtRef.current = Date.now()
    setCurationBusy(true)
    try {
      const res = await socialSetCuration(post.id, choice, rewardPercentage)
      if (!res.ok) {
        try {
          window.dispatchEvent(new CustomEvent("ghc:toast", {
            detail: { message: res.reason === "NETWORK" || res.error === "NETWORK" ? "Could not vote — check connection" : (res.error || "Could not record vote"), type: "error" },
          }))
        } catch { /* */ }
        return
      }
      if (res.durable === false) {
        try {
          window.dispatchEvent(new CustomEvent("ghc:toast", {
            detail: { message: "Vote not visible to others yet — server not confirmed", type: "error" },
          }))
        } catch { /* */ }
        return
      }
      if (res.ok && res.choice) {
        setCurationChoice(res.choice as "upvote" | "downvote" | "neutral")
        const nextUp = typeof res.upvoteCount === "number" ? res.upvoteCount : upvoteCount
        const nextDown = typeof res.downvoteCount === "number" ? res.downvoteCount : downvoteCount
        if (typeof res.upvoteCount === "number") setUpvoteCount(res.upvoteCount)
        if (typeof res.downvoteCount === "number") setDownvoteCount(res.downvoteCount)
        const redistributed = Boolean(res.redistribute?.credited) && Number(res.redistribute?.amount) > 0
        if (redistributed) {
          try {
            window.dispatchEvent(new CustomEvent("ghc:wallet-refresh"))
            window.dispatchEvent(new CustomEvent("ghc:content-reward-updated", { detail: { postId: post.id } }))
            window.dispatchEvent(new CustomEvent("ghc:toast", { detail: { message: `Vote saved and ${Number(res.redistribute?.amount).toFixed(4).replace(/\.?0+$/, "")} GHC contributed to this creator`, type: "success" } }))
          } catch { /* */ }
        } else if (res.reward?.credited && Number(res.reward.amount) > 0) {
          try {
            window.dispatchEvent(new CustomEvent("ghc:content-reward-updated", { detail: { postId: post.id } }))
            window.dispatchEvent(new CustomEvent("ghc:wallet-refresh"))
            window.dispatchEvent(new CustomEvent("ghc:toast", { detail: { message: `Vote saved and ${Number(res.reward.amount).toFixed(4).replace(/\.?0+$/, "")} GHC credited`, type: "success" } }))
          } catch { /* */ }
        } else {
          // A curation vote is a quality signal. GHC movement is a separate,
          // balance-funded redistribution and is never invented by the client.
          const redReason = String(res.redistribute?.reason || "").toUpperCase()
          const rewardReason = String(res.reward?.reason || "").toUpperCase()
          const required = Number(res.redistribute?.requiredBalance || 0)
          const available = Number(res.redistribute?.availableBalanceAfter || 0)
          const message = redReason.includes("INSUFFICIENT")
            ? required > 0
              ? `Vote saved. Your wallet needs ${required.toFixed(4).replace(/\.?0+$/, "")} GHC to fund this contribution.`
              : "Vote saved. Fund your GHC wallet to make a curation contribution."
            : rewardReason.includes("DISABLED") || rewardReason.includes("DAILY_CLAIM_ONLY")
              ? "Vote saved. Curation reward issuance is gated; no GHC was created."
              : "Vote saved. No GHC movement was recorded for this vote."
          try { window.dispatchEvent(new CustomEvent("ghc:toast", { detail: { message, type: "success" } })) } catch { /* */ }
        }
        broadcastPostEngagement({
          postId: post.id,
          kind: "curation",
          choice: res.choice as "upvote" | "downvote" | "neutral",
          upvoteCount: nextUp,
          downvoteCount: nextDown,
        })
        // Keep curation analytics synchronized even when this vote produces no GHC movement.
        try { window.dispatchEvent(new CustomEvent("ghc:content-reward-updated", { detail: { postId: post.id, source: "curation-vote" } })) } catch { /* fail-soft */ }
      }
    } finally {
      setCurationBusy(false)
    }
  }

  const visibleSinceRef = useRef<number | null>(null)
  const qualifiedSentRef = useRef(false)

  // Phase 2.4 — view / qualified_view (fail-soft, server authoritative)
  useEffect(() => {
    const postId = post.id
    visibleSinceRef.current = null
    qualifiedSentRef.current = false
    const el = containerRef.current
    if (!el || typeof IntersectionObserver === "undefined") return
    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) return
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          if (shouldSendAttention(postId, "view")) {
            void socialRecordAttention(postId, "view")
          }
          if (visibleSinceRef.current == null) {
            visibleSinceRef.current = Date.now()
          }
        } else if (visibleSinceRef.current != null && !qualifiedSentRef.current) {
          const dwell = Date.now() - visibleSinceRef.current
          visibleSinceRef.current = null
          if (dwell >= 3000 && shouldSendAttention(postId, "qualified_view")) {
            qualifiedSentRef.current = true
            void socialRecordAttention(postId, "qualified_view", { dwellMs: dwell })
          }
        }
      },
      { threshold: [0, 0.5, 1] }
    )
    obs.observe(el)
    return () => {
      obs.disconnect()
      // flush qualified on unmount if dwell met
      if (visibleSinceRef.current != null && !qualifiedSentRef.current) {
        const dwell = Date.now() - visibleSinceRef.current
        if (dwell >= 3000 && shouldSendAttention(postId, "qualified_view")) {
          void socialRecordAttention(postId, "qualified_view", { dwellMs: dwell })
        }
      }
    }
  }, [post.id])

  // Tap media → clean full-screen lightbox when available; never jam comments into the media view.
    const clearMediaLongPress = () => {
    if (mediaLongPressRef.current) {
      clearTimeout(mediaLongPressRef.current)
      mediaLongPressRef.current = null
    }
  }

  const startMediaLongPress = () => {
    clearMediaLongPress()
    mediaLongPressFiredRef.current = false
    mediaLongPressRef.current = setTimeout(() => {
      mediaLongPressRef.current = null
      mediaLongPressFiredRef.current = true
      setMediaToolsOpen(true)
      try {
        if ("vibrate" in navigator) navigator.vibrate(10)
      } catch {
        /* */
      }
    }, 480)
  }

  const endMediaLongPress = () => {
    clearMediaLongPress()
  }

  const handleDownloadCurrentMedia = async () => {
    const src = realImages[Math.min(imageIndex, Math.max(0, realImages.length - 1))] || realImages[0]
    if (!src) return
    setMediaToolsOpen(false)
    await downloadMedia(src, { kind: "image" })
  }

  const handleImageTap = (event?: React.MouseEvent) => {
    const target = event?.target as HTMLElement | null
    if (target?.closest("button, a, [role=button]")) return
    event?.stopPropagation()
    if (mediaLongPressFiredRef.current) {
      mediaLongPressFiredRef.current = false
      return
    }
    if (onOpenMedia && realImages.length > 0) {
      onOpenMedia({
        urls: realImages.map((u) => ({ url: u, kind: "image" as const })),
        index: imageIndex,
        caption: post.content?.slice(0, 120) || undefined,
        kind: "image",
      })
      return
    }
    onOpenPost?.(post.id)
  }

  const handleVideoTap = (event?: React.MouseEvent) => {
    event?.stopPropagation()
    const v = typeof post.video === "string" && isDurableMediaUrl(post.video) ? post.video : null
    if (onOpenMedia && v) {
      onOpenMedia({
        urls: [{ url: v, kind: "video" as const }],
        index: 0,
        caption: displayAuthor ? `Video · ${displayAuthor}` : "Video",
        kind: "video",
      })
      return
    }
    onOpenPost?.(post.id)
  }

  const handleQuickReaction = (reaction: PostReaction) => {
    if ("vibrate" in navigator) {
      try {
        navigator.vibrate(100)
      } catch {
        /* ignore */
      }
    }
    setShowReactions(false)
    // Post cards do not expose Like; Likes belong to profile/account cards.
    if (reaction.type === "like") return
    if (onReact) {
      onReact(post.id, reaction.type)
    }
  }

  // Media gallery navigation
  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation()
    setImageIndex((current) => Math.max(0, current - 1))
  }

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation()
    setImageIndex((current) => Math.min(realImages.length - 1, current + 1))
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
      data-post-id={post.id} role="article" tabIndex={onOpenPost ? 0 : undefined} aria-busy={curationBusy || undefined} aria-label={post.authorName ? `Post by ${displayAuthor}` : "Post"} className="gh-post-card mb-3 max-w-full cursor-pointer overflow-x-hidden overflow-hidden bg-card text-card-foreground focus-visible:outline-none"
      onClick={(event) => {
        const target = event.target as HTMLElement | null
        if (target?.closest("button, a, input, textarea, select, video, [role=button], [data-post-no-open]")) return
        onOpenPost?.(post.id)
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || !onOpenPost) return
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpenPost(post.id)
        }
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 pb-2 pt-3 sm:px-4 sm:pt-4">
        <div className="flex flex-1 items-center gap-2.5">
          <button type="button" onClick={() => onOpenProfile?.(post.authorId)} className="relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={`Open ${displayAuthor}'s profile`}>
            <LazyImage
              src={resolveAvatarUrl(post.authorPhoto, { seed: post.authorId || post.authorName || "member", size: 96 })}
              alt={displayAuthor}
              className="h-11 w-11 rounded-full object-cover bg-muted ring-2 ring-background shadow-sm"
            />
            {(post as Post & { authorOnline?: boolean }).authorOnline && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500" title="Online now" aria-label="Online now" />}
            {(post as Post & { authorVerified?: boolean }).authorVerified && <span className="absolute -right-1 -top-1 rounded-full bg-card p-0.5 text-sky-600 shadow-sm ring-1 ring-border/40" title="Verified profile" aria-label="Verified profile"><ShieldCheck size={11} /></span>}
          </button>
          <div className="min-w-0 flex-1">
            <button type="button" onClick={() => onOpenProfile?.(post.authorId)} className="block max-w-full truncate text-left text-sm font-bold text-foreground hover:text-primary">{displayAuthor}</button>
            <div className="flex flex-wrap items-center gap-1">
              <AuthorRepChip data={authorReputationFromPost(post as never)} />
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
                const realImages = (post.images || []).filter((u) => typeof u === "string" && isDurableMediaUrl(u))
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
          <ActionSheetItem icon={<Pencil size={16} />} onClick={() => {
              setDraftContent(post.content ?? "")
              setDraftImages(
                Array.isArray(post.images)
                  ? post.images.filter((u) => typeof u === "string" && isDurableMediaUrl(u))
                  : [],
              )
              setDraftVideo(
                typeof post.video === "string" && isDurableMediaUrl(post.video) ? post.video : null,
              )
              setEditingPost(true)
              setShowMenu(false)
            }}>
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

      {editingPost && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Edit post">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[1.25rem] border border-border/50 bg-card p-5 shadow-2xl">
            <h2 className="text-lg font-bold text-foreground">Edit post</h2>
            <textarea
              autoFocus
              value={draftContent}
              onChange={(event) => setDraftContent(event.target.value)}
              className="mt-4 min-h-28 w-full resize-y rounded-xl border border-border/70 bg-background p-3 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
              maxLength={5000}
              placeholder="Update your post…"
            />
            <div className="mt-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Media</p>
              {draftImages.length > 0 ? (
                <div className="mb-2 flex flex-wrap gap-2">
                  {draftImages.map((url) => (
                    <div key={url} className="relative h-16 w-16 overflow-hidden rounded-lg ring-1 ring-border/60">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img loading="lazy" src={url} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
                        aria-label="Remove image"
                        onClick={() => setDraftImages((prev) => prev.filter((u) => u !== url))}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              {draftVideo ? (
                <div className="mb-2 flex items-center gap-2 rounded-xl border border-border/50 bg-muted/30 px-3 py-2 text-[12px]">
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">Video attached</span>
                  <button type="button" className="font-semibold text-rose-600" onClick={() => setDraftVideo(null)}>
                    Remove
                  </button>
                </div>
              ) : null}
              <input
                ref={editImageInputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                multiple
                onChange={(e) => {
                  const files = e.target.files
                  e.target.value = ""
                  if (!files?.length) return
                  void (async () => {
                    setEditMediaBusy(true)
                    try {
                      for (const file of Array.from(files).slice(0, 10 - draftImages.length)) {
                        if (file.type.startsWith("video/")) {
                          const res = await uploadDurableMedia(file, { fileName: file.name, category: file.type.startsWith("video/") ? "videos" : "images" })
                          const url =
                            (res as { url?: string; publicUrl?: string })?.url ||
                            (res as { publicUrl?: string })?.publicUrl
                          if (url && isDurableMediaUrl(String(url))) setDraftVideo(String(url))
                          continue
                        }
                        if (!file.type.startsWith("image/")) continue
                        const res = await uploadDurableMedia(file, { fileName: file.name, category: file.type.startsWith("video/") ? "videos" : "images" })
                        const url =
                          (res as { url?: string; publicUrl?: string })?.url ||
                          (res as { publicUrl?: string })?.publicUrl
                        if (url && isDurableMediaUrl(String(url))) {
                          setDraftImages((prev) => [...prev, String(url)].slice(0, 10))
                        }
                      }
                    } catch {
                      /* fail-soft — keep existing media */
                    } finally {
                      setEditMediaBusy(false)
                    }
                  })()
                }}
              />
              <button
                type="button"
                disabled={editMediaBusy || draftImages.length >= 10}
                onClick={() => editImageInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-[12px] font-semibold text-foreground disabled:opacity-50"
              >
                {editMediaBusy ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                {editMediaBusy ? "Uploading…" : "Add photo or video"}
              </button>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingPost(false)}
                className="rounded-xl px-4 py-2 text-sm font-bold text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!draftContent.trim() || editMediaBusy}
                onClick={() => {
                  const media: PostEditMedia = {
                    images: draftImages,
                    video: draftVideo,
                  }
                  onEdit?.(post.id, draftContent.trim(), media)
                  setEditingPost(false)
                }}
                className="rounded-xl bg-[var(--gh-green)] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content with rich formatting */}
      <div className="px-3 pb-2.5 pt-1 sm:px-4 sm:pb-3">
        {detectSpecialPost(post.content) ? (
          <SpecialPostBody content={post.content || ""} />
        ) : (
          <>
            <div
              className={`mb-1 break-words text-[15px] leading-[1.55] tracking-[-0.011em] text-foreground sm:text-base ${
                !contentExpanded && (post.content?.length || 0) > 220 ? "line-clamp-5" : ""
              }`}
            >
              {contentParts.map((part, idx) => {
                if (typeof part === "string") {
                  return <SafeTextWithLinks key={idx} text={part} />
                }
                if (part.type === "hashtag") {
                  return (
                    <button
                      key={idx}
                      type="button"
                      data-post-no-open
                      className="text-emerald-700 hover:underline dark:text-emerald-400"
                      onClick={(e) => {
                        e.stopPropagation()
                        try {
                          window.dispatchEvent(
                            new CustomEvent("ghc:feed-search", {
                              detail: { query: String(part.value || "") },
                            }),
                          )
                          window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "home" }))
                        } catch { /* */ }
                      }}
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
                aria-expanded={contentExpanded}
                onClick={() => setContentExpanded((v) => !v)}
                className="mb-3 min-h-9 rounded-lg px-1 text-[13px] font-bold text-[var(--gh-green)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {contentExpanded ? "Show less" : "Read more"}
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
            className="mb-2 block overflow-hidden rounded-[1.15rem] border border-border/50 shadow-sm transition hover:border-border hover:shadow-[var(--gh-card-shadow)]"
          >
            <div className="flex gap-2 bg-muted/40 p-2 hover:bg-muted/60">
              {post.linkPreview.image && (
                <LazyImage
                  src={post.linkPreview.image}
                  alt={post.linkPreview.title || "Link"}
                  className="h-12 w-12 rounded-xl object-cover"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="truncate text-xs font-semibold text-foreground">{post.linkPreview.title}</p>
                <p className="text-xs text-muted-foreground truncate">{post.linkPreview.domain}</p>
              </div>
            </div>
          </a>
        )}

        {/* Media gallery with improved viewing */}
        {realImages.length > 0 && (
          <div
            className="group relative mb-2 aspect-[4/5] max-h-[24rem] w-full cursor-pointer overflow-hidden rounded-[1.15rem] bg-muted/50 sm:aspect-video sm:max-h-[26rem]"
            onClick={handleImageTap}
            onPointerDown={(e) => {
              if (e.button !== 0) return
              if ((e.target as HTMLElement).closest("button")) return
              startMediaLongPress()
            }}
            onPointerUp={endMediaLongPress}
            onPointerCancel={endMediaLongPress}
            onPointerLeave={endMediaLongPress}
            onContextMenu={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setMediaToolsOpen(true)
            }}
            role="group"
            tabIndex={onOpenPost || onOpenMedia ? 0 : undefined}
            aria-label={`Post image gallery, image ${imageIndex + 1} of ${realImages.length}. Hold for download.`}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                handleImageTap()
              }
            }}
          >
            <LazyImage
              src={realImages[Math.min(imageIndex, realImages.length - 1)] || realImages[0]}
              alt={`Photo ${imageIndex + 1} of ${realImages.length}`}
              className="absolute inset-0 h-full w-full object-cover"
              variant="post-media"
            />
            {realImages.length > 1 && (
              <>
                <button type="button" onClick={handlePrevImage} disabled={imageIndex === 0} aria-label="Previous post image" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2.5 text-white opacity-100 shadow-md transition-opacity hover:bg-black/80 disabled:opacity-35 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100">
                  <span aria-hidden="true">←</span>
                </button>
                <button type="button" onClick={handleNextImage} disabled={imageIndex >= realImages.length - 1} aria-label="Next post image" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2.5 text-white opacity-100 shadow-md transition-opacity hover:bg-black/80 disabled:opacity-35 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100">
                  <span aria-hidden="true">→</span>
                </button>
                <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/65 px-2.5 py-1 text-xs font-semibold tabular-nums text-white" aria-live="polite">
                  {Math.min(imageIndex + 1, realImages.length)} / {realImages.length}
                </div>
              </>
            )}
          </div>
        )}

        {typeof post.video === "string" && isDurableMediaUrl(post.video) ? <button type="button" onClick={handleVideoTap} className="relative mb-2 block aspect-video w-full overflow-hidden rounded-[1.15rem] bg-black text-left" aria-label="Play video full screen"><DurableVideo src={post.video} preload="metadata" muted playsInline className="absolute inset-0 h-full w-full object-contain" /><span className="absolute inset-0 flex items-center justify-center bg-black/15"><span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/50 bg-black/50 text-2xl text-white shadow-lg">▶</span></span><span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold text-white">Play video</span></button> : null}

        {/* Quote repost */}
        {post.quoteOf && (
          <div className="mb-2 p-2 border border-border/80 rounded-lg bg-muted/40 text-xs text-muted-foreground">
            <p className="font-semibold mb-1">Quoted post</p>
            <p className="text-muted-foreground">Original post content preview...</p>
          </div>
        )}
      </div>


      {(() => {
        const pollView = resolvePostPoll(post as { content?: string; poll?: import("./poll-inline").PollView | null })
        return pollView ? (
          <div className="px-3.5">
            <PollInline poll={pollView} postId={post.id} />
          </div>
        ) : null
      })()}
      {(() => {
        const ch = resolvePostChallenge(post as { content?: string })
        return ch ? (
          <div className="px-3.5">
            <ChallengeInline challenge={ch} />
          </div>
        ) : null
      })()}

      {/* Reaction summary only. Comment/share totals live beside their single action controls below. */}
      {visibleReactionEntries.length > 0 ? (
        <section className="mx-4 mb-2 px-1 py-1" aria-label="Reaction counts">
          <div className="flex flex-wrap gap-1">
            {visibleReactionEntries.slice(0, 5).map(([type, count]) => (
              <span key={type} className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-card/70 px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
                <span>{reactionEmoji[type] || "✨"}</span>
                <span className="tabular-nums">{Number(count).toLocaleString()}</span>
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {/* Saves only — views are shown once inside Curation & post insights (no duplicate 0 views). */}
      {post.engagement && Number(post.engagement.saves || 0) > 0 ? (
        <div className="border-t border-border/40 bg-muted/25 px-3.5 py-1.5 text-[11px] text-muted-foreground">
          <div className="flex justify-end">
            <span className="tabular-nums">{Number(post.engagement.saves).toLocaleString()} saved</span>
          </div>
        </div>
      ) : null}

      {showReactions && (
        <div className="mx-3 mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-lg" role="group" aria-label={curationReactionKind === "positive" ? "Positive curation reactions" : "Negative curation reactions"}>
          <span className="px-1 text-xs font-semibold text-muted-foreground">{curationReactionKind === "positive" ? "Positive reaction" : "Negative reaction"}</span>
          {REACTIONS.filter((reaction) => curationReactionKind === "positive" ? reaction.type !== "sad" && reaction.type !== "like" : reaction.type === "sad").map((reaction) => (
            <button key={reaction.type} type="button" onClick={() => handleQuickReaction(reaction)} className="flex h-8 min-w-8 items-center justify-center rounded-full bg-muted px-1.5 text-base hover:bg-muted/70" title={reaction.label} aria-label={reaction.label}>{reaction.emoji}</button>
          ))}
          <button type="button" onClick={() => setShowReactions(false)} className="ml-auto rounded-full px-2 py-1 text-xs text-muted-foreground">Cancel</button>
        </div>
      )}

      {/* Primary actions — mobile-safe density: never clip share/save */}
      <div
        className="border-t border-border/40 px-2 py-2 sm:px-3"
        role="toolbar"
        aria-label="Post engagement and curation actions"
      >
        <div className="flex min-w-0 w-full flex-wrap items-center gap-y-1.5">
          {/* Curation cluster — shrinks first on narrow screens */}
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <label
              className="flex shrink-0 items-center gap-1 text-[10px] leading-none text-muted-foreground"
              title="Curation weight only; this setting does not issue GHC"
            >
              <span className="sr-only sm:not-sr-only sm:inline">{isOwn ? "Weight" : "Support"}</span>
              <select
                aria-label="Curation vote weight percentage; does not issue GHC"
                value={rewardPercentage}
                disabled={curationBusy}
                onChange={(e) => setRewardPercentage(Number(e.target.value))}
                className="h-8 max-w-[3.75rem] rounded-md border border-border bg-background px-0.5 text-[11px] font-semibold text-foreground sm:max-w-[4.4rem] sm:text-xs"
              >
                <option value={0}>0%</option>
                <option value={25}>25%</option>
                <option value={50}>50%</option>
                <option value={75}>75%</option>
                <option value={100}>100%</option>
              </select>
            </label>
            <button
              type="button"
              disabled={curationBusy}
              aria-label="Hold for 1.2 seconds to vote and curate this post. Tap for reaction options."
              aria-pressed={curationChoice === "upvote"}
              onClick={(e) => {
                e.preventDefault()
                if (curationLongPressTriggeredRef.current) {
                  curationLongPressTriggeredRef.current = false
                  return
                }
                setCurationReactionKind("positive")
                setShowReactions((visible) => !visible)
              }}
              onContextMenu={(e) => { e.preventDefault(); openRoster("upvotes") }}
              onPointerDown={(e) => { if (e.button === 0) startCurationLongPress("upvote") }}
              onPointerUp={() => endCurationLongPress()}
              onPointerCancel={() => endCurationLongPress(true)}
              onPointerLeave={() => endCurationLongPress(true)}
              title="Hold for 1.2 seconds to vote and curate. Tap to choose a reaction. GHC changes only after server confirmation."
              className={`inline-flex h-9 min-h-9 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-bold transition active:scale-[0.97] sm:h-10 sm:px-3 sm:text-sm ${
                curationChoice === "upvote"
                  ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300/80 dark:bg-emerald-900/45 dark:text-emerald-300"
                  : "bg-emerald-50/80 text-emerald-700/90 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400"
              }`}
            >
                <ThumbsUp size={16} strokeWidth={2.25} aria-hidden className="sm:h-[18px] sm:w-[18px]" />
              <span className="tabular-nums">{upvoteCount}</span>
            </button>
            <button
              type="button"
              disabled={curationBusy}
              aria-label="Hold for 1.2 seconds to downvote and curate this post. Tap for reaction options."
              aria-pressed={curationChoice === "downvote"}
              onClick={(e) => {
                e.preventDefault()
                if (curationLongPressTriggeredRef.current) {
                  curationLongPressTriggeredRef.current = false
                  return
                }
                setCurationReactionKind("negative")
                setShowReactions((visible) => !visible)
              }}
              onContextMenu={(e) => { e.preventDefault(); openRoster("downvotes") }}
              onPointerDown={(e) => { if (e.button === 0) startCurationLongPress("downvote") }}
              onPointerUp={() => endCurationLongPress()}
              onPointerCancel={() => endCurationLongPress(true)}
              onPointerLeave={() => endCurationLongPress(true)}
              title="Hold for 1.2 seconds to downvote and curate. Tap to choose a reaction."
              className={`inline-flex h-9 min-h-9 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-bold transition active:scale-[0.97] sm:h-10 sm:px-3 sm:text-sm ${
                curationChoice === "downvote"
                  ? "bg-rose-100 text-rose-700 ring-1 ring-rose-300/80 dark:bg-rose-900/45 dark:text-rose-300"
                  : "bg-rose-50/70 text-rose-600/90 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-400"
              }`}
            >
              <ThumbsDown size={16} strokeWidth={2.25} aria-hidden className="sm:h-[18px] sm:w-[18px]" />
              <span className="tabular-nums">{downvoteCount}</span>
            </button>
          </div>

          {/* Response cluster — never shrinks away; share/save always visible */}
          <div className="ml-auto flex shrink-0 items-center gap-0.5">
            <div className="mx-0.5 hidden h-5 w-px bg-border/70 xs:block sm:mx-1 sm:h-6" aria-hidden />
            <button
              type="button"
              aria-label="Comment"
              onClick={() => onComment(post.id)}
              className="inline-flex h-9 min-h-9 min-w-9 items-center justify-center gap-0.5 rounded-full text-muted-foreground transition hover:bg-muted active:scale-95 sm:h-10 sm:min-w-10"
            >
              <MessageCircle size={18} aria-hidden className="sm:h-5 sm:w-5" />
              <span className="tabular-nums text-[11px] font-semibold sm:text-xs">
                {visibleCommentCount}
              </span>
            </button>
            <button
              type="button"
              aria-label={isSaved ? "Unsave" : "Save"}
              aria-pressed={isSaved}
              onClick={() => onSave(post.id)}
              className={`inline-flex h-9 min-h-9 min-w-9 items-center justify-center rounded-full transition active:scale-95 sm:h-10 sm:min-w-10 ${
                isSaved
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Bookmark size={18} fill={isSaved ? "currentColor" : "none"} aria-hidden className="sm:h-5 sm:w-5" />
            </button>
            <button
              type="button"
              aria-label="Share"
              onClick={() => onShare(post.id)}
              className="inline-flex h-9 min-h-9 min-w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted active:scale-95 sm:h-10 sm:min-w-10"
            >
              <Share2 size={18} aria-hidden className="sm:h-5 sm:w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Public reward / quality strip — GHC amounts only when server-enabled */}
      <PostRewardPanel
        postId={post.id}
        upvoteCount={upvoteCount}
        downvoteCount={downvoteCount}
        views={post.engagement?.views ?? 0}
      />

      <EngagementRosterSheet
        open={rosterOpen}
        onClose={() => setRosterOpen(false)}
        kind={rosterKind}
        postId={post.id}
      />
      {mediaToolsOpen && (
        <div
          className="fixed inset-0 z-[210] flex items-end justify-center bg-black/45 sm:items-center"
          onClick={(e) => {
            e.stopPropagation()
            setMediaToolsOpen(false)
          }}
          role="presentation"
          data-post-no-open
        >
          <div
            className="w-full max-w-sm rounded-t-2xl border border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            role="menu"
            aria-label="Post media tools"
            data-post-no-open
          >
            <p className="mb-3 text-center text-xs font-bold uppercase tracking-wide text-muted-foreground">Media tools</p>
            <div className="grid gap-2">
              <button
                type="button"
                role="menuitem"
                className="flex min-h-12 items-center gap-3 rounded-xl bg-muted/80 px-4 text-sm font-semibold hover:bg-muted"
                onClick={(e) => {
                  e.stopPropagation()
                  setMediaToolsOpen(false)
                  if (onOpenMedia && realImages.length > 0) {
                    onOpenMedia({
                      urls: realImages.map((u) => ({ url: u, kind: "image" as const })),
                      index: imageIndex,
                      caption: post.content?.slice(0, 120) || undefined,
                      kind: "image",
                    })
                  } else {
                    handleImageTap()
                  }
                }}
              >
                View full screen
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex min-h-12 items-center gap-3 rounded-xl bg-muted/80 px-4 text-sm font-semibold hover:bg-muted"
                onClick={(e) => {
                  e.stopPropagation()
                  void handleDownloadCurrentMedia()
                }}
              >
                Download photo
              </button>
              <button
                type="button"
                role="menuitem"
                className="mt-1 flex min-h-11 items-center justify-center rounded-xl text-sm text-muted-foreground hover:bg-muted/50"
                onClick={(e) => {
                  e.stopPropagation()
                  setMediaToolsOpen(false)
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export const EnhancedPostCard = memo(EnhancedPostCardInner)
EnhancedPostCard.displayName = "EnhancedPostCard"


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
          <h3 className="font-bold text-foreground">Why am I seeing this?</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground/90">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-foreground/90">{reason.reason}</p>
          <div className="flex gap-2">
            <button className="flex-1 rounded-xl bg-muted px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted/80">
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
