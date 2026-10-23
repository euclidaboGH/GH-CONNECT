"use client"

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
import { useDailyClaimStatus } from "./use-daily-claim-status"

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
          engagement: raw.engagement || { likes: Number(raw.likes || 0), comments: Number(raw.commentCount || 0), shares: Number(raw.shares || 0), views: 0, saves: 0, clicks: 0, avgEngagementTime: 0 },
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
  const currentUserId = IdentityService.getCurrentUserId() || ""
  const dailyClaim = useDailyClaimStatus(currentUserId, Boolean(currentUserId))

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
            <button
              type="button"
              onClick={() => {
                try {
                  if (dailyClaim.status?.claimable) {
                    window.localStorage.removeItem("ghc-daily-claim-dismissed-day")
                    window.dispatchEvent(new CustomEvent("ghc:open-daily-claim"))
                  } else {
                    window.dispatchEvent(new CustomEvent("ghc:open-rewards"))
                  }
                } catch { /* */ }
              }}
              aria-label={dailyClaim.status?.claimable ? "Daily GHC reward ready to claim" : dailyClaim.status?.claimedToday ? "Daily GHC reward claimed today" : "Open daily GHC rewards"}
              title={dailyClaim.status?.claimable ? "Daily reward ready to claim" : dailyClaim.status?.claimedToday ? "Daily reward claimed today" : "Daily rewards"}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-2.5 text-xs font-bold transition hover:bg-muted ${dailyClaim.status?.claimable ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-border/60 text-foreground/80"}`}
            >
              <span aria-hidden>◈</span>
              <span>{dailyClaim.status?.claimable ? "Reward ready" : dailyClaim.status?.claimedToday ? "Claimed" : "GHC"}</span>
              {dailyClaim.status?.claimable ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden /> : null}
            </button>
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
              className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-muted active:scale-90"
            >
              <Search size={18} className="text-foreground/80" />
            </button>
          </>
        }
        secondary={
          <>
            {/* Daily claim uses fixed modal (DailyClaimPrompt) — do not push header/content */}
            {/* header search only */}
            {isSearchOpen && searchQuery && (
              <div className="mb-1.5 flex gap-2">
                <input
                  type="text"
                  data-ghc-search="1" placeholder="Search posts, people, hashtags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 rounded-full border border-border/70 bg-muted/40 px-4 py-2 text-sm outline-none transition focus:border-primary/40 focus:bg-card focus:ring-2 focus:ring-primary/20"
                  autoFocus
                />
              </div>
            )}
            <div
              className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide"
              role="tablist"
              aria-label="Feed modes"
              onKeyDown={(e) => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return
                e.preventDefault()
                const idx = FEED_FILTERS.findIndex((f) => f.value === activeFilter)
                if (idx < 0) return
                let next = idx
                if (e.key === "ArrowRight") next = (idx + 1) % FEED_FILTERS.length
                if (e.key === "ArrowLeft") next = (idx - 1 + FEED_FILTERS.length) % FEED_FILTERS.length
                if (e.key === "Home") next = 0
                if (e.key === "End") next = FEED_FILTERS.length - 1
                setActiveFilter(FEED_FILTERS[next].value); try { window.localStorage.setItem("ghc.feedFilter", FEED_FILTERS[next].value) } catch { /* */ }
                setDisplayedPostsCount(MOBILE_PAGE_SIZES.feed)
              }}
            >
              {FEED_FILTERS.map((filter) => {
                const selected = activeFilter === filter.value
                return (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => {
                      setActiveFilter(filter.value); try { window.localStorage.setItem("ghc.feedFilter", filter.value) } catch { /* */ }
                      setDisplayedPostsCount(MOBILE_PAGE_SIZES.feed)
                    }}
                    role="tab"
                    aria-selected={selected}
                    tabIndex={selected ? 0 : -1}
                    aria-label={`${filter.label} feed — ${filter.hint}`}
                    title={filter.hint}
                    className={`flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.97] ${
                      selected
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    }`}
                  >
                    <span className={selected ? "text-primary-foreground/90" : "text-muted-foreground"} aria-hidden>
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

      <div className="sr-only" role="status" aria-live="polite">
        {feedStatusMsg || (isRefreshing ? "Refreshing feed" : "")}
      </div>

      {isOffline && (
        <div
          className="mx-3 mt-2 flex items-start gap-2 rounded-[1.25rem] border border-amber-200/80 bg-amber-50/90 px-3.5 py-2.5 text-left shadow-sm dark:border-amber-900 dark:bg-amber-950/40"
          role="status"
        >
          <span className="mt-0.5 text-amber-800 dark:text-amber-200" aria-hidden>
            !
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-amber-950 dark:text-amber-100">You&apos;re offline</p>
            <p className="text-[11px] leading-snug text-amber-900/90 dark:text-amber-200/90">
              Showing what&apos;s already on this device. New posts load when you&apos;re back online.
            </p>
          </div>
        </div>
      )}

      {/* Error state */}
      {feedError && (
        <div className="mx-3 mt-4 rounded-[1.25rem] border border-destructive/25 bg-destructive/5 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-destructive" aria-hidden="true">⚠️</div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-destructive">Couldn&apos;t load your feed</h3>
              <p className="mt-1 text-xs text-destructive/90">{feedError.message || "Check your connection and try again."}</p>
              <button
                type="button"
                onClick={() => { setFeedError(null); void handleRefresh() }}
                className="mt-2 min-h-9 rounded-full border border-destructive/30 bg-card px-3 text-xs font-semibold text-destructive transition hover:bg-destructive/10"
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
        role="feed"
        aria-label={`${activeFilter} feed`}
        aria-busy={isRefreshing || isLoadingMore}
        className="gh-feed-scroll gh-scroll-root min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-background scrollbar-hide [-webkit-overflow-scrolling:touch] touch-pan-y"
        style={pullDistance > 0 ? { transform: `translateY(${Math.min(pullDistance, 72)}px)` } : undefined}
      >
        <div className="gh-feed-column space-y-3 pb-6 pt-2 sm:pt-3">
          {/* Moments lead the feed; the public timeline begins immediately underneath. */}
          <ProfileStorySection scope="feed" />
          {/* Daily reward status is kept compact in the app header; details live in Rewards Centre. */}

      {draftPosts.length > 0 ? (
        <div className="mx-3 mb-2 rounded-2xl border border-border/50 bg-card/80 px-3 py-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Drafts</p>
            <span className="text-[10px] text-muted-foreground">{draftPosts.length}</span>
          </div>
          <ul className="space-y-1.5">
            {draftPosts.slice(0, 3).map((d) => (
              <li key={d.id} className="flex items-center gap-2">
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left text-[13px] text-foreground"
                  onClick={() => {
                    try {
                      window.dispatchEvent(
                        new CustomEvent("ghc:open-compose", {
                          detail: { mode: "post", draftId: d.id, text: d.content },
                        }),
                      )
                    } catch { /* */ }
                  }}
                >
                  {d.content.trim() || "Untitled draft"}
                </button>
                <button
                  type="button"
                  className="shrink-0 text-[11px] font-semibold text-muted-foreground"
                  onClick={() => {
                    removePostDraft(d.id)
                    setDraftPosts((prev) => prev.filter((x) => x.id !== d.id))
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}


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
                activeFilter === "communities"
                  ? { label: "Explore communities", onClick: () => setTab?.("communities") }
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
                  : {
                      label: "Create a post",
                      onClick: () => {
                        try {
                          window.dispatchEvent(new CustomEvent("ghc:open-compose", { detail: { mode: "post" } }))
                        } catch {
                          /* App shell owns the global composer. */
                        }
                      },
                    }
              }
            />
          ) : (
            displayPosts.map((rankedPost) => (
            <div key={rankedPost.post.id} className="cv-auto min-w-0 max-w-full">
              <PostErrorBoundary postId={rankedPost.post.id}>
                <EnhancedPostCard
                  post={rankedPost.post}
                  isLiked={likedPosts.includes(rankedPost.post.id)}
                  isSaved={bookmarkedPostIds.includes(rankedPost.post.id)}
                  isOwnPost={isOwnAuthor(rankedPost.post.authorId, rankedPost.post.authorName, profile)}
                  onLike={(id) => {
                    // Post-level likes deprecated for matching; keep handler for ranking legacy signals only
                    if (!perms.canLike(rankedPost.post.authorId)) return
                    handleLike(id)
                  }}
                  onReact={(id, reaction) => {
                    if (!perms.canLike(rankedPost.post.authorId)) {
                      addToast("You can't react to this post", "error")
                      return
                    }
                    void handleReact(id, reaction)
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
                  onOpenPost={openPostDetail}
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
                      ? (postId, content, media) => void editPost(postId, content, media)
                      : undefined
                  }
                />
              </PostErrorBoundary>
            </div>
            ))
          )}

{/* Loading indicator */}
          {isLoadingMore && (
            <div className="space-y-4">
              <PostSkeleton />
              <PostSkeleton />
            </div>
          )}

          {/* Infinite scroll trigger */}
          {hasMorePosts && <div ref={observerTargetRef} className="h-10" aria-hidden="true" />}

          {/* Pagination stays available while the local list is expanded or the server may have older posts. */}
          {(displayedPostsCount < rankedPosts.length || hasMorePosts) && rankedPosts.length > 0 && (
            <div className="flex justify-center py-3">
              <button
                type="button"
                disabled={isLoadingMore}
                onClick={() => void loadMorePosts()}
                className="min-h-10 rounded-full border border-border/70 bg-card px-5 text-xs font-bold text-foreground shadow-sm transition hover:bg-muted disabled:opacity-60"
              >
                {isLoadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}

          {displayedPostsCount >= rankedPosts.length && !hasMorePosts && rankedPosts.length > 0 && (
            <div
              className="mx-1 rounded-[1.25rem] border border-dashed border-emerald-200/80 bg-gradient-to-b from-emerald-50/70 to-background px-5 py-8 text-center dark:border-emerald-900/50 dark:from-emerald-950/30"
              role="status"
            >
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <Users size={20} aria-hidden="true" />
              </div>
              <p className="text-sm font-bold text-foreground">You&apos;re all caught up</p>
              <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-muted-foreground">
                Find people or share a moment.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setTab?.("discover")}
                  className="rounded-full bg-[var(--gh-green)] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:brightness-105 active:scale-95"
                >
                  Find people
                </button>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      window.dispatchEvent(new CustomEvent("ghc:open-create-hub"))
                    } catch {
                      /* App shell owns the global composer. */
                    }
                  }}
                  className="rounded-full bg-[var(--gh-green)] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:brightness-105 active:scale-95"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      window.dispatchEvent(new CustomEvent("ghc:open-story-creator"))
                    } catch {
                      /* App shell owns the global composer. */
                    }
                  }}
                  className="rounded-full border border-border bg-card px-4 py-2 text-xs font-bold text-foreground transition hover:bg-muted active:scale-95"
                >
                  Add story
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
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
              if (!result.ok) return
              void (async () => {
                let durableOk = true
                if (sharePostId) {
                  try {
                    const { socialSharePost } = await import("@/lib/social/client")
                    const remote = await socialSharePost(sharePostId)
                    durableOk = remote.ok !== false
                    if (remote.ok && typeof remote.shareCount === "number") {
                      broadcastPostEngagement({ postId: sharePostId, kind: "share", shareCount: remote.shareCount })
                    }
                  } catch {
                    durableOk = false
                  }
                  if (shouldSendAttention(sharePostId, "share")) {
                    void socialRecordAttention(sharePostId, "share")
                  }
                }
                if (result.link) addToast("Link copied", "success")
                else if (result.repost) addToast("Shared to your timeline", "success")
                else if (result.story) addToast("Added to your story", "success")
                else if (result.messages?.length) {
                  const n = result.messages.length
                  addToast(n > 1 ? `Shared to ${n} communities/chats` : "Shared to community", "success")
                }
                else if (!durableOk) addToast("Could not sync share to server", "error")
                else addToast("Shared", "success")
              })()
            }}
            onFindPeople={() => setTab?.("discover")}
            onDiscoverCommunities={() => setTab?.("communities")}
          />
        )
      })()}

      <PostDetailSheet
        post={selectedPostId ? posts.find((p) => p.id === selectedPostId) || rankedPosts.find((r) => r.post.id === selectedPostId)?.post || (routedPost?.id === selectedPostId ? routedPost : null) : null}
        open={Boolean(selectedPostId)}
        onClose={() => setSelectedPostId(null)}
        onComments={(postId) => { setSelectedPostId(null); setCommentingPostId(postId) }}
        onShare={(postId) => { setSelectedPostId(null); setSharePostId(postId) }}
        onOpenMedia={(url, caption) => setLightbox({ url, caption })}
        loadComments={loadPostComments}
      />

      <CommentSheet
        post={commentingPostId ? posts.find((p) => p.id === commentingPostId) || (routedPost?.id === commentingPostId ? routedPost : null) : null}
        open={Boolean(commentingPostId)}
        onClose={() => {
          setCommentingPostId(null)
        }}
      />


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
            <div className="relative z-10 max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card shadow-2xl sm:rounded-3xl">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/50 bg-card px-4 py-3">
                <h3 className="text-base font-bold text-foreground">Profile</h3>
                <button type="button" onClick={() => setViewingAuthorId(null)} className="rounded-full bg-muted px-3 py-1.5 text-xs font-bold text-foreground">Close</button>
              </div>
              <div className="px-5 py-5">
                <div className="flex items-center gap-4">
                  <img src={photo} alt="" className="h-16 w-16 rounded-full object-cover ring-2 ring-emerald-100 dark:ring-emerald-900" loading="lazy" decoding="async" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-bold text-foreground">{name}</p>
                    <p className="text-xs text-muted-foreground">{candidate?.location || "GreenHaven member"}</p>
                    {candidate?.verified && <span className="mt-1 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">Verified</span>}
                  </div>
                </div>
                {candidate?.bio && <p className="mt-4 text-sm leading-relaxed text-foreground/90">{candidate.bio}</p>}
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
                  className="mt-3 min-h-10 w-full rounded-xl border border-border/70 bg-muted/40 text-sm font-semibold text-foreground"
                >
                  Open in Find
                </button>
                <p className="mt-3 text-center text-[11px] text-muted-foreground">
                  Like or pass for matching, or connect and message — based on your relationship. Blocks are always respected.
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
