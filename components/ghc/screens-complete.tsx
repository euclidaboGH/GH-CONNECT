"use client"

import { useDeferredValue, useMemo, useState, useRef, useEffect, useCallback, type ChangeEvent } from "react"
import { useGHC } from "@/contexts/ghc-context"
import { getBoundDomainServices } from "@/lib/domains/compat"
import { onCloseTransientUI } from "@/lib/transient-ui"
import { asArray, asInterests, safeLocation, uniqueIds } from "@/lib/safe-data"
import { filterValidMatches } from "@/lib/regression-guards"
import { rankDiscoveryCandidates, nextDiscoveryCandidate } from "@/lib/discovery-ranking"
import { MOBILE_PAGE_SIZES } from "@/lib/mobile-performance"
import { RelationshipActions, RelationshipLegend } from "./relationship-actions"
import { PremiumCommunityHub } from "./premium-community-hub"
import { ProfileTrustStrip, ProfileInterestChips } from "./premium-profile-identity"
import { usePermissions } from "@/hooks/usePermissions"
import { timeAgo } from "@/lib/ghc-data"
import { rankForYouFeed, rankFollowingFeed } from "@/lib/feed-ranking-engine"
import { getConversationListState, isMessageFromCurrentUser } from "@/lib/unified-messaging-engine"
import { Heart, MessageCircle, Share2, ChevronLeft, ChevronRight, Send, Settings as SettingsIcon, Wallet, LogOut, Zap, ThumbsDown, UserPlus, Flag, Ban, RefreshCw, X, Search, Filter, MessageSquare, Phone, Video, MoreVertical, Check, Clock, Plus, AlertCircle, Globe, Users, Briefcase, Pin, Archive, Newspaper } from "lucide-react"
import type { PrimaryMode, Candidate, Profile } from "@/lib/ghc-types"
import { PostSkeleton, PostCard } from "./feed-components"
import { SearchBar } from "./search-bar"
import { UserCard } from "./user-card"
import {
  TrendingSection,
  NearbySection,
  SuggestedFriendsSection,
  PopularPostsSection,
  RecentSearchesSection,
} from "./discovery-sections"
import { FilterPanel } from "./filter-panel"
import {
  DiscoverListRow,
  ConnectionModeBar,
  candidateMatchesIntent,
  SuggestionsCarousel,
  type ConnectionMode,
} from "./discovery-components"
import { CONTINENT_LABELS, candidateInContinent, type ContinentId } from "@/lib/discovery-continents"
import { CommunitiesSection } from "./communities-section"
import { ProfilePreviewPage } from "./profile-preview-page"
import { EmptyMatchesState, MatchCard, MatchCardSkeleton, MatchTabs, MatchIntentionFilters, resolveMatchIntention } from "./matches-components"
import type { MatchIntention } from "@/lib/ghc-types"
import { EmptyMessagesState, ConversationSearchBar, ConversationItem, MessageInput, MessageBubble, ChatHeader } from "./message-components"
import { RecommendedGroupsSection } from "./recommended-groups-section"
import { PostComposer } from "./post-composer"
import { UnifiedCompose } from "./unified-compose"
import { CommentSheet } from "./comment-sheet"
import ProfileStorySection from "./profile-story-section"
import { LazyImage } from "./lazy-image"
import { GroupCard } from "./group-card"
import { CreateGroupModal, type CreateGroupFormData } from "./create-group-modal"
import { EmptyState } from "./empty-state"
import { SetupChecklist } from "./setup-checklist"
import { filterOwnPosts, extractMediaFromPosts, nextProfileActions, BIO_PROMPTS } from "@/lib/feed-profile-experience"
import { useScrollHeader } from "@/lib/use-scroll-header"
import { CollapsingAppHeader } from "./collapsing-app-header"
import {
  ProfileCompletionRing,
  ProfileCompletionCard,
  calculateProfileCompletion,
  ProfileHeaderActions,
  MoreOptionsMenu,
  ModeButtons,
  InterestsPills,
  PreviewPublicProfileToggle,
  OwnPostCard,
  EditProfileModal,
  AchievementsSection,
  SocialLinksSection,
  ActivityHistorySection,
  PrivacyControlsSection,
  SavedPostsSection,
  ProfileQRCode,
  ExpandableBio,
  } from "./profile-components"
// Profile enhancement UI components - analytics, achievements, social links, etc.
import {
  ProfileAnalyticsCard,
  FollowerInsightsCard,
  EnhancedAchievementsGrid,
  SkillsSection,
  EnhancedSocialLinksSection,
  PinnedPostsSection,
  EnhancedQRProfileShare,
  ProfileVisibilityStatus,
} from "./profile-enhancements-ui"
// Note: ResponsiveButton is available but not currently used in ProfileScreen

// HOME SCREEN - Full Social Feed with Pull-to-Refresh
export function HomeScreen() {
  const {
    posts,
    profile,
    candidates,
    following,
    likedPostIds,
    settings,
    likePost,
    addComment,
    addToast,
    createPost,
    followUser,
    startConversation,
    matches,
    blockUser,
    muteUser,
    reportContent,
  } = useGHC()
  const [screenError, setScreenError] = useState<Error | null>(null)
  const [feedType, setFeedType] = useState<"for-you" | "following">("for-you")
  const [modeFilter, setModeFilter] = useState<string>("all")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [likedPosts, setLikedPosts] = useState<string[]>([])
  const [bookmarkedPostIds, setBookmarkedPostIds] = useState<string[]>([])
  const [commentingPostId, setCommentingPostId] = useState<string | null>(null)
  const [commentText, setCommentText] = useState("")
  const [pullDistance, setPullDistance] = useState(0)
  const [showComposeSheet, setShowComposeSheet] = useState(false)
  const [composeInitialMode, setComposeInitialMode] = useState<"post" | "story">("post")
  const [composeText, setComposeText] = useState("")
  const [isComposing, setIsComposing] = useState(false)
  const [feedProfileUserId, setFeedProfileUserId] = useState<string | null>(null)
  useEffect(() => {
    return onCloseTransientUI(() => {
      setFeedProfileUserId(null)
      setCommentingPostId(null)
      setCommentSheetPostId(null)
      setShowComposeSheet(false)
      setCommentText("")
    })
  }, [])
  const [commentSheetPostId, setCommentSheetPostId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const startYRef = useRef(0)

  /** Build a Candidate-like object from a feed post author for public profile preview */
  const resolveAuthorCandidate = (authorId: string): Candidate | null => {
    if (!authorId || authorId === "current-user") return null
    const byId = candidates.find((c) => c.id === authorId)
    if (byId) return byId
    const samplePost = posts.find((p) => p.authorId === authorId)
    if (!samplePost) return null
    // Fallback: match candidate by display name (legacy seed ids)
    const nameKey = (samplePost.authorName || "").toLowerCase().split(/[\s.]+/)[0]
    const byName = candidates.find((c) => (c.name || "").toLowerCase().startsWith(nameKey))
    if (byName) return byName
    return {
      id: authorId,
      name: samplePost.authorName,
      age: 0,
      photo: samplePost.authorPhoto || "/placeholder.svg?width=200&height=200",
      location: "",
      bio: "",
      interests: [],
      verified: false,
      online: false,
    } as Candidate
  }

  const feedProfileCandidate = feedProfileUserId ? resolveAuthorCandidate(feedProfileUserId) : null

  const canMessageUser = (userId: string) => {
    // Message only after mutual match OR accepted follow relationship (friend)
    const isMatched = (matches || []).some((m: any) => m.userId === userId || m.id === userId)
    const isFriend = (following || []).includes(userId) // simplified: following used as accepted graph for now
    return isMatched || isFriend
  }

  const handleOpenAuthorProfile = (authorId: string) => {
    if (!authorId || authorId === "current-user") {
      addToast("This is your post", "info")
      return
    }
    const candidate = resolveAuthorCandidate(authorId)
    if (!candidate) {
      addToast("Profile unavailable", "error")
      return
    }
    setFeedProfileUserId(authorId)
  }

  const handleMessageFromFeedProfile = async (userId: string, name: string, photo: string) => {
    if (!canMessageUser(userId)) {
      addToast("Message unlocks after a match or when you both connect (follow accepted).", "info")
      return
    }
    try {
      await startConversation(userId, name, photo)
      addToast("Conversation opened", "success")
      window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "messages" }))
    } catch {
      addToast("Could not open conversation", "error")
    }
  }

  // Error boundary for this screen
  if (screenError) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-4">
        <AlertCircle size={40} className="text-red-500" />
        <p className="text-sm text-gray-600 text-center">Something went wrong loading your feed</p>
        <button
          onClick={() => setScreenError(null)}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:opacity-90"
        >
          Try Again
        </button>
      </div>
    )
  }

  // Pull-to-refresh handler
  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      startYRef.current = e.touches[0].clientY
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      const currentY = e.touches[0].clientY
      const distance = Math.max(0, currentY - startYRef.current)
      setPullDistance(Math.min(distance, 100))
    }
  }

  const handleTouchEnd = async () => {
    if (pullDistance > 60) {
      await handleRefresh()
    }
    setPullDistance(0)
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await new Promise((resolve) => setTimeout(resolve, 650))
    setIsRefreshing(false)
    addToast("Feed refreshed!", "success")
  }

  const handleLike = async (postId: string) => {
    if (likedPosts.includes(postId)) {
      setLikedPosts(likedPosts.filter((id) => id !== postId))
    } else {
      setLikedPosts([...likedPosts, postId])
      await likePost(postId)
    }
  }

  const handleComment = async (postId: string) => {
    if (!commentText.trim()) return
    await addComment(postId, commentText)
    setCommentText("")
    setCommentingPostId(null)
    addToast("Comment posted!", "success")
  }

  const handleCreatePost = async () => {
    if (!composeText.trim()) return
    setIsComposing(true)
    try {
      await createPost(composeText, [], null, null, null)
      addToast("Post created!", "success")
      setComposeText("")
      setShowComposeSheet(false)
    } catch (error) {
      addToast("Failed to create post", "error")
    } finally {
      setIsComposing(false)
    }
  }

  const filteredPosts = useMemo(() => {
    const visible = posts.filter((post) => !(post as any).deletedAt)
    if (modeFilter === "all") return visible
    return visible.filter((post) => {
      if (modeFilter === "dating") return post.authorId !== "user-seed-3"
      if (modeFilter === "friendship") return post.authorId !== "user-seed-2"
      if (modeFilter === "networking") return post.authorId === "user-seed-3"
      return true
    })
  }, [modeFilter, posts])

  const rankedPosts = useMemo(() => {
    const context = {
      userProfile: profile,
      userInterests: profile.interests || [],
      recentlyEngagedPostIds: likedPostIds,
      blockedUserIds: settings.blockedUsers || [],
      followingIds: following,
      savedPostIds: [],
      viewedPostIds: [],
    }

    return (feedType === "for-you"
      ? rankForYouFeed(filteredPosts, context)
      : rankFollowingFeed(filteredPosts, context)
    ).map(({ post }) => post)
  }, [feedType, filteredPosts, following, likedPostIds, profile, settings.blockedUsers])

  const displayPosts = rankedPosts.slice(0, feedType === "for-you" ? 8 : 5)
  const recommendedPeople = useMemo(() => {
    const followed = new Set(following)
    const interests = (profile.interests || []).map((interest) => interest.toLowerCase())
    return [...candidates]
      .filter((candidate) => candidate.id !== "current-user" && !followed.has(candidate.id) && !(settings.blockedUsers || []).includes(candidate.id))
      .sort((a, b) => {
        const score = (candidate: Candidate) =>
          (candidate.interests || []).filter((interest) => interests.includes(interest.toLowerCase())).length * 10 +
          (candidate.online ? 2 : 0)
        return score(b) - score(a)
      })
      .slice(0, 3)
  }, [candidates, following, profile.interests, settings.blockedUsers])

  return (
    <div className="pb-3 bg-white h-full flex flex-col relative">
      <div className="sr-only" aria-live="polite">
        {isRefreshing ? "Refreshing feed" : `${displayPosts.length} posts available`}
      </div>
      {/* Pull-to-refresh indicator */}
      {pullDistance > 0 && (
        <div className="absolute top-0 left-0 right-0 h-16 flex items-center justify-center z-30">
          <div
            className={`w-8 h-8 rounded-full border-3 border-emerald-300 border-t-purple-600 transition-all ${
              isRefreshing ? "animate-spin" : ""
            }`}
            style={{ opacity: Math.min(pullDistance / 60, 1) }}
          ></div>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-3 py-1.5 z-20">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-gray-950">Feed</h2>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="w-9 h-9 rounded-full hover:bg-gray-100 transition flex items-center justify-center active:scale-90"
          >
            <RefreshCw
              size={18}
              className={`text-gray-700 ${isRefreshing ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
          </button>
        </div>

        {/* Feed type toggle */}
        <div className="flex gap-2 bg-gray-100 rounded-lg p-1 mb-3">
          {[
            { value: "for-you", label: "For You" },
            { value: "following", label: "Following" },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setFeedType(option.value as "for-you" | "following")}
              className={`flex-1 py-1.5 px-3 rounded font-bold text-xs transition-all active:scale-95 ${
                feedType === option.value
                  ? "bg-gradient-to-r from-emerald-600 to-purple-700 text-white shadow-md"
                  : "text-gray-700 hover:text-gray-900"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Mode filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-hide">
          {["all", "dating", "friendship", "networking"].map((mode) => {
            const shouldShow =
              mode === "all" ||
              mode === profile.primaryMode ||
              (profile.primaryMode === "dating" && mode !== "networking")
            if (!shouldShow && mode !== "all") return null

            const modeConfig = {
              all: { icon: Globe, label: "All" },
              dating: { icon: Heart, label: "Dating" },
              friendship: { icon: Users, label: "Friendship" },
              networking: { icon: Briefcase, label: "Networking" },
            }
            const Icon = modeConfig[mode as keyof typeof modeConfig]?.icon || Globe

            return (
              <button
                key={mode}
                onClick={() => setModeFilter(mode)}
                className={`flex items-center gap-1.5 whitespace-nowrap py-1.5 px-3 rounded-full font-semibold text-xs transition-all active:scale-95 ${
                  modeFilter === mode
                    ? "bg-gradient-to-r from-emerald-600 to-pink-500 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <Icon size={14} strokeWidth={2} />
                {modeConfig[mode as keyof typeof modeConfig]?.label}
              </button>
            )
          })}
        </div>

        {/* Feed story strip — own + followed people */}
        <div className="-mx-4 mb-2 border-b border-gray-100">
          <ProfileStorySection scope="feed" />
        </div>

        {/* Composer bar */}
        <div className="flex items-center gap-2 px-2 py-2 bg-gray-50 rounded-lg">
          <img
            src={profile.photos && profile.photos.length > 0 ? profile.photos[0] : "/placeholder.svg"}
            alt="You"
            className="w-9 h-9 rounded-full object-cover flex-shrink-0"
            onError={(e) => {
              e.currentTarget.src = "/placeholder.svg"
            }}
          />
          <button
            onClick={() => setShowComposeSheet(true)}
            className="flex-1 bg-white border border-gray-200 rounded-full px-4 py-2 text-xs text-gray-500 hover:bg-gray-50 transition text-left"
          >
            What&apos;s on your mind?
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="flex-1 overflow-y-auto overscroll-y-contain scrollbar-hide"
        style={{ paddingTop: pullDistance > 0 ? pullDistance : 0, WebkitOverflowScrolling: "touch" }}
      >
        <div className="px-3 pt-3 pb-4 space-y-3">
          {/* People recommendations - only show if there are candidates */}
          {recommendedPeople && recommendedPeople.length > 0 && (
            <div className="bg-gradient-to-r from-emerald-50 to-pink-50 rounded-xl p-4 border border-emerald-200">
              <div className="flex items-center gap-2 mb-3">
                <UserPlus size={16} className="text-emerald-600" />
                <p className="text-xs font-bold text-emerald-900 uppercase tracking-wide">
                  People You May Know
                </p>
              </div>
              <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
                {recommendedPeople.map((person) => {
                  const initial = person.name?.charAt(0).toUpperCase() || "?"
                  return (
                    <div key={person.id} className="flex-shrink-0 text-center group">
                      <div className="relative w-14 h-14 rounded-full border-2 border-emerald-300 mx-auto mb-2 bg-gradient-to-br from-pink-400 via-purple-400 to-purple-600 flex items-center justify-center text-white font-bold overflow-hidden shadow-sm group-hover:shadow-md transition-all">
                        {person.photo && person.photo !== "/placeholder.svg?width=40&height=40" ? (
                          <img
                            src={person.photo}
                            alt={person.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.style.display = "none"
                              const parent = e.currentTarget.parentElement
                              if (parent && !parent.querySelector("span")) {
                                const span = document.createElement("span")
                                span.textContent = initial
                                span.className = "text-lg"
                                parent.appendChild(span)
                              }
                            }}
                          />
                        ) : (
                          <span className="text-lg">{initial}</span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-gray-900 truncate w-14">{person.name}</p>
                      <button
                        onClick={() => followUser(person.id)}
                        className="text-xs text-pink-600 font-semibold mt-1 hover:text-pink-700 active:scale-90 transition-all hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 rounded px-1"
                      >
                        Follow
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Loading skeleton */}
          {isLoading && (
            <div className="space-y-3">
              <PostSkeleton />
              <PostSkeleton />
              <PostSkeleton />
            </div>
          )}

          {/* Posts */}
          {!isLoading &&
            (displayPosts.length === 0 ? (
              <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-pink-50 px-5 py-10 text-center shadow-sm">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm"><Newspaper size={26} /></div>
                <p className="text-[18px] font-bold tabular-nums text-gray-900">Your feed is ready for something new</p>
                <p className="mx-auto mt-1 max-w-xs text-sm leading-5 text-gray-600">Create the first post or meet people who are already sharing.</p>
                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
                  <button type="button" onClick={() => setShowComposeSheet(true)} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700">Create your first post</button>
                  <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "discover" }))} className="rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50">Explore Discover</button>
                </div>
              </div>
            ) : (
              displayPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  isLiked={likedPosts.includes(post.id)}
                  isBookmarked={bookmarkedPostIds.includes(post.id)}
                  isOwnPost={post.authorId === "current-user"}
                  isCommentingPostId={commentingPostId === post.id}
                  onLike={handleLike}
                  onComment={() => setCommentSheetPostId(post.id)}
                  onShare={(postId) => addToast("Post shared!", "success")}
                  onOpenProfile={handleOpenAuthorProfile}
                  onBookmark={(postId) => {
                    setBookmarkedPostIds((current) =>
                      current.includes(postId)
                        ? current.filter((id) => id !== postId)
                        : [...current, postId],
                    )
                    addToast(
                      bookmarkedPostIds.includes(postId) ? "Removed from saved" : "Post saved",
                      bookmarkedPostIds.includes(postId) ? "info" : "success",
                    )
                  }}
                />
              ))
            ))}

          {/* Comment section */}
          {commentingPostId && (
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-2">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment..."
                className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                rows={2}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleComment(commentingPostId)}
                  disabled={!commentText.trim()}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white py-2 rounded-lg font-bold text-xs transition active:scale-95"
                >
                  Post
                </button>
                <button
                  onClick={() => {
                    setCommentingPostId(null)
                    setCommentText("")
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg font-bold text-xs transition active:scale-95"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Create — opens unified Post | Story compose */}
      <button
        onClick={() => {
          setComposeInitialMode("post")
          setShowComposeSheet(true)
        }}
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-pink-500 to-pink-600 text-white shadow-lg transition-all hover:shadow-xl active:scale-90"
        title="Create"
        aria-label="Create a post or story"
      >
        <Plus size={24} strokeWidth={3} />
      </button>

      <UnifiedCompose
        open={showComposeSheet}
        onOpenChange={setShowComposeSheet}
        initialMode={composeInitialMode}
      />

      <CommentSheet
        post={commentSheetPostId ? posts.find((p) => p.id === commentSheetPostId) || null : null}
        open={Boolean(commentSheetPostId)}
        onClose={() => setCommentSheetPostId(null)}
      />

      {/* Public profile opened from feed author name / photo */}
      {feedProfileCandidate && (
        <ProfilePreviewPage
          candidate={feedProfileCandidate}
          userInterests={profile.interests || []}
          userAge={profile?.age}
          userLocation={profile.city}
          canMessage={canMessageUser(feedProfileCandidate.id)}
          isFollowing={(following || []).includes(feedProfileCandidate.id)}
          isMatched={(matches || []).some(
            (m: any) => m.userId === feedProfileCandidate.id || m.id === feedProfileCandidate.id,
          )}
          onBack={() => setFeedProfileUserId(null)}
          onMessage={() =>
            void handleMessageFromFeedProfile(
              feedProfileCandidate.id,
              feedProfileCandidate.name,
              feedProfileCandidate.photo,
            )
          }
          onFollow={() => {
            void followUser(feedProfileCandidate.id)
            addToast(`You followed ${feedProfileCandidate.name}`, "success")
          }}
          onLike={() => {
            void followUser(feedProfileCandidate.id)
            addToast(`Interest noted for ${feedProfileCandidate.name}`, "success")
            setFeedProfileUserId(null)
          }}
          onPass={() => {
            setFeedProfileUserId(null)
            addToast("Passed", "info")
          }}
          onMute={() => {
            void muteUser?.(feedProfileCandidate.id)
            addToast("Muted", "info")
            setFeedProfileUserId(null)
          }}
          onBlock={() => {
            void blockUser(feedProfileCandidate.id)
            addToast("Blocked", "success")
            setFeedProfileUserId(null)
          }}
          onReport={(reason) => {
            void reportContent("user", feedProfileCandidate.id, reason)
            addToast("Report submitted", "success")
          }}
          publicPosts={posts
            .filter((p) => p.authorId === feedProfileCandidate.id && !(p as any).deletedAt)
            .slice(0, 8)
            .map((p) => ({ id: p.id, content: p.content, createdAt: p.createdAt }))}
        />
      )}
    </div>
  )
}

// DISCOVERY SCREEN - Enhanced Find People with Search & Filters
export function DiscoveryGridScreen() {
  const {
    candidates,
    posts,
    profile,
    following,
    friends,
    matches,
    settings,
    blockedUsers,
    mutedUsers,
    likes,
    swipe,
    startConversation,
    addToast,
    followUser,
    setTab,
    blockUser,
    muteUser,
    reportContent,
  } = useGHC()
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>(() => {
    try {
      const v = localStorage.getItem("ghc_find_intent_v1")
      if (v === "friends" || v === "professional" || v === "collaborate" || v === "mentor" || v === "learn" || v === "dating" || v === "all") return v
    } catch { /* */ }
    return "all"
  })
  useEffect(() => {
    try {
      localStorage.setItem("ghc_find_intent_v1", connectionMode)
    } catch { /* */ }
  }, [connectionMode])
  const [continentFilter, setContinentFilter] = useState<ContinentId>("global")
  const matchesConnectionMode = (c: Candidate) => candidateMatchesIntent(c, connectionMode)
  const [searchQuery, setSearchQuery] = useState("")
  const [processedCandidateIds, setProcessedCandidateIds] = useState<Set<string>>(new Set())
  const [busyCandidateIds, setBusyCandidateIds] = useState<Set<string>>(new Set())
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const [showFilters, setShowFilters] = useState(false)
  const [showProfilePreview, setShowProfilePreview] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)

  // Keep-alive tabs leave Find mounted — force-close profile / filters when leaving Find
  useEffect(() => {
    return onCloseTransientUI(() => {
      setShowProfilePreview(false)
      setSelectedCandidate(null)
      setShowFilters(false)
    })
  }, [])
  const [ageRange, setAgeRange] = useState<[number, number]>([18, 45])
  const [selectedMode, setSelectedMode] = useState("dating")
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [distance, setDistance] = useState(50)
  const [locationFilter, setLocationFilter] = useState("")
  const [activityLevel, setActivityLevel] = useState<"active" | "recent" | "all">("all")
  const [recentSearches, setRecentSearches] = useState<string[]>(["travel", "photography", "tech"])
  const [viewMode, setViewMode] = useState<"browse" | "sections">(() => {
    try {
      const v = localStorage.getItem("ghc_find_view_v1")
      return v === "sections" ? "sections" : "browse"
    } catch {
      return "browse"
    }
  })
  const [layoutMode, setLayoutMode] = useState<"cards" | "list">(() => {
    try {
      const v = localStorage.getItem("ghc_find_layout_v1")
      return v === "list" ? "list" : "cards"
    } catch {
      return "cards"
    }
  })
  const [showMoreSections, setShowMoreSections] = useState(false)
  const [discoveryError, setDiscoveryError] = useState<Error | null>(null)
  const [discoveryRenderKey, setDiscoveryRenderKey] = useState(0)
  const { compact: headerCompact, hidden: headerHidden, onScroll: onHeaderScroll } = useScrollHeader({ threshold: 40 })

  const filteredCandidates = useMemo(() => {
    const query = (deferredSearchQuery ?? "").trim().toLowerCase()
    const matchIds = (matches || [])
      .map((m: { userId?: string; id?: string }) => m.userId || m.id)
      .filter(Boolean) as string[]
    const blocked = uniqueIds([...(blockedUsers || []), ...((settings?.blockedUsers as string[]) || [])])
    const muted = uniqueIds([
      ...(mutedUsers || []),
      ...(((settings as { mutedUsers?: string[] })?.mutedUsers) || []),
    ])

    // Rank with non-sensitive signals, then apply UI filters (search, age, etc.)
    const ranked = rankDiscoveryCandidates(Array.isArray(candidates) ? candidates : [], {
      selfId: (profile as { id?: string } | null | undefined)?.id || "current-user",
      interests: Array.isArray(profile?.interests) ? profile!.interests : [],
      city: profile?.city,
      country: profile?.country,
      profession: (profile as { profession?: string } | null | undefined)?.profession,
      education: (profile as { education?: string } | null | undefined)?.education,
      followingIds: following || [],
      friendIds: friends || [],
      matchIds,
      blockedIds: blocked,
      mutedIds: muted,
      processedIds: processedCandidateIds,
      connectionMode,
    })

    return ranked.filter((candidate) => {
      const candidateInterests = Array.isArray(candidate.interests)
        ? candidate.interests.filter((interest): interest is string => typeof interest === "string")
        : []
      const candidateName = typeof candidate.name === "string" ? candidate.name : "Pi Member"
      const candidateLocation = typeof candidate.location === "string" ? candidate.location : ""
      const candidateBio = typeof candidate.bio === "string" ? candidate.bio : ""
      const candidateAge = Number.isFinite(Number(candidate.age)) ? Number(candidate.age) : 0
      const searchable = [candidateName, candidateLocation, candidateBio, ...candidateInterests]
        .join(" ")
        .toLowerCase()
      const matchesSearch = !query || searchable.includes(query)
      const matchesAge =
        !candidateAge || (candidateAge >= ageRange[0] && candidateAge <= ageRange[1])
      const matchesInterest =
        selectedInterests.length === 0 ||
        selectedInterests.some((interest) => candidateInterests.includes(interest))
      const candidateRecord = candidate as Candidate & {
        city?: string
        country?: string
        lastActiveAt?: number
        relationshipGoals?: string[]
        primaryMode?: string
      }
      const searchableLocation =
        `${candidate.location ?? ""} ${candidateRecord.city ?? ""} ${candidateRecord.country ?? ""}`.toLowerCase()
      const matchesLocation =
        !locationFilter.trim() ||
        searchableLocation.includes(locationFilter.trim().toLowerCase())
      const matchesActivity =
        activityLevel === "all" ||
        (activityLevel === "active"
          ? Boolean(candidate.online)
          : Boolean(
              candidate.online ||
                Number(candidateRecord.lastActiveAt ?? 0) > Date.now() - 604800000,
            ))
      const matchesGoal =
        !selectedMode ||
        selectedMode === "dating" ||
        candidateRecord.primaryMode === selectedMode ||
        (Array.isArray(candidateRecord.relationshipGoals) &&
          candidateRecord.relationshipGoals.includes(selectedMode))
      const matchesContinent = candidateInContinent(
        candidate as { country?: string; location?: string; city?: string },
        continentFilter,
      )
      const matchesIntent = matchesConnectionMode(candidate)
      return (
        matchesSearch &&
        matchesAge &&
        matchesInterest &&
        matchesLocation &&
        matchesActivity &&
        matchesGoal &&
        matchesContinent &&
        matchesIntent
      )
    })
  }, [
    activityLevel,
    ageRange,
    blockedUsers,
    candidates,
    connectionMode,
    continentFilter,
    deferredSearchQuery,
    following,
    friends,
    locationFilter,
    matches,
    mutedUsers,
    processedCandidateIds,
    profile,
    selectedInterests,
    selectedMode,
    settings?.blockedUsers,
  ])


  const resetDiscoveryFilters = () => {
    setSearchQuery("")
    setAgeRange([18, 45])
    setSelectedMode("dating")
    setSelectedInterests([])
    setDistance(50)
    setLocationFilter("")
    setActivityLevel("all")
    setProcessedCandidateIds(new Set())
    setBusyCandidateIds(new Set())
    setDiscoveryError(null)
    setViewMode("browse")
  }

  const commitSearch = (query: string) => {
    const normalized = query.trim()
    setSearchQuery(normalized)
    if (normalized) setRecentSearches((current) => [normalized, ...current.filter((item) => item.toLowerCase() !== normalized.toLowerCase())].slice(0, 5))
  }

  /** Mark acted-on and optionally open the next ranked card */
  
  const outgoingInterestIds = useMemo(() => {
    const set = new Set<string>()
    for (const like of likes || []) {
      if (like?.fromUserId === "current-user" && typeof like.toUserId === "string") {
        set.add(like.toUserId)
      }
    }
    return set
  }, [likes])

  const matchedUserIds = useMemo(() => {
    return new Set(
      (matches || [])
        .map((m: { userId?: string; id?: string }) => m.userId || m.id)
        .filter(Boolean) as string[],
    )
  }, [matches])

const completeDiscoveryAction = useCallback(
    (candidateId: string, options?: { advancePreview?: boolean; toast?: string; toastType?: "success" | "info" | "error" }) => {
      setProcessedCandidateIds((current) => new Set(current).add(candidateId))
      setBusyCandidateIds((current) => {
        const next = new Set(current)
        next.delete(candidateId)
        return next
      })
      if (options?.toast) {
        addToast(options.toast, options.toastType || "success")
      }
      if (options?.advancePreview !== false && showProfilePreview) {
        // Use latest filtered list excluding the one we just processed
        const remaining = filteredCandidates.filter((c) => c.id !== candidateId)
        const next = nextDiscoveryCandidate(remaining, candidateId)
        if (next) {
          setSelectedCandidate(next)
          setShowProfilePreview(true)
        } else {
          setShowProfilePreview(false)
          setSelectedCandidate(null)
        }
      } else if (!showProfilePreview) {
        setSelectedCandidate(null)
      }
    },
    [addToast, filteredCandidates, showProfilePreview],
  )

  const refreshDiscovery = useCallback(() => {
    setProcessedCandidateIds(new Set())
    setBusyCandidateIds(new Set())
    setSelectedCandidate(null)
    setShowProfilePreview(false)
    setDiscoveryError(null)
    setDiscoveryRenderKey((k) => k + 1)
    addToast("Discovery refreshed", "info")
  }, [addToast])


  const handleLike = async (candidateId: string) => {
    if (busyCandidateIds.has(candidateId) || processedCandidateIds.has(candidateId)) return
    setBusyCandidateIds((current) => new Set(current).add(candidateId))
    try {
      setDiscoveryError(null)
      const candidate = candidates.find((c) => c.id === candidateId)
      if (!candidate) {
        throw new Error("Profile not found")
      }
      await swipe(candidateId, "like")
      const label =
        typeof candidate.name === "string" && candidate.name.trim()
          ? candidate.name.trim()
          : "this profile"
      completeDiscoveryAction(candidateId, {
        advancePreview: showProfilePreview,
      })
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Failed to like profile")
      console.error("[Discovery Like Error]", err)
      setDiscoveryError(err)
      addToast("Failed to like profile. Try again.", "error")
      setBusyCandidateIds((current) => {
        const next = new Set(current)
        next.delete(candidateId)
        return next
      })
    }
  }

  const handlePass = async (candidateId: string) => {
    if (busyCandidateIds.has(candidateId) || processedCandidateIds.has(candidateId)) return
    setBusyCandidateIds((current) => new Set(current).add(candidateId))
    try {
      await swipe(candidateId, "pass")
      completeDiscoveryAction(candidateId, {
        advancePreview: showProfilePreview,
        toast: "Hidden for now",
        toastType: "info",
      })
    } catch {
      addToast("Could not pass this profile. Try again.", "error")
      setBusyCandidateIds((current) => {
        const next = new Set(current)
        next.delete(candidateId)
        return next
      })
    }
  }

  const handleMessage = async (candidateId: string) => {
    try {
      setDiscoveryError(null)
      const candidate = candidates.find((c) => c.id === candidateId)
      if (!candidate) {
        throw new Error("Profile not found")
      }
      const isMatched = (matches || []).some(
        (m: { userId?: string; id?: string }) => m.userId === candidateId || m.id === candidateId
      )
      const isFollowing = (following || []).includes(candidateId)
      const canOpenChat = isMatched || isFollowing
      await startConversation(
        candidateId,
        typeof candidate.name === "string" ? candidate.name : "Pi Member",
        typeof candidate.photo === "string" && candidate.photo
          ? candidate.photo
          : "/placeholder.svg?height=80&width=80"
      )
      setProcessedCandidateIds((current) => new Set(current).add(candidateId))
      setShowProfilePreview(false)
      setSelectedCandidate(null)
      addToast(
        canOpenChat ? "Opening conversation…" : "Message request sent — they can accept when ready",
        "success"
      )
      try {
        setTab?.("messages" as any)
      } catch {
        /* */
      }
      window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "messages" }))
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Failed to start conversation")
      console.error("[Discovery Message Error]", err)
      setDiscoveryError(err)
      addToast("Failed to start conversation. Try again.", "error")
    }
  }

  const handleFollow = async (candidateId: string) => {
    try {
      setDiscoveryError(null)
      const candidate = candidates.find((c) => c.id === candidateId)
      if (!candidate) {
        throw new Error("Profile not found")
      }
      const { allowClientAction, rateLimitMessage } = await import("@/lib/client-rate-limit")
      if (!allowClientAction("follow")) {
        addToast(rateLimitMessage("follow"), "info")
        return
      }
      // Single source: followUser toggles `following` and shows toast
      await followUser(candidateId)
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Failed to follow user")
      console.error("[Discovery Follow Error]", err)
      setDiscoveryError(err)
      addToast("Failed to follow user. Try again.", "error")
    }
  }

  const handleViewProfile = (candidate: Candidate) => {
    setSelectedCandidate(candidate)
    setShowProfilePreview(true)
  }

  const handleViewEvent = (name: string) => {
    addToast(`Viewing event: ${name}`, "info")
  }

  const handleViewBusiness = (name: string) => {
    addToast(`Viewing business: ${name}`, "info")
  }

  const handleViewProduct = (name: string) => {
    addToast(`Viewing product: ${name}`, "info")
  }

  const handleViewPost = (postId: string) => {
    addToast(`Viewing post`, "info")
  }

  const handleViewLive = (streamId: string) => {
    addToast(`Joining live stream`, "info")
  }

  const handleViewCommunity = (name: string) => {
    addToast(`Viewing community: ${name}`, "info")
  }

  const handleSearch = (query: string) => {
    try {
      setDiscoveryError(null)
      setSearchQuery(query)
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Search failed")
      console.error("[Discovery Search Error]", err)
      setDiscoveryError(err)
    }
  }


  const modeFilteredCandidates = useMemo(
    () => filteredCandidates.filter(matchesConnectionMode),
    [filteredCandidates, connectionMode],
  )
  const [discoverVisibleCount, setDiscoverVisibleCount] = useState(18)
  useEffect(() => {
    setDiscoverVisibleCount(18)
  }, [connectionMode, deferredSearchQuery, viewMode, layoutMode])
  const visibleDiscoveryCandidates = useMemo(
    () => modeFilteredCandidates.slice(0, discoverVisibleCount),
    [modeFilteredCandidates, discoverVisibleCount],
  )
  const suggestedCandidates = modeFilteredCandidates.slice(0, 5)
  const suggestionTerms = useMemo(() => {
    const safeCandidates = Array.isArray(candidates) ? candidates : []
    return Array.from(new Set(safeCandidates.flatMap((candidate) => Array.isArray(candidate?.interests) ? candidate.interests.filter((interest): interest is string => typeof interest === "string") : []))).slice(0, 12)
  }, [candidates])
  const activeFilterCount = Number(ageRange[0] !== 18 || ageRange[1] !== 45) + Number(selectedInterests.length > 0) + Number(distance !== 50) + Number(selectedMode !== "dating") + Number(Boolean(locationFilter.trim())) + Number(activityLevel !== "all")
  const filtersApplied = activeFilterCount > 0
  const activeFilterLabels = [
    ...(ageRange[0] !== 18 || ageRange[1] !== 45 ? [`${ageRange[0]}–${ageRange[1]} years`] : []),
    ...(selectedMode !== "dating" ? [selectedMode] : []),
    ...(distance !== 50 ? [`Within ${distance} km`] : []),
    ...(selectedInterests.length ? selectedInterests.slice(0, 2) : []),
    ...(locationFilter.trim() ? [locationFilter.trim()] : []),
    ...(activityLevel !== "all" ? [activityLevel === "active" ? "Active now" : "Recently active"] : []),
  ]

  return (
    <div key={discoveryRenderKey} className="relative flex h-full min-h-0 flex-col overflow-hidden bg-stone-50 text-stone-900">
      {/* Error Banner */}
      {discoveryError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-red-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-900">Something went wrong</p>
              <p className="text-xs text-red-700 mt-1">{discoveryError.message}</p>
              <button
                onClick={() => { setDiscoveryError(null); setBusyCandidateIds(new Set()); setProcessedCandidateIds(new Set()); setSelectedCandidate(null); setShowProfilePreview(false); setSearchQuery(""); setViewMode("sections"); setDiscoveryRenderKey((key) => key + 1) }}
                className="mt-2 text-xs font-semibold text-red-600 hover:text-red-700 underline"
                aria-label="Dismiss error"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <CollapsingAppHeader
        title="Find"
        subtitle="Discover people & communities"
        compact={headerCompact}
        hidden={headerHidden}
        compactLeading={
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-500 text-white">
            <Users size={14} />
          </div>
        }
        actions={
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setLayoutMode((m) => {
                  const next = m === "cards" ? "list" : "cards"
                  try { localStorage.setItem("ghc_find_layout_v1", next) } catch { /* */ }
                  return next
                })
              }}
              className="min-h-9 rounded-full bg-muted px-3 py-1.5 text-[11px] font-bold text-foreground"
              aria-label="Toggle list or cards"
            >
              {layoutMode === "cards" ? "List" : "Cards"}
            </button>
            <button
              type="button"
              onClick={() => {
                const next = viewMode === "browse" ? "sections" : "browse"
                setViewMode(next)
                try { localStorage.setItem("ghc_find_view_v1", next) } catch { /* */ }
              }}
              className="rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary"
              aria-label={`Switch to ${viewMode === "browse" ? "sections" : "browse"} view`}
            >
              {viewMode === "browse" ? "Sections" : "Browse"}
            </button>
          </div>
        }
        secondary={
          <>
            {/* Compact search — filter button lives in SearchBar */}
            <SearchBar recentSearches={recentSearches} suggestionTerms={suggestionTerms} onSearch={handleSearch} onSearchCommit={commitSearch} onFiltersClick={() => setShowFilters(true)} />
            {/* Single chip row: categories + quick filters (saves vertical space vs two rows) */}
            <div className="mt-1 flex gap-1 overflow-x-auto scrollbar-hide pb-0.5" role="toolbar" aria-label="Find shortcuts">
              {(
                [
                  { id: "people", label: "People" },
                  { id: "professionals", label: "Pro" },
                  { id: "communities", label: "Communities" },
                  { id: "nearby", label: "Nearby" },
                  { id: "active", label: "Active" },
                  { id: "mutual", label: "Mutuals" },
                ] as const
              ).map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => {
                    if (chip.id === "communities") {
                      setTab("communities")
                      window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "communities" }))
                    } else if (chip.id === "professionals") {
                      setConnectionMode("professional")
                      setSelectedInterests((cur) =>
                        cur.includes("Tech") || cur.includes("Business") ? cur : [...cur, "Tech"].slice(0, 8)
                      )
                    } else if (chip.id === "nearby") {
                      setLocationFilter(profile.city || profile.country || "")
                    } else if (chip.id === "active") {
                      setActivityLevel("active")
                    } else if (chip.id === "mutual") {
                      setConnectionMode("friendship")
                    } else {
                      setConnectionMode("all")
                    }
                  }}
                  className="flex min-h-8 shrink-0 items-center rounded-full border border-border/80 bg-card px-2.5 py-1 text-[10px] font-bold text-foreground transition hover:border-primary/40 hover:bg-primary/5"
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <div className="mt-0.5 flex items-center justify-between text-[10px] text-stone-500">
              <span className="flex items-center gap-1.5">
                {searchQuery !== deferredSearchQuery && (
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />
                )}
                {searchQuery !== deferredSearchQuery
                  ? "Updating…"
                  : `${filteredCandidates.length} to explore`}
                {filtersApplied && (
                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 font-bold text-emerald-800">Filtered</span>
                )}
              </span>
              {activeFilterCount > 0 && (
                <button type="button" onClick={resetDiscoveryFilters} className="font-semibold text-emerald-700">
                  Reset
                </button>
              )}
            </div>
          </>
        }
      />

      {/* Main Content */}
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y scrollbar-hide pb-[var(--gh-bottom-content-inset)]"
        style={{ WebkitOverflowScrolling: "touch" }}
        role="main"
        aria-label="Discovery content"
        aria-live="polite"
        aria-busy={searchQuery !== deferredSearchQuery}
        onScroll={onHeaderScroll}
      >
        {viewMode === "sections" ? (
          <div className="space-y-2 pb-4">
            {/* People-first hierarchy: search remains above, then Picks for you, interests, and discovery sections. */}
            <ConnectionModeBar mode={connectionMode} onChange={setConnectionMode} />
            {connectionMode !== "all" && (
              <p className="px-4 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                Showing · {connectionMode.charAt(0).toUpperCase() + connectionMode.slice(1)}
              </p>
            )}
            {suggestedCandidates.length > 0 && <div className="animate-in fade-in duration-300"><SuggestionsCarousel candidates={suggestedCandidates} onViewProfile={handleViewProfile} onLike={handleLike} onMessage={handleMessage} userInterests={Array.isArray(profile?.interests) ? profile.interests : []} userAge={profile?.age} userLocation={[profile?.city, profile?.country].filter(Boolean).join(", ") || "Global"} /></div>}
            {suggestionTerms.length > 0 && <div className="flex gap-1.5 overflow-x-auto px-4 py-2 scrollbar-hide animate-in fade-in duration-300" aria-label="Interest filters">
              {suggestionTerms.map((term) => <button key={term} type="button" onClick={() => setSelectedInterests((current) => current.includes(term) ? current.filter((item) => item !== term) : [...current, term])} className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold transition active:scale-95 ${selectedInterests.includes(term) ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-600 hover:bg-emerald-50 hover:text-emerald-800"}`}>{term}</button>)}
            </div>}
            {activeFilterLabels.length > 0 && <div className="flex gap-1.5 overflow-x-auto px-4 pb-2 scrollbar-hide" aria-label="Active filters">
              {activeFilterLabels.map((label) => <span key={label} className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold capitalize text-emerald-800">{label}</span>)}
              {selectedInterests.length > 2 && <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold text-gray-600">+{selectedInterests.length - 2} more</span>}
            </div>}
            <div className="animate-in fade-in slide-in-from-bottom-1 duration-300">
            <TrendingSection candidates={candidates} onViewProfile={handleViewProfile} onLike={handleLike} onMessage={handleMessage} />
            <NearbySection candidates={candidates} onViewProfile={handleViewProfile} onLike={handleLike} onMessage={handleMessage} />
            <SuggestedFriendsSection candidates={candidates.slice(0, 8)} onViewProfile={handleViewProfile} onFollow={handleFollow} />
            </div>

            {/* Main people grid stays ahead of secondary content. */}
            <div className="px-3 pt-3 animate-in fade-in slide-in-from-bottom-1 duration-300">
              <h3 className="mb-0.5 px-1 text-base font-bold text-stone-900">Recommended for you</h3>
              <p className="mb-3 px-1 text-[12px] text-stone-500">Based on your interests, location and activity</p>
              {layoutMode === "list" ? (
                <div className="space-y-2 [contain:layout_paint]">
                  {modeFilteredCandidates.slice(0, 16).map((candidate) => (
                    <DiscoverListRow
                      key={candidate.id}
                      candidate={candidate}
                      isFollowing={following.includes(candidate.id)}
                      onViewProfile={() => handleViewProfile(candidate)}
                      onLike={() => void handleLike(candidate.id)}
                    />
                  ))}
                </div>
              ) : (
              <div className="mx-auto grid max-w-md grid-cols-1 gap-4 [contain:layout_paint] sm:max-w-none sm:grid-cols-2">
                {modeFilteredCandidates.slice(0, 8).map((candidate) => (
                  <UserCard key={candidate.id} candidate={candidate} isFollowing={following.includes(candidate.id)} interestSent={outgoingInterestIds.has(candidate.id)} isMatched={matchedUserIds.has(candidate.id)} canMessage={(matches || []).some((m: any) => m.userId === candidate.id || m.id === candidate.id) || following.includes(candidate.id)} mutualInterestNames={(Array.isArray(candidate.interests) ? candidate.interests : []).filter((interest) => (Array.isArray(profile?.interests) ? profile.interests : []).includes(interest))} mutualConnections={(Array.isArray(candidate.interests) ? candidate.interests : []).filter((interest) => (Array.isArray(profile?.interests) ? profile.interests : []).includes(interest)).length} userInterests={Array.isArray(profile?.interests) ? profile.interests : []} userAge={profile?.age} userLocation={[profile?.city, profile?.country].filter(Boolean).join(", ") || "Global"} onViewProfile={() => handleViewProfile(candidate)} onLike={() => void handleLike(candidate.id)} onPass={() => void handlePass(candidate.id)} onFollow={() => void handleFollow(candidate.id)} onMessage={() => void handleMessage(candidate.id)} professionalMode={connectionMode === "professional"} onReport={() => { void reportContent("user", candidate.id, "Inappropriate profile"); addToast("Report submitted", "success") }} onBlock={() => { void blockUser?.(candidate.id); completeDiscoveryAction(candidate.id, { toast: "Blocked", toastType: "success", advancePreview: false }) }} />
                ))}
              </div>
              )}
            </div>

            {/* Secondary content remains available, but never blocks the people-first view. */}
            <button type="button" onClick={() => setShowMoreSections((value) => !value)} className="mx-4 mt-4 w-[calc(100%-2rem)] rounded-xl border border-gray-200 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 active:scale-95">
              {showMoreSections ? "Show less" : "See more"}
            </button>
            {showMoreSections && <div className="animate-in fade-in slide-in-from-bottom-1 duration-300">
              {!searchQuery && <RecentSearchesSection searches={recentSearches} onSearch={commitSearch} onClear={() => setRecentSearches([])} onRemove={(query) => setRecentSearches((current) => current.filter((item) => item.toLowerCase() !== query.toLowerCase()))} />}
              {posts && posts.length > 0 && <PopularPostsSection posts={posts} onViewPost={handleViewPost} />}
              <CommunitiesSection onViewCommunity={handleViewCommunity} />
            </div>}
          </div>
        ) : (
          <div className="px-3 pt-4 pb-4">
            {filteredCandidates.length === 0 ? (
              <EmptyState
                variant="discover"
                title="No more people to show"
                description="You've seen everyone who matches your current filters, or the pool is empty after excluding blocked and muted accounts."
                action={{ label: "Refresh Discovery", onClick: refreshDiscovery }}
                secondaryAction={{ label: "Reset filters", onClick: resetDiscoveryFilters }}
              />
            ) : (
              <div className="mx-auto grid max-w-md grid-cols-1 gap-4 sm:max-w-none sm:grid-cols-2 [contain:layout_paint]">
                {visibleDiscoveryCandidates.map((candidate) => (
                  <UserCard
                    key={candidate.id}
                    candidate={candidate}
                    isFollowing={following.includes(candidate.id)} interestSent={outgoingInterestIds.has(candidate.id)} isMatched={matchedUserIds.has(candidate.id)}
                    canMessage={(matches || []).some((m: any) => m.userId === candidate.id || m.id === candidate.id) || following.includes(candidate.id)}
                    mutualInterestNames={(Array.isArray(candidate.interests) ? candidate.interests : []).filter((interest) => (Array.isArray(profile?.interests) ? profile.interests : []).includes(interest))}
                    mutualConnections={(Array.isArray(candidate.interests) ? candidate.interests : []).filter((interest) => (Array.isArray(profile?.interests) ? profile.interests : []).includes(interest)).length}
                    userInterests={Array.isArray(profile?.interests) ? profile.interests : []}
                    userAge={profile?.age}
                    userLocation={[profile?.city, profile?.country].filter(Boolean).join(", ") || "Global"}
                    onViewProfile={() => handleViewProfile(candidate)}
                    onLike={() => void handleLike(candidate.id)}
                    onPass={() => void handlePass(candidate.id)}
                    onFollow={() => void handleFollow(candidate.id)}
                    onMessage={() => void handleMessage(candidate.id)}
                    professionalMode={connectionMode === "professional"}
                    onReport={() => {
                      void reportContent("user", candidate.id, "Inappropriate profile")
                      addToast("Report submitted", "success")
                    }}
                    onBlock={() => {
                      void blockUser?.(candidate.id)
                      completeDiscoveryAction(candidate.id, {
                        toast: "Blocked",
                        toastType: "success",
                        advancePreview: false,
                      })
                    }}
                  />
                ))}
                {modeFilteredCandidates.length > discoverVisibleCount && (
                  <div className="col-span-full flex justify-center pt-2 pb-4">
                    <button
                      type="button"
                      onClick={() => setDiscoverVisibleCount((n) => n + 12)}
                      className="min-h-11 rounded-xl border border-border bg-card px-5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted"
                    >
                      Show more people
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Discovery filters"
          aria-describedby="filter-description"
        >
          <FilterPanel
            isOpen={showFilters}
            onClose={() => setShowFilters(false)}
            ageRange={ageRange}
            onAgeRangeChange={setAgeRange}
            selectedMode={selectedMode}
            onModeChange={setSelectedMode}
            selectedInterests={selectedInterests}
            onInterestsChange={setSelectedInterests}
            distance={distance}
            onDistanceChange={setDistance}
            location={locationFilter}
            onLocationChange={setLocationFilter}
            activityLevel={activityLevel}
            onActivityLevelChange={setActivityLevel}
          />
          <div id="filter-description" className="sr-only">
            Use these filters to customize your discovery preferences
          </div>
        </div>
      )}

      {/* Profile Preview Modal */}
      {showProfilePreview && selectedCandidate && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Profile: ${selectedCandidate.name}`}
        >
          <ProfilePreviewPage
            candidate={selectedCandidate}
            onBack={() => {
              setShowProfilePreview(false)
              setSelectedCandidate(null)
            }}
            onLike={() => void handleLike(selectedCandidate.id)}
            onPass={() => void handlePass(selectedCandidate.id)}
            onMessage={() => void handleMessage(selectedCandidate.id)}
            onFollow={() => void handleFollow(selectedCandidate.id)}
            onMute={() => {
              const id = selectedCandidate.id
              void muteUser?.(id)
              completeDiscoveryAction(id, {
                toast: "Muted — their content is hidden from your feeds",
                toastType: "info",
                advancePreview: true,
              })
            }}
            onBlock={() => {
              const id = selectedCandidate.id
              void blockUser?.(id)
              completeDiscoveryAction(id, {
                toast: "Blocked",
                toastType: "success",
                advancePreview: true,
              })
            }}
            onReport={(reason) => {
              void reportContent?.("user", selectedCandidate.id, reason)
              addToast("Report submitted", "success")
            }}
            userInterests={Array.isArray(profile?.interests) ? profile.interests : []}
            userAge={profile?.age}
            userLocation={[profile?.city, profile?.country].filter(Boolean).join(", ") || "Global"}
            publicPosts={posts.filter((post) => post.authorId === selectedCandidate.id && post.visibility !== "private").map((post) => ({ id: post.id, content: post.content, createdAt: post.createdAt }))}
            stories={[]}
            isFollowing={following.includes(selectedCandidate.id)}
            isMatched={(matches || []).some((m: any) => m.userId === selectedCandidate.id || m.id === selectedCandidate.id)}
            canMessage={(matches || []).some((m: any) => m.userId === selectedCandidate.id || m.id === selectedCandidate.id) || following.includes(selectedCandidate.id)}
          />
        </div>
      )}
    </div>
  )
}

// MATCHES SCREEN - Mutual matches with tabs and common interests
export function MatchScreen() {
  const { matches, likes, profile, candidates, startConversation, sendMessage, conversations, addToast, setTab, friends } = useGHC()
  const [activeTab, setActiveTab] = useState<"new" | "all">("new")
  const [intentionFilter, setIntentionFilter] = useState<MatchIntention | "all">("all")
  const [removedMatches, setRemovedMatches] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { compact: headerCompact, hidden: headerHidden, onScroll: onHeaderScroll } = useScrollHeader({ threshold: 36 })

  const safeMatches = filterValidMatches(matches)
  const safeLikes = asArray(likes)
  const safeCandidates = asArray(candidates)

  // Prefer mutual likes when present; otherwise show graph matches (intentional matches domain)
  const mutualMatches = safeMatches.filter((match) => {
    const hasLikeData = safeLikes.length > 0
    if (!hasLikeData) return true
    return (
      safeLikes.some((like) => like.fromUserId === "current-user" && like.toUserId === match.userId) &&
      safeLikes.some((like) => like.fromUserId === match.userId && like.toUserId === "current-user")
    )
  })

  useEffect(() => {
    const timer = window.setTimeout(() => setIsLoading(false), 350)
    return () => window.clearTimeout(timer)
  }, [safeMatches.length])

  // Clear local Match UI when leaving the section
  useEffect(() => {
    return onCloseTransientUI((detail) => {
      const next = detail?.tab
      if (next && next !== "matches") {
        setActiveTab("new")
        setIntentionFilter("all")
      }
    })
  }, [])

  const sortMatches = (items: typeof safeMatches) =>
    [...items].sort((a, b) => Number(b.online) - Number(a.online) || b.matchedAt - a.matchedAt)

  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  const baseAll = sortMatches(mutualMatches.filter((m) => !removedMatches.includes(m.id)))
  const baseNew = sortMatches(baseAll.filter((m) => now - m.matchedAt < day))

  const filterByIntention = (items: typeof safeMatches) => {
    if (intentionFilter === "all") return items
    return items.filter((m) => {
      const cand = safeCandidates.find((c) => c.id === m.userId)
      return resolveMatchIntention(m as any, cand) === intentionFilter
    })
  }

  const newMatches = filterByIntention(baseNew)
  const allMatches = filterByIntention(baseAll)
  const displayMatches = activeTab === "new" ? newMatches : allMatches

  const intentionCounts = useMemo(() => {
    const counts: Partial<Record<MatchIntention | "all", number>> = { all: baseAll.length }
    for (const m of baseAll) {
      const cand = safeCandidates.find((c) => c.id === m.userId)
      const intent = resolveMatchIntention(m as any, cand)
      counts[intent] = (counts[intent] || 0) + 1
    }
    return counts
  }, [baseAll, safeCandidates])

  const getCandidateData = (userId: string) => safeCandidates.find((c) => c.id === userId)

  const mutualConnectionCount = (userId: string) => {
    // Approximate: shared friends not fully available — use interest overlap as soft signal only
    return 0
  }

  const handleMessage = async (match: (typeof matches)[0]) => {
    const cand = getCandidateData(match.userId)
    const intention = resolveMatchIntention(match as any, cand)
    const metaLabel =
      intention === "professional"
        ? "Professional"
        : intention === "friendship"
          ? "Friendship"
          : intention === "dating"
            ? "Dating"
            : intention === "collaboration"
              ? "Collaboration"
              : intention === "mentorship"
                ? "Mentorship"
                : intention === "learning"
                  ? "Learning"
                  : "shared interests"
    const existing = (conversations || []).find(
      (c: { participantId?: string; conversationType?: string }) =>
        c.participantId === match.userId && c.conversationType === "private"
    )
    const convId = await startConversation(match.userId, match.userName, match.userPhoto)
    if (convId && !existing && typeof sendMessage === "function") {
      try {
        await sendMessage(convId, `You matched on ${metaLabel}. Looking forward to connecting.`)
      } catch {
        /* offline / non-blocking */
      }
    }
    addToast(`Chat opened · You matched on ${metaLabel}`, "success")
  }

  const handleRemoveMatch = (matchId: string) => {
    setRemovedMatches([...removedMatches, matchId])
    addToast("Match removed", "info")
  }

  const handleStartSwiping = () => {
    setTab("discover")
    addToast("Mutual interest only — open Find to express interest", "info")
  }

  if (!isLoading && mutualMatches.length === 0) {
    return (
      <div className="relative flex h-full flex-col bg-background text-foreground pb-3">
        <CollapsingAppHeader
          title="Matches"
          subtitle="Mutual interest · not automatic friends"
          compact={false}
          hidden={false}
          compactLeading={
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-emerald-600 text-white">
              <Heart size={14} />
            </div>
          }
        />
        <div className="flex flex-1 items-center justify-center">
          <EmptyMatchesState onStartSwiping={handleStartSwiping} />
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex h-full flex-col bg-background text-foreground pb-3">
      <CollapsingAppHeader
        title="Matches"
        subtitle={`${baseAll.length} intentional match${baseAll.length === 1 ? "" : "es"}`}
        compact={headerCompact}
        hidden={headerHidden}
        compactLeading={
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-emerald-600 text-white">
            <Heart size={14} />
          </div>
        }
        actions={
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800">
            {baseAll.length}
          </span>
        }
        secondary={
          <div className="space-y-2">
            <MatchTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
              newCount={baseNew.length}
              totalCount={baseAll.length}
            />
            <MatchIntentionFilters
              active={intentionFilter}
              onChange={setIntentionFilter}
              counts={intentionCounts}
            />
            <p className="text-[12px] leading-relaxed text-stone-600">
              A Match is mutual interest — not automatic friendship or a compatibility score. Follow and Connect are different.
            </p>
          </div>
        }
      />

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-hide" onScroll={onHeaderScroll}>
        {isLoading ? (
          <div className="flex flex-col gap-3 px-4 pb-6 pt-4">
            <MatchCardSkeleton />
            <MatchCardSkeleton />
            <MatchCardSkeleton />
            <MatchCardSkeleton />
            <MatchCardSkeleton />
          </div>
        ) : displayMatches.length === 0 ? (
          <EmptyState
            variant="matches"
            title={
              activeTab === "new"
                ? "No new matches"
                : intentionFilter !== "all"
                  ? "No matches for this intention"
                  : "No matches yet"
            }
            description={
              activeTab === "new"
                ? "New mutual interests from the last 24 hours show up here. Dating · Friendship · Pro · Mentor are intentional types — not automatic friends."
                : "A match means mutual intentional interest. Open Find to express interest in people who fit your goals."
            }
            action={{ label: "Express interest on Find", onClick: handleStartSwiping }}
          />
        ) : (
          <div className="flex flex-col gap-3 px-4 pb-6 pt-4">
            {displayMatches.map((match, index) => (
              <MatchCard
                key={match.id}
                match={match}
                userInterests={Array.isArray(profile?.interests) ? profile.interests : []}
                candidateData={getCandidateData(match.userId)}
                onMessage={() => void handleMessage(match)}
                onRemove={() => handleRemoveMatch(match.id)}
                onOpenProfile={() => {
                  window.dispatchEvent(
                    new CustomEvent("ghc:open-profile", { detail: { userId: match.userId, name: match.userName } })
                  )
                  setTab?.("profile")
                  addToast(`Viewing ${match.userName}`, "info")
                }}
                animationDelay={Math.min(index, 5) * 70}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// MESSAGES SCREEN - Chat with search and enhanced features
export function MessageScreen() {
  const [messageWindow, setMessageWindow] = useState(MOBILE_PAGE_SIZES.messages)
  const [inboxCategory, setInboxCategory] = useState<"all" | "personal" | "requests" | "groups">("all")

  const {
    conversations,
    sendMessage,
    replyToMessage,
    forwardMessage,
    addMessageReaction,
    deleteMessage,
    markConversationRead,
    pinConversation,
    unpinConversation,
    archiveConversation,
    muteConversation,
    reportContent,
    blockUser,
    blockedUsers,
    addToast,
    setTab,
    matches,
    friends,
    saveDraft,
    loadDraft,
  } = useGHC()
  const perms = usePermissions()
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [messageText, setMessageText] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [showRequestsOnly, setShowRequestsOnly] = useState(false)
  const [showPinnedOnly, setShowPinnedOnly] = useState(false)
  const [showArchivedOnly, setShowArchivedOnly] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  // Close open conversation / filters when leaving Messages (keep-alive)
  useEffect(() => {
    return onCloseTransientUI((detail) => {
      const nextTab = detail?.tab
      setReplyingTo(null)
      if (nextTab && nextTab !== "messages") {
        setSelectedConversationId(null)
        setMessageText("")
        setShowRequestsOnly(false)
        setShowPinnedOnly(false)
        setShowArchivedOnly(false)
        setSearchQuery("")
      }
    })
  }, [])
  const { compact: headerCompact, hidden: headerHidden, onScroll: onHeaderScroll } = useScrollHeader({ threshold: 36 })

  // Use shared conversation engine for filtering and sorting
  const { filteredConversations, conversations: privateConversations, selectedConversation } = getConversationListState(conversations, "private", searchQuery, selectedConversationId)

  useEffect(() => {
    if (selectedConversation) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
    }
  }, [selectedConversationId, selectedConversation?.messages?.length])

  const [draftRestored, setDraftRestored] = useState(false)

  // Load draft when conversation changes
  useEffect(() => {
    setDraftRestored(false)
    setMessageText("")
    if (selectedConversationId) {
      const draft = loadDraft(selectedConversationId)
      if (draft) {
        setMessageText(draft)
      }
      setDraftRestored(true)
    }
  }, [selectedConversationId, loadDraft])

  // Save draft when message text changes
  useEffect(() => {
    if (selectedConversationId && messageText.trim()) {
      saveDraft(selectedConversationId, messageText)
    }
  }, [messageText, selectedConversationId, saveDraft])
  
  const handleSendMessage = async () => {
    if (!selectedConversationId || !messageText.trim() || isSending) return
    
    setIsSending(true)
    try {
      if (replyingTo) {
        await replyToMessage(selectedConversationId, replyingTo, messageText)
        setReplyingTo(null)
      } else {
        await sendMessage(selectedConversationId, messageText)
      }
      setMessageText("")
      
      // Mark conversation as read
      await markConversationRead(selectedConversationId)
    } catch (err) {
      console.warn("[v0] Send message error:", err)
      addToast("Failed to send message", "error")
    } finally {
      setIsSending(false)
    }
  }

  const handleReply = (messageId: string) => {
    setReplyingTo(messageId)
    addToast("Replying to message...", "info")
  }

  const handleForward = async (messageId: string) => {
    if (!selectedConversationId) return
    try {
      await forwardMessage(selectedConversationId, messageId)
      addToast("Message forwarded", "success")
    } catch (err) {
      addToast("Failed to forward message", "error")
    }
  }

  const handleReact = async (messageId: string, emoji: string) => {
    if (!selectedConversationId) return
    try {
      await addMessageReaction(selectedConversationId, messageId, emoji)
    } catch (err) {
      addToast("Failed to add reaction", "error")
    }
  }

  const handleDelete = async (messageId: string, deleteForEveryone: boolean = false) => {
    if (!selectedConversationId) return
    const conv = conversations.find((c) => c.id === selectedConversationId)
    const msg = conv?.messages?.find((m) => m.id === messageId)
    if (!msg) return
    if (deleteForEveryone) {
      if (!perms.canDeleteMessageForEveryone(msg.senderId, msg.createdAt)) {
        addToast("Delete for everyone is only available on your messages within 1 hour", "error")
        return
      }
    }
    try {
      await deleteMessage(selectedConversationId, messageId, deleteForEveryone)
    } catch (err) {
      addToast("Failed to delete message", "error")
    }
  }

  const handleAttachmentClick = () => {
    addToast("Attachment feature coming soon", "info")
  }

  const handleNavigateToFeed = () => {
    setTab("matches")
    addToast("Open a match to start a conversation.", "info")
  }

  // Chat view
  if (selectedConversation) {
    return (
      <div className="relative h-full min-h-0 flex flex-col overflow-hidden bg-white pb-3">
        <ChatHeader
          isCommunity={
            selectedConversation.conversationType === "group" ||
            Boolean((selectedConversation as { isCommunity?: boolean }).isCommunity)
          }
          participantName={
            selectedConversation.groupName || selectedConversation.participantName || "Chat"
          }
          participantPhoto={selectedConversation.participantPhoto}
          isOnline={selectedConversation.online}
          isTyping={!!selectedConversation.isTyping}
          lastSeenLabel={
            selectedConversation.online
              ? "Active now"
              : selectedConversation.lastMessageTime
                ? `Last active ${timeAgo(selectedConversation.lastMessageTime)}`
                : "Offline"
          }
          onBack={() => setSelectedConversationId(null)}
          onOpenProfile={() => {
            addToast(`Profile · ${selectedConversation.participantName}`, "info")
            window.dispatchEvent(
              new CustomEvent("ghc:open-profile", {
                detail: { userId: selectedConversation.participantId },
              })
            )
          }}
          onReport={() => {
            void reportContent(
              "user",
              selectedConversation.participantId,
              "Inappropriate messages"
            )
            addToast("Report submitted", "success")
          }}
          onBlock={() => {
            void blockUser?.(selectedConversation.participantId)
            addToast("User blocked", "success")
            setSelectedConversationId(null)
          }}
          onCall={() => addToast("Voice calls will open in a secure session when both people are available in Pi Browser.", "info")}
          onVideo={() => addToast("Video calls will open in a secure session when both people are available in Pi Browser.", "info")}
        />

        {/* Messages area */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-gradient-to-b from-gray-50/70 via-white to-white p-4 sm:px-6 scrollbar-hide">
          {selectedConversation.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-6 text-center">
              <p className="text-sm font-semibold text-foreground">
                Say hello to {selectedConversation.participantName || "them"}
              </p>
              {((matches || []).some((m: any) => m.userId === selectedConversation.participantId || m.id === selectedConversation.participantId) ||
                (friends || []).includes(selectedConversation.participantId || "")) ? (
                <>
                  <p className="mt-1 text-xs text-muted-foreground">Keep it respectful and genuine.</p>
                  <div className="mt-4 flex max-w-sm flex-wrap justify-center gap-2">
                    {[
                      "Hi — great to connect!",
                      "Loved your profile. How are you?",
                      "What are you working on lately?",
                    ].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setMessageText(chip)}
                        className="min-h-10 rounded-full border border-border bg-card px-3 py-2 text-[12px] font-semibold text-foreground transition hover:border-emerald-400 hover:bg-emerald-50"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-muted-foreground">Match or connect first for a warmer intro — or send a polite message request.</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTab("matches")}
                      className="min-h-10 rounded-full bg-emerald-600 px-4 text-[12px] font-bold text-white"
                    >
                      Open Matches
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab("discover")}
                      className="min-h-10 rounded-full border border-border px-4 text-[12px] font-bold text-foreground"
                    >
                      Find people
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            (() => {
              const all = selectedConversation.messages
              const windowSize = Math.max(MOBILE_PAGE_SIZES.messages, messageWindow)
              const start = Math.max(0, all.length - windowSize)
              const visible = all.slice(start)
              return (
                <>
                  {start > 0 && (
                    <button
                      type="button"
                      className="mb-3 w-full rounded-xl border border-stone-200 bg-white py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-50"
                      onClick={() => setMessageWindow((w) => w + MOBILE_PAGE_SIZES.messages)}
                    >
                      Load earlier messages
                    </button>
                  )}
                  {visible.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isSentByCurrentUser={isMessageFromCurrentUser(msg)}
                      onReply={handleReply}
                      onForward={handleForward}
                      onReact={handleReact}
                      onDelete={handleDelete}
                      onCopy={(text) => {
                        try {
                          void navigator.clipboard?.writeText(text)
                          addToast("Copied", "success")
                        } catch {
                          addToast("Could not copy", "error")
                        }
                      }}
                      onReport={(messageId) => {
                        void reportContent("message", messageId, "Inappropriate content")
                        addToast("Report submitted", "success")
                      }}
                      onRetry={(messageId) => {
                        const failed = selectedConversation.messages.find((m) => m.id === messageId)
                        if (failed?.text) {
                          void sendMessage(selectedConversation.id, failed.text)
                          addToast("Retrying…", "info")
                        }
                      }}
                    />
                  ))}
                </>
              )
            })()
          )}
          <div ref={messagesEndRef} aria-hidden="true" />
        </div>

        {/* Reply preview */}
        {replyingTo && (
          <div className="flex items-center justify-between border-l-4 border-emerald-500 bg-emerald-50 px-4 py-2">
            <span className="text-sm text-emerald-800">Replying to a message</span>
            <button
              onClick={() => setReplyingTo(null)}
              className="text-emerald-700 hover:text-emerald-900"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Draft indicator */}
        {messageText.trim() && (
          <div className="border-b border-border bg-muted/40 px-4 py-0.5 text-[10px] text-muted-foreground">
            Draft saved
          </div>
        )}

        {/* Message input — blocked users cannot compose */}
        {blockedUsers?.includes(selectedConversation.participantId || "") ? (
          <div className="border-t border-border bg-muted/50 px-4 py-3 text-center">
            <p className="text-sm font-semibold text-foreground">You blocked this user</p>
            <p className="mt-1 text-xs text-muted-foreground">Messaging is turned off for this conversation.</p>
          </div>
        ) : (
          <MessageInput
            messageText={messageText}
            onMessageChange={setMessageText}
            onSendMessage={handleSendMessage}
            onEmojiClick={() => {}}
            onAttachmentClick={handleAttachmentClick}
            disabled={isSending}
          />
        )}
      </div>
    )
  }

  // Conversations list view
  // Apply filters
  let displayConversations = filteredConversations
  if (showPinnedOnly) displayConversations = displayConversations.filter((c) => c.isPinned)
  if (showArchivedOnly) displayConversations = displayConversations.filter((c) => c.isArchived)
  if (showRequestsOnly) {
    displayConversations = displayConversations.filter((c) => {
      const flag = (c as { isRequest?: boolean; messageRequest?: boolean }).isRequest || (c as { messageRequest?: boolean }).messageRequest
      const fewMsgs = (c.messages?.length || 0) <= 2
      // Soft heuristic: short threads / flagged requests until backend labels requests
      return Boolean(flag) || fewMsgs
    })
  }
  if (inboxCategory === "requests") {
    displayConversations = displayConversations.filter((c) => (c as { isRequest?: boolean }).isRequest)
  } else if (inboxCategory === "groups") {
    displayConversations = displayConversations.filter((c) => Boolean((c as { isGroup?: boolean; type?: string }).isGroup || (c as { type?: string }).type === "group"))
  } else if (inboxCategory === "personal") {
    displayConversations = displayConversations.filter((c) => !(c as { isGroup?: boolean; type?: string }).isGroup && (c as { type?: string }).type !== "group")
  }
  
  return (
    <div className="relative flex h-full flex-col bg-background text-foreground pb-3">
      <CollapsingAppHeader
        title="Messages"
        subtitle={
          privateConversations.length > 0
            ? `${privateConversations.length} ${privateConversations.length === 1 ? "chat" : "chats"} · DMs & requests`
            : "Personal chats · requests · groups"
        }
        compact={headerCompact}
        hidden={headerHidden}
        compactLeading={
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-500 text-white">
            <MessageSquare size={14} />
          </div>
        }
        actions={
          privateConversations.length > 0 ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
              {privateConversations.length}
            </span>
          ) : null
        }
        secondary={
          privateConversations.length > 0 ? (
            <>
              <ConversationSearchBar searchQuery={searchQuery} onSearchChange={setSearchQuery} />
              <div className="mt-1.5 flex gap-2 overflow-x-auto scrollbar-hide">
                {(() => {
                  const all = privateConversations.length
                  const personal = privateConversations.filter((c) => !(c as { isGroup?: boolean; type?: string }).isGroup && (c as { type?: string }).type !== "group" && !(c as { isRequest?: boolean }).isRequest).length
                  const requests = privateConversations.filter((c) => (c as { isRequest?: boolean }).isRequest).length
                  const groups = privateConversations.filter((c) => Boolean((c as { isGroup?: boolean; type?: string }).isGroup || (c as { type?: string }).type === "group")).length
                  const items: { cat: typeof inboxCategory; label: string; count: number }[] = [
                    { cat: "all", label: "All", count: all },
                    { cat: "personal", label: "Personal", count: personal },
                    { cat: "requests", label: "Requests", count: requests },
                    { cat: "groups", label: "Groups", count: groups },
                  ]
                  return items.map(({ cat, label, count }) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setInboxCategory(cat)}
                    className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      inboxCategory === cat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-primary/10"
                    }`}
                  >
                    {label}
                    <span className={`rounded-full px-1.5 text-[10px] ${inboxCategory === cat ? "bg-white/20" : "bg-background/80"}`}>{count}</span>
                  </button>
                  ))
                })()}
                <button
                  type="button"
                  onClick={() => setShowPinnedOnly(!showPinnedOnly)}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs transition ${
                    showPinnedOnly ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <Pin size={13} aria-hidden="true" /> Pinned
                </button>
                <button
                  type="button"
                  onClick={() => setShowArchivedOnly(!showArchivedOnly)}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs transition ${
                    showArchivedOnly ? "bg-gray-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <Archive size={13} aria-hidden="true" /> Archived
                </button>
              </div>
            </>
          ) : null
        }
      />

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-hide" onScroll={onHeaderScroll}>
        {privateConversations.length === 0 ? (
          <EmptyMessagesState
            onNavigateToMatches={() => {
              setTab("matches")
              window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "matches" }))
            }}
            onNavigateToFind={() => {
              setTab("discover")
              window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "discover" }))
            }}
            hasMatches={(matches?.length || 0) > 0}
            hasConnections={(friends?.length || 0) > 0}
          />
        ) : displayConversations.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 py-12">
            <div className="max-w-xs text-center">
              {inboxCategory === "requests" ? (
                <>
                  <p className="mb-2 text-sm font-semibold text-foreground">No message requests</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Message requests from people you don’t connect with yet will appear here. You
                    choose whether to accept or decline.
                  </p>
                </>
              ) : (
                <>
                  <p className="mb-2 text-sm font-semibold text-foreground">No conversations found</p>
                  <p className="text-xs text-muted-foreground">
                    Try another search, or open Matches / Find people to start a chat.
                  </p>
                </>
              )}
            </div>
          </div>
        ) : (
          displayConversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isSelected={selectedConversationId === conv.id}
              onClick={() => {
                setSelectedConversationId(conv.id)
                markConversationRead(conv.id)
              }}
              onOpenProfile={() => {
                setSelectedConversationId(null)
                setTab("discover")
                addToast(`Viewing ${conv.participantName}'s profile`, "info")
              }}
              onPin={async (convId) => {
                try {
                  if (conv.isPinned) {
                    await unpinConversation(convId)
                    addToast("Conversation unpinned", "info")
                  } else {
                    await pinConversation(convId)
                    addToast("Conversation pinned", "success")
                  }
                } catch (err) {
                  addToast("Action failed", "error")
                }
              }}
              onArchive={async (convId) => {
                try {
                  if (conv.isArchived) {
                    // unarchive by removing from archived list - would need new API
                    addToast("Unarchive feature coming soon", "info")
                  } else {
                    await archiveConversation(convId)
                    addToast("Conversation archived", "success")
                  }
                } catch (err) {
                  addToast("Action failed", "error")
                }
              }}
              onMute={async (convId) => {
                try {
                  if (conv.isMuted) {
                    // unmute would need new API
                    addToast("Unmute feature coming soon", "info")
                  } else {
                    await muteConversation(convId, 24) // 24 hours
                    addToast("Conversation muted for 24 hours", "success")
                  }
                } catch (err) {
                  addToast("Action failed", "error")
                }
              }}
            />
          ))
        )}
      </div>
    </div>
  )
}

// PROFILE SCREEN - User profile with enhanced features
export function ProfileScreen({ onSettings, onOpenWallet }: { onSettings: () => void; onOpenWallet?: () => void }) {
  const { profile, updateProfile, posts, deletePost, likePost, likedPostIds, addToast, following, friends, editPost, archivePost } = useGHC()
  const [editProfileOpen, setEditProfileOpen] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [selectedMode, setSelectedMode] = useState(() => profile?.primaryMode || "friendship")
  const [showPreview, setShowPreview] = useState(false)
  const [showDashboard, setShowDashboard] = useState(false)
  const [showSectionOpen, setShowSectionOpen] = useState<"achievements" | "social" | "activity" | "privacy" | "saved" | null>(null)
  const [isLoadingEnhancements, setIsLoadingEnhancements] = useState(false)
  const [profileComposerOpen, setProfileComposerOpen] = useState(false)
  const [profileCommentPostId, setProfileCommentPostId] = useState<string | null>(null)
  const [profileContentTab, setProfileContentTab] = useState<"posts" | "media" | "about" | "communities" | "shop">("posts")
  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [profileScrolled, setProfileScrolled] = useState(false)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const profileScrollRef = useRef<HTMLDivElement>(null)

  // Non-null local profile — avoids refresh crashes when context is momentarily empty
  const p = profile || ({
    displayName: "Member",
    photos: [] as string[],
    interests: [] as string[],
    primaryMode: "friendship" as const,
  } as NonNullable<typeof profile>)
  const { percentage: completionPercentage, missing: missingFields } = calculateProfileCompletion(p)

  // Filter to show only user's own posts
  const myPosts = filterOwnPosts(posts, "current-user", profile).slice(0, 30)
  const myMedia = extractMediaFromPosts(myPosts)
  const profileNextActions = nextProfileActions(profile)
  
  // Enhanced features - now integrated from profile-enhancements module
  const savedPostsCount = 0
  // Real domain activity only — never fake "Liked 5 posts"
  const activities = (() => {
    const items: { type: string; description: string; timestamp: number }[] = []
    for (const post of myPosts.slice(0, 8)) {
      const ts = Number(post.createdAt) || Date.now()
      const hasMedia = Array.isArray(post.media) ? post.media.length > 0 : Boolean(post.image || post.photo)
      const snippet = (post.content || "").trim().slice(0, 48)
      items.push({
        type: hasMedia ? "photo" : "post",
        description: hasMedia
          ? snippet
            ? `Shared a photo · ${snippet}${(post.content || "").length > 48 ? "…" : ""}`
            : "Shared a photo"
          : snippet
            ? `Posted · ${snippet}${(post.content || "").length > 48 ? "…" : ""}`
            : "Published a post",
        timestamp: ts,
      })
    }
    if (profile?.updatedAt) {
      items.push({
        type: "profile",
        description: "Updated profile",
        timestamp: Number(profile.updatedAt) || Date.now(),
      })
    }
    items.sort((a, b) => b.timestamp - a.timestamp)
    return items.slice(0, 6)
  })()

  // Derived stats (single source of truth — avoid duplicate stat rows)
  const postsCount = myPosts.length
  const followingCount = following?.length ?? 0
  const friendsCount = friends?.length ?? 0
  const followerCount = profile.profileViews ? Math.max(friendsCount, 0) : friendsCount
  const profileViews = profile.profileViews ?? 0

  /** Compress an image file to a JPEG data URL for local profile storage */
  const compressImageFile = (file: File, maxW: number, maxH: number, quality = 0.82): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/")) {
        reject(new Error("Please select a valid image file"))
        return
      }
      if (file.size > 8 * 1024 * 1024) {
        reject(new Error("Image must be less than 8MB"))
        return
      }
      const img = new Image()
      const objectUrl = URL.createObjectURL(file)
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas")
          let width = img.width
          let height = img.height
          if (width > maxW) {
            height = Math.round((height * maxW) / width)
            width = maxW
          }
          if (height > maxH) {
            width = Math.round((width * maxH) / height)
            height = maxH
          }
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext("2d")
          if (!ctx) {
            reject(new Error("Could not process image"))
            return
          }
          ctx.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL("image/jpeg", quality))
        } catch (e) {
          reject(e instanceof Error ? e : new Error("Failed to process image"))
        } finally {
          URL.revokeObjectURL(objectUrl)
        }
      }
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        reject(new Error("Failed to load image"))
      }
      img.src = objectUrl
    })
  }

  const handleCoverUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploadingCover(true)
    try {
      const dataUrl = await compressImageFile(file, 1280, 480, 0.85)
      await updateProfile({ coverPhoto: dataUrl })
      addToast("Cover photo updated", "success")
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to update cover", "error")
    } finally {
      setIsUploadingCover(false)
      if (coverInputRef.current) coverInputRef.current.value = ""
    }
  }

  const handleAvatarUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploadingAvatar(true)
    try {
      const dataUrl = await compressImageFile(file, 512, 512, 0.88)
      const nextPhotos = [dataUrl, ...(profile.photos || []).slice(0, 5)]
      await updateProfile({ photos: nextPhotos })
      addToast("Profile photo updated", "success")
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to update photo", "error")
    } finally {
      setIsUploadingAvatar(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ""
    }
  }

  const handleUpdateProfile = async (updates: Partial<Profile>) => {
    await updateProfile(updates)
    setEditProfileOpen(false)
    addToast("Profile updated!", "success")
  }

  const handleDeletePost = async (postId: string) => {
    await deletePost(postId)
    addToast("Post deleted", "info")
  }

  const handleShare = async () => {
    const name = (profile.displayName || "GH Connect member").trim()
    const city =
      profile.isPublic !== false && (profile.city || profile.country)
        ? [profile.city, profile.country].filter(Boolean).join(", ")
        : ""
    const trust: string[] = []
    if (profile.verified) trust.push("Verified")
    // Reputation / VIP labels only if present on profile — never GHC
    if ((profile as { membershipTier?: string }).membershipTier === "vip") trust.push("VIP")
    if ((profile as { membershipTier?: string }).membershipTier === "vvip") trust.push("VVIP")
    const lines = [
      name,
      city ? city : null,
      trust.length ? trust.join(" · ") : null,
      "GH Connect",
    ].filter(Boolean)
    const shareData = {
      title: name,
      text: lines.join("\n"),
      url: typeof window !== "undefined" ? window.location.href : "",
    }

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData)
      } catch (err) {
        console.warn("[v0] Share cancelled:", err)
      }
    } else {
      try {
        await navigator.clipboard?.writeText(lines.join(" · "))
        addToast("Profile card copied", "success")
      } catch {
        addToast("Profile link ready", "success")
      }
    }
  }

  const handleModeChange = async (mode: string) => {
    setSelectedMode(mode)
    await updateProfile({ primaryMode: mode as "dating" | "friendship" | "networking" })
    addToast(`Mode changed to ${mode}!`, "success")
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
      {/* Hidden file inputs for cover + avatar */}
      <input
        ref={coverInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleCoverUpload}
        aria-hidden="true"
      />
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleAvatarUpload}
        aria-hidden="true"
      />

      {/* Scroll-linked compact bar — sticks after cover scrolls away (content-first) */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-30 transition-[opacity,transform] duration-300 ease-out ${
          profileScrolled ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none -translate-y-full opacity-0"
        }`}
        aria-hidden={!profileScrolled}
      >
        <div className="flex items-center gap-2 border-b border-border/80 bg-card/95 px-3 py-2 shadow-sm backdrop-blur-md sm:gap-2.5 sm:px-4">
          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-stone-100 ring-2 ring-emerald-100/80">
            <img
              src={profile.photos?.[0] || "/placeholder.svg?width=64&height=64"}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1 pr-1">
            <p className="truncate text-sm font-bold text-foreground">{profile.displayName || "Your Profile"}</p>
            <p className="truncate text-[10px] font-medium text-muted-foreground">
              {postsCount} posts · {followingCount} following
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleShare()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/80 text-muted-foreground transition hover:bg-muted hover:text-foreground active:scale-95"
            aria-label="Share profile"
            title="Share profile"
          >
            <Share2 size={16} strokeWidth={2} aria-hidden="true" />
          </button>
          {/* Wallet + Settings — balanced utility pair; identity stays primary */}
          <div
            className="flex shrink-0 items-center gap-2 rounded-full border border-border/70 bg-muted/50 p-1"
            role="group"
            aria-label="Account tools"
          >
            <button
              type="button"
              onClick={() => (onOpenWallet ? onOpenWallet() : onSettings())}
              className="flex h-10 w-10 items-center justify-center rounded-full text-emerald-800 transition hover:bg-emerald-50 active:scale-95 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
              aria-label="GHC Wallet"
              title="GHC Wallet"
            >
              <Wallet size={17} strokeWidth={2} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onSettings}
              className="flex h-10 w-10 items-center justify-center rounded-full text-foreground/80 transition hover:bg-background active:scale-95"
              aria-label="Settings"
              title="Settings"
            >
              <SettingsIcon size={17} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={profileScrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(5.5rem+env(safe-area-inset-bottom))] scrollbar-hide"
        onScroll={(e) => {
          const y = (e.target as HTMLDivElement).scrollTop
          setProfileScrolled(y > 140)
        }}
      >
        {/* Cover — one clear control to add/change cover (no duplicate competing buttons) */}
        <div className="relative h-[min(32vh,180px)] min-h-[140px] overflow-hidden bg-gradient-to-br from-emerald-200 via-teal-50 to-stone-50 sm:h-[min(28vh,200px)]">
          <img
            src={profile.coverPhoto || "/placeholder.svg?width=640&height=220"}
            alt={profile.coverPhoto ? "Your cover photo" : "Cover photo placeholder"}
            loading="eager"
            decoding="async"
            className="h-full w-full object-cover"
            onError={(event) => {
              event.currentTarget.src = "/placeholder.svg?width=640&height=220"
            }}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-black/20" />
          {/* Top-right: share/more · Wallet+Settings pair — identity remains the focus */}
          <div className="absolute right-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] items-center gap-1.5 sm:right-4 sm:top-3.5">
            <ProfileHeaderActions
              onShare={handleShare}
              onMoreClick={() => setMoreMenuOpen(true)}
              onEditCover={() => coverInputRef.current?.click()}
            />
            <div
              className="flex shrink-0 items-center gap-2 rounded-full border border-white/50 bg-white/95 p-1 shadow-sm backdrop-blur-md"
              role="group"
              aria-label="Account tools"
            >
              <button
                type="button"
                onClick={() => (onOpenWallet ? onOpenWallet() : onSettings())}
                className="flex h-10 w-10 items-center justify-center rounded-full text-emerald-800 transition hover:bg-emerald-50 active:scale-95"
                aria-label="GHC Wallet"
                title="GHC Wallet"
              >
                <Wallet size={18} strokeWidth={2} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onSettings}
                className="flex h-10 w-10 items-center justify-center rounded-full text-stone-700 transition hover:bg-stone-100 active:scale-95"
                aria-label="Settings"
                title="Settings"
              >
                <SettingsIcon size={18} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          </div>
          {/* Primary cover CTA — always visible, high contrast */}
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            disabled={isUploadingCover}
            className={`absolute z-10 flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold shadow-lg backdrop-blur transition hover:scale-[1.02] active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-60 ${
              profile.coverPhoto
                ? "bottom-3 right-3 bg-white/95 text-stone-800"
                : "bottom-1/2 left-1/2 -translate-x-1/2 translate-y-1/2 bg-emerald-600 text-white"
            }`}
            aria-label={profile.coverPhoto ? "Change cover photo" : "Add cover photo"}
          >
            {isUploadingCover ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            )}
            {isUploadingCover ? "Uploading…" : profile.coverPhoto ? "Edit cover" : "Add cover photo"}
          </button>
        </div>

        {/* Identity block — scrolls with cover (content-first) */}
        <div className="relative z-10 mx-auto -mt-14 max-w-2xl space-y-5 px-4 pb-3 sm:px-6">
          <div className="rounded-3xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
            <div className="flex items-end gap-4 sm:gap-5">
              <div className="relative shrink-0">
                <ProfileCompletionRing
                  percentage={completionPercentage}
                  hasAchievements={profile.verified}
                  profilePhoto={profile.photos?.[0] || ""}
                />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  className="absolute -bottom-1 -right-1 flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-emerald-600 text-white shadow-md transition hover:bg-emerald-700 active:scale-95 disabled:opacity-60"
                  aria-label="Upload profile photo"
                  title="Change photo"
                >
                  {isUploadingAvatar ? (
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  )}
                </button>
              </div>
              <div className="min-w-0 flex-1 pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-[22px] font-bold leading-tight tracking-tight text-foreground">
                    {profile.displayName || "Your Profile"}
                  </h1>
                  {profile.verified && (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                      Pi verified
                    </span>
                  )}
                </div>
                <p className="mt-0.5 font-mono text-[13px] text-muted-foreground">
                  @{(profile as { username?: string; publicId?: string }).username ||
                    (profile as { publicId?: string }).publicId ||
                    (profile.displayName || "member").toLowerCase().replace(/\s+/g, ".")}
                </p>
                <p className="mt-1 text-sm font-semibold text-emerald-600">
                  {profile.age || "Age not added"}
                  {profile.profession ? (
                    <span className="font-medium text-gray-500"> · {profile.profession}</span>
                  ) : null}
                </p>
                <p className="mt-0.5 truncate text-xs text-gray-500">
                  {profile.city || "Location not added"}
                  {profile.city && profile.country ? `, ${profile.country}` : ""}
                </p>
              </div>
            </div>

            <div className="mt-3">
              <ExpandableBio
                bio={profile.bio || "Add a short bio so people know what makes you unique."}
              />
            </div>

            <SetupChecklist
              onNavigate={(tab) => {
                setTab?.(tab as any)
                window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: tab }))
              }}
            />
            <ProfileTrustStrip profileVerified={Boolean(profile.verified)} />
            {(() => {
              try {
                const st = getBoundDomainServices()?.membership?.getStatus?.() as
                  | { tier?: string; source?: string; lifecycle?: string; expiresAt?: number }
                  | null
                if (!st || (st.source !== "trial" && st.lifecycle !== "trial")) return null
                const tier = (st.tier || "free").toUpperCase()
                let ends = ""
                if (st.expiresAt && st.expiresAt > Date.now()) {
                  const h = Math.max(1, Math.round((st.expiresAt - Date.now()) / 3600000))
                  ends = h < 48 ? ` · ends in ${h}h` : ""
                }
                return (
                  <p className="mt-1.5 text-center text-[11px] font-semibold text-emerald-700">
                    Welcome {tier}
                    {ends}
                  </p>
                )
              } catch {
                return null
              }
            })()}

            <ProfileInterestChips interests={Array.isArray(profile.interests) ? profile.interests : []} />

            {/* Tappable stats — single source of truth row */}
            <div
              className="profile-stats-row mt-3 grid grid-cols-4 gap-1.5 text-center"
              role="group"
              aria-label="Profile stats"
            >
              <button type="button" onClick={() => setProfileContentTab("posts")} className="rounded-xl bg-muted/60 px-1.5 py-2.5 ring-1 ring-border/60 transition hover:bg-primary/10">
                <p className="text-[18px] font-bold tabular-nums text-gray-900">{postsCount}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Posts</p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSectionOpen("social")
                  addToast(friendsCount ? `${friendsCount} friends — full lists when synced` : "Friends list opens when connections sync", "info")
                }}
                className="rounded-xl bg-muted/60 px-1.5 py-2.5 ring-1 ring-border/60 transition hover:bg-primary/10"
              >
                <p className="text-[18px] font-bold tabular-nums text-gray-900">{friendsCount}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Friends</p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSectionOpen("social")
                  addToast(followingCount ? `${followingCount} following — full lists when synced` : "Following list opens when graph syncs", "info")
                }}
                className="rounded-xl bg-muted/60 px-1.5 py-2.5 ring-1 ring-border/60 transition hover:bg-primary/10"
              >
                <p className="text-[18px] font-bold tabular-nums text-gray-900">{followingCount}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Following</p>
              </button>
              <div className="rounded-xl bg-muted/60 px-1.5 py-2.5 ring-1 ring-border/60">
                <p className="text-[18px] font-bold tabular-nums text-gray-900">{profileViews || "—"}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Views</p>
              </div>
            </div>

            {/* Primary CTAs — Edit + Write (thumb-reach, high contrast) */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEditProfileOpen(true)}
                className="min-h-11 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 text-sm font-bold text-white shadow-sm transition hover:shadow-md active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              >
                Edit profile
              </button>
              <button
                type="button"
                onClick={() => setProfileComposerOpen(true)}
                className="min-h-11 rounded-xl border border-border bg-card px-4 text-sm font-bold text-foreground transition hover:bg-muted active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                Write a post
              </button>
            </div>
            {/* Secondary tools — quieter visual weight */}
            <div className="mt-2 flex items-center justify-center gap-1">
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="min-h-9 rounded-lg px-3 text-[12px] font-semibold text-stone-500 transition hover:bg-stone-50 hover:text-stone-800"
              >
                {showPreview ? "Close preview" : "Preview public"}
              </button>
              <span className="text-stone-300" aria-hidden>
                ·
              </span>
              <button
                type="button"
                onClick={() => setShowDashboard((current) => !current)}
                className="min-h-9 rounded-lg px-3 text-[12px] font-semibold text-stone-500 transition hover:bg-stone-50 hover:text-stone-800"
              >
                {showDashboard ? "Hide insights" : "Insights"}
              </button>
            </div>

            {showPreview && (
              <div className="mt-3 space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                <p className="mb-1 rounded-lg bg-amber-50 px-2 py-1 text-center text-[11px] font-semibold text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                  Viewing as others · wallet stays private
                </p>
                <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Preview · what others see</p>
                <PreviewPublicProfileToggle
                  isEnabled={Boolean(profile.isPublic)}
                  onToggle={(enabled) => {
                    void updateProfile({ isPublic: enabled } as Partial<Profile>)
                    addToast(enabled ? "Profile is public" : "Profile is private", "success")
                  }}
                />
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                  <img
                    src={profile.photos?.[0] || "/placeholder.svg?width=64&height=64"}
                    alt=""
                    className="h-14 w-14 rounded-full object-cover ring-2 ring-emerald-100"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-foreground">{profile.displayName || "Member"}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {[profile.profession, profile.isPublic !== false ? profile.city : null].filter(Boolean).join(" · ") || "On GH Connect"}
                    </p>
                    <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">
                      {profile.bio || "No bio yet"}
                    </p>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-border bg-card px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Public</p>
                    <ul className="mt-1 space-y-0.5 text-[11px] text-foreground">
                      <li>Name, photo, bio</li>
                      <li>Profession · interests</li>
                      <li>City (if you allow)</li>
                      <li>Verification · reputation badges</li>
                      <li>Posts you mark public</li>
                    </ul>
                  </div>
                  <div className="rounded-xl border border-border bg-card px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-stone-500">Always private</p>
                    <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                      <li>Wallet & GHC balance</li>
                      <li>Pending rewards</li>
                      <li>Precise location without consent</li>
                      <li>Message contents</li>
                      <li>Blocked / muted lists</li>
                    </ul>
                  </div>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Wallet balance is never shown on your public profile.
                </p>
              </div>
            )}

            {completionPercentage < 100 && (
              <div className="mt-4">
                <ProfileCompletionCard
                  percentage={completionPercentage}
                  missing={missingFields}
                  onCompleteClick={() => setEditProfileOpen(true)}
                  onAddCover={() => coverInputRef.current?.click()}
                />
              </div>
            )}
          </div>
        </div>

      {/* Highlights — featured moments (Facebook-style row) */}
      <div className="mx-auto max-w-2xl border-t border-gray-200/80 px-4 py-5 sm:px-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">Highlights</p>
          <button
            type="button"
            onClick={() => addToast("Add highlight — pick a photo or post to feature", "info")}
            className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700"
          >
            Add
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
          <button
            type="button"
            onClick={() =>
              addToast(
                myMedia.length
                  ? "Add highlight — pick a photo from your posts"
                  : "Share a photo post first, then feature it here",
                "info"
              )
            }
            className="flex w-16 shrink-0 flex-col items-center gap-1.5"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-border bg-muted text-muted-foreground transition hover:border-emerald-400 hover:text-emerald-600">
              <Plus size={20} />
            </div>
            <span className="text-[10px] font-semibold text-muted-foreground">New</span>
          </button>
          {/* Real media only — never fake letter circles */}
          {myMedia.slice(0, 4).map((m) => (
            <button
              key={`hl-${m.postId}-${m.url}`}
              type="button"
              className="flex w-16 shrink-0 flex-col items-center gap-1.5"
              onClick={() => addToast("Highlight viewer coming soon", "info")}
            >
              <div className="h-14 w-14 overflow-hidden rounded-full ring-2 ring-emerald-200">
                <img src={m.url} alt="" className="h-full w-full object-cover" />
              </div>
              <span className="w-full truncate text-center text-[10px] font-semibold text-muted-foreground">Highlight</span>
            </button>
          ))}
        </div>
        {myMedia.length === 0 && (
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Feature a photo from your posts. Highlights only use real media — no placeholder letters.
          </p>
        )}
      </div>

      {/* Social links — always visible (identity, not insights) */}
      <div className="mx-auto max-w-2xl border-t border-gray-200/80 px-4 py-4 sm:px-6">
        <div className="mb-2.5 flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">Social links</p>
          <span className="text-[10px] font-medium text-stone-400">Optional · shown on public profile</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { platform: "Instagram", emoji: "📷", key: "instagram" },
            { platform: "X", emoji: "𝕏", key: "x" },
            { platform: "LinkedIn", emoji: "💼", key: "linkedin" },
            { platform: "TikTok", emoji: "♪", key: "tiktok" },
            { platform: "YouTube", emoji: "▶", key: "youtube" },
            { platform: "Website", emoji: "🌐", key: "website" },
          ].map((social) => (
            <button
              key={social.key}
              type="button"
              onClick={() => addToast(`${social.platform} link — add from Edit profile soon`, "info")}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-stone-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 active:scale-95"
            >
              <span aria-hidden>{social.emoji}</span>
              {social.platform}
              <span className="text-[10px] font-bold text-emerald-600">+</span>
            </button>
          ))}
        </div>
      </div>

      {showDashboard && (
        <>
          <AchievementsSection verified={profile.verified} completionPercentage={completionPercentage} />
          {/* Recent Activity — insights only */}
          <div className="mx-auto max-w-2xl border-t border-gray-200/80 px-4 py-4 sm:px-6">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">Recent activity</p>
            <div className="space-y-2">
              {activities.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-[12px] text-muted-foreground">
                  Your real posts and profile updates appear here — nothing is invented.
                </p>
              ) : null}
              {activities.slice(0, 5).map((activity, idx) => (
                <div key={idx} className="flex items-start gap-3 rounded-lg bg-gray-50 p-3">
                  <div className="mt-0.5 text-lg" aria-hidden>
                    {activity.type === "post" && "📝"}
                    {activity.type === "photo" && "📷"}
                    {activity.type === "like" && "👍"}
                    {activity.type === "profile" && "✏️"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">{activity.description}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {new Date(activity.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Stories on profile — compose stays on identity card only */}
      <ProfileStorySection />

      {/* Profile content tabs — sticky */}
      <div className="sticky top-0 z-20 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-md">
        <div className="mb-0 flex items-center gap-1 overflow-x-auto border-b border-border pb-2 scrollbar-hide">
          {(
            [
              { id: "posts" as const, label: "Posts" },
              { id: "media" as const, label: "Media" },
              { id: "about" as const, label: "About" },
              { id: "communities" as const, label: "Communities" },
              { id: "shop" as const, label: "Shop" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setProfileContentTab(tab.id)}
              className={`relative min-h-10 shrink-0 rounded-lg px-3.5 text-[13px] font-bold transition ${
                profileContentTab === tab.id
                  ? "text-emerald-800"
                  : "text-stone-500 hover:bg-stone-50 hover:text-stone-800"
              }`}
            >
              {tab.label}
              {profileContentTab === tab.id && (
                <span className="absolute inset-x-3 -bottom-2 h-0.5 rounded-full bg-emerald-600" />
              )}
            </button>
          ))}
        </div>

        {profileContentTab === "communities" ? (
          <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-4 py-8 text-center">
            <p className="text-sm font-semibold text-stone-800">Communities</p>
            <p className="mt-1 text-xs text-stone-500">
              Communities you belong to appear here. Open the Communities tab to join or create.
            </p>
          </div>
        ) : profileContentTab === "shop" ? (
          <div className="rounded-2xl border border-dashed border-emerald-100 bg-emerald-50/40 px-4 py-8 text-center">
            <p className="text-sm font-semibold text-stone-800">Marketplace identity</p>
            <p className="mt-1 text-xs text-stone-500">
              Active listings and seller reputation show here when you sell on GH Connect. Wallet stays private.
            </p>
          </div>
        ) : profileContentTab === "about" ? (
          <div className="space-y-3 pb-8">
            {/* Structured About — Facebook-class information hierarchy */}
            {(
              [
                {
                  title: "Personal details",
                  rows: [
                    { label: "Work", value: profile.profession || null, empty: "Add workplace" },
                    { label: "Education", value: profile.education || null, empty: "Add school" },
                    {
                      label: "Lives in",
                      value:
                        profile.city || profile.country
                          ? [profile.city, profile.country].filter(Boolean).join(", ")
                          : null,
                      empty: "Add city",
                    },
                    { label: "From", value: profile.hometown || null, empty: "Add hometown" },
                    { label: "Born", value: profile.bornDate || null, empty: "Add birthday" },
                  ],
                },
                {
                  title: "Contact & links",
                  rows: [
                    {
                      label: "Bio",
                      value: profile.bio?.trim() ? profile.bio.trim().slice(0, 160) : null,
                      empty: "Add a short bio",
                    },
                    {
                      label: "Visibility",
                      value: profile.isPublic === false ? "Private profile" : "Public profile",
                      empty: null,
                    },
                  ],
                },
              ] as const
            ).map((block) => (
              <div key={block.title} className="rounded-2xl bg-gray-50/90 p-3.5 ring-1 ring-gray-100">
                <div className="mb-2.5 flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">{block.title}</p>
                  <button
                    type="button"
                    onClick={() => setEditProfileOpen(true)}
                    className="text-[11px] font-semibold text-emerald-600"
                    aria-label={`Edit ${block.title}`}
                  >
                    Edit
                  </button>
                </div>
                <ul className="space-y-2.5 text-sm text-gray-700">
                  {block.rows.map((row) => (
                    <li key={row.label} className="flex gap-2">
                      <span className="w-[4.5rem] shrink-0 font-semibold text-gray-500">{row.label}</span>
                      <button
                        type="button"
                        onClick={() => setEditProfileOpen(true)}
                        className={`min-w-0 flex-1 text-left ${row.value ? "text-gray-800" : "text-emerald-600"}`}
                      >
                        {row.value || row.empty}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="rounded-2xl bg-gray-50/90 p-3.5 ring-1 ring-gray-100">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">Connect as</p>
              <ModeButtons selectedMode={selectedMode} onModeChange={handleModeChange} />
            </div>
            <div className="rounded-2xl bg-gray-50/90 p-3.5 ring-1 ring-gray-100">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">Interests</p>
                <button
                  type="button"
                  onClick={() => setEditProfileOpen(true)}
                  className="text-[11px] font-semibold text-emerald-600"
                >
                  Edit
                </button>
              </div>
              <InterestsPills
                interests={profile.interests}
                onEdit={async (newInterests) => await updateProfile({ interests: newInterests })}
              />
            </div>
          </div>
        ) : profileContentTab === "media" ? (
          myMedia.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 py-8 text-center">
              <p className="text-sm font-semibold text-gray-700">No media yet</p>
              <p className="mt-1 text-xs text-gray-500">Photos and videos from your posts appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {myMedia.slice(0, 30).map((m) => (
                <div key={`${m.postId}-${m.url}`} className="aspect-square overflow-hidden rounded-lg bg-gray-100">
                  <img src={m.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>
          )
        ) : myPosts.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border bg-muted/40 py-10 text-center">
            <p className="text-sm font-semibold text-foreground">No posts yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Share something genuine — only your posts appear here.</p>
            <button
              type="button"
              onClick={() => setProfileComposerOpen(true)}
              className="mt-4 rounded-full bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
            >
              Write a post
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {myPosts.map((post) => (
              <OwnPostCard
                key={post.id}
                post={post}
                onDelete={handleDeletePost}
                isLiked={likedPostIds.includes(post.id)}
                onLike={(postId) => void likePost(postId)}
                onComment={() => setProfileCommentPostId(post.id)}
                onShare={() => void handleShare()}
                onEdit={async (postId, content) => {
                  if (!editPost) {
                    addToast("Edit unavailable", "error")
                    return
                  }
                  await editPost(postId, content)
                }}
                onArchive={(postId) => void archivePost?.(postId)}
                onInsights={() => addToast("Post insights", "info")}
              />
            ))}
          </div>
        )}
      </div>

      {showDashboard && <>
      {/* QR Profile Share */}
      <div className="px-4 py-4 border-t border-gray-200">
        <ProfileQRCode profileUrl={typeof window !== "undefined" ? window.location.href : ""} />
      </div>

      {/* Privacy Controls */}
      <PrivacyControlsSection 
        profileVisibility="everyone"
        onVisibilityChange={(visibility) => addToast(`Profile visibility set to ${visibility}`, "success")}
      />

      {/* ENHANCED ANALYTICS & INSIGHTS SECTION */}
      {!isLoadingEnhancements && (
        <>
          {/* Profile Analytics Card - Views, Bounce Rate, Time Spent */}
          <ProfileAnalyticsCard analytics={{
            viewCount: profileViews || 0,
            avgTimeSpent: 0,
            visitorsThisMonth: profileViews || 0,
            bounceRate: 0,
            topSource: "in-app",
          }} />
          
          {/* Follower Insights — derived from session graph (no fabricated demographics) */}
          <FollowerInsightsCard insights={{
            totalFollowers: followerCount,
            growthRate: 0,
            topCountries: [],
            avgAge: 0,
            maleRatio: 0,
            femaleRatio: 0,
          }} />
          <p className="px-4 text-[11px] text-stone-500">
            Insights use your real posts ({postsCount}), friends ({friendsCount}), and following ({followingCount}).
            Detailed demographics appear when the analytics backend is connected.
          </p>

          {/* Skills & Endorsements Section */}
          <SkillsSection 
            skills={profile.skills || []}
            onAddSkill={(skill) => addToast(`Skill "${skill}" added`, "success")}
            onRemoveSkill={(skill) => addToast(`Skill "${skill}" removed`, "success")}
          />
        </>
      )}
        </>}

        </div>

      {/* More Options Menu — Settings only via gear icon */}
      <MoreOptionsMenu
        isOpen={moreMenuOpen}
        onClose={() => setMoreMenuOpen(false)}
        onEditProfile={() => setEditProfileOpen(true)}
        onWritePost={() => setProfileComposerOpen(true)}
        onChangeCover={() => coverInputRef.current?.click()}
        onShareProfile={() => void handleShare()}
        onCopyLink={() => {
          try {
            const url = typeof window !== "undefined" ? window.location.href : ""
            void navigator.clipboard?.writeText(url)
            addToast("Profile link copied", "success")
          } catch {
            addToast("Could not copy link", "error")
          }
        }}
        onPreview={() => setShowPreview(true)}
      />

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
        profile={profile}
        onSave={handleUpdateProfile}
        onChangeCover={() => coverInputRef.current?.click()}
        onChangePhoto={() => avatarInputRef.current?.click()}
      />
      <UnifiedCompose open={profileComposerOpen} onOpenChange={setProfileComposerOpen} initialMode="post" />
      <CommentSheet
        post={profileCommentPostId ? posts.find((p) => p.id === profileCommentPostId) || null : null}
        open={Boolean(profileCommentPostId)}
        onClose={() => setProfileCommentPostId(null)}
      />
    </div>
  )
}

/** @deprecated Import from ./communities-screen — implementation moved out of this file. */
export { CommunitiesScreen } from "./communities-screen"
