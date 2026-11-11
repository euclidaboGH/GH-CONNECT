"use client"

import { POST_SYNC_EVENT, readPostSyncDetail } from "@/lib/social/post-sync"

import { closeAllActionSheets } from "./action-sheet"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import type { Post, FeedFilter, PostDraft, SavedPost } from "@/lib/ghc-types"
import { listPostDrafts, removePostDraft } from "@/lib/creator/post-drafts"
import { bootstrapPosts } from "@/lib/domains/adapters/session-bootstrap"
import { isDemoDataAllowed } from "@/lib/demo-data-policy"
import { emitSectionRefresh } from "@/lib/client/section-refresh"
import { useSectionRefresh } from "@/hooks/use-section-refresh"
import { useGHCFeed, useGHCShell, useGHCMessaging } from "@/contexts/ghc-context"
import { IdentityService } from "@/lib/identity/identity-service"
import { resolveAvatarUrl } from "@/lib/avatar"
import { socialGetPost, socialRecordAttention } from "@/lib/social/client"
import { shouldSendAttention } from "@/lib/social/attention-client"
import { usePermissions } from "@/hooks/usePermissions"
import { ShareSheet } from "./share-sheet"
import type { ShareResult } from "@/lib/share-service"
import { Bookmark, Plus, Search, Filter, Zap, Clock, TrendingUp, Users, MapPin, RefreshCw, MessageCircle, Send, X, UsersRound, Hash, Compass, Store } from "lucide-react"
import { MOBILE_PAGE_SIZES, getAdaptiveFeedPageSize, prefetchMediaFacades, preferReducedData, setPreferReducedData } from "@/lib/mobile-performance"
import { getBoundDomainServices } from "@/lib/domains/compat"
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
import { ComposerPromptBar } from "./composer-prompt-bar"
import { rankFeed, extractHashtags, extractMentions } from "@/lib/feed-ranking-engine"
import type { RankedPost, FeedLocationLane, FeedIntentionBias } from "@/lib/feed-ranking-engine"
import { buildCommentTree, sortComments } from "@/lib/comment-thread-utils"
import { broadcastPostEngagement } from "@/lib/engagement/post-engagement"
import { useScrollHeader } from "@/lib/use-scroll-header"
import { useRegionalContext } from "@/contexts/regional-context"
import { getExperienceMessage, type ExperienceMessageKey } from "@/lib/i18n/experience"
import { CollapsingAppHeader } from "./collapsing-app-header"
import { PremiumSurfaceActions } from "./premium-surface-actions"
import { FloatingCreateButton } from "./feed-components"
import { BrandLogo } from "./brand-logo"
import { PostErrorBoundary } from "@/lib/error-boundary"
import { LazyImage } from "./lazy-image"
import { RelationshipActions } from "./relationship-actions"
import { FeedInterstitial, interstitialKindAt } from "./feed-interstitial"
import { FilterSummary } from "./filtering/filter-summary"
import { matchesFilterQuery } from "@/lib/filtering/filter-utils"

const FEED_FILTERS: {
  value: FeedFilter
  label: ExperienceMessageKey
  shortLabel: ExperienceMessageKey
  icon: React.ReactNode
  hint: string
}[] = [
  { value: "for-you", label: "forYou", shortLabel: "forYou", icon: <Zap size={14} />, hint: "Quality picks for you" },
  { value: "following", label: "following", shortLabel: "following", icon: <Users size={14} />, hint: "People you follow" },
  { value: "friends", label: "friends", shortLabel: "friends", icon: <UsersRound size={14} />, hint: "Your connections" },
  { value: "communities", label: "communities", shortLabel: "communities", icon: <Hash size={14} />, hint: "Community activity" },
  { value: "trending", label: "trending", shortLabel: "trending", icon: <TrendingUp size={14} />, hint: "What's rising now" },
  { value: "saved", label: "saved", shortLabel: "saved", icon: <Bookmark size={14} />, hint: "Posts you saved" },
]


interface EnhancedFeedScreenProps {
  onCompose?: () => void
  onProfile?: () => void
}


function FeedSkeleton() {
  return (
    <div className="space-y-4 px-3 py-3" role="status" aria-busy="true" aria-label="Loading feed">
      {[1, 2, 3].map((i) => (
        <div key={i} className="gh-card gh-skeleton p-4">
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
    blockedUsers, mutedUsers, settings, applyShareResult, shares, reposts, setTab, editPost,
    muteUser, unfollowFromPost, archivePost, savePost, unsavePost, refreshFeed, loadPostComments, hidePost } = useGHCFeed()
  const { setTab: shellSetTab } = useGHCShell()
  const { conversations } = useGHCMessaging()
  // Prefer feed setTab; shell keeps chrome in sync when needed
  void shellSetTab
  const perms = usePermissions()
  const regional = useRegionalContext()
  const t = useCallback((key: ExperienceMessageKey) => getExperienceMessage(key, regional.locale), [regional.locale])
  // Demo/seed posts only when explicit demo policy allows — never as production feed filler
  const seedPostList = useMemo(() => bootstrapPosts(), [])
  const seedPostIds = useMemo(() => new Set(seedPostList.map((post) => post.id)), [seedPostList])

  // Subscribe to the canonical identity signal so account changes are observed
  // even before the broader profile snapshot finishes hydrating.
  const [identityOwnerSignal, setIdentityOwnerSignal] = useState<{ received: boolean; userId: string | null }>({ received: false, userId: IdentityService.getCurrentUserId() || null })
  useEffect(() => IdentityService.subscribe((identity) => setIdentityOwnerSignal({ received: true, userId: identity.userId || null })), [])
  // Feed preferences are account-scoped. Never read a previous account's global device keys while the authenticated identity is hydrating.
  const ownerCandidate = identityOwnerSignal.received ? identityOwnerSignal.userId : profile?.id
  const normalizedOwnerId = String(ownerCandidate || "").trim()
  const feedPreferenceOwnerId = normalizedOwnerId && normalizedOwnerId !== "current-user" && normalizedOwnerId !== "preview-user" ? normalizedOwnerId : "anonymous"
  const hasFeedPreferenceOwner = feedPreferenceOwnerId !== "anonymous"
  const feedPreferencesStorageKey = `ghc.feed-preferences.v2:${feedPreferenceOwnerId}`
  const hiddenPostStorageKey = `ghc.hidden-post-ids.v2:${feedPreferenceOwnerId}`
  const [feedPreferencesLoadedFor, setFeedPreferencesLoadedFor] = useState("anonymous")
  const [hiddenPostIds, setHiddenPostIds] = useState<string[]>([])

  // State management
  const [activeFilter, setActiveFilter] = useState<FeedFilter>("for-you")
  const [locationLane, setLocationLane] = useState<FeedLocationLane>("worldwide")
  const [intentionBias, setIntentionBias] = useState<FeedIntentionBias>("balanced")
  const [focusMode, setFocusMode] = useState(false)
  const [showFeedControls, setShowFeedControls] = useState(false)
  // Device-local data saver; browser/network constrained-data signals always take precedence.
  const [reducedData, setReducedData] = useState(() => preferReducedData())

  const handleFeedFilterChange = useCallback((next: FeedFilter) => {
    setActiveFilter(next)
    setDisplayedPostsCount(getAdaptiveFeedPageSize())
    if (containerRef.current) containerRef.current.scrollTo({ top: 0, behavior: "smooth" })
  }, [])
  useEffect(() => {
    if (!hasFeedPreferenceOwner) {
      setActiveFilter("for-you")
      setLocationLane("worldwide")
      setIntentionBias("balanced")
      setFocusMode(false)
      setHiddenPostIds([])
      setFeedPreferencesLoadedFor(feedPreferenceOwnerId)
      return
    }
    try {
      const raw = window.localStorage.getItem(feedPreferencesStorageKey)
      const value = raw ? JSON.parse(raw) as Record<string, unknown> : {}
      const filter = value.filter
      setActiveFilter(filter === "following" || filter === "friends" || filter === "communities" || filter === "trending" || filter === "saved" ? filter : "for-you")
      setLocationLane(value.locationLane === "city" || value.locationLane === "country" ? value.locationLane : "worldwide")
      setIntentionBias(value.intentionBias === "friendship" || value.intentionBias === "professional" || value.intentionBias === "dating" ? value.intentionBias : "balanced")
      setFocusMode(value.focusMode === true)
      const hiddenRaw = window.localStorage.getItem(hiddenPostStorageKey)
      const hiddenValue: unknown = hiddenRaw ? JSON.parse(hiddenRaw) : []
      setHiddenPostIds(Array.isArray(hiddenValue) ? [...new Set(hiddenValue.filter((id): id is string => typeof id === "string").map((id) => id.trim()).filter(Boolean))].slice(-200) : [])
    } catch {
      setActiveFilter("for-you")
      setLocationLane("worldwide")
      setIntentionBias("balanced")
      setFocusMode(false)
      setHiddenPostIds([])
    }
    setFeedPreferencesLoadedFor(feedPreferenceOwnerId)
  }, [feedPreferenceOwnerId, feedPreferencesStorageKey, hiddenPostStorageKey, hasFeedPreferenceOwner])

  useEffect(() => {
    if (!hasFeedPreferenceOwner || feedPreferencesLoadedFor !== feedPreferenceOwnerId) return
    try {
      window.localStorage.setItem(feedPreferencesStorageKey, JSON.stringify({ filter: activeFilter, locationLane, intentionBias, focusMode }))
      window.localStorage.setItem(hiddenPostStorageKey, JSON.stringify(hiddenPostIds.slice(-200)))
    } catch { /* device storage may be unavailable */ }
  }, [activeFilter, locationLane, intentionBias, focusMode, hiddenPostIds, feedPreferenceOwnerId, feedPreferencesLoadedFor, feedPreferencesStorageKey, hiddenPostStorageKey, hasFeedPreferenceOwner])

  const [searchQuery, setSearchQuery] = useState("")
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [viewingAuthorId, setViewingAuthorId] = useState<string | null>(null)
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [feedBootstrapped, setFeedBootstrapped] = useState(false)
  const [initialFeedLoadSettled, setInitialFeedLoadSettled] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  // A ref closes the same-render gap before React commits isLoadingMore=true;
  // IntersectionObserver and the manual button cannot start duplicate pages.
  const loadMoreLockRef = useRef(false)
  const [hasMorePosts, setHasMorePosts] = useState(true)
  const [displayedPostsCount, setDisplayedPostsCount] = useState<number>(MOBILE_PAGE_SIZES.feed)
  // Preserve identical server/client first paint; adapt the batch immediately after hydration.
  useEffect(() => { setDisplayedPostsCount(getAdaptiveFeedPageSize()) }, [])
  const [savedPosts, setSavedPosts] = useState<SavedPost[]>([])
  const [bookmarkedPostIdsState, setBookmarkedPostIds] = useState<string[]>([])
  const [bookmarkedOwnerId, setBookmarkedOwnerId] = useState("anonymous")
  const [draftPosts, setDraftPosts] = useState<PostDraft[]>([])
  const [rankedPostsState, setRankedPosts] = useState<RankedPost[]>([])
  const [rankedOwnerId, setRankedOwnerId] = useState("anonymous")
  const [visibilityReasonPostId, setVisibilityReasonPostId] = useState<string | null>(null)
  const [selectedVisibilityReason, setSelectedVisibilityReason] = useState<{
    reason: string
    category: string
  } | null>(null)
  const feedPreferenceStorageKey = `ghc.not-interested-post-ids:${feedPreferenceOwnerId}`
  const topicPreferenceStorageKey = `ghc.feed-topic-preferences:${feedPreferenceOwnerId}`
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [mutedTopics, setMutedTopics] = useState<string[]>([])
  const [topicPreferencesLoadedFor, setTopicPreferencesLoadedFor] = useState("anonymous")
  useEffect(() => {
    if (!hasFeedPreferenceOwner) {
      setMutedTopics([])
      setSelectedTopic(null)
      setTopicPreferencesLoadedFor(feedPreferenceOwnerId)
      return
    }
    try {
      const raw = window.localStorage.getItem(topicPreferenceStorageKey)
      const value: unknown = raw ? JSON.parse(raw) : []
      setMutedTopics(Array.isArray(value) ? [...new Set(value.filter((v): v is string => typeof v === "string").map((v) => v.trim().toLowerCase()).filter((v) => /^[\p{L}\p{N}_]{2,32}$/u.test(v)))].slice(0, 100) : [])
      setSelectedTopic(null)
    } catch { setMutedTopics([]); setSelectedTopic(null) }
    setTopicPreferencesLoadedFor(feedPreferenceOwnerId)
  }, [topicPreferenceStorageKey, feedPreferenceOwnerId, hasFeedPreferenceOwner])
  useEffect(() => {
    if (!hasFeedPreferenceOwner || topicPreferencesLoadedFor !== feedPreferenceOwnerId) return
    try { window.localStorage.setItem(topicPreferenceStorageKey, JSON.stringify(mutedTopics.slice(0, 100))) } catch { /* device storage may be unavailable */ }
  }, [topicPreferenceStorageKey, mutedTopics, hasFeedPreferenceOwner, topicPreferencesLoadedFor, feedPreferenceOwnerId])
  const toggleMutedTopic = useCallback((topic: string) => {
    const normalized = topic.trim().toLowerCase()
    if (!/^[\p{L}\p{N}_]{2,32}$/u.test(normalized)) return
    setMutedTopics((current) => current.includes(normalized) ? current.filter((value) => value !== normalized) : [...current, normalized].slice(-100))
    if (selectedTopic === normalized) setSelectedTopic(null)
  }, [selectedTopic])
  const [notInterestedIds, setNotInterestedIds] = useState<string[]>(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(feedPreferenceStorageKey) : null
      const ids: unknown = raw ? JSON.parse(raw) : []
      return Array.isArray(ids)
        ? [...new Set(ids.filter((id): id is string => typeof id === "string").map((id) => id.trim()).filter(Boolean))].slice(-200)
        : []
    } catch { return [] }
  })
  const [notInterestedLoadedFor, setNotInterestedLoadedFor] = useState(feedPreferenceOwnerId)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(feedPreferenceStorageKey)
      const ids: unknown = raw ? JSON.parse(raw) : []
      setNotInterestedIds(Array.isArray(ids)
        ? [...new Set(ids.filter((id): id is string => typeof id === "string").map((id) => id.trim()).filter(Boolean))].slice(-200)
        : [])
    } catch { setNotInterestedIds([]) }
    setNotInterestedLoadedFor(feedPreferenceOwnerId)
  }, [feedPreferenceOwnerId, feedPreferenceStorageKey])
  useEffect(() => {
    if (!hasFeedPreferenceOwner || notInterestedLoadedFor !== feedPreferenceOwnerId) return
    try { window.localStorage.setItem(feedPreferenceStorageKey, JSON.stringify(notInterestedIds.slice(-200))) } catch { /* device storage may be unavailable */ }
  }, [feedPreferenceOwnerId, feedPreferenceStorageKey, notInterestedIds, notInterestedLoadedFor, hasFeedPreferenceOwner])

  // Do not render or rank any previous account's cached feed while one of the
  // account-scoped preference stores is still hydrating.
  const feedPreferencesReady = hasFeedPreferenceOwner
    ? feedPreferencesLoadedFor === feedPreferenceOwnerId && notInterestedLoadedFor === feedPreferenceOwnerId && topicPreferencesLoadedFor === feedPreferenceOwnerId
    : isDemoDataAllowed()
  const rankedPosts = feedPreferencesReady && rankedOwnerId === feedPreferenceOwnerId ? rankedPostsState : []
  const likedPosts = feedPreferencesReady && Array.isArray(likedPostIds) ? likedPostIds : []
  const bookmarkedPostIds = bookmarkedOwnerId === feedPreferenceOwnerId ? bookmarkedPostIdsState : []

  // Prefetch signed URLs only after the active account's feed state is ready.
  useEffect(() => {
    if (!feedPreferencesReady || reducedData || preferReducedData()) return
    const list = rankedPosts.slice(0, 6).flatMap((item) => {
      const post = item.post
      const imgs = Array.isArray(post?.images) ? post.images : []
      const vid = typeof post?.video === "string" ? [post.video] : []
      return [...imgs, ...vid].filter((u): u is string => typeof u === "string")
    })
    if (list.length) prefetchMediaFacades(list, 3)
  }, [rankedPosts, reducedData, feedPreferencesReady])
  const [sharePostId, setSharePostId] = useState<string | null>(null)
  const [feedError, setFeedError] = useState<Error | null>(null)
  const [isOffline, setIsOffline] = useState(false)
  const [feedStatusMsg, setFeedStatusMsg] = useState<string | null>(null)
  const [showCreateMenu, setShowCreateMenu] = useState(false)
  const [commentingPostId, setCommentingPostId] = useState<string | null>(null)
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)
  const [saveCollectionPostId, setSaveCollectionPostId] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<{
    url?: string
    urls?: { url: string; kind?: "image" | "video"; alt?: string }[]
    index?: number
    caption?: string
  } | null>(null)
  const [insightsPost, setInsightsPost] = useState<Post | null>(null)
  const { compact: headerCompact, hidden: headerHidden, onScroll: onHeaderScroll } = useScrollHeader({
    threshold: 40,
  })
  const [commentSort, setCommentSort] = useState<"newest" | "liked" | "pinned">("newest")
  const containerRef = useRef<HTMLDivElement>(null)
  const startYRef = useRef(0)
  const touchIdentifierRef = useRef<number | null>(null)
  const pendingLikesRef = useRef(new Set<string>())
  const pendingSavesRef = useRef(new Set<string>())
  const pendingCommentsRef = useRef(new Set<string>())

  // Infinite scroll detection
  const observerTargetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    const load = () => {
      if (!hasFeedPreferenceOwner) { setDraftPosts([]); return }
      try {
        const next = listPostDrafts()
        if (!cancelled && IdentityService.getCurrentUserId() === feedPreferenceOwnerId) setDraftPosts(next)
      } catch {
        if (!cancelled) setDraftPosts([])
      }
    }
    setDraftPosts([])
    load()
    const onChange = () => load()
    window.addEventListener("ghc:post-drafts-changed", onChange as EventListener)
    return () => {
      cancelled = true
      window.removeEventListener("ghc:post-drafts-changed", onChange as EventListener)
    }
  }, [feedPreferenceOwnerId, hasFeedPreferenceOwner])

  useEffect(() => {
    let cancelled = false
    if (!hasFeedPreferenceOwner) {
      setBookmarkedPostIds([])
      setBookmarkedOwnerId(feedPreferenceOwnerId)
      return () => { cancelled = true }
    }
    setBookmarkedPostIds([])
    setBookmarkedOwnerId(feedPreferenceOwnerId)
    setInitialFeedLoadSettled(false)
    setFeedError(null)
    void (async () => {
      try {
        const { socialListSaves } = await import("@/lib/social/client")
        const res = await socialListSaves(80)
        if (cancelled || IdentityService.getCurrentUserId() !== feedPreferenceOwnerId) return
        if (!res.ok) { setBookmarkedPostIds([]); return }
        setBookmarkedPostIds(Array.from(new Set(res.postIds.filter((id) => typeof id === "string" && id.length > 0))).slice(0, 80))
      } catch {
        /* device bookmarks still work */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [feedPreferenceOwnerId, hasFeedPreferenceOwner])

  useEffect(() => {
    const onSearch = (e: Event) => {
      try {
        const q = String((e as CustomEvent).detail?.query || "").trim()
        if (!q) return
        setIsSearchOpen(true)
        setSearchQuery(q)
      } catch { /* */ }
    }
    window.addEventListener("ghc:feed-search", onSearch as EventListener)
    return () => window.removeEventListener("ghc:feed-search", onSearch as EventListener)
  }, [])


  const loadMorePosts = useCallback(async () => {
    if (loadMoreLockRef.current || isLoadingMore || !hasMorePosts) return
    // Reveal already-hydrated posts locally before requesting another server page.
    if (displayedPostsCount < rankedPosts.length) {
      setDisplayedPostsCount((prev) => Math.min(rankedPosts.length, prev + getAdaptiveFeedPageSize()))
      return
    }

    if (typeof refreshFeed !== "function") {
      setHasMorePosts(false)
      return
    }

    loadMoreLockRef.current = true
    try {
      setIsLoadingMore(true)
      // The provider supplies the last cursor issued by the canonical API.
      // Do not derive a cursor from merged UI state: that state may contain
      // optimistic, offline-only or locally reconciled posts.
      const page = await refreshFeed({ append: true, limit: 20 })
      if (!page.ok) throw new Error(page.error || "Could not load older posts")
      const fetchedCount = Math.max(0, Number(page.appended) || 0)
      if (fetchedCount === 0 || !page.nextCursor) {
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
      loadMoreLockRef.current = false
      setIsLoadingMore(false)
    }
  }, [addToast, displayedPostsCount, hasMorePosts, isLoadingMore, rankedPosts.length, refreshFeed])


  useEffect(() => {
    // Older embedded WebViews may not expose IntersectionObserver; the visible
    // Load more control remains available as the deterministic fallback.
    if (typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore) {
          loadMorePosts()
        }
      },
      { root: containerRef.current, rootMargin: preferReducedData() ? "240px 0px" : "720px 0px", threshold: 0.01 }
    )

    if (observerTargetRef.current) {
      observer.observe(observerTargetRef.current)
    }

    return () => observer.disconnect()
  }, [hasMorePosts, isLoadingMore, displayedPostsCount, loadMorePosts, rankedPosts.length, reducedData])

  // Rank posts based on filter
  useEffect(() => {
    try {
      if (!feedPreferencesReady) {
        setFeedBootstrapped(false)
        setRankedPosts([])
        setRankedOwnerId(feedPreferenceOwnerId)
        return
      }
      setFeedError(null)
      const blockedIds = Array.from(
        new Set([...(blockedUsers || []), ...(settings?.blockedUsers || [])].filter((id): id is string => typeof id === "string" && id.length > 0))
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
        mutedUserIds: Array.from(new Set([...(mutedUsers || []), ...(settings?.mutedUsers || [])].filter((id): id is string => typeof id === "string" && id.length > 0))),
        followingIds: following || [],
        friendIds: friends || [],
        communityIds,
        savedPostIds: bookmarkedPostIds,
        viewedPostIds: [],
        locationLane,
        intentionBias,
        geolocation: regional.location ? { latitude: regional.location.latitude, longitude: regional.location.longitude } : undefined,
        focusMode,
        includedTopics: selectedTopic ? [selectedTopic] : [],
        excludedTopics: mutedTopics,
      }

      const realPosts = posts.filter((post) => !seedPostIds.has(post.id) && !(post as any).deletedAt && !(post as any).isArchived && !hiddenPostIds.includes(post.id))
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
      setRankedOwnerId(feedPreferenceOwnerId)
      setFeedBootstrapped(true)
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Failed to rank feed")
      setFeedError(err)
      console.error("[Feed Ranking Error]", err)
      // Fallback: show unranked posts
      setRankedPosts(posts.map((post) => ({ post, score: 0, reason: { reason: "Feed unavailable", category: "error" } })))
      setRankedOwnerId(feedPreferenceOwnerId)
      setFeedBootstrapped(true)
    }
  }, [activeFilter, posts, likedPosts, profile, bookmarkedPostIds, notInterestedIds, seedPostIds, seedPostList, blockedUsers, settings, following, friends, conversations, locationLane, intentionBias, focusMode, hiddenPostIds, regional.location, selectedTopic, mutedTopics, mutedUsers, hasFeedPreferenceOwner, feedPreferencesLoadedFor, notInterestedLoadedFor, topicPreferencesLoadedFor, feedPreferencesReady, feedPreferenceOwnerId])

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

  // Always hydrate the canonical server feed on first mount. A focus event is not
  // guaranteed to fire after this component subscribes (especially in Pi Browser),
  // which previously left an empty local array looking like a genuine empty feed.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        let result = await refreshFeed()
        if (!cancelled && !result.ok && result.error === "FEED_REQUEST_SUPERSEDED") {
          // Focus/visibility revalidation can race the mount request; retry once
          // instead of declaring initial hydration complete on a cancelled request.
          result = await refreshFeed()
        }
        if (cancelled) return
        if (!result.ok && result.error !== "FEED_REQUEST_SUPERSEDED") {
          setFeedError(new Error(result.error || "Could not load feed"))
        } else if (result.ok) {
          setFeedError(null)
        }
      } catch (error) {
        if (!cancelled) setFeedError(error instanceof Error ? error : new Error("Could not load feed"))
      } finally {
        if (!cancelled) setInitialFeedLoadSettled(true)
      }
    })()
    return () => { cancelled = true }
  }, [refreshFeed, feedPreferenceOwnerId])

  useSectionRefresh("feed", async () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return
    await refreshFeed?.()
  }, {
    minIntervalMs: 12_000,
    events: ["ghc:post-published", "ghc:post-engagement", "ghc:feed-invalidate", "ghc:feed-soft-revalidate"],
  })

  // Phase 4: soft-refresh lives on the mounted feed screen (not the loading skeleton).
  useEffect(() => {
    const soft = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return
      try {
        window.dispatchEvent(new CustomEvent("ghc:section-refresh", { detail: { section: "feed", soft: true } }))
      } catch { /* */ }
    }
    const onVis = () => {
      if (document.visibilityState === "visible") soft()
    }
    const onPrefetch = (e: Event) => {
      const id = (e as CustomEvent<string>).detail
      if (id === "home" || id === "feed") soft()
    }
    const onFocus = () => soft()
    document.addEventListener("visibilitychange", onVis)
    window.addEventListener("ghc:prefetch-tab", onPrefetch as EventListener)
    window.addEventListener("focus", onFocus)
    return () => {
      document.removeEventListener("visibilitychange", onVis)
      window.removeEventListener("ghc:prefetch-tab", onPrefetch as EventListener)
      window.removeEventListener("focus", onFocus)
    }
  }, [])

  // Low-frequency recovery poll when the tab is visible.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && (typeof navigator === "undefined" || navigator.onLine !== false)) void refreshFeed?.()
    }, 45_000)
    return () => window.clearInterval(timer)
  }, [refreshFeed])

  const handleRefresh = async () => {
    try {
      emitSectionRefresh("feed", { reason: "manual" }, { minIntervalMs: 0 })
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
      setDisplayedPostsCount(getAdaptiveFeedPageSize())
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
    if (pendingSavesRef.current.has(postId)) return
    pendingSavesRef.current.add(postId)
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
          try {
            window.dispatchEvent(
              new CustomEvent("ghc:post-engagement", { detail: { postId, kind: "save" } }),
            )
          } catch { /* */ }
        }
      }
    } catch (error) {
      setBookmarkedPostIds(previous)
      const err = error instanceof Error ? error : new Error("Failed to save post")
      console.error("[Save Error]", err)
      addToast("Failed to save post. Try again.", "error")
    } finally {
      pendingSavesRef.current.delete(postId)
    }
  }, [bookmarkedPostIds, addToast, savePost, unsavePost])

  const handleNotInterested = useCallback((postId: string) => {
    const id = String(postId || "").trim()
    if (!id) return
    setNotInterestedIds((prev) => prev.includes(id) ? prev : [...prev, id].slice(-200))
    addToast("This post was removed from your feed. Your preference is saved on this device.", "info")
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
      const detail = (event as CustomEvent<{ postId?: unknown; commentId?: unknown; parentId?: unknown; threadRootId?: unknown; action?: unknown }>).detail
      const postId = typeof detail?.postId === "string" ? detail.postId.trim() : ""
      if (!postId) return
      const action = typeof detail?.action === "string" ? detail.action : ""
      const commentId = typeof detail?.commentId === "string" ? detail.commentId.trim() : ""
      const parentId = typeof detail?.parentId === "string" ? detail.parentId.trim() : ""
      const threadRootId = typeof detail?.threadRootId === "string" ? detail.threadRootId.trim() : ""
      const openLoadedPost = (target: Post) => {
        if (cancelled) return
        if (action === "comment") {
          openComments(target.id)
          if (commentId) window.setTimeout(() => window.dispatchEvent(new CustomEvent("ghc:focus-comment", { detail: { postId: target.id, commentId, parentId, threadRootId } })), 80)
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
    const query = searchQuery.trim()
    if (!query) return rankedPosts
    return rankedPosts.filter((rp) => {
      const post = rp.post
      return matchesFilterQuery(query, post.content, post.authorName, post.hashtags?.join(" "))
    })
  }, [rankedPosts, searchQuery])

  const displayPosts = useMemo(() => searchResults.slice(0, displayedPostsCount), [searchResults, displayedPostsCount])
  const discoveryTopics = useMemo(() => {
    const counts = new Map<string, number>()
    for (const { post } of rankedPosts.slice(0, 40)) {
      const contentTags = extractHashtags(String(post.content || ""))
      const suppliedTags = Array.isArray(post.hashtags) ? post.hashtags : []
      for (const raw of [...contentTags, ...suppliedTags]) {
        const tag = String(raw || "").replace(/^#/, "").trim().toLowerCase()
        if (!/^[\p{L}\p{N}_]{2,32}$/u.test(tag)) continue
        counts.set(tag, (counts.get(tag) || 0) + 1)
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([tag]) => tag)
  }, [rankedPosts])
  const discoveryCreators = useMemo(() => {
    const seen = new Set<string>()
    const ownId = String(profile?.id || "")
    return rankedPosts.flatMap(({ post }) => {
      const id = String(post.authorId || "").trim()
      const name = String(post.authorName || "").trim()
      if (!id || !name || id === ownId || seen.has(id)) return []
      seen.add(id)
      return [{ id, name, photo: String(post.authorPhoto || "") }]
    }).slice(0, 5)
  }, [rankedPosts, profile?.id])
  const discoveryCommunities = useMemo(() => {
    const seen = new Set<string>()
    return rankedPosts.flatMap(({ post }) => {
      const id = String(post.communityId || "").trim()
      const name = String(post.communityName || "").trim()
      if (!id || !name || seen.has(id)) return []
      seen.add(id)
      return [{ id, name }]
    }).slice(0, 4)
  }, [rankedPosts])
  const hasRealPosts = useMemo(() => posts.some((post) => !seedPostIds.has(post.id)), [posts, seedPostIds])

  return (
    <div className="gh-world-feed gh-feed-shell relative flex h-full min-h-0 flex-col bg-background text-foreground" role="region" aria-label={t("feed")}>
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
        subtitle={t(FEED_FILTERS.find((f) => f.value === activeFilter)?.label || "feed")}
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
        <div className="gh-premium-feed-toolbar sticky top-0 z-20 border-b border-border/50 bg-background/95 px-3 py-2 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto scrollbar-hide" role="tablist" aria-label={t("feedFilters")}>
              {FEED_FILTERS.map((filter) => {
                const active = activeFilter === filter.value
                return (
                <button
                  key={filter.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  title={t(filter.label)}
                  onClick={() => handleFeedFilterChange(filter.value)}
                  className={`relative inline-flex min-h-10 shrink-0 items-center gap-1.5 border-b-2 px-2.5 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                    active
                      ? "border-[var(--gh-green)] text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className={active ? "opacity-100" : "opacity-80"} aria-hidden>{filter.icon}</span>
                  <span>{t(filter.shortLabel)}</span>
                </button>
                )
              })}
            </div>
            <button type="button" onClick={() => setShowFeedControls((v) => !v)} aria-expanded={showFeedControls} aria-label={t("personalizeFeed")} className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border bg-card transition-colors ${showFeedControls || focusMode ? "border-emerald-500 text-emerald-700" : "border-border/60 text-muted-foreground hover:text-foreground"}`}>
              <Filter size={15} />
            </button>
            <button type="button" onClick={() => setIsSearchOpen((v) => !v)} aria-label={isSearchOpen ? t("cancel") : t("searchFeed")} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground transition-colors hover:text-foreground">
              {isSearchOpen ? <X size={16} /> : <Search size={16} />}
            </button>
            <button type="button" onClick={() => void handleRefresh()} disabled={isRefreshing} aria-label={t("refreshFeed")} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50">
              <RefreshCw size={15} className={isRefreshing ? "animate-spin" : ""} />
            </button>
          </div>
          {showFeedControls ? (
            <section className="mt-2 rounded-2xl border border-border/70 bg-card p-3 shadow-sm" aria-label={t("feedPersonalization")}>
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-xs font-bold text-foreground">{t("yourFeedPriorities")}</p><p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">Tune relevance without changing who you follow. These preferences stay on this device.</p></div>
                <button type="button" onClick={() => { setLocationLane("worldwide"); setIntentionBias("balanced"); setFocusMode(false) }} className="text-[10px] font-bold text-emerald-700">{t("reset")}</button>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div><p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t("locationRelevance")}</p><div className="flex flex-wrap gap-1">{([ ["city",t("nearby")], ["country",t("country")], ["worldwide",t("worldwide")] ] as const).map(([id,label]) => <button key={id} type="button" onClick={() => setLocationLane(id)} className={`rounded-full px-2.5 py-1.5 text-[11px] font-bold ${locationLane === id ? "bg-emerald-700 text-white" : "bg-muted text-muted-foreground"}`}>{label}</button>)}</div></div>
                <div><p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t("whatMattersNow")}</p><div className="flex flex-wrap gap-1">{([ ["balanced",t("balanced")], ["friendship",t("connections")], ["professional",t("professional")], ["dating",t("matching")] ] as const).map(([id,label]) => <button key={id} type="button" onClick={() => setIntentionBias(id)} className={`rounded-full px-2.5 py-1.5 text-[11px] font-bold ${intentionBias === id ? "bg-emerald-700 text-white" : "bg-muted text-muted-foreground"}`}>{label}</button>)}</div></div>
              </div>
              <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2"><span><span className="block text-xs font-bold text-foreground">{t("focusMode")}</span><span className="block text-[10px] text-muted-foreground">{t("focusModeHelp")}</span></span><input type="checkbox" checked={focusMode} onChange={(e) => setFocusMode(e.target.checked)} className="h-4 w-4 accent-emerald-700" /></label>
              <label className="mt-2 flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2"><span><span className="block text-xs font-bold text-foreground">Reduce data in Feed</span><span className="block text-[10px] leading-4 text-muted-foreground">Limit background media prefetch and load older posts closer to the end. Your device and network data-saver settings always take priority.</span></span><input type="checkbox" checked={reducedData} onChange={(e) => { const enabled = e.target.checked; setPreferReducedData(enabled); setReducedData(enabled || preferReducedData()) }} className="h-4 w-4 accent-emerald-700" /></label>
            </section>
          ) : null}
          {isSearchOpen ? (
            <input
              autoFocus
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t("searchPosts")}
              aria-label={t("searchPosts")}
              className="mt-2 min-h-10 w-full rounded-xl border border-border/70 bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          ) : null}
          <FilterSummary
            className="mt-2"
            items={[
              ...(locationLane !== "worldwide" ? [{ id: "location", label: `Location: ${locationLane === "city" ? "Nearby" : "Country"}`, onRemove: () => setLocationLane("worldwide") }] : []),
              ...(intentionBias !== "balanced" ? [{ id: "intent", label: `Priority: ${intentionBias === "professional" ? "Professional" : intentionBias === "friendship" ? "Connections" : "Matching"}`, onRemove: () => setIntentionBias("balanced") }] : []),
              ...(focusMode ? [{ id: "focus", label: "Focus mode", onRemove: () => setFocusMode(false) }] : []),
              ...(searchQuery.trim() ? [{ id: "search", label: `Search: ${searchQuery.trim()}`, onRemove: () => setSearchQuery("") }] : []),
            ]}
            onClearAll={() => { setLocationLane("worldwide"); setIntentionBias("balanced"); setFocusMode(false); setSearchQuery("") }}
            ariaLabel="Active feed filters"
          />
          {feedStatusMsg ? <p className="mt-1 text-[10px] text-muted-foreground" role="status">{feedStatusMsg}</p> : null}
        </div>

        {isOffline ? <div className="mx-3 mt-2 rounded-xl border border-amber-300/70 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-900 dark:bg-amber-950/30 dark:text-amber-100" role="status">{t("offlineFeed")}</div> : null}


        {draftPosts.length > 0 ? (
          <div className="mx-3 mt-2 rounded-xl border border-border/60 bg-card px-3 py-2" aria-label="Unpublished drafts">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold text-foreground">{t("draftsOnDevice")}</p>
              <p className="text-[10px] text-muted-foreground">{draftPosts.length} saved</p>
            </div>
            <ul className="space-y-1.5">
              {draftPosts.slice(0, 4).map((d) => (
                <li key={d.id} className="flex items-start gap-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 rounded-lg bg-muted/50 px-2.5 py-2 text-left transition hover:bg-muted"
                    onClick={() => {
                      try {
                        window.dispatchEvent(
                          new CustomEvent("ghc:open-compose", {
                            detail: { mode: "post", draftId: d.id, text: d.content },
                          }),
                        )
                      } catch { /* */ }
                      onCompose?.()
                    }}
                  >
                    <p className="line-clamp-2 text-[12px] font-medium text-foreground">
                      {d.content?.trim() || (d.images?.length ? "Media draft" : "Empty draft")}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      Edited {new Date(d.lastEditedAt || d.createdAt).toLocaleString()}
                    </p>
                  </button>
                  <button
                    type="button"
                    className="shrink-0 rounded-lg px-2 py-2 text-[11px] font-semibold text-rose-600 hover:bg-rose-50"
                    aria-label="Delete draft"
                    onClick={() => {
                      try {
                        removePostDraft(d.id)
                        setDraftPosts(listPostDrafts())
                      } catch { /* */ }
                    }}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {feedError ? <div className="mx-3 mt-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11px] text-destructive" role="alert">{feedError.message}</div> : null}

        <div
          ref={containerRef}
          className="gh-premium-feed-scroll min-h-0 flex-1 overflow-y-auto [touch-action:pan-y] pb-[var(--gh-screen-bottom-inset)] scrollbar-hide [-webkit-overflow-scrolling:touch]"
          onScroll={onHeaderScroll}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={() => void handleTouchEnd()}
        >
          {pullDistance > 0 ? <div className="px-4 py-1 text-center text-[10px] text-muted-foreground">{isRefreshing ? "Refreshing…" : pullDistance > 80 ? "Release to refresh" : "Pull to refresh"}</div> : null}
          <div className="px-2 pt-2">

            <ProfileStorySection scope="feed" />

            <div className="mx-1 mt-2.5 sm:mx-2">
              <ComposerPromptBar
                avatarLetter={String(profile?.displayName || profile?.username || "G")}
                avatarUrl={Array.isArray(profile?.photos) && profile.photos[0] ? String(profile.photos[0]) : null}
                placeholder="What's happening in GreenHaven?"
                onOpen={() => {
                  try {
                    window.dispatchEvent(new CustomEvent("ghc:open-create-hub"))
                  } catch { /* */ }
                  onCompose?.()
                }}
                onOpenPhoto={() => {
                  try {
                    window.dispatchEvent(new CustomEvent("ghc:open-create-hub", { detail: { media: "photo" } }))
                  } catch { /* */ }
                  onCompose?.()
                }}
                onOpenVideo={() => {
                  try {
                    window.dispatchEvent(new CustomEvent("ghc:open-create-hub", { detail: { media: "video" } }))
                  } catch { /* */ }
                  onCompose?.()
                }}
                onOpenStory={() => {
                  try {
                    window.dispatchEvent(new CustomEvent("ghc:open-story-creator"))
                  } catch { /* */ }
                }}
              />
            </div>
            {discoveryTopics.length > 0 ? (
              <section className="gh-card-padding mx-1 mt-3 rounded-2xl border border-border/60 bg-card/80 sm:mx-2" aria-label="Topics in your feed">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold tracking-wide text-foreground">Explore conversations</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">Topics appearing in posts you can currently see</p>
                  </div>
                  <Compass size={16} className="shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide" role="group" aria-label="Explore feed topics">
                  {discoveryTopics.map((topic) => (
                    <span key={topic} className="inline-flex shrink-0 items-center overflow-hidden rounded-full border border-border/70 bg-muted/40">
                      <button
                        type="button"
                        aria-pressed={selectedTopic === topic}
                        onClick={() => { setSelectedTopic((current) => current === topic ? null : topic); setDisplayedPostsCount(getAdaptiveFeedPageSize()); containerRef.current?.scrollTo({ top: 0, behavior: "smooth" }) }}
                        className={`inline-flex min-h-9 items-center px-3 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${selectedTopic === topic ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}
                      >#{topic}</button>
                      <button
                        type="button"
                        aria-label={`${mutedTopics.includes(topic) ? "Show" : "Hide"} topic ${topic}`}
                        aria-pressed={mutedTopics.includes(topic)}
                        onClick={() => toggleMutedTopic(topic)}
                        className={`min-h-9 border-l border-border/60 px-2 text-[10px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${mutedTopics.includes(topic) ? "text-destructive" : "text-muted-foreground hover:text-foreground"}`}
                      >{mutedTopics.includes(topic) ? "×" : "−"}</button>
                    </span>
                  ))}
                  {selectedTopic ? <button type="button" onClick={() => setSelectedTopic(null)} className="min-h-9 shrink-0 rounded-full px-3 text-[10px] font-semibold text-primary underline underline-offset-2">Clear topic filter</button> : null}
                </div>
                {mutedTopics.length > 0 ? (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="Muted feed topics">
                    <span className="text-[10px] font-semibold text-muted-foreground">Muted:</span>
                    {mutedTopics.map((topic) => (
                      <button key={topic} type="button" onClick={() => toggleMutedTopic(topic)} className="inline-flex min-h-8 items-center gap-1 rounded-full border border-destructive/25 bg-destructive/5 px-2.5 text-[10px] font-semibold text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={`Unmute topic ${topic}`}>#{topic} <span aria-hidden="true">×</span></button>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}
            {(discoveryCreators.length > 0 || discoveryCommunities.length > 0) ? (
              <section className="mx-1 mt-3 grid gap-2 sm:mx-2 sm:grid-cols-2" aria-label="People and communities in your feed">
                {discoveryCreators.length > 0 ? (
                  <div className="min-w-0 rounded-2xl border border-border/60 bg-card/80 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div><p className="text-[11px] font-bold text-foreground">People to explore</p><p className="text-[10px] text-muted-foreground">Creators already appearing in your feed</p></div>
                      <Users size={15} className="text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {discoveryCreators.map((creator) => (
                        <button key={creator.id} type="button" onClick={() => { try { window.dispatchEvent(new CustomEvent("ghc:open-profile", { detail: { userId: creator.id } })) } catch { onProfile?.(); setTab("discover") } }} aria-label={`Explore ${creator.name}`} className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 py-1 pl-1 pr-3 text-[11px] font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                          <span className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-muted">{creator.photo ? <LazyImage src={resolveAvatarUrl(creator.photo, { seed: creator.id, size: 96 })} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center">{creator.name.slice(0,1).toUpperCase()}</span>}</span>
                          <span className="truncate">{creator.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {discoveryCommunities.length > 0 ? (
                  <div className="min-w-0 rounded-2xl border border-border/60 bg-card/80 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div><p className="text-[11px] font-bold text-foreground">Communities in your feed</p><p className="text-[10px] text-muted-foreground">Spaces represented by visible posts</p></div>
                      <UsersRound size={15} className="text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {discoveryCommunities.map((community) => (
                        <button key={community.id} type="button" onClick={() => setTab("communities")} className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 text-[11px] font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                          <Hash size={12} aria-hidden="true" /><span className="truncate">{community.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>
          {!feedBootstrapped || !initialFeedLoadSettled ? (
            <FeedSkeleton />
          ) : displayPosts.length === 0 && feedError ? (
            <section className="mx-3 my-4 rounded-2xl border border-destructive/25 bg-destructive/[0.04] p-5 text-center" role="alert" aria-live="polite">
              <p className="text-sm font-bold text-foreground">{isOffline ? "You're offline" : "Your feed couldn't load"}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{isOffline ? "Reconnect to refresh posts. Any feed data already available is preserved." : "This is a loading error, not an empty feed. Try again without losing your current filters."}</p>
              <button type="button" onClick={() => void handleRefresh()} disabled={isRefreshing || isOffline} className="mt-3 inline-flex min-h-10 items-center justify-center rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                {isRefreshing ? "Retrying…" : "Retry feed"}
              </button>
            </section>
          ) : displayPosts.length === 0 ? (
            <EmptyState
              variant="feed"
              title={searchQuery.trim() ? "No matching posts" : undefined}
              description={searchQuery.trim() ? "Try another keyword or hashtag." : hasRealPosts ? "No posts match this filter yet. Try another feed filter." : undefined}
              action={searchQuery.trim()
                ? { label: "Clear search", onClick: () => setSearchQuery("") }
                : {
                    label: "Refresh feed",
                    onClick: () => { void handleRefresh() },
                  }}
              secondaryAction={
                searchQuery.trim()
                  ? undefined
                  : {
                      label: "Find people",
                      onClick: () => setTab("discover"),
                    }
              }
            />
          ) : (
            <div className="gh-premium-feed-list gh-feed-column gh-section-stack space-y-4 px-2 py-3 sm:px-3">
              {displayPosts.map(({ post, reason }, index) => (
                <div key={post.id}>
                  {index > 0 && !focusMode && activeFilter === "for-you" && interstitialKindAt(index) ? (
                    <FeedInterstitial
                      kind={interstitialKindAt(index)!}
                      onFindPeople={() => setTab("discover")}
                      onOpenMarketplace={() => window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "marketplace" }))}
                      onOpenCommunities={() => setTab("communities")}
                      onCreate={() => {
                        try { window.dispatchEvent(new CustomEvent("ghc:open-create-hub")) } catch { /* */ }
                        onCompose?.()
                      }}
                    />
                  ) : null}
                  <PostErrorBoundary>
                    <div className="gh-feed-post-slot cv-auto"><EnhancedPostCard
                      surface="feed"
                      post={post}
                      priority={index === 0}
                      isLiked={likedPosts.includes(post.id)}
                      isSaved={bookmarkedPostIds.includes(post.id)}
                      isOwnPost={isOwnAuthor(post.authorId, post.authorName, profile)}
                      onLike={handleLike}
                      onReact={handleReact}
                      onComment={openComments}
                      onShare={(postId) => setSharePostId(postId)}
                      onSave={handleSave}
                      onNotInterested={handleNotInterested}
                      onReport={(postId, reason) => { void reportPost?.(postId, reason) }}
                      onBlock={(postId) => {
                        const authorId = String(post.authorId || "")
                        if (authorId) void blockUser?.(authorId)
                      }}
                      onMute={(postId) => {
                        const authorId = String(post.authorId || "")
                        if (authorId) void muteUser?.(authorId)
                      }}
                      onDelete={(postId) => { void deletePost?.(postId) }}
                      onArchive={(postId) => { void archivePost?.(postId) }}
                      onHide={(postId) => { setHiddenPostIds((prev) => prev.includes(postId) ? prev : [...prev, postId]); void hidePost?.(postId) }}
                      onCopyLink={(postId) => {
                        try {
                          const url = `${typeof window !== "undefined" ? window.location.origin : ""}/?post=${encodeURIComponent(postId)}`
                          void navigator.clipboard?.writeText(url)
                          addToast?.("Link copied", "success")
                        } catch {
                          addToast?.("Could not copy link", "error")
                        }
                      }}
                      onEdit={(postId, content, media) => {
                        void editPost?.(postId, content, media)
                      }}
                      onInsights={(postId) => {
                        const p =
                          posts.find((x) => x.id === postId) ||
                          rankedPosts.find((item) => item.post.id === postId)?.post
                        if (p) setInsightsPost(p)
                      }}
                      onShowVisibilityReason={handleShowVisibilityReason}
                      visibilityReason={reason}
                      onOpenPost={openPostDetail}
                      onOpenMedia={({ urls, index, caption, kind }) => {
                        const items = (urls || []).map((u) => {
                          if (typeof u === "string") {
                            return {
                              url: u,
                              kind: (kind === "video" && (urls?.length ?? 0) === 1 ? "video" : "image") as "image" | "video",
                            }
                          }
                          return {
                            url: u.url,
                            kind: (u.kind || (kind === "video" && (urls?.length ?? 0) === 1 ? "video" : "image")) as "image" | "video",
                            alt: u.alt,
                          }
                        })
                        setLightbox({
                          urls: items,
                          index: index ?? 0,
                          caption,
                        })
                      }}
                      onOpenProfile={(userId) => {
                        if (userId) {
                          try {
                            window.dispatchEvent(new CustomEvent("ghc:open-profile", { detail: { userId } }))
                          } catch { /* */ }
                        } else {
                          onProfile?.()
                          setTab("profile")
                        }
                      }}
                    /></div>
                  </PostErrorBoundary>
                </div>
              ))}
              <div ref={observerTargetRef} className="flex min-h-12 items-center justify-center py-3" aria-live="polite">
                {isLoadingMore ? <span className="text-[11px] font-medium text-muted-foreground motion-safe:animate-pulse">Loading more posts…</span> : hasMorePosts ? <button type="button" onClick={() => void loadMorePosts()} className="min-h-11 rounded-full border border-border/70 bg-card px-5 py-2.5 text-[12px] font-bold shadow-sm transition hover:bg-muted/40 active:scale-[0.98]">Load more</button> : <span className="rounded-full bg-muted/60 px-3 py-1 text-[11px] font-medium text-muted-foreground">You’re all caught up</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      <CommentSheet post={posts.find((post) => post.id === commentingPostId) || routedPost} open={Boolean(commentingPostId)} onClose={() => setCommentingPostId(null)} />
      {selectedVisibilityReason && visibilityReasonPostId ? (
        <VisibilityReasonTooltip
          reason={selectedVisibilityReason}
          onClose={() => { setSelectedVisibilityReason(null); setVisibilityReasonPostId(null) }}
          onSeeLess={() => {
            handleNotInterested(visibilityReasonPostId)
            setSelectedVisibilityReason(null)
            setVisibilityReasonPostId(null)
          }}
        />
      ) : null}
      <PostDetailSheet
        post={posts.find((post) => post.id === selectedPostId) || rankedPosts.find((item) => item.post.id === selectedPostId)?.post || routedPost}
        open={Boolean(selectedPostId)}
        onClose={() => setSelectedPostId(null)}
        onComments={openComments}
        onShare={(postId) => setSharePostId(postId)}
        onOpenMedia={(url, caption) => setLightbox({ url, caption })}
        loadComments={loadPostComments}
      />
      <MediaLightbox
        open={Boolean(lightbox)}
        url={lightbox?.url || null}
        urls={lightbox?.urls}
        index={lightbox?.index ?? 0}
        caption={lightbox?.caption}
        onClose={() => setLightbox(null)}
      />
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
          onComplete={(result: ShareResult) => {
            applyShareResult(result)
            const pid = sharePostId
            setSharePostId(null)
            if (pid) {
              void import("@/lib/social/client").then(({ socialRecordAttention }) => {
                void socialRecordAttention(pid, "share")
              })
              try {
                window.dispatchEvent(
                  new CustomEvent("ghc:post-engagement", {
                    detail: { postId: pid, kind: "share" },
                  }),
                )
              } catch { /* */ }
            }
          }}
          onFindPeople={() => setTab("discover")}
          onDiscoverCommunities={() => setTab("communities")}
        />
      ) : null}
    </div>
  )
}

export default EnhancedFeedScreen
