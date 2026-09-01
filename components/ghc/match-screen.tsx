"use client"

import { useDeferredValue, useMemo, useState, useRef, useEffect, useCallback, type ChangeEvent } from "react"
import { useGHC } from "@/contexts/ghc-context"
import { getBoundDomainServices } from "@/lib/domains/compat"
import { getOrCreateGreenHavenId } from "@/lib/domains/greenhaven-id"
import { onCloseTransientUI } from "@/lib/transient-ui"
import { asArray, asInterests, safeLocation, uniqueIds } from "@/lib/safe-data"
import { resolveUserIntents, scoreIntentMatch } from "@/lib/connection-intents"
import { filterValidMatches } from "@/lib/regression-guards"
import { rankDiscoveryCandidates, nextDiscoveryCandidate } from "@/lib/discovery-ranking"
import { MOBILE_PAGE_SIZES } from "@/lib/mobile-performance"
import { RelationshipActions, RelationshipLegend } from "./relationship-actions"
import { PremiumCommunityHub } from "./premium-community-hub"
import { EcosystemHubCard } from "./ecosystem-hub-card"
import { ProfileTrustStrip, ProfileInterestChips, ProfileIdentityBlock } from "./premium-profile-identity"
import { ProfileMoreNav } from "./profile-more-nav"
import { GreenHavenIdentityCard } from "./greenhaven-identity-card"
import { ProfileHeroMeta } from "./profile-hero"
import { IdentityLayersStrip } from "./identity-layers-strip"
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

// HOME SCREEN — legacy stub (app uses EnhancedFeedScreen). Kept so this module parses.
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
    addToast("Matches are mutual interest only — express interest on Find", "info")
  }

  if (!isLoading && mutualMatches.length === 0) {
    return (
      <div className="relative flex h-full flex-col bg-background text-foreground pb-3">
        <CollapsingAppHeader
          title="Matches"
          subtitle="Mutual interest — not auto-friends"
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
