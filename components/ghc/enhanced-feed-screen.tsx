"use client"

import { closeAllActionSheets } from "./action-sheet"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import type { Post, FeedFilter, PostDraft, SavedPost } from "@/lib/ghc-types"
import { seedPosts } from "@/lib/ghc-data"
import { useGHC } from "@/contexts/ghc-context"
import { usePermissions } from "@/hooks/usePermissions"
import { ShareSheet } from "./share-sheet"
import type { ShareResult } from "@/lib/share-service"
import { Bookmark, Plus, Search, Filter, Zap, Clock, TrendingUp, Users, MapPin, RefreshCw, MessageCircle, Send, X, UsersRound, Hash, ShoppingBag } from "lucide-react"
import { MOBILE_PAGE_SIZES } from "@/lib/mobile-performance"
import { getBoundDomainServices } from "@/lib/domains/compat"
import { NotificationBell } from "./notification-bell"
import { GlobalSearchModal } from "./global-search"
import { EmptyState } from "./empty-state"
import { FirstSessionTips } from "./first-session-tips"
import { SetupChecklist } from "./setup-checklist"
import { SaveToCollectionSheet } from "./save-to-collection"
import { MediaLightbox } from "./media-lightbox"
import { PostInsightsSheet } from "./post-insights"
import { PostSkeleton } from "./feed-components"
import { EnhancedComment } from "./feed-enhancements"
import { CommentSheet } from "./comment-sheet"
import { isOwnAuthor } from "@/lib/ownership"
import { EnhancedPostCard, VisibilityReasonTooltip } from "./enhanced-post-card"
import { PostComposer } from "./post-composer"
import ProfileStorySection from "./profile-story-section"
import { rankFeed, extractHashtags, extractMentions } from "@/lib/feed-ranking-engine"
import type { RankedPost, FeedLocationLane, FeedIntentionBias } from "@/lib/feed-ranking-engine"
import { buildCommentTree, sortComments } from "@/lib/comment-thread-utils"
import { useScrollHeader } from "@/lib/use-scroll-header"
import { CollapsingAppHeader } from "./collapsing-app-header"
import { BrandLogo } from "./brand-logo"
import { PostErrorBoundary } from "@/lib/error-boundary"
import { LazyImage } from "./lazy-image"
import { RelationshipActions } from "./relationship-actions"
import { onCloseTransientUI } from "@/lib/transient-ui"
import { DailyRewardHomeExperience } from "./daily-reward-experience"

const FEED_FILTERS: {
  value: FeedFilter
  label: string
  shortLabel: string
  icon: React.ReactNode
  hint: string
}[] = [
  { value: "for-you", label: "For You", shortLabel: "For You", icon: <Zap size={14} />, hint: "Quality picks for you" },
  { value: "following", label: "Following", shortLabel: "Following", icon: <Users size={14} />, hint: "People you follow" },
  { value: "friends", label: "Friends", shortLabel: "Friends", icon: <UsersRound size={14} />, hint: "Your connections" },
  { value: "communities", label: "Communities", shortLabel: "Communities", icon: <Hash size={14} />, hint: "Community activity" },
  { value: "trending", label: "Trending", shortLabel: "Trending", icon: <TrendingUp size={14} />, hint: "What's rising now" },
]

const COMMENT_EMOJIS = ["😀","😂","❤️","👍","🔥","🙏","😍","🎉"]

interface EnhancedFeedScreenProps {
  onCompose?: () => void
  onProfile?: () => void
}


function FeedSkeleton() {
  return (
    <div className="space-y-3 px-3 py-3" aria-hidden>
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-stone-200" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-28 rounded bg-stone-200" />
              <div className="h-2 w-16 rounded bg-stone-100" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-3 w-full rounded bg-stone-100" />
            <div className="h-3 w-4/5 rounded bg-stone-100" />
          </div>
          <div className="mt-3 h-40 rounded-xl bg-stone-100" />
        </div>
      ))}
    </div>
  )
}

/** Subtle marketplace discovery — max a few items, not an ad wall */
function MarketplaceDiscoveryStrip({ onOpen }: { onOpen?: () => void }) {
  const listings = useMemo(() => {
    try {
      return getBoundDomainServices()?.marketplace?.listListings?.({ status: "active" })?.slice(0, 4) || []
    } catch {
      return []
    }
  }, [])
  if (!listings.length) return null
  return (
    <section
      className="rounded-2xl border border-emerald-100/80 bg-white px-3 py-3 shadow-sm"
      aria-label="Marketplace picks"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <ShoppingBag size={14} className="text-emerald-600" aria-hidden />
          <h2 className="text-xs font-bold tracking-wide text-stone-800">Marketplace</h2>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800"
        >
          See more
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {listings.map((l: any) => (
          <button
            key={l.id}
            type="button"
            onClick={onOpen}
            className="min-w-[7.5rem] max-w-[7.5rem] flex-shrink-0 rounded-xl border border-stone-100 bg-stone-50 p-2 text-left transition hover:border-emerald-200 active:scale-[0.98]"
          >
            <div className="mb-1.5 h-14 overflow-hidden rounded-lg bg-stone-200">
              {l.media?.[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={l.media[0]} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="flex h-full items-center justify-center text-stone-400">
                  <ShoppingBag size={18} />
                </div>
              )}
            </div>
            <p className="truncate text-[11px] font-semibold text-stone-800">{l.title}</p>
            <p className="truncate text-[10px] text-emerald-700">
              {l.price} {l.currency}
            </p>
          </button>
        ))}
      </div>
    </section>
  )
}

export function EnhancedFeedScreen({ onCompose, onProfile }: EnhancedFeedScreenProps) {
  const { posts, profile, candidates, likePost, addComment, editComment, deleteComment, addCommentReaction, removeCommentReaction, pinComment, addToast, followUser, blockUser, reportPost, reportContent, deletePost, following, friends, conversations, blockedUsers, mutedUsers, settings, applyShareResult, shares, reposts, setTab, editPost, muteUser, unfollowFromPost, archivePost, savePost, unsavePost } = useGHC()
  const perms = usePermissions()
  const seedPostList = useMemo(() => seedPosts(), [])
  const seedPostIds = useMemo(() => new Set(seedPostList.map((post) => post.id)), [seedPostList])

  // State management
  const [activeFilter, setActiveFilter] = useState<FeedFilter>("for-you")
  const [locationLane, setLocationLane] = useState<FeedLocationLane>("worldwide")
  const [intentionBias, setIntentionBias] = useState<FeedIntentionBias>("balanced")
  const [personalizeOpen, setPersonalizeOpen] = useState(false)
  const [feedChrome, setFeedChrome] = useState<"checklist" | "personalize" | "none">(() => {
    try {
      if (typeof localStorage !== "undefined" && localStorage.getItem("ghc_feed_chrome_v1") === "1") return "none"
    } catch { /* */ }
    return "checklist"
  })
  const dismissFeedChrome = () => {
    setFeedChrome("none")
    try { localStorage.setItem("ghc_feed_chrome_v1", "1") } catch { /* */ }
  }
  const [focusMode, setFocusMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [viewingAuthorId, setViewingAuthorId] = useState<string | null>(null)
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [displayedPostsCount, setDisplayedPostsCount] = useState(MOBILE_PAGE_SIZES.feed)
  const [likedPosts, setLikedPosts] = useState<string[]>([])
  const [savedPosts, setSavedPosts] = useState<SavedPost[]>([])
  const [bookmarkedPostIds, setBookmarkedPostIds] = useState<string[]>([])
  const [draftPosts, setDraftPosts] = useState<PostDraft[]>([])
  const [rankedPosts, setRankedPosts] = useState<RankedPost[]>([])
  const [visibilityReasonPostId, setVisibilityReasonPostId] = useState<string | null>(null)
  const [selectedVisibilityReason, setSelectedVisibilityReason] = useState<{
    reason: string
    category: string
  } | null>(null)
  const [notInterestedIds, setNotInterestedIds] = useState<string[]>([])
  const [sharePostId, setSharePostId] = useState<string | null>(null)
  const [feedError, setFeedError] = useState<Error | null>(null)
  const [showComposer, setShowComposer] = useState(false)
  const [showCreateMenu, setShowCreateMenu] = useState(false)
  const [composeMode, setComposeMode] = useState<"post" | "story">("post")
  const [showCommentEmoji, setShowCommentEmoji] = useState(false)
  const [commentingPostId, setCommentingPostId] = useState<string | null>(null)
  const [saveCollectionPostId, setSaveCollectionPostId] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<{ url: string; caption?: string } | null>(null)
  const [insightsPost, setInsightsPost] = useState<Post | null>(null)
  const { compact: headerCompact, hidden: headerHidden, onScroll: onHeaderScroll } = useScrollHeader({
    threshold: 40,
  })
  const [commentText, setCommentText] = useState("")
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null)
  const [commentSort, setCommentSort] = useState<"newest" | "liked" | "pinned">("newest")
  const containerRef = useRef<HTMLDivElement>(null)
  const startYRef = useRef(0)
  const touchIdentifierRef = useRef<number | null>(null)
  const pendingLikesRef = useRef(new Set<string>())
  const pendingCommentsRef = useRef(new Set<string>())

  // Dispose all temporary Feed UI when leaving section or global dismiss
  useEffect(() => {
    return onCloseTransientUI(() => {
      setViewingAuthorId(null)
      setVisibilityReasonPostId(null)
      setSelectedVisibilityReason(null)
      setSharePostId(null)
      setShowComposer(false)
      setShowCreateMenu(false)
      setShowCommentEmoji(false)
      setCommentingPostId(null)
      setSaveCollectionPostId(null)
      setLightbox(null)
      setInsightsPost(null)
      setIsSearchOpen(false)
      setPersonalizeOpen(false)
      setCommentText("")
      setReplyingToCommentId(null)
    })
  }, [])


  // Infinite scroll detection
  const observerTargetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore) {
          loadMorePosts()
        }
      },
      { threshold: 0.1 }
    )

    if (observerTargetRef.current) {
      observer.observe(observerTargetRef.current)
    }

    return () => observer.disconnect()
  }, [isLoadingMore, displayedPostsCount])

  // Rank posts based on filter
  useEffect(() => {
    try {
      setFeedError(null)
      const blockedIds = Array.from(
        new Set([...(blockedUsers || []), ...((settings as any)?.blockedUsers || [])].filter(Boolean))
      )
      const mutedIds = Array.from(
        new Set([
          ...(mutedUsers || []),
          ...(((settings as any)?.mutedUsers as string[]) || []),
        ].filter(Boolean)),
      )
      const communityIds = (conversations || [])
        .filter(
          (c) =>
            c.conversationType === "group" ||
            (c as any).kind === "community" ||
            (c as any).isCommunity
        )
        .map((c) => c.id)
      const feedContext = {
        userProfile: profile,
        userInterests: profile.interests,
        recentlyEngagedPostIds: likedPosts,
        blockedUserIds: blockedIds,
        mutedUserIds: mutedIds,
        followingIds: following || [],
        friendIds: friends || [],
        communityIds,
        savedPostIds: bookmarkedPostIds,
        viewedPostIds: [],
        locationLane,
        intentionBias,
        focusMode,
      }

      const realPosts = posts.filter((post) => !seedPostIds.has(post.id) && !(post as any).deletedAt && !(post as any).isArchived)
      const feedPosts = realPosts.length > 0 ? realPosts : seedPostList.slice(0, 3)
      const ranked = rankFeed(
        feedPosts.filter((p) => !notInterestedIds.includes(p.id)),
        activeFilter,
        feedContext
      )
      // Prevent duplicate rows after refresh / pagination merges
      const seen = new Set<string>()
      const unique = ranked.filter((row) => {
        const id = row.post?.id
        if (!id || seen.has(id)) return false
        seen.add(id)
        return true
      })
      setRankedPosts(unique)
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Failed to rank feed")
      setFeedError(err)
      console.error("[Feed Ranking Error]", err)
      // Fallback: show unranked posts
      setRankedPosts(posts.map((post) => ({ post, score: 0, reason: { reason: "Feed unavailable", category: "error" } })))
    }
  }, [activeFilter, posts, likedPosts, profile, bookmarkedPostIds, notInterestedIds, seedPostIds, seedPostList, blockedUsers, mutedUsers, settings, following, friends, conversations, locationLane, intentionBias, focusMode])

  // Pull-to-refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      startYRef.current = e.touches[0].clientY
      touchIdentifierRef.current = e.touches[0].identifier
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0 && touchIdentifierRef.current !== null) {
      const touch = Array.from(e.touches).find((t) => t.identifier === touchIdentifierRef.current)
      if (touch) {
        const distance = Math.max(0, touch.clientY - startYRef.current)
        setPullDistance(Math.min(distance, 120))
      }
    }
  }

  const handleTouchEnd = async () => {
    if (pullDistance > 80) {
      await handleRefresh()
    }
    setPullDistance(0)
    touchIdentifierRef.current = null
  }

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true)
      setFeedError(null)
      // Simulate refresh
      await new Promise((resolve) => setTimeout(resolve, 1200))
      setDisplayedPostsCount(MOBILE_PAGE_SIZES.feed)
      addToast("Feed refreshed!", "success")
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Failed to refresh feed")
      console.error("[Refresh Error]", err)
      setFeedError(err)
      addToast("Failed to refresh. Try again.", "error")
    } finally {
      setIsRefreshing(false)
    }
  }

  const loadMorePosts = async () => {
    try {
      setIsLoadingMore(true)
      // Simulate loading
      await new Promise((resolve) => setTimeout(resolve, 800))
      setDisplayedPostsCount((prev) => prev + 5)
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Failed to load more posts")
      console.error("[Load More Error]", err)
      addToast("Failed to load more posts.", "error")
    } finally {
      setIsLoadingMore(false)
    }
  }

  // Post interaction handlers
  const handleLike = useCallback(
    async (postId: string, isDouble?: boolean) => {
      if (pendingLikesRef.current.has(postId)) return
      pendingLikesRef.current.add(postId)
      const wasLiked = likedPosts.includes(postId)
      try {
        setLikedPosts((previous) => wasLiked ? previous.filter((id) => id !== postId) : [...previous, postId])
        await likePost(postId)
      } catch (error) {
        console.error("[Like Error]", error)
        setLikedPosts((previous) => wasLiked ? [...previous, postId] : previous.filter((id) => id !== postId))
        addToast("Could not update like. Try again.", "error")
      } finally {
        pendingLikesRef.current.delete(postId)
      }
    },
    [likedPosts, likePost, addToast]
  )

  const handleSave = useCallback((postId: string) => {
    try {
      const isBookmarked = bookmarkedPostIds.includes(postId)
      if (isBookmarked) {
        setBookmarkedPostIds((prev) => prev.filter((id) => id !== postId))
        if (unsavePost) void unsavePost(postId)
        addToast("Removed from bookmarks", "info")
      } else {
        setBookmarkedPostIds((prev) => [...prev, postId])
        setSaveCollectionPostId(postId)
        if (savePost) void savePost(postId)
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Failed to save post")
      console.error("[Save Error]", err)
      addToast("Failed to save post. Try again.", "error")
    }
  }, [bookmarkedPostIds, addToast, savePost, unsavePost])

  const handleNotInterested = useCallback((postId: string) => {
    setNotInterestedIds((prev) => [...prev, postId])
    addToast("You won't see posts like this", "info")
  }, [addToast])

  const openComments = useCallback((postId: string) => {
    setCommentingPostId(postId)
    setReplyingToCommentId(null)
    setCommentText("")
  }, [])

  const startReply = useCallback((commentId: string) => {
    setReplyingToCommentId(commentId)
    setCommentText("")
  }, [])

  const submitComment = useCallback(async () => {
    const postId = commentingPostId
    const text = (commentText ?? "").trim()
    if (!postId || !text || isSubmittingComment || pendingCommentsRef.current.has(postId)) {
      if (!text && postId) addToast("Comment cannot be empty", "error")
      return
    }
    pendingCommentsRef.current.add(postId)
    setIsSubmittingComment(true)
    try {
      await addComment(postId, text, replyingToCommentId || undefined)
      setCommentText("")
      setReplyingToCommentId(null)
      // Toast is owned by addComment (success or error)
    } catch {
      addToast("Could not post comment", "error")
    } finally {
      pendingCommentsRef.current.delete(postId)
      setIsSubmittingComment(false)
    }
  }, [addComment, addToast, commentingPostId, commentText, isSubmittingComment, replyingToCommentId])

  const handleShowVisibilityReason = useCallback((postId: string) => {
    setVisibilityReasonPostId(postId)
    const post = posts.find((p) => p.id === postId)
    const rankedPost = rankedPosts.find((rp) => rp.post.id === postId)
    if (rankedPost) {
      setSelectedVisibilityReason(rankedPost.reason)
    }
  }, [posts, rankedPosts])

  // Search and filter posts
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return rankedPosts
    return rankedPosts.filter((rp) => {
      const post = rp.post
      return (
        (post.content ?? "").toLowerCase().includes(query) ||
        post.authorName.toLowerCase().includes(query) ||
        (post.hashtags?.some((tag) => tag.toLowerCase().includes(query)) || false)
      )
    })
  }, [rankedPosts, searchQuery])

  const displayPosts = useMemo(() => searchResults.slice(0, displayedPostsCount), [searchResults, displayedPostsCount])
  const hasRealPosts = useMemo(() => posts.some((post) => !seedPostIds.has(post.id)), [posts, seedPostIds])

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-background text-foreground">
      {/* Pull-to-refresh indicator */}
      {pullDistance > 0 && (
        <div className="absolute top-0 left-0 right-0 h-20 flex items-center justify-center z-30">
          <div
            className={`w-8 h-8 rounded-full border-3 border-purple-300 border-t-purple-600 transition-all ${
              isRefreshing ? "animate-spin" : ""
            }`}
            style={{ opacity: Math.min(pullDistance / 80, 1), transform: `rotate(${(pullDistance / 120) * 360}deg)` }}
          ></div>
        </div>
      )}

      {/* Premium feed header — emerald identity, clear mode hierarchy */}
      <CollapsingAppHeader
        title=""
        subtitle={FEED_FILTERS.find((f) => f.value === activeFilter)?.hint || "Social · Stories · Communities"}
        compact={headerCompact}
        hidden={headerHidden}
        compactTitle=""
        leading={<BrandLogo size="header" className="object-left" />}
        compactLeading={<BrandLogo size="compact" className="object-left" />}
        actions={
          <>
            <NotificationBell
              onOpenTarget={(n) => {
                if (n.type === "message") setTab("messages")
                else if (n.type === "match" || n.type === "follow" || n.type === "friend_request")
                  setTab("discover")
              }}
            />
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              aria-label="Search"
              aria-expanded={isSearchOpen}
              className="flex h-11 w-11 items-center justify-center rounded-full transition hover:bg-emerald-50 active:scale-90"
            >
              <Search size={18} className="text-gray-700" />
            </button>
          </>
        }
        secondary={
          <>
            {isSearchOpen && (
              <div className="mb-1.5 flex gap-2">
                <input
                  type="text"
                  placeholder="Search posts, people, hashtags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 rounded-full border border-gray-100 bg-stone-50 px-4 py-2 text-sm outline-none transition focus:border-emerald-200 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    setIsSearchOpen(false)
                    setSearchQuery("")
                  }}
                  className="rounded-full px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            )}
            <div
              className="flex snap-x snap-mandatory gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide"
              role="tablist"
              aria-label="Feed modes"
            >
              {FEED_FILTERS.map((filter) => {
                const selected = activeFilter === filter.value
                return (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => {
                      setActiveFilter(filter.value)
                      setDisplayedPostsCount(MOBILE_PAGE_SIZES.feed)
                    }}
                    role="tab"
                    aria-selected={selected}
                    aria-label={`${filter.label} feed — ${filter.hint}`}
                    title={filter.hint}
                    className={`flex min-h-9 shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all active:scale-[0.97] ${
                      selected
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/25 ring-1 ring-primary/30"
                        : "bg-muted/80 text-muted-foreground ring-1 ring-border/50 hover:bg-primary/10 hover:text-primary"
                    }`}
                  >
                    <span className={selected ? "text-emerald-100" : "text-stone-400"} aria-hidden>
                      {filter.icon}
                    </span>
                    {filter.shortLabel}
                  </button>
                )
              })}
            </div>
          </>
        }
      />


      {/* Error state */}
      {feedError && (
        <div className="mx-3 mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <div className="flex items-start gap-3">
            <div className="text-red-600 mt-0.5" aria-hidden="true">⚠️</div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-red-900">Something went wrong</h3>
              <p className="text-xs text-red-700 mt-1">{feedError.message}</p>
              <button
                onClick={() => { setFeedError(null); void handleRefresh() }}
                className="mt-2 text-xs font-semibold text-red-600 hover:text-red-700 underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feed content */}
      {isRefreshing && rankedPosts.length === 0 ? <FeedSkeleton /> : null}
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onScroll={(e) => {
          onHeaderScroll(e)
          closeAllActionSheets()
        }}
        role="main"
        aria-label={`${activeFilter} feed`}
        aria-live="polite"
        aria-busy={isLoadingMore}
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-background px-1 scrollbar-hide [-webkit-overflow-scrolling:touch] touch-pan-y"
        style={pullDistance > 0 ? { transform: `translateY(${Math.min(pullDistance, 72)}px)` } : undefined}
      >
        <div className="mx-auto max-w-lg space-y-3 px-3 pb-6 pt-2 sm:px-4 sm:pt-3">
          <ProfileStorySection scope="feed" />

          {/* First-class Daily Reward — claim on Home, manage detail in Rewards Centre */}
          {activeFilter === "for-you" && <DailyRewardHomeExperience />}

          {/* Light marketplace discovery — not an ad wall */}
          {activeFilter === "for-you" && (
            <MarketplaceDiscoveryStrip onOpen={() => setTab?.("discover")} />
          )}

          {feedChrome === "checklist" && (
            <div className="relative">
              <SetupChecklist
                onNavigate={(tab) => {
                  window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: tab }))
                }}
              />
              <button
                type="button"
                onClick={dismissFeedChrome}
                className="absolute right-2 top-2 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-bold text-muted-foreground shadow-sm"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Personalize — only after checklist dismissed to reduce first-screen noise */}
          {feedChrome !== "checklist" && activeFilter === "for-you" && (
            <div className="rounded-2xl border border-border/70 bg-card shadow-sm">
              <button
                type="button"
                onClick={() => setPersonalizeOpen((v) => !v)}
                className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
                aria-expanded={personalizeOpen}
              >
                <span className="text-xs font-bold text-foreground">Personalize feed</span>
                <span className="flex items-center gap-2">
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation()
                      setFocusMode((v) => !v)
                    }}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition ${
                      focusMode ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {focusMode ? "Focus on" : "Focus off"}
                  </span>
                  <span className="text-[10px] font-semibold text-muted-foreground">{personalizeOpen ? "Hide" : "Show"}</span>
                </span>
              </button>
              {personalizeOpen && (
                <div className="space-y-2 border-t border-border/60 px-3 pb-3 pt-2">
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Location lane">
                    {([
                      { id: "city" as const, label: "City" },
                      { id: "country" as const, label: "Country" },
                      { id: "worldwide" as const, label: "Worldwide" },
                    ]).map((lane) => (
                      <button
                        key={lane.id}
                        type="button"
                        onClick={() => setLocationLane(lane.id)}
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                          locationLane === lane.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {lane.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Intention focus">
                    {([
                      { id: "balanced" as const, label: "Balanced" },
                      { id: "friendship" as const, label: "Friends" },
                      { id: "professional" as const, label: "Pro" },
                      { id: "dating" as const, label: "Dating" },
                    ]).map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setIntentionBias(b.id)}
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                          intentionBias === b.id ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] leading-snug text-muted-foreground">
                    Soft preferences only — not a compatibility score.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Community highlights — discovery, not ads */}
          {activeFilter === "for-you" && (conversations || []).some((c) => c.conversationType === "group" || (c as any).isCommunity) && (
            <div className="rounded-2xl border border-teal-200/60 bg-gradient-to-r from-teal-50/80 to-emerald-50/40 p-3 dark:border-teal-900/40 dark:from-teal-950/30 dark:to-emerald-950/20">
              <p className="text-[11px] font-bold text-teal-900 dark:text-teal-100">Community highlights</p>
              <p className="mt-0.5 text-[10px] text-teal-800/80 dark:text-teal-200/70">
                Spaces you belong to — open the Community tab for posts, events, and member chat.
              </p>
              <div className="mt-2 flex gap-2 overflow-x-auto scrollbar-hide">
                {(conversations || [])
                  .filter((c) => c.conversationType === "group" || (c as any).isCommunity)
                  .slice(0, 6)
                  .map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setTab?.("communities")}
                      className="shrink-0 rounded-full border border-teal-200 bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-teal-900 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-100"
                    >
                      {c.groupName || c.participantName || "Community"}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {!hasRealPosts && displayPosts.length > 0 && (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-center">
              <p className="text-xs text-stone-600">Here&apos;s some inspiration while you get started.</p>
              <button
                type="button"
                onClick={() => {
                  setShowComposer(true)
                  onCompose?.()
                }}
                className="mt-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 active:scale-95"
              >
                Create your first post
              </button>
            </div>
          )}

          {displayPosts.length === 0 ? (
            <EmptyState
              variant="feed"
              title={
                activeFilter === "following"
                  ? "Your Following feed is quiet"
                  : activeFilter === "friends"
                    ? "No posts from friends yet"
                    : activeFilter === "communities"
                      ? "No community posts yet"
                      : activeFilter === "trending"
                        ? "Nothing trending right now"
                        : "Your feed is ready"
              }
              description={
                activeFilter === "following"
                  ? "Follow people you care about — their posts appear here. Blocked accounts never show."
                  : activeFilter === "friends"
                    ? "Connect with people — posts from friends show up here."
                    : activeFilter === "communities"
                      ? "Join communities to see discussions and shared posts here."
                      : activeFilter === "trending"
                        ? "Check back soon for rising posts across GH Connect."
                        : "Share something meaningful, or discover people and communities."
              }
              action={
                activeFilter === "following" || activeFilter === "friends"
                  ? { label: "Find people", onClick: () => setTab?.("discover") }
                  : activeFilter === "communities"
                    ? { label: "Explore communities", onClick: () => setTab?.("discover") }
                    : { label: "Create a post", onClick: () => { setShowComposer(true); onCompose?.() } }
              }
              secondaryAction={
                activeFilter !== "for-you"
                  ? {
                      label: "View For You",
                      onClick: () => {
                        setActiveFilter("for-you")
                        setDisplayedPostsCount(MOBILE_PAGE_SIZES.feed)
                      },
                    }
                  : { label: "Discover people", onClick: () => setTab?.("discover") }
              }
            />
          ) : (
            displayPosts.map((rankedPost) => (
            <div key={rankedPost.post?.id || rankedPost.id} className="cv-auto">
              <PostErrorBoundary postId={rankedPost.post.id}>
                <EnhancedPostCard
                  post={rankedPost.post}
                  isLiked={likedPosts.includes(rankedPost.post.id)}
                  isSaved={bookmarkedPostIds.includes(rankedPost.post.id)}
                  isOwnPost={isOwnAuthor(rankedPost.post.authorId, rankedPost.post.authorName, profile)}
                  onLike={(id) => {
                    if (!perms.canLike(rankedPost.post.authorId)) {
                      addToast("You can't like this post", "error")
                      return
                    }
                    handleLike(id)
                  }}
                  onComment={() => {
                    if (!perms.canComment(rankedPost.post.authorId)) {
                      addToast("You can't comment on this post", "error")
                      return
                    }
                    openComments(rankedPost.post.id)
                  }}
                  onShare={(postId) => setSharePostId(postId)}
                  onSave={handleSave}
                  onNotInterested={handleNotInterested}
                  onShowVisibilityReason={handleShowVisibilityReason}
                  visibilityReason={rankedPost.reason}
                  onOpenProfile={(authorId) => {
                    const id = authorId || rankedPost.post.authorId
                    if (!id || id === "current-user" || id === profile?.id) {
                      onProfile?.()
                      setTab("profile")
                      return
                    }
                    setViewingAuthorId(id)
                  }}
                  onDelete={
                    isOwnAuthor(rankedPost.post.authorId, rankedPost.post.authorName, profile) || perms.canDeletePost(rankedPost.post.authorId)
                      ? (postId) => void deletePost(postId)
                      : undefined
                  }
                  onInsights={
                    isOwnAuthor(rankedPost.post.authorId, rankedPost.post.authorName, profile)
                      ? (postId) => {
                          const p = posts.find((x) => x.id === postId) || rankedPost.post
                          setInsightsPost(p)
                        }
                      : undefined
                  }
                  onOpenMedia={(url, caption) => setLightbox({ url, caption })}
                  onArchive={
                    isOwnAuthor(rankedPost.post.authorId, rankedPost.post.authorName, profile) && archivePost
                      ? (postId) => void archivePost(postId)
                      : undefined
                  }
                  onReport={
                    !perms.isBlockedUser(rankedPost.post.authorId)
                      ? (postId, reason) => void (reportContent?.("post", postId, reason) ?? reportPost?.(postId, reason))
                      : undefined
                  }
                  onBlock={
                    perms.canBlock(rankedPost.post.authorId)
                      ? () => void perms.tryBlock(rankedPost.post.authorId)
                      : undefined
                  }
                  onMute={
                    rankedPost.post.authorId !== "current-user" && muteUser
                      ? () => {
                          void muteUser(rankedPost.post.authorId)
                          addToast("Author muted", "info")
                        }
                      : undefined
                  }
                  onEdit={
                    isOwnAuthor(rankedPost.post.authorId, rankedPost.post.authorName, profile) && editPost
                      ? (postId, content) => void editPost(postId, content)
                      : undefined
                  }
                />
              </PostErrorBoundary>
            </div>
            ))
          )}

          
      {sharePostId && (() => {
        const sp = posts.find((p) => p.id === sharePostId) || rankedPosts.find((r) => r.post.id === sharePostId)?.post
        if (!sp) return null
        return (
          <ShareSheet
            post={sp}
            open={!!sharePostId}
            onClose={() => setSharePostId(null)}
            shareContext={{
              currentUserId: "current-user",
              blockedUsers: blockedUsers || settings?.blockedUsers || [],
              posts,
              conversations: conversations || [],
            }}
            onComplete={(result: ShareResult) => {
              applyShareResult?.(result)
              if (result.ok) {
                if (result.link) addToast("Link copied", "success")
                else if (result.repost) addToast("Shared to your timeline", "success")
                else if (result.story) addToast("Added to your story", "success")
                else if (result.messages?.length) addToast("Sent", "success")
                else addToast("Shared", "success")
              }
            }}
            onFindPeople={() => setTab?.("discover")}
            onDiscoverCommunities={() => setTab?.("communities")}
          />
        )
      })()}

{/* Loading indicator */}
          {isLoadingMore && (
            <div className="space-y-4">
              <PostSkeleton />
              <PostSkeleton />
            </div>
          )}

          {/* Infinite scroll trigger */}
          {displayedPostsCount < rankedPosts.length && <div ref={observerTargetRef} className="h-10" />}

          {/* End of feed */}
          {displayedPostsCount >= rankedPosts.length && rankedPosts.length > 0 && (
  <div className="mx-1 rounded-2xl border border-dashed border-emerald-200 bg-gradient-to-b from-emerald-50/70 to-background px-5 py-8 text-center" role="status">
  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><Users size={20} aria-hidden="true" /></div>
  <p className="text-sm font-bold text-foreground">You&apos;re all caught up</p>
  <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-muted-foreground">Find people or share a moment.</p>
  <div className="mt-4 flex flex-wrap justify-center gap-2">
  <button type="button" onClick={() => setTab?.("discover") || onProfile?.()} className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 active:scale-95">Find people</button>
  <button type="button" onClick={() => { setComposeMode("post"); setShowComposer(true); onCompose?.() }} className="rounded-full border border-border bg-card px-4 py-2 text-xs font-bold text-foreground transition hover:bg-muted active:scale-95">Share a moment</button>
  </div>
  </div>
          )}
        </div>
      </div>

            <CommentSheet
        post={commentingPostId ? posts.find((p) => p.id === commentingPostId) || null : null}
        open={Boolean(commentingPostId)}
        onClose={() => {
          setCommentingPostId(null)
          setReplyingToCommentId(null)
          setCommentText("")
          setShowCommentEmoji(false)
        }}
      />

      {/* Create menu — long-press FAB or overflow */}
      {showCreateMenu && (
        <>
          <button type="button" className="fixed inset-0 z-40 bg-black/30" aria-label="Close create menu" onClick={() => setShowCreateMenu(false)} />
          <div className="fixed bottom-28 right-4 z-50 w-56 overflow-hidden rounded-2xl border border-emerald-100 bg-card shadow-2xl" role="menu">
            <p className="border-b border-border px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Create</p>
            {([
              { id: "post", label: "Post", desc: "Share to your feed" },
              { id: "story", label: "Story", desc: "24h moment" },
              { id: "community", label: "Community", desc: "Open communities" },
            ] as const).map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setShowCreateMenu(false)
                  if (item.id === "community") {
                    setTab?.("communities")
                    return
                  }
                  setComposeMode(item.id)
                  setShowComposer(true)
                  onCompose?.()
                }}
                className="flex w-full flex-col items-start px-3 py-2.5 text-left transition hover:bg-emerald-50"
              >
                <span className="text-sm font-bold text-foreground">{item.label}</span>
                <span className="text-[11px] text-muted-foreground">{item.desc}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Compose FAB: short-press = post; long-press = Story · Post · Community */}
      <button
        type="button"
        onClick={() => {
          setComposeMode("post")
          setShowComposer(true)
          onCompose?.()
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          setShowCreateMenu(true)
        }}
        onPointerDown={(e) => {
          if (e.pointerType === "touch") {
            const timer = window.setTimeout(() => setShowCreateMenu(true), 450)
            const clear = () => window.clearTimeout(timer)
            e.currentTarget.addEventListener("pointerup", clear, { once: true })
            e.currentTarget.addEventListener("pointerleave", clear, { once: true })
            e.currentTarget.addEventListener("pointercancel", clear, { once: true })
          }
        }}
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-500 text-white shadow-lg transition hover:shadow-xl active:scale-95"
        aria-label="Create post. Long-press for Story or Community"
        aria-expanded={showCreateMenu}
        title="Tap to post · Long-press for more"
      >
        <Plus size={24} />
      </button>
      <PostComposer open={showComposer} onOpenChange={setShowComposer} initialMode={composeMode} />


      {/* Visibility reason tooltip */}
      {selectedVisibilityReason && (
        <VisibilityReasonTooltip
          reason={selectedVisibilityReason}
          onClose={() => {
            setVisibilityReasonPostId(null)
            setSelectedVisibilityReason(null)
          }}
        />
      )}

      <GlobalSearchModal
        open={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectPerson={() => setTab?.("discover")}
        onSelectPost={() => {
          /* stay on feed; post already listed */
        }}
        onSelectCommunity={() => setTab?.("communities")}
      />

      <SaveToCollectionSheet
        open={Boolean(saveCollectionPostId)}
        postId={saveCollectionPostId}
        onClose={() => setSaveCollectionPostId(null)}
        onSaved={(name) => addToast(`Saved to ${name}`, "success")}
      />
      <MediaLightbox
        open={Boolean(lightbox)}
        url={lightbox?.url || null}
        caption={lightbox?.caption}
        onClose={() => setLightbox(null)}
      />
      <PostInsightsSheet
        open={Boolean(insightsPost)}
        post={insightsPost}
        onClose={() => setInsightsPost(null)}
      />

      {/* Public profile peek from feed author name/photo */}
      {viewingAuthorId && (() => {
        const samplePost = posts.find((p) => p.authorId === viewingAuthorId)
        const candidate = (candidates || []).find((c: { id: string }) => c.id === viewingAuthorId)
        const name = candidate?.name || samplePost?.authorName || "Member"
        const photo = candidate?.photo || samplePost?.authorPhoto || "/placeholder.svg?width=80&height=80"
        const isFollowingAuthor = (following || []).includes(viewingAuthorId)
        return (
          <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true" aria-label={`${name}'s profile`}>
            <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={() => setViewingAuthorId(null)} />
            <div className="relative z-10 max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
                <h3 className="text-base font-bold text-gray-900">Profile</h3>
                <button type="button" onClick={() => setViewingAuthorId(null)} className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700">Close</button>
              </div>
              <div className="px-5 py-5">
                <div className="flex items-center gap-4">
                  <img src={photo} alt="" className="h-16 w-16 rounded-full object-cover ring-2 ring-purple-100" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-bold text-gray-900">{name}</p>
                    <p className="text-xs text-gray-500">{candidate?.location || "GH Connect member"}</p>
                    {candidate?.verified && <span className="mt-1 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">Verified</span>}
                  </div>
                </div>
                {candidate?.bio && <p className="mt-4 text-sm leading-relaxed text-gray-700">{candidate.bio}</p>}
                {/* Peer-only actions — no Edit / Write / cover upload */}
                <div className="mt-5">
                  <RelationshipActions
                    userId={viewingAuthorId}
                    userName={name}
                    userPhoto={photo}
                    compact={false}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setViewingAuthorId(null)
                    setTab("discover")
                  }}
                  className="mt-3 w-full min-h-10 rounded-xl border border-stone-200 bg-stone-50 text-sm font-semibold text-stone-700"
                >
                  Open in Find
                </button>
                <p className="mt-3 text-center text-[11px] text-stone-400">
                  Follow, Connect, Match or Message — based on your relationship. Messaging respects privacy and blocks.
                </p>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

export default EnhancedFeedScreen
