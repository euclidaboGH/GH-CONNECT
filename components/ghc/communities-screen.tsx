"use client"

import { isDemoDataAllowed } from "@/lib/demo-data-policy"

import { IdentityService } from "@/lib/identity/identity-service"
import { isSameIdentity, idListIncludes } from "@/lib/identity/identity-match"
import { loadPersistedCommunities, isCommunityConversationRow } from "@/lib/domains/community-persistence"

/**
 * Communities tab — My communities vs Discover (0.58 community polish).
 * Domain-backed join/create; Board is the product surface (hub).
 * Cards use elevated surfaces + clearer My vs Discover hierarchy.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSectionRefresh } from "@/hooks/use-section-refresh"
import { useAccountFilterState } from "@/hooks/use-account-filter-state"
import { FilterSummary } from "./filtering/filter-summary"
import { FilterPanel } from "./filtering/filter-panel"
import { FilterResultState } from "./filtering/filter-result-state"
import { matchesFilterQuery } from "@/lib/filtering/filter-utils"
import {
  Plus,
  Search,
  X,
  Users,
  Compass,
  Sparkles,
  MapPin,
  ArrowLeft,
} from "lucide-react"
import { useGHCMessaging } from "@/contexts/ghc-context"
import { useRegionalContext } from "@/contexts/regional-context"
import { getProductMessage } from "@/lib/i18n/product"
import { getWorkflowMessage } from "@/lib/i18n/workflows"
import { onCloseTransientUI } from "@/lib/transient-ui"
import { useScrollHeader } from "@/lib/use-scroll-header"
import { navigateTo } from "@/lib/navigation/navigate"
import { GroupCard } from "./group-card"
import { CreateGroupModal, type CreateGroupFormData } from "./create-group-modal"
import { privacyJoinHint, formatCommunityRole } from "@/lib/community/role-labels"
import {
  matchesPrivacyFilter,
  normalizeCommunityPrivacy,
  privacyFilterLabel,
  sortCommunityRows,
  communityMemberCount,
  communityUnreadCount,
  type CommunityPrivacyFilter,
} from "@/lib/community/discovery"
import { resolveJoinCta } from "@/lib/community/join-status"
import { PremiumCommunityHub } from "./premium-community-hub"
import { CollapsingAppHeader } from "./collapsing-app-header"
import { PremiumSurfaceActions } from "./premium-surface-actions"
import { EmptyState } from "./empty-state"
import { CommunityJoinReasonPicker } from "./community-join-reason-picker"
import {
  resolveMembershipState,
  saveLocalJoinReasons,
  userFacingJoinError,
  primaryMembershipAction,
} from "@/lib/domains/adapters/community-membership-adapter"
import {
  isCommunityMemberWithOptionalCache,
  allowLocalBoardFallback,
  communityLocalCacheAllowed,
} from "@/lib/domains/adapters/community-ui-authority"
import type { CommunityJoinReasonId } from "@/lib/domains/contracts/communities"

type DirectoryTab = "my" | "discover"
type CommunityAttentionFilter = "all" | "board" | "chat" | "requests"
type CommunityFilterPrefs = { searchQuery: string; sortBy: "recent" | "active" | "unread" | "name"; privacyFilter: "all" | "public" | "request" | "invite"; categoryFilter: string; communityAttentionFilter: CommunityAttentionFilter }
const DEFAULT_COMMUNITY_FILTERS: CommunityFilterPrefs = { searchQuery: "", sortBy: "recent", privacyFilter: "all", categoryFilter: "all", communityAttentionFilter: "all" }
function validateCommunityFilters(value: unknown): CommunityFilterPrefs {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {}
  return {
    searchQuery: typeof raw.searchQuery === "string" ? raw.searchQuery.slice(0, 120) : "",
    sortBy: ["recent", "active", "unread", "name"].includes(String(raw.sortBy)) ? raw.sortBy as CommunityFilterPrefs["sortBy"] : "recent",
    privacyFilter: ["all", "public", "request", "invite"].includes(String(raw.privacyFilter)) ? raw.privacyFilter as CommunityFilterPrefs["privacyFilter"] : "all",
    categoryFilter: typeof raw.categoryFilter === "string" ? raw.categoryFilter.slice(0, 64) : "all",
    communityAttentionFilter: ["all", "board", "chat", "requests"].includes(String(raw.communityAttentionFilter)) ? raw.communityAttentionFilter as CommunityAttentionFilter : "all",
  }
}

type CommunityRow = {
  id: string
  conversationType: "group"
  groupName: string
  participantName: string
  participantId: string
  participantPhoto?: string
  groupPhoto?: string
  photo?: string
  lastMessage: string
  lastMessageTime: number
  members: string[]
  createdBy: string
  unreadCount?: number
  boardUnread?: number
  chatUnread?: number
  description?: string
  privacy?: string
  category?: string
  region?: string
  tags?: string[]
  rules?: string[] | string
  welcomeMessage?: string
  kind?: string
  communityId?: string
  boardPosts?: Array<{
    id: string
    communityId: string
    authorId: string
    authorName: string
    body: string
    kind: string
    createdAt: number
    likes: number
    comments: number
    pinned?: boolean
  }>
  pendingJoinRequests?: string[]
  memberCount?: number
  /** User ids invited but not yet members */
  invitedMembers?: string[]
  groupRoles?: Record<string, string>
  isMuted?: boolean
  events?: unknown[]
  announcements?: unknown[]
  polls?: unknown[]
}

function buildSeedCommunities(): CommunityRow[] {
  if (!isDemoDataAllowed()) return []
  const now = Date.now()
  return [
    {
      id: "demo-community-lagos-tech",
      conversationType: "group",
      groupName: "Lagos Tech",
      participantName: "Lagos Tech",
      participantId: "demo-lagos-tech",
      lastMessage: "Share wins, questions, and local meetups.",
      lastMessageTime: now - 3600000,
      members: ["sarah", "emma", "jessica", "demo-mod"],
      createdBy: "demo-mod",
      unreadCount: 2,
      boardUnread: 3,
      chatUnread: 2,
      description: "Builders and learners in Lagos — jobs, side projects, and mentorship.",
      privacy: "public",
      category: "Tech",
      region: "Lagos, Nigeria",
      tags: ["Tech", "Lagos", "Mentorship"],
      rules: ["Be respectful", "No spam job blasts", "Help newcomers"],
      welcomeMessage: "Welcome to Lagos Tech — introduce yourself and read the rules.",
      kind: "community",
      communityId: "demo-community-lagos-tech",
      boardPosts: [
        {
          id: "seed-lagos-1",
          communityId: "demo-community-lagos-tech",
          authorId: "demo-mod",
          authorName: "Ada (mod)",
          body: "Welcome! Drop your stack + what you are building this month.",
          kind: "question",
          createdAt: now - 7200000,
          likes: 12,
          comments: 4,
          pinned: true,
        },
        {
          id: "seed-lagos-2",
          communityId: "demo-community-lagos-tech",
          authorId: "sarah",
          authorName: "Sarah",
          body: "Anyone going to the Yaba meetup Saturday?",
          kind: "text",
          createdAt: now - 3600000,
          likes: 5,
          comments: 2,
        },
      ],
    },
    {
      id: "demo-community-creators-hub",
      conversationType: "group",
      groupName: "Creators Hub",
      participantName: "Creators Hub",
      participantId: "demo-creators",
      lastMessage: "Weekly prompt: share one thing you shipped.",
      lastMessageTime: now - 7200000,
      members: ["nicole", "amina", "demo-mod"],
      createdBy: "demo-mod",
      description: "Writers, designers, and video creators — feedback and collaboration.",
      privacy: "public",
      category: "Arts",
      region: "Global",
      tags: ["Creators", "Design", "Content"],
      rules: ["Constructive feedback only", "Credit original work"],
      welcomeMessage: "Glad you are here — pin your portfolio link in the intro thread.",
      kind: "community",
      communityId: "demo-community-creators-hub",
      boardPosts: [
        {
          id: "seed-creators-1",
          communityId: "demo-community-creators-hub",
          authorId: "demo-mod",
          authorName: "Mod",
          body: "Weekly prompt: share one thing you shipped.",
          kind: "text",
          createdAt: now - 8000000,
          likes: 8,
          comments: 3,
          pinned: true,
        },
      ],
    },
    {
      id: "demo-community-wellness",
      conversationType: "group",
      groupName: "Wellness Circle",
      participantName: "Wellness Circle",
      participantId: "demo-wellness",
      lastMessage: "Sunday stretch session details inside.",
      lastMessageTime: now - 86400000,
      members: ["zainab", "jessica", "demo-mod"],
      createdBy: "demo-mod",
      description: "Fitness, mindfulness, and sustainable habits.",
      privacy: "public",
      category: "Wellness",
      region: "Global",
      tags: ["Fitness", "Mindfulness"],
      rules: ["No medical claims", "Encourage, do not shame"],
      welcomeMessage: "Take what helps, leave what does not — welcome.",
      kind: "community",
      communityId: "demo-community-wellness",
    },
    {
      id: "demo-community-founders",
      conversationType: "group",
      groupName: "Founders & Operators",
      participantName: "Founders & Operators",
      participantId: "demo-founders",
      lastMessage: "AMA with an early-stage operator this Friday.",
      lastMessageTime: now - 5400000,
      members: ["david", "emma", "demo-mod"],
      createdBy: "demo-mod",
      description: "Early-stage founders and operators — honest ops talk.",
      privacy: "public",
      category: "Business",
      region: "Global",
      tags: ["Startups", "Business"],
      rules: ["No unsolicited pitching in intros", "Share learnings"],
      welcomeMessage: "Tell us what you are building in one sentence.",
      kind: "community",
      communityId: "demo-community-founders",
    },
    {
      id: "demo-community-accra-creatives",
      conversationType: "group",
      groupName: "Accra Creatives",
      participantName: "Accra Creatives",
      participantId: "demo-accra",
      lastMessage: "Studio open hours this Saturday in Osu.",
      lastMessageTime: now - 10800000,
      members: ["amina", "nicole", "demo-mod", "sarah"],
      createdBy: "demo-mod",
      unreadCount: 1,
      boardUnread: 2,
      chatUnread: 1,
      description: "Designers, photographers and makers in Greater Accra.",
      privacy: "public",
      category: "Arts",
      region: "Accra, Ghana",
      tags: ["Accra", "Design", "Local"],
      rules: ["Support local makers", "No spam DMs in chat"],
      welcomeMessage: "Welcome — share what you create and where you are based.",
      kind: "community",
      communityId: "demo-community-accra-creatives",
    },
  ]
}

function normalizeRules(rules: string[] | string | undefined): string[] {
  if (!rules) return []
  if (Array.isArray(rules)) return rules
  return rules.split("\n").map((r) => r.trim()).filter(Boolean)
}

function isCommunityConv(c: {
  conversationType?: string
  kind?: string
  communityId?: string
  groupName?: string
  participantName?: string
}): boolean {
  if (c.conversationType !== "group") return false
  if (c.kind === "community" || c.communityId) return true
  return !!(c.groupName || c.participantName)
}

export function CommunitiesScreen() {
  const regional = useRegionalContext()
  const msg = useCallback((key: Parameters<typeof getProductMessage>[0]) => getProductMessage(key, regional.locale), [regional.locale])
  const workflow = useCallback((key: Parameters<typeof getWorkflowMessage>[0]) => getWorkflowMessage(key, regional.locale), [regional.locale])
  const ctx = useGHCMessaging() as any as any as any
  const {
    conversations: conversationsRaw,
    profile,
    addToast,
    createGroup,
    joinCommunity,
    leaveCommunity,
    acceptCommunityInvitation,
    declineCommunityInvitation,
    createBoardPost,
    replyToBoardPost,
    reactToBoardPost,
    createCommunityAnnouncement,
    createCommunityEvent,
    rsvpCommunityEvent,
    pinBoardPost,
    unpinBoardPost,
    hideBoardPost,
    unhideBoardPost,
    transitionCommunityLifecycle,
    reportCommunityContent,
    setTab,
    candidates,
    approveCommunityJoinRequest,
    declineCommunityJoinRequest,
    inviteCommunityMember,
    muteConversation,
    unmuteConversation,
  } = ctx

  const conversations = useMemo(
    () => (Array.isArray(conversationsRaw) ? conversationsRaw : []),
    [conversationsRaw],
  )
  const [directory, setDirectory] = useState<DirectoryTab>("my")
  const [directoryOffset, setDirectoryOffset] = useState(0)
  const changeDirectory = useCallback((value: DirectoryTab) => { setDirectoryOffset(0); setDirectory(value) }, [])
  const filterPrefs = useAccountFilterState("communities", IdentityService.getCurrentUserId() || "anonymous", DEFAULT_COMMUNITY_FILTERS, validateCommunityFilters)
  const { searchQuery, sortBy, privacyFilter, categoryFilter, communityAttentionFilter } = filterPrefs.value
  const setSearchQuery = useCallback((value: string) => { setDirectoryOffset(0); filterPrefs.update("searchQuery", value) }, [filterPrefs])
  const setSortBy = useCallback((value: CommunityFilterPrefs["sortBy"]) => filterPrefs.update("sortBy", value), [filterPrefs])
  const setPrivacyFilter = useCallback((value: CommunityFilterPrefs["privacyFilter"]) => filterPrefs.update("privacyFilter", value), [filterPrefs])
  const setCategoryFilter = useCallback((value: string) => { setDirectoryOffset(0); filterPrefs.update("categoryFilter", value) }, [filterPrefs])
  const setCommunityAttentionFilter = useCallback((value: CommunityAttentionFilter) => filterPrefs.update("communityAttentionFilter", value), [filterPrefs])
  const [showCreate, setShowCreate] = useState(false)
  const [createSubmitError, setCreateSubmitError] = useState<string | null>(null)
  const openCreateCommunity = useCallback(() => setShowCreate(true), [])
  useEffect(() => {
    const onCompose = () => openCreateCommunity()
    window.addEventListener("ghc:open-community-compose", onCompose)
    return () => window.removeEventListener("ghc:open-community-compose", onCompose)
  }, [openCreateCommunity])
  useEffect(() => {
    if (!showCreate) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowCreate(false) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [showCreate])
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null)
  /** Snapshot so hub opens immediately after create (before conversations state catches up) */
  const [createdSnapshot, setCreatedSnapshot] = useState<CommunityRow | null>(null)
  const [joinGate, setJoinGate] = useState<CommunityRow | null>(null)
  const [hubKey, setHubKey] = useState<number>(0)
  const [platformSnapshots, setPlatformSnapshots] = useState<Record<string, any>>({})
  const [platformLoading, setPlatformLoading] = useState(false)
  const [joinPickerRow, setJoinPickerRow] = useState<CommunityRow | null>(null)
  const [joinBusy, setJoinBusy] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [localJoined, setLocalJoined] = useState<string[]>(() => {
    if (typeof window === "undefined") return []
    try {
      // Phase 3: session markers always; durable local only when demo policy allows.
      const sessionRaw = window.sessionStorage.getItem("ghc.community.joinedIds.session")
      const durableRaw = communityLocalCacheAllowed()
        ? window.localStorage.getItem("ghc.community.joinedIds")
        : null
      const parse = (raw: string | null): string[] => {
        if (!raw) return []
        try {
          const parsed = JSON.parse(raw) as string[]
          return Array.isArray(parsed) ? parsed.filter(Boolean) : []
        } catch {
          return []
        }
      }
      return Array.from(new Set([...parse(sessionRaw), ...parse(durableRaw)]))
    } catch {
      return []
    }
  })

  /** Server public directory from GET /api/communities — no fabricated rows */
  const [remoteDirectory, setRemoteDirectory] = useState<CommunityRow[]>([])
  const [directoryLoading, setDirectoryLoading] = useState(true)
  const [directoryDurable, setDirectoryDurable] = useState<boolean | null>(null)
  const [directoryError, setDirectoryError] = useState<string | null>(null)
  const [directoryServerFilterAvailable, setDirectoryServerFilterAvailable] = useState(true)
  const [isOffline, setIsOffline] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [directoryTick, setDirectoryTick] = useState(0)
  const [directoryHasMore, setDirectoryHasMore] = useState(false)
  const [directoryLoadingMore, setDirectoryLoadingMore] = useState(false)

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

  const reloadDirectory = useCallback(() => {
    setDirectoryTick((n) => n + 1)
  }, [])

  useSectionRefresh("communities", () => {
    reloadDirectory()
  }, { minIntervalMs: 15_000 })

  useEffect(() => {
    let cancelled = false
    if (directoryOffset === 0) { setDirectoryLoading(true); setDirectoryLoadingMore(false); setDirectoryHasMore(false) }
    else setDirectoryLoadingMore(true)
    setDirectoryError(null)
    const hardTimeout = typeof window !== "undefined" ? window.setTimeout(() => {
      if (!cancelled) {
        if (directoryOffset === 0) setDirectoryLoading(false)
        else setDirectoryLoadingMore(false)
        setDirectoryError((prev) => prev || "Directory is taking longer than expected. Pull to retry.")
      }
    }, 15_000) : null
    const filterActive = Boolean(searchQuery.trim() || (directory === "discover" && categoryFilter !== "all") || directoryOffset > 0)
    const debounce = window.setTimeout(() => {
      void import("@/lib/social/client")
      .then(async ({ socialListCommunities }) => {
        const filtered = await socialListCommunities({ limit: 100, offset: directoryOffset, q: searchQuery.trim() || undefined, category: directory === "discover" && categoryFilter !== "all" ? categoryFilter : undefined })
        if (!filterActive || filtered.ok) return { ...filtered, serverFiltered: true }
        // Older deployments without the Phase 10.2 RPC retain a bounded fallback; the UI discloses this.
        const fallback = await socialListCommunities(100)
        return { ...fallback, serverFiltered: false }
      })
      .then((res) => {
        if (cancelled) return
        if (!res.ok) throw new Error("Community directory unavailable")
        setDirectoryServerFilterAvailable(res.serverFiltered)
        const rows: CommunityRow[] = []
        for (const raw of res.communities || []) {
          if (!raw || typeof raw !== "object") continue
          const r = raw as Record<string, unknown>
          const id = String(r.id || "").trim()
          const name = String(r.name || "").trim()
          if (!id || !name) continue
          const createdBy = String(r.createdBy || r.created_by || "").trim()
          const cover = String(r.coverImage || r.cover_image || r.photo || "").trim()
          const memberCount = Number(r.memberCount || r.member_count || 0) || 0
          const viewerIsMember = r.viewerIsMember === true || r.viewer_is_member === true
          const viewerRole = String(r.viewerRole || r.viewer_role || (viewerIsMember ? "member" : "")).trim()
          let membersFromRemote = Array.isArray(r.members)
            ? (r.members as unknown[]).map(String).filter(Boolean)
            : createdBy
              ? [createdBy]
              : []
          const groupRoles: Record<string, string> =
            r.groupRoles && typeof r.groupRoles === "object"
              ? { ...(r.groupRoles as Record<string, string>) }
              : {}
          // Phase 3: trust server viewerIsMember enrichment for My tab.
          const meHint = IdentityService.getCurrentUserId() || ""
          if (viewerIsMember && meHint) {
            if (!membersFromRemote.includes(meHint)) membersFromRemote = [...membersFromRemote, meHint]
            if (!groupRoles[meHint]) groupRoles[meHint] = viewerRole || "member"
          }
          const resolvedCount = Math.max(memberCount, membersFromRemote.length, viewerIsMember ? 1 : 0)
          rows.push({
            id,
            conversationType: "group",
            groupName: name,
            participantName: name,
            participantId: createdBy,
            participantPhoto: cover || undefined,
            groupPhoto: cover || undefined,
            photo: cover || undefined,
            lastMessage: String(r.purpose || r.description || "").slice(0, 120),
            lastMessageTime:
              typeof r.createdAt === "number"
                ? r.createdAt
                : typeof r.created_at === "number"
                  ? r.created_at
                  : Date.parse(String(r.createdAt || r.created_at || "")) || 0,
            members: membersFromRemote,
            memberCount: resolvedCount || undefined,
            groupRoles: Object.keys(groupRoles).length ? groupRoles : undefined,
            createdBy,
            description: r.description != null ? String(r.description) : undefined,
            privacy: r.privacy != null ? String(r.privacy) : "public",
            category: r.category != null ? String(r.category) : undefined,
            tags: Array.isArray(r.tags) ? r.tags.map(String) : undefined,
            rules: Array.isArray(r.rules) ? r.rules.map(String) : r.rules != null ? String(r.rules) : undefined,
            welcomeMessage: r.welcomeMessage != null ? String(r.welcomeMessage) : r.welcome_message != null ? String(r.welcome_message) : undefined,
            kind: "community",
            communityId: id,
          })
        }
        setDirectoryHasMore(res.serverFiltered && Boolean(res.pagination?.hasMore))
        setRemoteDirectory((current) => {
          if (directoryOffset === 0) return rows
          const byId = new Map(current.map((community) => [community.id, community]))
          for (const community of rows) byId.set(community.id, community)
          return Array.from(byId.values())
        })
        setDirectoryDurable(Boolean(res.durable))
        setDirectoryLoading(false)
        setDirectoryLoadingMore(false)
        if (hardTimeout != null) window.clearTimeout(hardTimeout)
        // Seed session membership markers so My (n) matches the list.
        try {
          const me = IdentityService.getCurrentUserId() || ""
          if (me) {
            const owned = rows
              .filter((c) => {
                if (c.createdBy && (c.createdBy === me || isSameIdentity(c.createdBy))) return true
                if (Array.isArray(c.members) && idListIncludes(c.members, me)) return true
                if (c.groupRoles && (c.groupRoles[me] || Object.keys(c.groupRoles).some((k) => isSameIdentity(k)))) return true
                return false
              })
              .map((c) => c.id)
            if (owned.length) {
              setLocalJoined((prev) => Array.from(new Set([...(prev || []), ...owned])))
            }
          }
        } catch {
          /* identity unavailable */
        }
      })
      .catch(() => {
        if (!cancelled) {
          if (directoryOffset === 0) setRemoteDirectory([])
          setDirectoryDurable(false)
          setDirectoryError(directoryOffset > 0 ? "Could not load more communities. Try again." : "Could not load the community directory")
          setDirectoryLoading(false)
          setDirectoryLoadingMore(false)
          setDirectoryHasMore(false)
        }
      })
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(debounce)
      if (hardTimeout != null) window.clearTimeout(hardTimeout)
    }
  }, [directoryTick, directory, searchQuery, categoryFilter, directoryOffset])

  useEffect(() => {
    try {
      window.sessionStorage.setItem("ghc.community.joinedIds.session", JSON.stringify(localJoined))
    } catch {
      /* */
    }
    if (!communityLocalCacheAllowed()) return
    try {
      window.localStorage.setItem("ghc.community.joinedIds", JSON.stringify(localJoined))
    } catch {
      /* */
    }
  }, [localJoined])

  useEffect(() => {
    const onOpen = (e: Event) => {
      const id = String((e as CustomEvent).detail?.groupId || (e as CustomEvent).detail?.id || "").trim()
      if (!id) return
      setSelectedCommunityId(id)
      setDirectory("my")
    }
    window.addEventListener("ghc:open-community", onOpen as EventListener)
    return () => window.removeEventListener("ghc:open-community", onOpen as EventListener)
  }, [])


  useEffect(() => {
    if (!selectedCommunityId) return
    let cancelled = false
    setPlatformLoading(true)
    void fetch(`/api/communities/${encodeURIComponent(selectedCommunityId)}/platform`, { credentials: "include", cache: "no-store" })
      .then(async (r) => ({ ok: r.ok, payload: await r.json().catch(() => ({})) }))
      .then(({ ok, payload }) => {
        if (cancelled) return
        if (ok && payload?.durable === true && payload?.community) {
          setPlatformSnapshots((prev) => ({ ...prev, [selectedCommunityId]: payload.community }))
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setPlatformLoading(false) })
    return () => { cancelled = true }
  }, [selectedCommunityId, hubKey])
  useEffect(() => {
    const onRefresh = (e: Event) => {
      const id = String((e as CustomEvent).detail?.communityId || "").trim()
      const detail = (e as CustomEvent<{ communityId?: string; skipHubRemount?: boolean }>).detail
      if (id && id !== selectedCommunityId) return
      if (!detail?.skipHubRemount) setHubKey((k) => k + 1)
      setDirectoryLoading(true)
      // The directory loader is intentionally mounted once; this event only
      // forces the selected hub to re-read its durable parent snapshot.
      window.setTimeout(() => setDirectoryLoading(false), 150)
    }
    window.addEventListener("ghc:community-refresh", onRefresh as EventListener)
    return () => window.removeEventListener("ghc:community-refresh", onRefresh as EventListener)
  }, [selectedCommunityId])
  const [localBoard, setLocalBoard] = useState<
    Record<string, NonNullable<CommunityRow["boardPosts"]>>
  >(() => {
    if (typeof window === "undefined") return {}
    if (!communityLocalCacheAllowed()) return {}
    try {
      const raw = window.localStorage.getItem("ghc.community.boardPosts")
      if (!raw) return {}
      const parsed = JSON.parse(raw) as Record<string, NonNullable<CommunityRow["boardPosts"]>>
      return parsed && typeof parsed === "object" ? parsed : {}
    } catch {
      return {}
    }
  })

  useEffect(() => {
    if (!communityLocalCacheAllowed()) return
    try {
      window.localStorage.setItem("ghc.community.boardPosts", JSON.stringify(localBoard))
    } catch {
      /* quota */
    }
  }, [localBoard])

  const { compact: headerCompact, hidden: headerHidden, onScroll: onHeaderScroll } =
    useScrollHeader({ threshold: 48 })

  useEffect(() => {
    return onCloseTransientUI((detail: any) => {
      setShowCreate(false)
      setJoinGate(null)
      if (detail?.tab && detail.tab !== "communities") {
        setSelectedCommunityId(null)
      }
    })
  }, [])

  const seeds = useMemo(() => (isDemoDataAllowed() ? buildSeedCommunities() : []), [])

  const fromState = useMemo(() => {
    const seen = new Set<string>()
    const rows: CommunityRow[] = []
    for (const c of conversations) {
      if (!isCommunityConv(c as any) || seen.has(c.id)) continue
      seen.add(c.id)
      rows.push(c as unknown as CommunityRow)
    }
    return rows
  }, [conversations])

  const communityGroups = useMemo(() => {
    const persisted = loadPersistedCommunities()
    const map = new Map<string, CommunityRow>()
    // Remote directory first; local/state rows override with richer membership data
    for (const c of remoteDirectory) map.set(c.id, c)
    for (const c of seeds) map.set(c.id, c as CommunityRow)
    for (const c of persisted) {
      if (isCommunityConversationRow(c as any)) map.set(c.id, c as unknown as CommunityRow)
    }
    for (const c of fromState) map.set(c.id, c)
    return Array.from(map.values())
  }, [fromState, seeds, remoteDirectory])

  const isJoined = useCallback(
    (c: CommunityRow) => {
      const me = IdentityService.getCurrentUserId() || "current-user"
      // Domain-first; Class D localJoined only when communityLocalCacheAllowed()
      return isCommunityMemberWithOptionalCache(c as any, me, localJoined)
    },
    [localJoined]
  )

  const myCommunities = useMemo(
    () => communityGroups.filter((c) => isJoined(c)),
    [communityGroups, isJoined]
  )

  const discoverCommunities = useMemo(
    () => communityGroups.filter((c) => !isJoined(c)),
    [communityGroups, isJoined]
  )

  const categories = useMemo(() => {
    const set = new Set<string>()
    communityGroups.forEach((c) => {
      if (c.category) set.add(c.category)
    })
    return ["all", ...Array.from(set).sort()]
  }, [communityGroups])

  const visibleGroups = useMemo(() => {
    const pool = directory === "my" ? myCommunities : discoverCommunities
    const q = searchQuery.trim().toLowerCase()
    // Phase 1 honesty: "My" lists membership truth — do not hide joined spaces behind
    // Discover-oriented privacy/category chips. Search still applies so users can find
    // among many memberships. Discover keeps full filters.
    return pool
      .filter((c) => {
        if (directory === "discover") {
          if (categoryFilter !== "all" && (c.category || "") !== categoryFilter) return false
          if (!matchesPrivacyFilter(c.privacy, privacyFilter)) return false
        } else if (communityAttentionFilter !== "all") {
          if (communityAttentionFilter === "board" && Number(c.boardUnread || 0) <= 0) return false
          if (communityAttentionFilter === "chat" && Number(c.chatUnread || c.unreadCount || 0) <= 0) return false
          if (communityAttentionFilter === "requests") {
            const matchedRole = Object.entries(c.groupRoles || {}).find(([memberId]) => isSameIdentity(memberId))?.[1]
            const role = matchedRole || (c.createdBy && isSameIdentity(c.createdBy) ? "owner" : "member")
            if (!(["owner", "admin", "moderator"].includes(role)) || !(c.pendingJoinRequests?.length)) return false
          }
        }
        if (!q) return true
        return matchesFilterQuery(q, c.groupName, c.participantName, c.description, c.region, ...(c.tags || []), c.category, c.privacy)
      })
      .sort((a, b) => {
        if (sortBy === "name")
          return (a.groupName || a.participantName).localeCompare(b.groupName || b.participantName)
        if (sortBy === "active") return communityMemberCount(b) - communityMemberCount(a) || (b.lastMessageTime || 0) - (a.lastMessageTime || 0)
        if (sortBy === "unread") {
          const aUnread = communityUnreadCount(a)
          const bUnread = communityUnreadCount(b)
          return bUnread - aUnread || (b.lastMessageTime || 0) - (a.lastMessageTime || 0)
        }
        return (b.lastMessageTime || 0) - (a.lastMessageTime || 0)
      })
  }, [directory, myCommunities, discoverCommunities, searchQuery, categoryFilter, privacyFilter, sortBy, communityAttentionFilter])

  const communityPulse = useMemo(() => {
    const boardUnread = myCommunities.reduce((sum, c) => sum + communityUnreadCount({ boardUnread: c.boardUnread }), 0)
    const chatUnread = myCommunities.reduce((sum, c) => sum + communityUnreadCount({ chatUnread: c.chatUnread, unreadCount: c.unreadCount }), 0)
    const requestsToReview = myCommunities.reduce((sum, c) => {
      const matchedRole = Object.entries(c.groupRoles || {}).find(([memberId]) => isSameIdentity(memberId))?.[1]
      const role = matchedRole || (c.createdBy && isSameIdentity(c.createdBy) ? "owner" : "member")
      return role === "owner" || role === "admin" || role === "moderator"
        ? sum + Number(c.pendingJoinRequests?.length || 0)
        : sum
    }, 0)
    return { boardUnread, chatUnread, requestsToReview, total: boardUnread + chatUnread + requestsToReview }
  }, [myCommunities])

  const selected = selectedCommunityId
    ? (() => {
        const base = communityGroups.find((c) => c.id === selectedCommunityId) ||
          (createdSnapshot && createdSnapshot.id === selectedCommunityId ? createdSnapshot : null)
        const snapshot = platformSnapshots[selectedCommunityId]
        if (!base || !snapshot) return base
        return {
          ...base,
          groupName: snapshot.name || base.groupName,
          participantName: snapshot.name || base.participantName,
          description: snapshot.description ?? base.description,
          privacy: snapshot.privacy ?? base.privacy,
          category: snapshot.category ?? base.category,
          members: Array.isArray(snapshot.members) ? snapshot.members : base.members,
          createdBy: snapshot.createdBy || base.createdBy,
          groupRoles: snapshot.role ? { ...(base.groupRoles || {}), [IdentityService.getCurrentUserId() || "current-user"]: snapshot.role } : base.groupRoles,
          pendingJoinRequests: Array.isArray(snapshot.pendingJoinRequests) ? snapshot.pendingJoinRequests : base.pendingJoinRequests,
          announcements: Array.isArray(snapshot.announcements) ? snapshot.announcements : base.announcements,
          events: Array.isArray(snapshot.events) ? snapshot.events : base.events,
          resources: Array.isArray(snapshot.resources) ? snapshot.resources : (base as any).resources,
        } as CommunityRow
      })()
    : null

  /** Open join-reason picker; membership only after authoritative join succeeds */
  const beginJoin = (row: CommunityRow) => {
    const me = IdentityService.getCurrentUserId()
    const state = resolveMembershipState(row, me)
    const action = primaryMembershipAction(state)
    if (action === "pending") {
      addToast("Your request is already pending", "info")
      return
    }
    if (action === "open") {
      setSelectedCommunityId(row.id)
      return
    }
    if (action === "none") {
      addToast("This community is not available", "error")
      return
    }
    setJoinError(null)
    setJoinPickerRow(row)
  }

  const ensureInStateAndJoin = async (
    row: CommunityRow,
    reasons: CommunityJoinReasonId[] = []
  ) => {
    if (!joinCommunity) {
      addToast("Joining is temporarily unavailable", "error")
      return false
    }
    setJoinBusy(true)
    setJoinError(null)
    try {
      const me = IdentityService.getCurrentUserId()
      if (reasons.length) {
        try {
          saveLocalJoinReasons(me, row.id, reasons)
        } catch {
          /* non-authoritative */
        }
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        addToast("You are offline — join when reconnected", "info")
        return false
      }
      const ok = await joinCommunity(row.id)
      if (ok) {
        // Domain join / request succeeded. Toast authority is in joinCommunity
        // (Joined vs Request sent vs device-only) — never blanket "Joined" for pending.
        try {
          // Prefer My so the community is visible without hunting the Discover list.
          setDirectory("my")
        } catch { /* */ }
        if (communityLocalCacheAllowed()) {
          const meId = IdentityService.getCurrentUserId()
          const after = resolveMembershipState(
            {
              ...row,
              members: Array.from(new Set([...(row.members || []), meId].filter(Boolean))),
            },
            meId
          )
          if (after === "member" || after === "owner" || after === "admin" || after === "moderator") {
            setLocalJoined((prev) => (prev.includes(row.id) ? prev : [...prev, row.id]))
          }
        }
        setHubKey((k) => k + 1)
        setJoinPickerRow(null)
        setJoinGate(null)
        // Open hub so Board/Chat are one step away after membership
        setSelectedCommunityId(row.id)
        setDirectory("my")
        setStatusMsg("You're in — open Board or Chat to participate")
        window.setTimeout(() => setStatusMsg(null), 2800)
        try {
          addToast("Welcome to the community", "success")
        } catch {
          /* */
        }
        return true
      }
      setJoinError(userFacingJoinError("join_failed"))
      addToast(userFacingJoinError("join_failed"), "error")
      return false
    } catch (e: any) {
      const msg = userFacingJoinError(e?.message || "join_failed")
      setJoinError(msg)
      addToast(msg, "error")
      return false
    } finally {
      setJoinBusy(false)
    }
  }

  const handleAcceptCommunityInvitation = async (id: string): Promise<boolean> => {
    if (typeof acceptCommunityInvitation !== "function") return false
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      addToast("You are offline — reconnect to accept this invitation", "info")
      return false
    }
    try {
      const ok = await acceptCommunityInvitation(id)
      if (ok) {
        setDirectory("my")
        setSelectedCommunityId(id)
        setHubKey((k) => k + 1)
      } else {
        addToast("Could not accept this invitation. Please try again.", "error")
      }
      return ok
    } catch {
      addToast("Could not accept this invitation. Please try again.", "error")
      return false
    }
  }

  const handleDeclineCommunityInvitation = async (id: string): Promise<boolean> => {
    if (typeof declineCommunityInvitation !== "function") return false
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      addToast("You are offline — reconnect to decline this invitation", "info")
      return false
    }
    try {
      const ok = await declineCommunityInvitation(id)
      if (ok) setDirectoryTick((n) => n + 1)
      else addToast("Could not decline this invitation. Please try again.", "error")
      return ok
    } catch {
      addToast("Could not decline this invitation. Please try again.", "error")
      return false
    }
  }

  const handleLeave = async (id: string, name: string) => {
    if (leaveCommunity) {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        addToast("You are offline — leave when reconnected", "info")
        return
      }
      let ok = false
      try {
        ok = await leaveCommunity(id)
      } catch {
        addToast("Could not leave this community. Please try again.", "error")
        return
      }
      if (ok) {
        // Mirror cache only after domain leave succeeds (Studio Class D)
        if (communityLocalCacheAllowed()) {
          setLocalJoined((prev) => prev.filter((x) => x !== id))
        }
        setLocalBoard((prev) => {
          if (!prev[id]) return prev
          const next = { ...prev }
          delete next[id]
          return next
        })
        addToast(`Left ${name}`, "info")
        if (selectedCommunityId === id) setSelectedCommunityId(null)
        return
      }
      addToast("Could not leave this community. Please try again.", "error")
      return
    }
    // No domain leave API: Studio cache-only leave; production must not fake leave
    if (communityLocalCacheAllowed()) {
      setLocalJoined((prev) => prev.filter((x) => x !== id))
      addToast(`Left ${name} (studio)`, "info")
      if (selectedCommunityId === id) setSelectedCommunityId(null)
      return
    }
    addToast("Leaving is temporarily unavailable.", "error")
  }

  const boardPostsFor = (row: CommunityRow) => {
    const fromConv = (row.boardPosts || []) as NonNullable<CommunityRow["boardPosts"]>
    // Class D local board only in Studio/demo — never production authority
    const extra = allowLocalBoardFallback() ? localBoard[row.id] || [] : []
    const map = new Map<string, (typeof fromConv)[0]>()
    ;[...fromConv, ...extra].forEach((p) => map.set(p.id, p))
    return Array.from(map.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }

  const handleBoardPost = async (
    communityId: string,
    body: string,
    kind?: "text" | "question" | "resource"
  ): Promise<boolean> => {
    if (createBoardPost) {
      const ok = await createBoardPost(communityId, body, kind)
      if (ok) {
        setHubKey((k) => k + 1)
        return true
      }
      if (!allowLocalBoardFallback()) {
        addToast("Could not post to the board. Please try again.", "error")
        return false
      }
    } else if (!allowLocalBoardFallback()) {
      addToast("Board posting is unavailable right now.", "error")
      return false
    }
    // Studio/demo only — Class D local board cache (not production authority)
    const post = {
      id: `local_${Date.now()}`,
      communityId,
      authorId: "current-user",
      authorName: profile?.displayName || "You",
      body,
      kind: kind || "text",
      createdAt: Date.now(),
      likes: 0,
      comments: 0,
      isLocalCache: true,
    }
    setLocalBoard((prev) => ({
      ...prev,
      [communityId]: [post, ...(prev[communityId] || [])],
    }))
    addToast("Posted to board (studio cache)", "success")
    setHubKey((k) => k + 1)
    return true
  }

  if (selected) {
    const me = IdentityService.getCurrentUserId() || "current-user"
    const joined =
      isJoined(selected) ||
      selected.createdBy === me ||
      selected.createdBy === "current-user" ||
      isSameIdentity(selected.createdBy) ||
      Boolean(selected.groupRoles?.[me]) ||
      Boolean(selected.groupRoles?.["current-user"]) ||
      idListIncludes(selected.members || [], me) ||
      (selected.members || []).includes("current-user")
    const rules = normalizeRules(selected.rules)
    const rawRole =
      selected.createdBy === me ||
      selected.createdBy === "current-user" ||
      selected.groupRoles?.[me] === "owner" ||
      selected.groupRoles?.["current-user"] === "owner"
        ? "owner"
        : joined
          ? (selected.groupRoles?.[me] ||
              selected.groupRoles?.["current-user"] ||
              "member")
          : "guest"
    const role: "owner" | "admin" | "moderator" | "member" | "guest" =
      rawRole === "owner" ||
      rawRole === "admin" ||
      rawRole === "moderator" ||
      rawRole === "member" ||
      rawRole === "guest"
        ? rawRole
        : joined
          ? "member"
          : "guest"
    return (
      <div className="flex h-full min-w-0 max-w-full min-h-0 flex-col">
        <PremiumCommunityHub
          key={hubKey}
          community={{
            id: selected.id,
            name: selected.groupName || selected.participantName,
            description: selected.description,
            memberCount: communityMemberCount(selected),
            membershipState: resolveMembershipState(selected, me),
            privacy: normalizeCommunityPrivacy(selected.privacy),
            isJoined: joined,
            photo: selected.groupPhoto || selected.participantPhoto || selected.photo,
            cover: selected.groupPhoto || selected.photo,
            category: selected.category,
            rules,
            tags: selected.tags,
            region: selected.region,
            role,
            welcomeMessage: selected.welcomeMessage,
            boardUnread: selected.boardUnread,
            chatUnread: selected.chatUnread,
            isMuted: !!selected.isMuted,
          }}
          boardPosts={boardPostsFor(selected)}
          events={selected.events || []}
          onRsvp={async (eventId) => {
            if (rsvpCommunityEvent) await rsvpCommunityEvent(selected.id, eventId)
            setHubKey((k) => k + 1)
          }}
          onCreateEvent={
            createCommunityEvent
              ? async (input) => {
                  const ok = await createCommunityEvent(selected.id, input)
                  if (ok) setHubKey((k) => k + 1)
                  return ok
                }
              : undefined
          }
          canChat={joined}
          role={role}
          onBack={() => { setSelectedCommunityId(null); setCreatedSnapshot(null) }}
          onJoin={() => {
            beginJoin(selected)
          }}
          onAcceptInvitation={() => handleAcceptCommunityInvitation(selected.id)}
          onDeclineInvitation={() => handleDeclineCommunityInvitation(selected.id)}
          pendingJoinRequests={selected.pendingJoinRequests || []}
          inviteCandidates={(Array.isArray(candidates) ? candidates : [])
            .filter(
              (c: any) =>
                c?.id &&
                !(selected.members || []).includes(c.id) &&
                !(selected.invitedMembers || []).includes(c.id)
            )
            .slice(0, 12)
            .map((c: any) => ({
              id: c.id,
              name: c.name || c.id,
              photo: c.photo,
            }))}
          onApproveRequest={async (userId: string) => {
            if (!approveCommunityJoinRequest) {
              addToast("Approval unavailable", "error")
              return
            }
            const ok = await approveCommunityJoinRequest(selected.id, userId)
            if (ok) setHubKey((k) => k + 1)
          }}
          onDeclineRequest={async (userId: string) => {
            if (!declineCommunityJoinRequest) {
              addToast("Decline unavailable", "error")
              return
            }
            const ok = await declineCommunityJoinRequest(selected.id, userId)
            if (ok) setHubKey((k) => k + 1)
          }}
          onInviteMember={async (userId: string) => {
            if (!inviteCommunityMember) {
              addToast("Invite unavailable", "error")
              return
            }
            const ok = await inviteCommunityMember(selected.id, userId)
            if (ok) setHubKey((k) => k + 1)
          }}
          onSetRole={async (userId, role) => {
            if (!ctx.setGroupRole) {
              addToast("Role update unavailable", "error")
              return
            }
            await ctx.setGroupRole(selected.id, userId, role)
            setHubKey((k) => k + 1)
          }}
          onRemoveMember={async (userId) => {
            if (!ctx.removeGroupMember) {
              addToast("Remove unavailable", "error")
              return
            }
            await ctx.removeGroupMember(selected.id, userId)
            setHubKey((k) => k + 1)
          }}
          onLeave={() =>
            handleLeave(selected.id, selected.groupName || selected.participantName)
          }
          onMute={async () => {
            const muted = !!selected.isMuted
            if (muted && unmuteConversation) {
              await unmuteConversation(selected.id)
              addToast("Community unmuted", "success")
            } else if (muteConversation) {
              await muteConversation(selected.id, 24 * 7)
              addToast("Community muted — you remain a member", "info")
            } else {
              addToast("Mute unavailable", "error")
            }
            setHubKey((k) => k + 1)
          }}
          onOpenChat={() => {
            if (!joined) {
              addToast("Join this community to use Chat", "info")
              return
            }
            const communityId = selected.id
            const title = selected.groupName || selected.participantName || "Community"
            // Unmount heavy hub before switching tabs — reduces freeze risk
            setSelectedCommunityId(null)
            setCreatedSnapshot(null)
            const openThread = () => {
              window.dispatchEvent(
                new CustomEvent("ghc:open-conversation", {
                  detail: {
                    conversationId: communityId,
                    kind: "community",
                    title,
                  },
                })
              )
            }
            try {
              window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "messages" }))
              // Retry open — Messages may mount after tab switch
              window.setTimeout(openThread, 60)
              window.setTimeout(openThread, 220)
              window.setTimeout(openThread, 500)
            } catch {
              setTab?.("messages")
              window.setTimeout(openThread, 100)
            }
            addToast("Opening community chat in Messages", "info")
          }}
          onReplyToPost={async (postId, body) => {
            if (!replyToBoardPost) {
              addToast("Replies unavailable", "error")
              return
            }
            const ok = await replyToBoardPost(selected.id, postId, body)
            if (ok) setHubKey((k) => k + 1)
          }}
          onReactToPost={async (postId) => {
            if (!reactToBoardPost) return
            const ok = await reactToBoardPost(selected.id, postId)
            if (ok) setHubKey((k) => k + 1)
          }}
          onPinPost={async (postId) => {
            if (!pinBoardPost) return
            const ok = await pinBoardPost(selected.id, postId)
            if (ok) setHubKey((k) => k + 1)
          }}
          onUnpinPost={async (postId) => {
            if (!unpinBoardPost) return
            const ok = await unpinBoardPost(selected.id, postId)
            if (ok) setHubKey((k) => k + 1)
          }}
          onUnhidePost={async (postId) => {
            if (!unhideBoardPost) return
            const ok = await unhideBoardPost(selected.id, postId)
            if (ok) setHubKey((k) => k + 1)
          }}
          onTransitionLifecycle={async (next) => {
            if (!transitionCommunityLifecycle) return
            const ok = await transitionCommunityLifecycle(selected.id, next)
            if (ok) setHubKey((k) => k + 1)
          }}
          onReportCommunity={async (input) => {
            if (!reportCommunityContent) return
            await reportCommunityContent(selected.id, input)
          }}
          onHidePost={async (postId) => {
            if (!hideBoardPost) return
            const ok = await hideBoardPost(selected.id, postId)
            if (ok) setHubKey((k) => k + 1)
          }}
          onCreateAnnouncement={async (input) => {
            if (!createCommunityAnnouncement) {
              addToast("Announcements unavailable", "error")
              return
            }
            const ok = await createCommunityAnnouncement(selected.id, input)
            if (ok) setHubKey((k) => k + 1)
          }}
          announcements={(selected.announcements || []) as never[]}
          onPost={(body: string, kind?: "text" | "question" | "resource") =>
            handleBoardPost(selected.id, body, kind)
          }
          memberPreview={[
            {
              id: "current-user",
              name: profile?.displayName || "You",
              role: role === "guest" ? "member" : role,
            },
            ...(selected.members || [])
              .filter((m) => m !== "current-user")
              .slice(0, 8)
              .map((m) => ({
                id: m,
                name: m.charAt(0).toUpperCase() + m.slice(1),
                role: selected.createdBy === m ? "owner" : "member",
              })),
          ]}
        />
      </div>
    )
  }

  return (
    <div className="gh-communities-shell gh-world-community flex h-full min-h-0 flex-col overscroll-y-contain bg-background" role="region" aria-label={msg("communityTitle")}>
      <CollapsingAppHeader
        title={msg("communityTitle")}
        compact={headerCompact}
        hidden={headerHidden}
        leading={
          <button
            type="button"
            onClick={() => {
              // Canonical shell navigation — Home tab (no reload / no history hack)
              if (!navigateTo("home")) setTab?.("home")
            }}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground transition hover:bg-muted active:scale-95"
            aria-label="Back to Home"
          >
            <ArrowLeft size={18} strokeWidth={2.25} aria-hidden />
          </button>
        }
        compactLeading={
          <button
            type="button"
            onClick={() => {
              if (!navigateTo("home")) setTab?.("home")
            }}
            className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground active:scale-95"
            aria-label="Back to Home"
          >
            <ArrowLeft size={16} strokeWidth={2.25} aria-hidden />
          </button>
        }
        actions={
          <div className="flex items-center gap-1.5">
            <PremiumSurfaceActions />
            <button
              type="button"
              onClick={openCreateCommunity}
              className="inline-flex h-8 items-center gap-1 rounded-full bg-[var(--gh-green)] px-2.5 text-[12px] font-bold text-white shadow-sm"
              aria-label={msg("create") + " " + msg("communityTitle")}
            >
              <Plus size={16} strokeWidth={2.5} />
              {msg("create")}
            </button>
          </div>
        }
        secondary={
          <FilterPanel
            title="Explore communities"
            description="Search your spaces or discover communities by topic, access and activity."
            resultCount={visibleGroups.length}
            activeCount={Number(Boolean(searchQuery.trim())) + Number(directory === "discover" && categoryFilter !== "all") + Number(directory === "discover" && privacyFilter !== "all") + Number(directory === "my" && communityAttentionFilter !== "all")}
            persistentContent={<div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={msg("searchCommunity")}
                aria-label={msg("searchCommunity")}
                className="h-8 w-full rounded-lg border border-border bg-card pl-9 pr-9 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                  aria-label="Clear search"
                >
                  <X size={15} />
                </button>
              ) : null}
            </div>}
          >
            <FilterSummary className="mt-2" items={[
              ...(searchQuery ? [{ id: "search", label: `Search: ${searchQuery}`, onRemove: () => setSearchQuery("") }] : []),
              ...(directory === "discover" && categoryFilter !== "all" ? [{ id: "category", label: `Topic: ${categoryFilter}`, onRemove: () => setCategoryFilter("all") }] : []),
              ...(directory === "discover" && privacyFilter !== "all" ? [{ id: "privacy", label: `Access: ${privacyFilterLabel(privacyFilter)}`, onRemove: () => setPrivacyFilter("all") }] : []),
              ...(directory === "my" && communityAttentionFilter !== "all" ? [{ id: "attention", label: `Attention: ${communityAttentionFilter}`, onRemove: () => setCommunityAttentionFilter("all") }] : []),
            ]} onClearAll={() => { setSearchQuery(""); setCategoryFilter("all"); setPrivacyFilter("all"); setCommunityAttentionFilter("all") }} />

            <div
              className="mt-1 flex gap-1 rounded-xl border border-border/50 bg-muted/50 p-0.5"
              role="tablist"
              aria-label="Community directory"
            >
              <button
                type="button"
                role="tab"
                aria-selected={directory === "my"}
                onClick={() => changeDirectory("my")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-[11px] font-bold transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                  directory === "my"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Users size={14} aria-hidden />
                {msg("myCommunities")} ({myCommunities.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={directory === "discover"}
                onClick={() => changeDirectory("discover")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-[11px] font-bold transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                  directory === "discover"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Compass size={14} aria-hidden />
                {msg("discover")} ({discoverCommunities.length})
              </button>
            </div>

            {directory === "discover" ? (
              <>
                <div className="mt-2 flex items-center gap-2 overflow-x-auto scrollbar-hide">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      aria-pressed={categoryFilter === cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
                        categoryFilter === cat
                          ? "bg-[var(--gh-green)] text-white"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {cat === "all" ? msg("allTopics") : cat}
                    </button>
                  ))}
                  <label className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                    <span className="sr-only">Sort</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                      className="rounded-lg border border-border bg-card px-2 py-1 text-[11px] font-semibold text-foreground"
                    >
                      <option value="recent">Recent</option>
                      <option value="unread">Needs attention</option>
                      <option value="active">Most members</option>
                      <option value="name">Name</option>
                    </select>
                  </label>
                </div>
                <div className="mt-1.5 flex items-center gap-2 overflow-x-auto scrollbar-hide" aria-label="Access filter">
                  {(["all", "public", "request", "invite"] as CommunityPrivacyFilter[]).map((id) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={privacyFilter === id}
                      onClick={() => setPrivacyFilter(id)}
                      className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-semibold transition ${
                        privacyFilter === id
                          ? "bg-sky-700 text-white"
                          : "border border-border/70 bg-card text-muted-foreground"
                      }`}
                    >
                      {privacyFilterLabel(id)}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="mt-2 flex items-center justify-end">
                <label className="shrink-0 text-[11px] text-muted-foreground">
                  <span className="sr-only">Sort</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="rounded-lg border border-border bg-card px-2 py-1 text-[11px] font-semibold text-foreground"
                  >
                    <option value="recent">Recent</option>
                    <option value="unread">Needs attention</option>
                    <option value="active">Most members</option>
                    <option value="name">Name</option>
                  </select>
                </label>
              </div>
            )}
          </FilterPanel>
        }
      />

      <div className="sr-only" role="status" aria-live="polite">
        {statusMsg || (directoryLoading ? "Loading communities" : "")}
      </div>
      {directoryDurable === false && !directoryLoading ? (
        <div className="mx-3 mt-2 rounded-[1.25rem] border border-border/60 bg-muted/40 px-3.5 py-2 text-[11px] leading-snug text-muted-foreground" role="status">
          Directory loaded without a durability signal — join/leave still call the live membership API.
        </div>
      ) : null}
      {!directoryLoading && (searchQuery.trim() || (directory === "discover" && categoryFilter !== "all") || directoryOffset > 0) && !directoryServerFilterAvailable ? (
        <div className="mx-3 mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100" role="status">Server-side community search is awaiting the Phase 10.2 database migration. Showing a bounded directory fallback, so results may not cover every community.</div>
      ) : null}
      {isOffline ? (
        <div className="mx-3 mt-2 rounded-[1.25rem] border border-amber-200/80 bg-amber-50/90 px-3.5 py-2.5 text-[12px] text-amber-950 shadow-sm dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100" role="status">
          <p className="font-semibold">You&apos;re offline</p>
          <p className="mt-0.5 text-[11px] leading-snug opacity-90">Showing communities already on this device. Directory updates when you reconnect.</p>
        </div>
      ) : null}
      {directoryError && !directoryLoading ? (
        <div className="mx-3 mt-2 rounded-[1.25rem] border border-border/60 bg-card px-3.5 py-2.5">
          <FilterResultState state="error" title="Community directory unavailable" description={directoryError} onRetry={reloadDirectory} />
        </div>
      ) : null}
      <div
        className="gh-scroll-stable min-h-0 flex-1 overflow-y-auto overscroll-y-contain scrollbar-hide" style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
        onScroll={onHeaderScroll}
      >
        <div className="mx-auto max-w-2xl space-y-3 px-3 pb-8 pt-3 sm:px-5" role="region" aria-label="Community directory">
          {myCommunities.length > 0 ? (
            <section className="rounded-[1.35rem] border border-border/60 bg-card p-3.5 shadow-sm" aria-label="Community action center">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[13px] font-bold text-foreground">Your community pulse</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">See what needs your attention across every community without opening them one by one.</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {communityPulse.total > 0 ? (
                    <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white">{communityPulse.total} to review</span>
                  ) : (
                    <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">Caught up</span>
                  )}
                  {communityAttentionFilter !== "all" ? (
                    <button type="button" onClick={() => setCommunityAttentionFilter("all")} className="min-h-7 text-[10px] font-semibold text-primary underline-offset-2 hover:underline">Clear focus</button>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button type="button" aria-pressed={communityAttentionFilter === "board"} onClick={() => { setDirectory("my"); setCommunityAttentionFilter(communityAttentionFilter === "board" ? "all" : "board") }} className={`rounded-xl border px-2 py-2.5 text-left transition hover:bg-muted ${communityAttentionFilter === "board" ? "border-primary/50 bg-primary/10" : "border-border/60 bg-muted/35"}`}>
                  <span className="block text-sm font-extrabold text-foreground">{communityPulse.boardUnread}</span>
                  <span className="text-[10px] font-semibold text-muted-foreground">Board updates</span>
                </button>
                <button type="button" aria-pressed={communityAttentionFilter === "chat"} onClick={() => { setDirectory("my"); setCommunityAttentionFilter(communityAttentionFilter === "chat" ? "all" : "chat") }} className={`rounded-xl border px-2 py-2.5 text-left transition hover:bg-muted ${communityAttentionFilter === "chat" ? "border-primary/50 bg-primary/10" : "border-border/60 bg-muted/35"}`}>
                  <span className="block text-sm font-extrabold text-foreground">{communityPulse.chatUnread}</span>
                  <span className="text-[10px] font-semibold text-muted-foreground">Chat unread</span>
                </button>
                <button type="button" aria-pressed={communityAttentionFilter === "requests"} onClick={() => { setDirectory("my"); setCommunityAttentionFilter(communityAttentionFilter === "requests" ? "all" : "requests") }} className={`rounded-xl border px-2 py-2.5 text-left transition hover:bg-muted ${communityAttentionFilter === "requests" ? "border-primary/50 bg-primary/10" : "border-border/60 bg-muted/35"}`}>
                  <span className="block text-sm font-extrabold text-foreground">{communityPulse.requestsToReview}</span>
                  <span className="text-[10px] font-semibold text-muted-foreground">Requests</span>
                </button>
              </div>
            </section>
          ) : null}

          <div className="rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-teal-50/40 p-3.5 dark:border-emerald-900/40 dark:from-emerald-950/40 dark:to-teal-950/20">
            <p className="flex items-center gap-1.5 text-[13px] font-bold text-emerald-900 dark:text-emerald-100">
              <Sparkles size={14} aria-hidden />
              {workflow("board")}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-emerald-800/80 dark:text-emerald-200/70">
              {workflow("boardPostsEvents")}
            </p>
          </div>

          {directoryLoading ? (
            <div className="space-y-3" aria-busy="true" aria-label="Loading communities">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded-[1.25rem] border border-border/40 bg-card p-3.5 shadow-sm">
                  <div className="flex gap-3">
                    <div className="h-11 w-11 rounded-xl bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-36 rounded bg-muted" />
                      <div className="h-2.5 w-48 rounded bg-muted/70" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {!directoryLoading && directory === "my" && myCommunities.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-4 text-center">
              <p className="text-sm font-semibold text-foreground">No communities joined yet</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Discover public spaces — or create your own local chapter.
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => changeDirectory("discover")}
                  className="min-h-10 rounded-full bg-[var(--gh-green)] px-4 text-[12px] font-bold text-white"
                >
                  Discover communities
                </button>
                <button
                  type="button"
                  onClick={openCreateCommunity}
                  className="min-h-10 rounded-full border border-border px-4 text-[12px] font-bold text-foreground"
                >
                  Create one
                </button>
              </div>
              <div className="mt-4 space-y-2 text-left">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Suggested for you
                </p>
                {discoverCommunities.slice(0, 3).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setJoinGate(c)}
                    className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-2.5 text-left hover:border-emerald-300"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--gh-green)] text-sm font-bold text-white">
                      {(c.groupName || "?")[0]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">{c.groupName}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {c.region ? `${c.region} · ` : ""}
                        {c.description?.slice(0, 48) || c.category}
                      </span>
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700">Join</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {directory === "discover" &&
          isDemoDataAllowed() && communityGroups.every((c) => String(c.id).startsWith("demo-community-")) &&
          fromState.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
              Sample communities for preview — including local chapters. Create your own GreenHaven space anytime.
            </p>
          ) : null}

          {!directoryLoading && visibleGroups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-10 text-center">
              <p className="text-[14px] font-bold text-foreground">
                {directory === "my"
                  ? myCommunities.length === 0
                    ? "No communities yet"
                    : "No communities match your search"
                  : discoverCommunities.length === 0
                    ? myCommunities.length > 0
                      ? "You're already in every community we found"
                      : "No communities to discover yet"
                    : "No communities match"}
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {directory === "my"
                  ? myCommunities.length === 0
                    ? "Join a space from Discover, or create one for your city or interest."
                    : "Clear search to see all of your communities."
                  : discoverCommunities.length === 0
                    ? "Create a new space, or open My communities for spaces you already joined."
                    : "Try another search or category."}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {directory === "my" ? (
                  <button
                    type="button"
                    onClick={() => changeDirectory("discover")}
                    className="rounded-full bg-[var(--gh-green)] px-4 py-2 text-[12px] font-bold text-white"
                  >
                    Discover communities
                  </button>
                ) : myCommunities.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => changeDirectory("my")}
                    className="rounded-full bg-[var(--gh-green)] px-4 py-2 text-[12px] font-bold text-white"
                  >
                    Open My communities ({myCommunities.length})
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={openCreateCommunity}
                  className="rounded-full border border-border bg-card px-4 py-2 text-[12px] font-bold text-foreground"
                >
                  Create community
                </button>
              </div>
            </div>
          ) : null}

          {visibleGroups.length > 0 ? (
            <>
            <p className="px-0.5 text-[11px] font-medium text-muted-foreground" aria-live="polite">
              {visibleGroups.length}{" "}
              {directory === "my" ? "in My communities" : "to discover"}
              {searchQuery.trim() ? " matching search" : ""}
            </p>
            {visibleGroups.map((community) => {
              const joined = isJoined(community)
              const isSample = String(community.id).startsWith("demo-community-")
              const viewerId = IdentityService.getCurrentUserId() || ""
              const membershipState = resolveMembershipState(community, viewerId)
              const membershipStatus = membershipState === "pending" || membershipState === "invited" ? membershipState : undefined
              const role =
                community.createdBy === "current-user"
                  ? "owner"
                  : joined
                    ? "member"
                    : "guest"
              return (
                <GroupCard
                  key={community.id}
                  id={community.id}
                  groupName={community.groupName || community.participantName}
                  lastSenderName={community.participantName || "Community"}
                  lastMessage={
                    community.description ||
                    community.lastMessage ||
                    "Open for posts, events and member chat"
                  }
                  lastMessageTime={community.lastMessageTime || Date.now()}
                  memberCount={communityMemberCount(community)}
                  onlineCount={0}
                  unreadCount={community.unreadCount || 0}
                  boardUnread={community.boardUnread || 0}
                  chatUnread={community.chatUnread || 0}
                  isJoined={joined}
                  membershipStatus={membershipStatus}
                  onAcceptInvite={membershipStatus === "invited" ? () => handleAcceptCommunityInvitation(community.id) : undefined}
                  onDeclineInvite={membershipStatus === "invited" ? () => handleDeclineCommunityInvitation(community.id) : undefined}
                  category={community.category || "community"}
                  region={community.region}
                  role={role}
                  isSample={isSample}
                  coverImage={community.groupPhoto || community.photo}
                  groupAvatar={community.participantPhoto || community.groupPhoto}
                  onClick={() => setSelectedCommunityId(community.id)}
                  joinLabel={
                    resolveJoinCta({
                      privacy: community.privacy,
                      viewerIsMember: joined,
                      pendingRequest: membershipStatus === "pending" || (membershipStatus as string | undefined) === "requested",
                      isOwner: role === "owner",
                    }).label
                  }
                  onJoin={!joined && !membershipStatus ? () => setJoinGate(community) : undefined}
                />
              )
            })}
            {directoryHasMore && directoryOffset < 100000 ? <button type="button" disabled={directoryLoadingMore} onClick={() => setDirectoryOffset((value) => value + 100)} className="min-h-11 w-full rounded-xl border border-border bg-card px-3 text-xs font-bold text-foreground disabled:opacity-60" aria-live="polite">{directoryLoadingMore ? "Loading more communities…" : "Load more communities"}</button> : null}
            </>
          ) : directory === "discover" ? (
            <EmptyState
              variant="communities"
              title={searchQuery || privacyFilter !== "all" || categoryFilter !== "all" ? "No communities match" : "Find or start a community"}
              description={
                searchQuery
                  ? `No results for “${searchQuery}”. Try another keyword — or create a community.`
                  : privacyFilter !== "all" || categoryFilter !== "all"
                    ? "No communities match these filters. Clear filters or create a new community."
                    : "Board = posts & events · Chat = member conversation. Create one if nothing fits."
              }
              action={{ label: "Create community", onClick: openCreateCommunity }}
              secondaryAction={
                searchQuery || privacyFilter !== "all" || categoryFilter !== "all"
                  ? {
                      label: "Clear filters",
                      onClick: () => {
                        setSearchQuery("")
                        setPrivacyFilter("all")
                        setCategoryFilter("all")
                      },
                    }
                  : {
                      label: "Retry directory",
                      onClick: () => setDirectoryTick((n) => n + 1),
                    }
              }
            />
          ) : null}
        </div>
      </div>

      {joinGate ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="join-gate-title"
            className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-card p-5 shadow-xl sm:rounded-3xl"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h2 id="join-gate-title" className="text-lg font-bold text-foreground">
                  {joinGate.groupName || joinGate.participantName}
                </h2>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-muted-foreground">
                  <span className="capitalize">{joinGate.privacy || "public"}</span>
                  <span>·</span>
                  <span>{joinGate.members?.length || 0} members</span>
                  {joinGate.region ? (
                    <>
                      <span>·</span>
                      <span className="inline-flex items-center gap-0.5">
                        <MapPin size={12} aria-hidden /> {joinGate.region}
                      </span>
                    </>
                  ) : null}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setJoinGate(null)}
                className="rounded-full p-2 text-muted-foreground hover:bg-muted"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-[13px] leading-relaxed text-foreground/90">
              {joinGate.description || "A space for posts, events, and member chat."}
            </p>
            <p className="mt-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-[12px] text-muted-foreground">
              {privacyJoinHint(joinGate.privacy)}
            </p>
            {normalizeRules(joinGate.rules).length > 0 ? (
              <div className="mt-4 rounded-2xl border border-border bg-muted/40 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Rules — please read before joining
                </p>
                <ul className="mt-2 space-y-1.5 text-[13px] text-foreground">
                  {normalizeRules(joinGate.rules).map((r, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="font-bold text-emerald-600">{i + 1}.</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setJoinGate(null)}
                disabled={joinBusy}
                className="gh-btn gh-btn-secondary min-h-11 flex-1 disabled:opacity-60"
              >
                Not now
              </button>
              <button
                type="button"
                disabled={joinBusy}
                onClick={() => {
                  const row = joinGate
                  setJoinGate(null)
                  if (!row) return
                  beginJoin(row)
                }}
                className="gh-btn gh-btn-primary min-h-11 flex-1 disabled:pointer-events-none disabled:opacity-60"
                aria-busy={joinBusy}
              >
                {joinBusy
                  ? "Working…"
                  : ["invite-only", "invite", "private", "approval", "request"].includes(
                        String(joinGate.privacy || "").toLowerCase(),
                      )
                    ? "Request to join"
                    : "Join community"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <CreateGroupModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        error={createSubmitError}
        onSubmit={async (data: CreateGroupFormData) => {
          setCreateSubmitError(null)
          const id = await createGroup(data)
          if (!id) {
            setCreateSubmitError("Payment or server confirmation did not complete. Your details are preserved; retry or switch the fee method. If a Pi payment may have succeeded, check payment status before trying again.")
            return false
          }
          setCreateSubmitError(null)
          setShowCreate(false)
          try {
            window.dispatchEvent(new CustomEvent("ghc:wallet-synced", { detail: { reason: "community-create-fee" } }))
            window.dispatchEvent(new CustomEvent("ghc:wallet-refresh", { detail: { reason: "community-create-fee" } }))
          } catch { /* */ }
          // Creator is always a member — mirror join id so My list updates even when
          // identity id drifts between "current-user" and Pi uid before rehydrate.
          setLocalJoined((prev) => (prev.includes(id) ? prev : [...prev, id]))
          setDirectory("my")
          const me = IdentityService.getCurrentUserId() || "current-user"
          const snapshot = {
            id,
            participantId: "",
            participantName: data.name,
            participantPhoto: data.coverImage || "/placeholder.svg?height=80&width=80",
            groupName: data.name,
            groupPhoto: data.coverImage,
            photo: data.coverImage,
            conversationType: "group" as const,
            kind: "community",
            communityId: id,
            isCommunity: true,
            description: data.description,
            privacy: data.privacy || "public",
            category: data.category,
            welcomeMessage: data.welcomeMessage,
            rules: data.rules,
            members: [me],
            groupRoles: { [me]: "owner" },
            createdBy: me,
            messages: [],
            lastMessage: "Community created · Board is ready",
            lastMessageTime: Date.now(),
            unread: false,
            online: false,
            boardPosts: [],
          } as CommunityRow
          setCreatedSnapshot(snapshot)
          setSelectedCommunityId(id)
          setHubKey((k) => k + 1)
          // Toast already fired in createGroup — avoid double toast
          return true
        }}
      />

      <CommunityJoinReasonPicker
        open={!!joinPickerRow}
        rules={normalizeRules(joinPickerRow?.rules)}
        communityName={joinPickerRow?.groupName || joinPickerRow?.participantName}
        busy={joinBusy}
        error={joinError}
        onConfirm={(reasons) => {
          if (joinPickerRow) void ensureInStateAndJoin(joinPickerRow, reasons)
        }}
        onCancel={() => {
          if (!joinBusy) {
            setJoinPickerRow(null)
            setJoinError(null)
          }
        }}
      />
    </div>
  )
}
