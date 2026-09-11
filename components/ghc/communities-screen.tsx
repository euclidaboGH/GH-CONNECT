"use client"

import { isDemoDataAllowed } from "@/lib/demo-data-policy"

import { IdentityService } from "@/lib/identity/identity-service"
import { loadPersistedCommunities, isCommunityConversationRow } from "@/lib/domains/community-persistence"

/**
 * Communities tab — My communities vs Discover (0.58 community polish).
 * Domain-backed join/create; Board is the product surface (hub).
 * Cards use elevated surfaces + clearer My vs Discover hierarchy.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Plus,
  Search,
  X,
  Users,
  Compass,
  Sparkles,
  MapPin,
} from "lucide-react"
import { useGHCMessaging } from "@/contexts/ghc-context"
import { onCloseTransientUI } from "@/lib/transient-ui"
import { useScrollHeader } from "@/lib/use-scroll-header"
import { GroupCard } from "./group-card"
import { CreateGroupModal, type CreateGroupFormData } from "./create-group-modal"
import { PremiumCommunityHub } from "./premium-community-hub"
import { CollapsingAppHeader } from "./collapsing-app-header"
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
  const ctx = useGHCMessaging() as any as any as any
  const {
    conversations: conversationsRaw,
    profile,
    addToast,
    createGroup,
    joinCommunity,
    leaveCommunity,
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
  const [directory, setDirectory] = useState<DirectoryTab>("discover")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<"recent" | "active" | "name">("recent")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [showCreate, setShowCreate] = useState(false)
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null)
  /** Snapshot so hub opens immediately after create (before conversations state catches up) */
  const [createdSnapshot, setCreatedSnapshot] = useState<CommunityRow | null>(null)
  const [joinGate, setJoinGate] = useState<CommunityRow | null>(null)
  const [hubKey, setHubKey] = useState(0)
  const [joinPickerRow, setJoinPickerRow] = useState<CommunityRow | null>(null)
  const [joinBusy, setJoinBusy] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [localJoined, setLocalJoined] = useState<string[]>(() => {
    if (typeof window === "undefined") return []
    if (!communityLocalCacheAllowed()) return []
    try {
      const raw = window.localStorage.getItem("ghc.community.joinedIds")
      if (!raw) return []
      const parsed = JSON.parse(raw) as string[]
      return Array.isArray(parsed) ? parsed.filter(Boolean) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
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
    for (const c of seeds) map.set(c.id, c as CommunityRow)
    for (const c of persisted) {
      if (isCommunityConversationRow(c as any)) map.set(c.id, c as unknown as CommunityRow)
    }
    for (const c of fromState) map.set(c.id, c)
    return Array.from(map.values())
  }, [fromState, seeds])

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
    return pool
      .filter((c) => {
        if (categoryFilter !== "all" && (c.category || "") !== categoryFilter) return false
        if (!q) return true
        const hay = `${c.groupName} ${c.participantName} ${c.description || ""} ${c.region || ""} ${(c.tags || []).join(" ")} ${c.category || ""}`.toLowerCase()
        return hay.includes(q)
      })
      .sort((a, b) => {
        if (sortBy === "name")
          return (a.groupName || a.participantName).localeCompare(b.groupName || b.participantName)
        if (sortBy === "active") return (b.members?.length || 0) - (a.members?.length || 0)
        return (b.lastMessageTime || 0) - (a.lastMessageTime || 0)
      })
  }, [directory, myCommunities, discoverCommunities, searchQuery, categoryFilter, sortBy])

  const selected = selectedCommunityId
    ? communityGroups.find((c) => c.id === selectedCommunityId) ||
      (createdSnapshot && createdSnapshot.id === selectedCommunityId ? createdSnapshot : null)
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
      const ok = await joinCommunity(row.id)
      if (ok) {
        // Domain join succeeded. Mirror to Class D cache only in Studio for list hydration.
        if (communityLocalCacheAllowed()) {
          setLocalJoined((prev) => (prev.includes(row.id) ? prev : [...prev, row.id]))
        }
        setHubKey((k) => k + 1)
        setJoinPickerRow(null)
        addToast(`Joined ${row.groupName || row.participantName}`, "success")
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

  const handleLeave = async (id: string, name: string) => {
    if (leaveCommunity) {
      const ok = await leaveCommunity(id)
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
  ) => {
    if (createBoardPost) {
      const ok = await createBoardPost(communityId, body, kind)
      if (ok) {
        setHubKey((k) => k + 1)
        return
      }
      if (!allowLocalBoardFallback()) {
        addToast("Could not post to the board. Please try again.", "error")
        return
      }
    } else if (!allowLocalBoardFallback()) {
      addToast("Board posting is unavailable right now.", "error")
      return
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
  }

  if (selected) {
    const me = IdentityService.getCurrentUserId() || "current-user"
    const joined =
      isJoined(selected) ||
      selected.createdBy === me ||
      selected.createdBy === "current-user" ||
      Boolean(selected.groupRoles?.[me]) ||
      Boolean(selected.groupRoles?.["current-user"])
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
      <div className="flex h-full min-h-0 flex-col">
        <PremiumCommunityHub
          key={hubKey}
          community={{
            id: selected.id,
            name: selected.groupName || selected.participantName,
            description: selected.description,
            memberCount: selected.members?.length || 1,
            privacy:
              selected.privacy === "private" || selected.privacy === "invite-only"
                ? "private"
                : "public",
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
            // Unmount heavy hub before switching tabs — reduces freeze risk
            setSelectedCommunityId(null)
            setCreatedSnapshot(null)
            try {
              window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "messages" }))
              // Open the community conversation thread (not a DM-looking blank inbox)
              window.setTimeout(() => {
                window.dispatchEvent(
                  new CustomEvent("ghc:open-conversation", {
                    detail: { conversationId: communityId },
                  })
                )
              }, 80)
            } catch {
              setTab?.("messages")
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
    <div className="flex h-full min-h-0 flex-col bg-background">
      <CollapsingAppHeader
        title="Communities"
        compact={headerCompact}
        hidden={headerHidden}
        actions={
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex min-h-9 items-center gap-1 rounded-full bg-emerald-600 px-3 text-[12px] font-bold text-white"
            aria-label="Create community"
          >
            <Plus size={16} strokeWidth={2.5} />
            Create
          </button>
        }
        secondary={
          <>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, city, topic…"
                aria-label="Search communities"
                className="h-9 w-full rounded-xl border border-border bg-card pl-9 pr-9 text-sm text-foreground outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
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
            </div>

            <div className="mt-2 flex gap-1 rounded-xl bg-muted/60 p-1">
              <button
                type="button"
                onClick={() => setDirectory("my")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-bold transition ${
                  directory === "my"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                <Users size={14} aria-hidden />
                My ({myCommunities.length})
              </button>
              <button
                type="button"
                onClick={() => setDirectory("discover")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-bold transition ${
                  directory === "discover"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                <Compass size={14} aria-hidden />
                Discover ({discoverCommunities.length})
              </button>
            </div>

            <div className="mt-2 flex items-center gap-2 overflow-x-auto scrollbar-hide">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
                    categoryFilter === cat
                      ? "bg-emerald-600 text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {cat === "all" ? "All topics" : cat}
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
                  <option value="active">Most members</option>
                  <option value="name">Name</option>
                </select>
              </label>
            </div>
          </>
        }
      />

      <div
        className="gh-scroll-stable min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-hide"
        onScroll={onHeaderScroll}
      >
        <div className="mx-auto max-w-2xl space-y-3 px-3 pb-8 pt-3 sm:px-5">
          <div className="rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-teal-50/40 p-3.5 dark:border-emerald-900/40 dark:from-emerald-950/40 dark:to-teal-950/20">
            <p className="flex items-center gap-1.5 text-[13px] font-bold text-emerald-900 dark:text-emerald-100">
              <Sparkles size={14} aria-hidden />
              Community hub
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-emerald-800/80 dark:text-emerald-200/70">
              <span className="font-semibold">Board</span> is posts & events ·{" "}
              <span className="font-semibold">Chat</span> is live talk for members · Private DMs stay
              in Messages.
            </p>
          </div>

          {directory === "my" && myCommunities.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-4 text-center">
              <p className="text-sm font-semibold text-foreground">No communities joined yet</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Discover public spaces — or create your own local chapter.
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setDirectory("discover")}
                  className="min-h-10 rounded-full bg-emerald-600 px-4 text-[12px] font-bold text-white"
                >
                  Discover communities
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(true)}
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
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white">
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

          {visibleGroups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-10 text-center">
              <p className="text-[14px] font-bold text-foreground">
                {directory === "my" ? "No communities yet" : "No communities match"}
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {directory === "my"
                  ? "Join a space from Discover, or create one for your city or interest."
                  : "Try another search or category."}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {directory === "my" ? (
                  <button
                    type="button"
                    onClick={() => setDirectory("discover")}
                    className="rounded-full bg-emerald-600 px-4 py-2 text-[12px] font-bold text-white"
                  >
                    Discover communities
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setShowCreate(true)}
                  className="rounded-full border border-border bg-card px-4 py-2 text-[12px] font-bold text-foreground"
                >
                  Create community
                </button>
              </div>
            </div>
          ) : null}

          {visibleGroups.length > 0 ? (
            visibleGroups.map((community) => {
              const joined = isJoined(community)
              const isSample = String(community.id).startsWith("demo-community-")
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
                  memberCount={community.members?.length || 0}
                  onlineCount={0}
                  unreadCount={community.unreadCount || 0}
                  boardUnread={community.boardUnread || 0}
                  chatUnread={community.chatUnread || 0}
                  isJoined={joined}
                  category={community.category || "community"}
                  region={community.region}
                  role={role}
                  isSample={isSample}
                  coverImage={community.groupPhoto || community.photo}
                  groupAvatar={community.participantPhoto || community.groupPhoto}
                  onClick={() => setSelectedCommunityId(community.id)}
                  onJoin={!joined ? () => setJoinGate(community) : undefined}
                />
              )
            })
          ) : directory === "discover" ? (
            <EmptyState
              variant="communities"
              title={searchQuery ? "No communities match" : "Find or start a community"}
              description={
                searchQuery
                  ? `No results for “${searchQuery}”. Try another keyword — or create a community.`
                  : "Board = posts & events · Chat = member conversation."
              }
              action={
                searchQuery
                  ? {
                      label: "Create community",
                      onClick: () => setShowCreate(true),
                    }
                  : { label: "Create community", onClick: () => setShowCreate(true) }
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
                className="min-h-11 flex-1 rounded-2xl border border-border font-semibold text-foreground"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={() => {
                  const row = joinGate
                  setJoinGate(null)
                  if (!row) return
                  beginJoin(row)
                }}
                className="min-h-11 flex-1 rounded-2xl bg-emerald-600 font-bold text-white"
              >
                {joinGate.privacy === "invite-only" ? "Request to join" : "Join community"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <CreateGroupModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={async (data: CreateGroupFormData) => {
          const id = await createGroup(data)
          setShowCreate(false)
          if (!id) return
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
