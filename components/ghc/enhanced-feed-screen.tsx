"use client"

import { closeAllActionSheets } from "./action-sheet"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import type { Post, FeedFilter, PostDraft, SavedPost } from "@/lib/ghc-types"
import { seedPosts } from "@/lib/ghc-data"
import { useGHCFeed, useGHCShell, useGHCMessaging } from "@/contexts/ghc-context"
import { IdentityService } from "@/lib/identity/identity-service"
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
import { HomeCommandCentre } from "./home-command-centre"
import { rankFeed, extractHashtags, extractMentions } from "@/lib/feed-ranking-engine"
import type { RankedPost, FeedLocationLane, FeedIntentionBias } from "@/lib/feed-ranking-engine"
import { buildCommentTree, sortComments } from "@/lib/comment-thread-utils"
import { useScrollHeader } from "@/lib/use-scroll-header"
import { CollapsingAppHeader } from "./collapsing-app-header"
import { BrandLogo } from "./brand-logo"
import { PostErrorBoundary } from "@/lib/error-boundary"
import { LazyImage } from "./lazy-image"
import { RelationshipActions } from "./relationship-actions"

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
    <div className="space-y-3 px-3 py-3" aria-hidden role="status" aria-label="Loading feed">
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse rounded-2xl border border-border/40 bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-28 rounded bg-muted" />
              <div className="h-2 w-16 rounded bg-muted/70" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-3 w-full rounded bg-muted/80" />
            <div className="h-3 w-4/5 rounded bg-muted/60" />
          </div>
          <div className="mt-3 h-36 rounded-xl bg-muted/50" />
        </div>
      ))}
    </div>
  )
}


export function EnhancedFeedScreen({ onCompose, onProfile }: EnhancedFeedScreenProps) {
  const {
    posts, profile, candidates, likePost, addComment, editComment, deleteComment,
    addCommentReaction, removeCommentReaction, pinComment, addToast, followUser,
    blockUser, reportPost, reportContent, deletePost, following, friends,
    blockedUsers, settings, applyShareResult, shares, reposts, setTab, editPost,
    muteUser, unfollowFromPost, archivePost, savePost, unsavePost,
  } = useGHCFeed()
  const { setTab: shellSetTab } = useGHCShell()
  const { conversations } = useGHCMessaging()
  // Prefer feed setTab; shell keeps chrome in sync when needed
  void shellSetTab
  const perms = usePermissions()
  const seedPostList = useMemo(() => seedPosts(), [])
  const seedPostIds = useMemo(() => new Set(seedPostList.map((post) => post.id)), [seedPostList])

  // State management
  const [activeFilter, setActiveFilter] = useState<FeedFilter>("for-you")
  const [locationLane, setLocationLane] = useState<FeedLocationLane>("worldwide")
  const [intentionBias, setIntentionBias] = useState<FeedIntentionBias>("balanced")
  const [focusMode, setFocusMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [viewingAuthorId, setViewingAuthorId] = useState<string | null>(null)
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [feedBootstrapped, setFeedBootstrapped] = useState(false)
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
        userInterests: Array.isArray(profile?.interests) ? profile.interests : [],
        recentlyEngagedPostIds: likedPosts,
        blockedUserIds: blockedIds,
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
      setRankedPosts(ranked)
      setFeedBootstrapped(true)
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Failed to rank feed")
      setFeedError(err)
      console.error("[Feed Ranking Error]", err)
      // Fallback: show unranked posts
      setRankedPosts(posts.map((post) => ({ post, score: 0, reason: { reason: "Feed unavailable", category: "error" } })))
      setFeedBootstrapped(true)
    }
  }, [activeFilter, posts, likedPosts, profile, bookmarkedPostIds, notInterestedIds, seedPostIds, seedPostList, blockedUsers, settings, following, friends, conversations, locationLane, intentionBias, focusMode])

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

  useEffect(() => {
    const open = (e: Event) => {
      const d = (e as CustomEvent).detail || {}
      if (d.mode === "story") setComposeMode("story")
      else setComposeMode("post")
      setShowComposer(true)
    }
    window.addEventListener("ghc:open-compose", open as EventListener)
    const close = () => setShowComposer(false)
    window.addEventListener("ghc:close-compose", close)
    window.addEventListener("ghc:tab-change", close)
    window.addEventListener("ghc:close-transient-ui", close)
    return () => {
      window.removeEventListener("ghc:open-compose", open as EventListener)
      window.removeEventListener("ghc:close-compose", close)
      window.removeEventListener("ghc:tab-change", close)
      window.removeEventListener("ghc:close-transient-ui", close)
    }
  }, [])

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
              className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-emerald-50 active:scale-90"
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
              className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide"
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
                    className={`flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all active:scale-[0.97] ${
                      selected
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
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

      {/* Feed content — skeleton until bootstrap so empty state never flashes under load */}
      {(!feedBootstrapped || (isRefreshing && rankedPosts.length === 0)) ? (
        <FeedSkeleton />
      ) : (
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
        className="gh-scroll-root min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-background px-1 scrollbar-hide [-webkit-overflow-scrolling:touch] touch-pan-y"
        style={pullDistance > 0 ? { transform: `translateY(${Math.min(pullDistance, 72)}px)` } : undefined}
      >
        <div className="space-y-3 px-3 pb-6 pt-2 sm:px-4 sm:pt-3">
          <HomeCommandCentre
            onCompose={() => {
              try { window.dispatchEvent(new CustomEvent("ghc:open-create-hub")) } catch { /* */ }
            }}
          />
          <ProfileStorySection scope="feed" />

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
                        ? "Check back soon for rising posts across GreenHaven."
                        : "Posts from people and communities you follow will show up here. Use Discover to grow your network, or the + button to share."
              }
              action={
                activeFilter === "following" || activeFilter === "friends"
                  ? { label: "Find people", onClick: () => setTab?.("discover") }
                  : activeFilter === "communities"
                    ? { label: "Explore communities", onClick: () => setTab?.("discover") }
                    : { label: "Discover people", onClick: () => setTab?.("discover") }
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
              currentUserId: IdentityService.getCurrentUserId(),
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
  <button type="button" onClick={() => { try { window.dispatchEvent(new CustomEvent("ghc:open-create-hub")) } catch { setShowComposer(true) } }} className="rounded-full border border-border bg-card px-4 py-2 text-xs font-bold text-foreground transition hover:bg-muted active:scale-95">Share a moment</button>
  </div>
  </div>
          )}
        </div>
      </div>
      )}

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

      {/* Create: bottom-nav Create hub only (no floating FAB) */}
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
                  <img src={photo} alt="" className="h-16 w-16 rounded-full object-cover ring-2 ring-purple-100" loading="lazy" decoding="async" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-bold text-gray-900">{name}</p>
                    <p className="text-xs text-gray-500">{candidate?.location || "GreenHaven member"}</p>
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
