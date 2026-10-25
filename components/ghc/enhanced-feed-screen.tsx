"use client"

import { POST_SYNC_EVENT, readPostSyncDetail } from "@/lib/social/post-sync"

import { closeAllActionSheets } from "./action-sheet"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import type { Post, FeedFilter, PostDraft, SavedPost } from "@/lib/ghc-types"
import { listPostDrafts, removePostDraft } from "@/lib/creator/post-drafts"
import { bootstrapPosts } from "@/lib/domains/adapters/session-bootstrap"
import { isDemoDataAllowed } from "@/lib/demo-data-policy"
import { useGHCFeed, useGHCShell, useGHCMessaging } from "@/contexts/ghc-context"
import { IdentityService } from "@/lib/identity/identity-service"
import { socialGetPost, socialRecordAttention } from "@/lib/social/client"
import { shouldSendAttention } from "@/lib/social/attention-client"
import { usePermissions } from "@/hooks/usePermissions"
import { ShareSheet } from "./share-sheet"
import type { ShareResult } from "@/lib/share-service"
import { Bookmark, Plus, Search, Filter, Zap, Clock, TrendingUp, Users, MapPin, RefreshCw, MessageCircle, Send, X, UsersRound, Hash } from "lucide-react"
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
import { CommentSheet } from "./comment-sheet"
import { PostDetailSheet } from "./post-detail-sheet"
import { isOwnAuthor } from "@/lib/ownership"
import { EnhancedPostCard, VisibilityReasonTooltip } from "./enhanced-post-card"
import ProfileStorySection from "./profile-story-section"
import { rankFeed, extractHashtags, extractMentions } from "@/lib/feed-ranking-engine"
import type { RankedPost, FeedLocationLane, FeedIntentionBias } from "@/lib/feed-ranking-engine"
import { buildCommentTree, sortComments } from "@/lib/comment-thread-utils"
import { broadcastPostEngagement } from "@/lib/engagement/post-engagement"
import { useScrollHeader } from "@/lib/use-scroll-header"
import { CollapsingAppHeader } from "./collapsing-app-header"
import { PremiumSurfaceActions } from "./premium-surface-actions"
import { BrandLogo } from "./brand-logo"
import { PostErrorBoundary } from "@/lib/error-boundary"
import { LazyImage } from "./lazy-image"
import { RelationshipActions } from "./relationship-actions"
import { FeedInterstitial, interstitialKindAt } from "./feed-interstitial"

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


interface EnhancedFeedScreenProps {
  onCompose?: () => void
  onProfile?: () => void
}


function FeedSkeleton() {
  return (
    <div className="space-y-4 px-3 py-3" role="status" aria-busy="true" aria-label="Loading feed">
      {[1, 2, 3].map((i) => (
        <div key={i} className="gh-card animate-pulse p-4">
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
          <div className="mt-3 h-36 rounded-[var(--gh-radius-md)] bg-muted/50" />
        </div>
      ))}
    </div>
  )
}


export function EnhancedFeedScreen({ onCompose, onProfile }: EnhancedFeedScreenProps) {
  const {
    posts, profile, candidates, likedPostIds, likePost, reactToPost,
    addToast, followUser,
    blockUser, reportPost, reportContent, deletePost, following, friends,
    blockedUsers, settings, applyShareResult, shares, reposts, setTab, editPost,
    muteUser, unfollowFromPost, archivePost, savePost, unsavePost, refreshFeed, loadPostComments,
  } = useGHCFeed()
  const { setTab: shellSetTab } = useGHCShell()
  const { conversations } = useGHCMessaging()
  // Prefer feed setTab; shell keeps chrome in sync when needed
  void shellSetTab
  const perms = usePermissions()
  // Demo/seed posts only when explicit demo policy allows — never as production feed filler
  const seedPostList = useMemo(() => bootstrapPosts(), [])
  const seedPostIds = useMemo(() => new Set(seedPostList.map((post) => post.id)), [seedPostList])

  // State management
  const [activeFilter, setActiveFilter] = useState<FeedFilter>(() => {
    try {
      const v = window.localStorage.getItem("ghc.feedFilter")
      if (v === "for-you" || v === "following" || v === "friends" || v === "communities" || v === "trending") return v
    } catch { /* */ }
    return "for-you"
  })
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
  const [hasMorePosts, setHasMorePosts] = useState(true)
  const [displayedPostsCount, setDisplayedPostsCount] = useState<number>(MOBILE_PAGE_SIZES.feed)
  const [likedPosts, setLikedPosts] = useState<string[]>([])
  // Keep the visible liked state tied to the authenticated server-hydrated feed,
  // rather than waiting for the user to click Like once in this screen session.
  useEffect(() => {
    setLikedPosts(Array.isArray(likedPostIds) ? likedPostIds : [])
  }, [likedPostIds])
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
  const [isOffline, setIsOffline] = useState(false)
  const [feedStatusMsg, setFeedStatusMsg] = useState<string | null>(null)
  const [showCreateMenu, setShowCreateMenu] = useState(false)
  const [commentingPostId, setCommentingPostId] = useState<string | null>(null)
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)
  const [saveCollectionPostId, setSaveCollectionPostId] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<{ url: string; caption?: string } | null>(null)
  const [insightsPost, setInsightsPost] = useState<Post | null>(null)
  const { compact: headerCompact, hidden: headerHidden, onScroll: onHeaderScroll } = useScrollHeader({
    threshold: 40,
  })
  const [commentSort, setCommentSort] = useState<"newest" | "liked" | "pinned">("newest")
  const containerRef = useRef<HTMLDivElement>(null)
  const startYRef = useRef(0)
  const touchIdentifierRef = useRef<number | null>(null)
  const pendingLikesRef = useRef(new Set<string>())
  const pendingCommentsRef = useRef(new Set<string>())

  // Infinite scroll detection
  const observerTargetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = () => {
      try {
        setDraftPosts(listPostDrafts())
      } catch {
        setDraftPosts([])
      }
    }
    load()
    const onChange = () => load()
    window.addEventListener("ghc:post-drafts-changed", onChange as EventListener)
    return () => window.removeEventListener("ghc:post-drafts-changed", onChange as EventListener)
  }, [])


  const loadMorePosts = useCallback(async () => {
    if (isLoadingMore || !hasMorePosts) return
    // Reveal already-hydrated posts locally before requesting another server page.
    if (displayedPostsCount < rankedPosts.length) {
      setDisplayedPostsCount((prev) => Math.min(rankedPosts.length, prev + MOBILE_PAGE_SIZES.feed))
      return
    }

    const sorted = [...(posts || [])].sort((a, b) => {
      const timeDelta = (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0)
      return timeDelta || String(b.id).localeCompare(String(a.id))
    })
    const oldestPost = sorted.length ? sorted[sorted.length - 1] : null
    const oldest = oldestPost ? Number(oldestPost.createdAt) || 0 : 0
    if (!oldestPost?.id) {
      // Initial feed hydration may not have completed when the sentinel first enters view.
      // Keep pagination eligible until the first hydration attempt has settled.
      if (posts.length === 0 && !feedBootstrapped) return
      setHasMorePosts(false)
      return
    }
    if (oldest <= 0 || typeof refreshFeed !== "function") {
      setHasMorePosts(false)
      return
    }

    try {
      setIsLoadingMore(true)
      const page = await refreshFeed({ before: oldest, beforeId: String(oldestPost.id), append: true, limit: 20 })
      if (!page.ok) throw new Error(page.error || "Could not load older posts")
      const fetchedCount = Math.max(0, Number(page.appended) || 0)
      if (fetchedCount === 0) {
        setHasMorePosts(false)
        return
      }
      // One state transition per server page. This prevents a page from being revealed twice.
      setDisplayedPostsCount((prev) => prev + Math.min(20, fetchedCount))
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Failed to load more posts")
      console.error("[Load More Error]", err)
      addToast("Failed to load more posts. Please try again.", "error")
    } finally {
      setIsLoadingMore(false)
    }
  }, [addToast, displayedPostsCount, feedBootstrapped, hasMorePosts, isLoadingMore, posts, rankedPosts.length, refreshFeed])


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
  }, [hasMorePosts, isLoadingMore, displayedPostsCount, loadMorePosts, rankedPosts.length])

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
        recentlyEngagedPostIds: [...new Set([...bookmarkedPostIds, ...likedPosts])],
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
      // Production: empty feed when no real posts (honest empty state). Demo: optional seed filler.
      const feedPosts =
        realPosts.length > 0
          ? realPosts
          : isDemoDataAllowed()
            ? seedPostList.slice(0, 3)
            : []
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


  useEffect(() => {
    if (typeof window === "undefined") return
    const sync = () => setIsOffline(!navigator.onLine)
    sync()
    window.addEventListener("online", sync)
    window.addEventListener("offline", sync)
    return () => {
      window.removeEventListener("online", sync)
      window.removeEventListener("offline", sync)
    }
  }, [])

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true)
      setFeedStatusMsg("Refreshing feed…")
      setFeedError(null)
      const result = await refreshFeed()
      if (result.ok) setHasMorePosts(true)
      if (!result.ok) {
        const err = new Error(result.error || "Failed to refresh feed")
        setFeedError(err)
        setFeedStatusMsg("Refresh failed")
        addToast(result.error || "Failed to refresh. Try again.", "error")
        return
      }
      setDisplayedPostsCount(MOBILE_PAGE_SIZES.feed)
      if (result.durable) {
        addToast("Feed refreshed", "success")
        setFeedStatusMsg("Feed updated")
      } else {
        addToast("Showing local feed — server feed unavailable", "info")
        setFeedStatusMsg("Showing local feed")
      }
      window.setTimeout(() => setFeedStatusMsg(null), 2500)
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Failed to refresh feed")
      console.error("[Refresh Error]", err)
      setFeedError(err)
      setFeedStatusMsg("Refresh failed")
      addToast("Failed to refresh. Try again.", "error")
    } finally {
      setIsRefreshing(false)
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


  const handleReact = useCallback(
    async (postId: string, reaction: string) => {
      try {
        await reactToPost(postId, reaction)
      } catch (error) {
        console.error("[Reaction Error]", error)
        addToast("Could not update reaction. Try again.", "error")
      }
    },
    [reactToPost, addToast]
  )


  const handleSave = useCallback(async (postId: string) => {
    const isBookmarked = bookmarkedPostIds.includes(postId)
    const previous = bookmarkedPostIds
    try {
      if (isBookmarked) {
        setBookmarkedPostIds((prev) => prev.filter((id) => id !== postId))
        if (unsavePost) await unsavePost(postId)
      } else {
        setBookmarkedPostIds((prev) => [...prev, postId])
        setSaveCollectionPostId(postId)
        if (savePost) {
          await savePost(postId)
          if (shouldSendAttention(postId, "save")) void socialRecordAttention(postId, "save")
        }
      }
    } catch (error) {
      setBookmarkedPostIds(previous)
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
  }, [])

  const openPostDetail = useCallback((postId: string) => {
    setSelectedPostId(postId)
  }, [])

  // Profile owner-post actions route through the canonical Feed overlays so the
  // same comment, share, and insights flows are reused instead of duplicated.
  const [routedPost, setRoutedPost] = useState<Post | null>(null)

  useEffect(() => {
    let cancelled = false
    const handleOpenPostAction = async (event: Event) => {
      const detail = (event as CustomEvent<{ postId?: unknown; commentId?: unknown; action?: unknown }>).detail
      const postId = typeof detail?.postId === "string" ? detail.postId.trim() : ""
      if (!postId) return
      const action = typeof detail?.action === "string" ? detail.action : ""
      const commentId = typeof detail?.commentId === "string" ? detail.commentId.trim() : ""
      const openLoadedPost = (target: Post) => {
        if (cancelled) return
        if (action === "comment") {
          openComments(target.id)
          if (commentId) window.setTimeout(() => window.dispatchEvent(new CustomEvent("ghc:focus-comment", { detail: { postId: target.id, commentId } })), 80)
        } else if (action === "share") setSharePostId(target.id)
        else if (action === "insights") setInsightsPost(target)
        try {
          window.setTimeout(() => {
            const el = document.querySelector(`[data-post-id="${CSS.escape(target.id)}"]`) as HTMLElement | null
            el?.scrollIntoView({ behavior: "smooth", block: "center" })
          }, 80)
        } catch { /* */ }
      }

      const local = posts.find((post) => post.id === postId) || rankedPosts.find((ranked) => ranked.post.id === postId)?.post
      if (local) {
        openLoadedPost(local)
        return
      }

      // Profile posts can be older than the currently loaded feed page. Hydrate
      // the requested post directly instead of treating a missing feed-page row
      // as a missing post. This fixes Profile → Comment/Share/Insights routing.
      try {
        const result = await socialGetPost(postId)
        if (!result.ok || !result.post || cancelled) {
          addToast(result.error === "POST_NOT_FOUND" ? "This post is no longer available." : "Could not open this post. Please try again.", "error")
          return
        }
        const raw = result.post as Partial<Post>
        const hydrated: Post = {
          ...(raw as Post),
          id: postId,
          authorId: String(raw.authorId || ""),
          authorName: String(raw.authorName || "Member"),
          authorPhoto: String(raw.authorPhoto || ""),
          content: String(raw.content || ""),
          images: Array.isArray(raw.images) ? raw.images : [],
          comments: Array.isArray(raw.comments) ? raw.comments : [],
          engagement: raw.engagement || {
            likes: Number((raw as { likes?: number }).likes || 0),
            comments: Number(
              (raw as { commentCount?: number }).commentCount ??
                (Array.isArray(raw.comments) ? raw.comments.length : 0)
            ),
            shares: Number((raw as { shares?: number }).shares || 0),
            views: 0,
            saves: 0,
            clicks: 0,
            avgEngagementTime: 0,
          },
        }
        setRoutedPost(hydrated)
        openLoadedPost(hydrated)
      } catch {
        if (!cancelled) addToast("Could not open this post. Please try again.", "error")
      }
    }
    window.addEventListener("ghc:open-post", handleOpenPostAction as EventListener)
    window.addEventListener("ghc:open-post-ready", handleOpenPostAction as EventListener)
    return () => {
      cancelled = true
      window.removeEventListener("ghc:open-post", handleOpenPostAction as EventListener)
      window.removeEventListener("ghc:open-post-ready", handleOpenPostAction as EventListener)
    }
  }, [openComments, posts, rankedPosts, addToast, setRoutedPost])

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
            className={`h-8 w-8 rounded-full border-[3px] border-emerald-200 border-t-[var(--gh-green)] transition-all ${
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
            <PremiumSurfaceActions />
          </>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-border/50 bg-background/95 px-3 py-2 backdrop-blur">
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto scrollbar-hide" role="tablist" aria-label="Feed filters">
              {FEED_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  role="tab"
                  aria-selected={activeFilter === filter.value}
                  onClick={() => setActiveFilter(filter.value)}
                  className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[11px] font-bold transition ${activeFilter === filter.value ? "bg-[var(--gh-green)] text-white" : "bg-muted/60 text-muted-foreground hover:bg-muted"}`}
                >
                  {filter.icon}<span>{filter.shortLabel}</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setIsSearchOpen((v) => !v)} aria-label={isSearchOpen ? "Close feed search" : "Search feed"} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-card">
              {isSearchOpen ? <X size={16} /> : <Search size={16} />}
            </button>
            <button type="button" onClick={() => void handleRefresh()} disabled={isRefreshing} aria-label="Refresh feed" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-card disabled:opacity-50">
              <RefreshCw size={15} className={isRefreshing ? "animate-spin" : ""} />
            </button>
          </div>
          {isSearchOpen ? (
            <input
              autoFocus
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search posts, people, hashtags…"
              aria-label="Search posts, people, and hashtags"
              className="mt-2 min-h-10 w-full rounded-xl border border-border/70 bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          ) : null}
          {feedStatusMsg ? <p className="mt-1 text-[10px] text-muted-foreground" role="status">{feedStatusMsg}</p> : null}
        </div>

        {isOffline ? <div className="mx-3 mt-2 rounded-xl border border-amber-300/70 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-900 dark:bg-amber-950/30 dark:text-amber-100" role="status">Offline — showing available feed data. New actions may require a connection.</div> : null}
        {feedError ? <div className="mx-3 mt-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11px] text-destructive" role="alert">{feedError.message}</div> : null}

        <div
          ref={containerRef}
          className="min-h-0 flex-1 overflow-y-auto pb-[var(--gh-screen-bottom-inset)] scrollbar-hide [-webkit-overflow-scrolling:touch]"
          onScroll={onHeaderScroll}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={() => void handleTouchEnd()}
        >
          {pullDistance > 0 ? <div className="px-4 py-1 text-center text-[10px] text-muted-foreground">{isRefreshing ? "Refreshing…" : pullDistance > 80 ? "Release to refresh" : "Pull to refresh"}</div> : null}
          {!feedBootstrapped ? (
            <FeedSkeleton />
          ) : displayPosts.length === 0 ? (
            <EmptyState
              title={searchQuery.trim() ? "No matching posts" : "Your feed is getting ready"}
              description={searchQuery.trim() ? "Try another keyword or hashtag." : hasRealPosts ? "No posts match this filter yet. Try another feed filter." : "Follow people or explore communities to bring relevant posts into your feed."}
              action={searchQuery.trim() ? { label: "Clear search", onClick: () => setSearchQuery("") } : { label: "Discover people", onClick: () => setTab("discover") }}
            />
          ) : (
            <div className="space-y-3 px-3 py-3">
              {displayPosts.map(({ post, reason }, index) => (
                <div key={post.id}>
                  {index > 0 && interstitialKindAt(index) ? (
                    <FeedInterstitial
                      kind={interstitialKindAt(index)!}
                      onFindPeople={() => setTab("discover")}
                      onOpenMarketplace={() => setTab("marketplace")}
                      onOpenCommunities={() => setTab("communities")}
                      onCreate={() => onCompose?.()}
                    />
                  ) : null}
                  <PostErrorBoundary>
                    <EnhancedPostCard
                      post={post}
                      isLiked={likedPosts.includes(post.id)}
                      isSaved={bookmarkedPostIds.includes(post.id)}
                      isOwnPost={isOwnAuthor(post.authorId, post.authorName, profile)}
                      onLike={handleLike}
                      onReact={handleReact}
                      onComment={openComments}
                      onShare={(postId) => setSharePostId(postId)}
                      onSave={handleSave}
                      onNotInterested={handleNotInterested}
                      onShowVisibilityReason={handleShowVisibilityReason}
                      visibilityReason={reason}
                      onOpenPost={openPostDetail}
                      onOpenProfile={() => { onProfile?.(); setTab("profile") }}
                    />
                  </PostErrorBoundary>
                </div>
              ))}
              <div ref={observerTargetRef} className="flex min-h-12 items-center justify-center py-3" aria-live="polite">
                {isLoadingMore ? <span className="text-[11px] text-muted-foreground">Loading more posts…</span> : hasMorePosts ? <button type="button" onClick={() => void loadMorePosts()} className="rounded-full border border-border/70 bg-card px-4 py-2 text-[11px] font-bold">Load more</button> : <span className="text-[10px] text-muted-foreground">You’re all caught up</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      <CommentSheet post={posts.find((post) => post.id === commentingPostId) || routedPost} open={Boolean(commentingPostId)} onClose={() => setCommentingPostId(null)} />
      <PostDetailSheet
        post={posts.find((post) => post.id === selectedPostId) || rankedPosts.find((item) => item.post.id === selectedPostId)?.post || routedPost}
        open={Boolean(selectedPostId)}
        onClose={() => setSelectedPostId(null)}
        onComments={openComments}
        onShare={(postId) => setSharePostId(postId)}
        onOpenMedia={(url, caption) => setLightbox({ url, caption })}
        loadComments={loadPostComments}
      />
      <MediaLightbox open={Boolean(lightbox)} url={lightbox?.url || null} caption={lightbox?.caption} onClose={() => setLightbox(null)} />
      <SaveToCollectionSheet
        open={Boolean(saveCollectionPostId)}
        postId={saveCollectionPostId}
        onClose={() => setSaveCollectionPostId(null)}
        onSaved={() => {
          if (saveCollectionPostId) {
            setBookmarkedPostIds((current) => current.includes(saveCollectionPostId) ? current : [...current, saveCollectionPostId])
          }
        }}
      />
      <PostInsightsSheet post={insightsPost} open={Boolean(insightsPost)} onClose={() => setInsightsPost(null)} />
      {sharePostId && (posts.find((post) => post.id === sharePostId) || rankedPosts.find((item) => item.post.id === sharePostId)?.post) ? (
        <ShareSheet
          post={(posts.find((post) => post.id === sharePostId) || rankedPosts.find((item) => item.post.id === sharePostId)!.post)}
          open
          onClose={() => setSharePostId(null)}
          shareContext={{ currentUserId: profile?.id || IdentityService.getCurrentUserId() || "", blockedUsers: blockedUsers || [], posts: posts || [], conversations: conversations || [] }}
          onComplete={(result: ShareResult) => { applyShareResult(result); setSharePostId(null) }}
          onFindPeople={() => setTab("discover")}
          onDiscoverCommunities={() => setTab("communities")}
        />
      ) : null}
    </div>
  )
}

export default EnhancedFeedScreen
