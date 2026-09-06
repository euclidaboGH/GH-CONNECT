"use client"

/**
 * Premium community detail hub — Community ≠ Chat.
 * Board: posts, announcements, polls, events, discussion.
 * Chat: realtime member conversation (Messaging domain, community type).
 */

import { useMemo, useState, useEffect } from "react"
import { onCloseTransientUI } from "@/lib/transient-ui"
import {
  ArrowLeft,
  Bell,
  Calendar,
  Hash,
  MessageSquare,
  Shield,
  Users,
  Megaphone,
  BarChart3,
  Settings2,
  Pin,
  MapPin,
  Sparkles,
  VolumeX,
  Timer,
  MessageCircle,
} from "lucide-react"
import {
  AnnouncementCard,
  PollCard,
  EventCard,
} from "./community-features-ui"
import { CommunityPeopleYouMayKnow } from "./community-people-you-may-know"
import { PinnedResourceCard } from "./community-features-ui"
import { buildCommunityFeed } from "@/lib/domains/adapters/community-feed"
import { buildCommunityActivityDigest } from "@/lib/domains/adapters/community-activity-digest"
import { CommunityMemberWelcome } from "@/components/ghc/community-member-welcome"
import {
  buildMemberWelcomeModel,
  markWelcomeComplete,
  markChecklistStep,
  type OnboardingStepId,
} from "@/lib/domains/adapters/community-member-onboarding"
import { loadLocalJoinReasons } from "@/lib/domains/adapters/community-membership-adapter"
import {
  listModerationLog,
  listCommunityReports,
  buildGovernanceModel,
  buildHealthSnapshot,
  buildAdminHealthAnalytics,
  resolveCommunityReport,
  resolveLifecycle,
  lifecycleLabel,
  suggestLifecycleTransition,,
  governanceDurabilityLabel,
} from "@/lib/domains/adapters/community-governance"
import { buildPeopleYouMayKnowInCommunity } from "@/lib/domains/adapters/community-people-you-may-know"
import {
  buildCommunityParticipationHub,
  formatEventWhen,
} from "@/lib/domains/adapters/community-participation-hub"
import { IdentityService } from "@/lib/identity/identity-service"
import { useGHC } from "@/contexts/ghc-context"
import {
  getUpcomingEvents,
  getActivePolls,
  type Announcement,
  type Poll,
  type ScheduledEvent,
} from "@/lib/community-features-engine"

export type CommunityHubTab =
  | "board"
  | "announcements"
  | "discussion"
  | "chat"
  | "events"
  | "members"
  | "about"

type CommunitySummary = {
  id: string
  name: string
  description?: string
  memberCount: number
  privacy: "public" | "private"
  isJoined: boolean
  photo?: string
  cover?: string
  category?: string
  rules?: string[]
  tags?: string[]
  region?: string
  role?: "owner" | "admin" | "moderator" | "member" | "guest"
  welcomeMessage?: string
  boardUnread?: number
  chatUnread?: number
  samplePosts?: { id: string; author: string; excerpt: string }[]
}

const ROLE_BADGE: Record<string, string> = {
  owner: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  admin: "bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-200",
  moderator: "bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200",
  member: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
  guest: "bg-muted text-muted-foreground",
}

const HUB_TABS: { id: CommunityHubTab; label: string; icon: React.ReactNode; board?: boolean }[] = [
  { id: "board", label: "Board", icon: <Hash size={14} />, board: true },
  { id: "announcements", label: "Announce", icon: <Megaphone size={14} />, board: true },
  { id: "discussion", label: "Discussion", icon: <Pin size={14} />, board: true },
  { id: "events", label: "Events", icon: <Calendar size={14} />, board: true },
  { id: "chat", label: "Chat", icon: <MessageSquare size={14} /> },
  { id: "members", label: "Members", icon: <Users size={14} /> },
  { id: "about", label: "About", icon: <Shield size={14} /> },
]

const DEFAULT_RULES = [
  "Be respectful — no harassment or hate.",
  "Stay on topic for this community.",
  "No spam, scams, or misleading promotions.",
  "Protect privacy — don’t share others’ personal data.",
]

export function PremiumCommunityHub({
  community,
  onBack,
  onOpenChat,
  onJoin,
  onLeave,
  onMute,
  onPost,
  onReplyToPost,
  onReactToPost,
  onCreateAnnouncement,
  onPinPost,
  onUnpinPost,
  onHidePost,
  onUnhidePost,
  onTransitionLifecycle,
  onReportCommunity,
  onCreateEvent,
  onRsvp,
  onApproveRequest,
  onDeclineRequest,
  onInviteMember,
  pendingJoinRequests = [],
  inviteCandidates = [],
  announcements = [],
  polls = [],
  events = [],
  boardPosts = [],
  memberPreview = [],
  canChat = false,
  role,
}: {
  community: CommunitySummary
  onBack: () => void
  onOpenChat?: () => void
  onJoin?: () => void
  onLeave?: () => void
  onMute?: () => void
  onPost?: (body: string, kind?: "text" | "question" | "resource") => void
  onReplyToPost?: (postId: string, body: string) => void
  onReactToPost?: (postId: string) => void
  onCreateAnnouncement?: (input: { title: string; content: string }) => void
  onPinPost?: (postId: string) => void
  onUnpinPost?: (postId: string) => void
  onHidePost?: (postId: string) => void
  onUnhidePost?: (postId: string) => void
  onTransitionLifecycle?: (next: "draft" | "discoverable" | "active" | "quiet" | "archived") => void
  onReportCommunity?: (input: {
    targetType: "community" | "post" | "member"
    targetId: string
    reason: "spam" | "harassment" | "hate" | "misinformation" | "impersonation" | "safety" | "other"
  }) => void
  onCreateEvent?: (input: { title: string; startsAt: number; location?: string; isOnline?: boolean }) => void
  onRsvp?: (eventId: string) => void
  onApproveRequest?: (userId: string) => void
  onDeclineRequest?: (userId: string) => void
  onInviteMember?: (userId: string) => void
  pendingJoinRequests?: string[]
  inviteCandidates?: { id: string; name: string; photo?: string }[]
  announcements?: Announcement[]
  polls?: Poll[]
  events?: ScheduledEvent[] | any[]
  boardPosts?: any[]
  memberPreview?: { id: string; name: string; photo?: string; role?: string }[]
  canChat?: boolean
  role?: string
}) {
  const [welcomeTick, setWelcomeTick] = useState(0)
  const [tab, setTab] = useState<CommunityHubTab>(community.isJoined ? "board" : "about")
  const [showJoinConfirm, setShowJoinConfirm] = useState(false)

  useEffect(() => {
    return onCloseTransientUI(() => setShowJoinConfirm(false))
  }, [])
  const [chatMuted, setChatMuted] = useState(false)
  const [slowMode, setSlowMode] = useState(false)
  const [composeBody, setComposeBody] = useState("")
  const [boardSort, setBoardSort] = useState<"new" | "hot" | "top">("new")
  const effectiveCanChat = canChat || community.isJoined

  const upcoming = useMemo(() => getUpcomingEvents(events).slice(0, 5), [events])
  const activePolls = useMemo(() => getActivePolls(polls).slice(0, 3), [polls])
  const pinnedAnnouncements = announcements.filter((a) => a.pinned).slice(0, 3)
  const rules = (community.rules && community.rules.length > 0 ? community.rules : DEFAULT_RULES).slice(0, 8)
  const tags = community.tags?.length
    ? community.tags
    : [community.category, community.region].filter(Boolean) as string[]
  const isMod =
    community.role === "owner" || community.role === "admin" || community.role === "moderator"
  const ghcSession = useGHC() as any
  const meId = IdentityService.getCurrentUserId()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteBusy, setInviteBusy] = useState<string | null>(null)
  const [announceOpen, setAnnounceOpen] = useState(false)
  const [announceTitle, setAnnounceTitle] = useState("")
  const [announceBody, setAnnounceBody] = useState("")
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({})
  const [safetyTick, setSafetyTick] = useState(0)

  const membersWithRoles = (() => {
    if (memberPreview.length > 0) return memberPreview
    const roster: Array<{ id: string; name: string; role?: string; photo?: string }> = []
    const creator = (community as { createdBy?: string }).createdBy
    if (creator) {
      roster.push({
        id: creator,
        name: creator === "current-user" ? "You" : creator,
        role: "owner",
      })
    }
    const members = Array.isArray((community as { members?: string[] }).members)
      ? ((community as { members?: string[] }).members as string[])
      : []
    for (const m of members) {
      if (roster.some((r) => r.id === m)) continue
      roster.push({
        id: m,
        name: m === "current-user" ? "You" : m.charAt(0).toUpperCase() + m.slice(1),
        role: community.role && m === "current-user" ? community.role : "member",
      })
    }
    if (community.isJoined && !roster.some((r) => r.id === "current-user")) {
      roster.unshift({
        id: "current-user",
        name: "You",
        role: community.role || "member",
      })
    }
    return roster
  })()

  const memberIdsForSuggestions = Array.isArray((community as { members?: string[] }).members)
    ? ((community as { members?: string[] }).members as string[])
    : membersWithRoles.map((m) => m.id)

  const lifecycle = resolveLifecycle((community as any).lifecycle)
  const governanceModel = buildGovernanceModel({
    communityId: community.id,
    role: community.role,
    lifecycle,
  })
  const healthSnapshot = buildHealthSnapshot({
    communityId: community.id,
    lifecycle,
    memberCount: community.memberCount || membersWithRoles.length,
    boardPosts: boardPosts as any,
    events: events as any,
  })
  const moderationLog = isMod ? listModerationLog(community.id) : []
  const openReports = isMod ? listCommunityReports(community.id).filter((r) => r.status === "open") : []
  const allReports = isMod ? listCommunityReports(community.id) : []
  const adminHealth = isMod
    ? buildAdminHealthAnalytics({
        communityId: community.id,
        lifecycle,
        memberCount: community.memberCount || membersWithRoles.length,
        boardPosts: boardPosts as any,
        events: events as any,
        resourceCount: Array.isArray((community as any).resources) ? (community as any).resources.length : 0,
      })
    : null


  const lifecycleSuggestion = suggestLifecycleTransition({
    lifecycle,
    daysSinceLastActivity: adminHealth?.daysSinceLastActivity ?? null,
    memberCount: community.memberCount || membersWithRoles.length,
    discussionCount: adminHealth?.discussionCount ?? (Array.isArray(boardPosts) ? boardPosts.filter((p: any) => !p.hidden).length : 0),
    openReportCount: openReports.length,
    grade: adminHealth?.grade,
  })
  void safetyTick

  const activityDigest = buildCommunityActivityDigest({
    communityId: community.id,
    communityName: community.name,
    boardPosts: (boardPosts as any[])?.filter((p: any) => !p.hidden),
    announcements: announcements as any,
    events: events as any,
    activities: (community as any).activities,
    resources: (community as any).resources,
  })

  const participationHub = buildCommunityParticipationHub({
    communityId: community.id,
    events: events as any[],
    resources: (community as any).resources,
    boardPosts: boardPosts as any[],
  })


  const viewerId = IdentityService.getCurrentUserId() || ""
  const joinReasons = (() => {
    try {
      return loadLocalJoinReasons(viewerId, community.id) || []
    } catch {
      return []
    }
  })()
  const welcomeModel =
    isJoined && viewerId
      ? buildMemberWelcomeModel({
          userId: viewerId,
          communityId: community.id,
          communityName: community.name,
          welcomeMessage: community.welcomeMessage,
          rules,
          joinReasons,
        })
      : null
  // welcomeTick forces re-read of local checklist
  void welcomeTick


  const feedItems = buildCommunityFeed({
    communityId: community.id,
    boardPosts: boardPosts as any,
    announcements: announcements as any,
    events: events as any,
    activities: (community as any).activities,
    resources: (community as any).resources,
  })

  const peopleSuggestions = buildPeopleYouMayKnowInCommunity({
    viewerId: meId,
    communityId: community.id,
    memberIds: memberIdsForSuggestions,
    directory: (ghcSession.candidates || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      photo: c.photo,
      interests: c.interests,
    })),
    friendIds: ghcSession.friends || [],
    followingIds: ghcSession.following || [],
    blockedUserIds: ghcSession.blockedUsers || [],
    viewerInterests: ghcSession.profile?.interests || [],
    limit: 6,
  })

  const requestJoin = () => {
    if (!community.isJoined) {
      setShowJoinConfirm(true)
      setTab("about")
      return
    }
    onJoin?.()
  }

  const confirmJoin = () => {
    setShowJoinConfirm(false)
    onJoin?.()
    // Always land on Board after join — Chat is an explicit tab
    setTab("board")
  }

  // When membership flips to joined (parent update), open Board not Chat
  useEffect(() => {
    if (community.isJoined) {
      setTab((t) => (t === "about" || t === "chat" ? "board" : t))
    }
  }, [community.isJoined])

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      {/* Cover + identity kit */}
      <header className="shrink-0 border-b border-border bg-card">
        <div
          className="relative h-36 bg-gradient-to-br from-emerald-700 via-teal-600 to-cyan-700 sm:h-40"
          style={
            community.cover || community.photo
              ? {
                  backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0.15)), url(${community.cover || community.photo})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          <div className="absolute inset-x-0 top-0 flex items-center gap-2 px-3 py-2">
            <button
              type="button"
              onClick={onBack}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm hover:bg-black/50"
              aria-label="Back to communities"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0 flex-1" />
            {community.role && community.role !== "guest" && (
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold capitalize ${ROLE_BADGE[community.role] || ROLE_BADGE.member}`}>
                {community.role}
              </span>
            )}
          </div>
          <div className="absolute bottom-2 left-3 right-3">
            <h1 className="truncate text-base font-bold text-white drop-shadow">{community.name}</h1>
            <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-white/90">
              <span>{community.privacy === "public" ? "Public" : "Private"}</span>
              <span>·</span>
              <span>{community.memberCount} members</span>
              {community.region && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-0.5">
                    <MapPin size={11} aria-hidden /> {community.region}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-2">
          <div className="min-w-0 flex-1">
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.slice(0, 4).map((tag) => (
                  <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          {community.isJoined ? (
            <button
              type="button"
              onClick={() => {
                setTab("chat")
                onOpenChat?.()
              }}
              className="rounded-full bg-teal-600 px-3 py-1.5 text-[11px] font-bold text-white"
            >
              Open chat
            </button>
          ) : (
            <button
              type="button"
              onClick={requestJoin}
              className="min-h-10 rounded-full bg-primary px-4 py-2 text-[12px] font-bold text-primary-foreground"
            >
              Join
            </button>
          )}
        </div>

        <p className="px-3 pb-1 text-[10px] text-muted-foreground">
          <span className="font-semibold text-foreground">Board</span> = posts & events ·{" "}
          <span className="font-semibold text-teal-700 dark:text-teal-300">Chat</span> = live member talk
        </p>
        
        {(community.boardUnread || community.chatUnread) ? (
          <div className="mx-3 mb-2 flex gap-2">
            {(community.boardUnread || 0) > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-bold text-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
                Board · {community.boardUnread} new
              </span>
            )}
            {(community.chatUnread || 0) > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-bold text-teal-800 dark:bg-teal-950/40 dark:text-teal-200">
                Chat · {community.chatUnread} unread
              </span>
            )}
          </div>
        ) : null}

        {/* Board (content) vs Chat — structured spaces */}
        <div className="flex gap-1 overflow-x-auto px-3 pb-2 scrollbar-hide" role="tablist" aria-label="Community spaces">
          {HUB_TABS.map((t) => {
            const selected = tab === t.id
            const isChat = t.id === "chat"
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => {
                  if (isChat) {
                    if (community.isJoined && onOpenChat) onOpenChat()
                    setTab("chat")
                    return
                  }
                  setTab(t.id)
                }}
                className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
                  selected
                    ? isChat
                      ? "bg-teal-600 text-white"
                      : "bg-primary text-primary-foreground"
                    : isChat
                      ? "bg-teal-50 text-teal-800 ring-1 ring-teal-100 dark:bg-teal-950/40 dark:text-teal-200"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            )
          })}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 scrollbar-hide">
        {/* Join with eyes open */}
        {showJoinConfirm && !community.isJoined && (
          <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50/90 p-3 dark:border-amber-900 dark:bg-amber-950/40">
            <p className="text-xs font-bold text-amber-950 dark:text-amber-100">Join with eyes open</p>
            <p className="mt-1 text-[11px] text-amber-900/90 dark:text-amber-100/80">
              {community.memberCount} members · {community.privacy} · Review rules below before joining.
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-[11px] text-amber-950/90 dark:text-amber-50/90">
              {rules.slice(0, 4).map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ol>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={confirmJoin}
                className="rounded-full bg-primary px-4 py-2 text-[11px] font-bold text-primary-foreground"
              >
                Agree & join
              </button>
              <button
                type="button"
                onClick={() => setShowJoinConfirm(false)}
                className="rounded-full border border-border bg-card px-4 py-2 text-[11px] font-bold"
              >
                Not now
              </button>
            </div>
          </div>
        )}

        {tab === "board" && (
          <div className="space-y-4">
            {/* Participation strip — events & knowledge without leaving Board */}
            {(participationHub.nextEvent || participationHub.resources.length > 0) && (
              <div className="grid gap-2 sm:grid-cols-2">
                {participationHub.nextEvent ? (
                  <button
                    type="button"
                    onClick={() => setTab("events")}
                    className="rounded-2xl border border-border bg-card p-3 text-left transition hover:border-emerald-400/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                      Next up
                    </p>
                    <p className="mt-0.5 text-[13px] font-bold text-foreground line-clamp-1">
                      {participationHub.nextEvent.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatEventWhen(participationHub.nextEvent.startsAt)}
                      {participationHub.nextEvent.attendeeCount
                        ? ` · ${participationHub.nextEvent.attendeeCount} attending`
                        : ""}
                    </p>
                  </button>
                ) : null}
                {participationHub.resources.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setTab("about")}
                    className="rounded-2xl border border-border bg-card p-3 text-left transition hover:border-emerald-400/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      Knowledge hub
                    </p>
                    <p className="mt-0.5 text-[13px] font-bold text-foreground">
                      {participationHub.resourceCount} pinned resource{participationHub.resourceCount === 1 ? "" : "s"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">
                      {participationHub.resources[0]?.title}
                    </p>
                  </button>
                ) : null}
              </div>
            )}

            <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/50 px-3 py-2.5 dark:border-emerald-900/50 dark:bg-emerald-950/30">
              <p className="text-[11px] font-semibold text-emerald-900 dark:text-emerald-100">Board ≠ Chat</p>
              <p className="mt-0.5 text-[11px] text-emerald-800/85 dark:text-emerald-200/80">
                <strong>Board</strong> holds announcements, discussion, polls and events.{" "}
                <strong>Chat</strong> is realtime member conversation — a tool inside this place, not the whole community.
              </p>
            </div>

            
        {welcomeModel?.showWelcome ? (
          <div className="px-3 pt-3">
            <CommunityMemberWelcome
              model={welcomeModel}
              onDismiss={() => {
                markWelcomeComplete(viewerId, community.id)
                setWelcomeTick((t) => t + 1)
              }}
              onChecklistStep={(step: OnboardingStepId) => {
                markChecklistStep(viewerId, community.id, step)
                setWelcomeTick((t) => t + 1)
              }}
              onOpenMembers={() => setTab("members")}
              onOpenBoard={() => setTab("board")}
              onOpenEvents={() => setTab("events")}
            />
          </div>
        ) : null}

        {community.welcomeMessage && (
              <div className="rounded-2xl border border-border bg-card p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Pinned welcome</p>
                <p className="mt-1 text-sm text-foreground">
                  {community.welcomeMessage ||
                    `Welcome to ${community.name} — introduce yourself and read the rules.`}
                </p>
                <div className="mt-2 rounded-xl bg-background/80 px-2.5 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Rules</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-muted-foreground">
                    {rules.slice(0, 4).map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {community.isJoined && onPost && (
              <div className="rounded-2xl border border-border bg-card p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Post to board</p>
                <textarea
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Share an update, question, or resource…"
                  rows={3}
                  className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-emerald-400"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["Intro yourself", "Ask a question", "Share a resource"] as const).map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setComposeBody((b) => b || prompt + ": ")}
                      className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold text-muted-foreground"
                    >
                      {prompt}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={!composeBody.trim()}
                    onClick={() => {
                      onPost(composeBody.trim(), "text")
                      setComposeBody("")
                    }}
                    className="ml-auto min-h-9 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white disabled:opacity-40"
                  >
                    Post
                  </button>
                </div>
              </div>
            )}

            {(boardPosts?.length > 0 || (community.samplePosts?.length || 0) > 0) && (
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-xs font-bold text-foreground">Discussion</h2>
                  <div className="flex gap-1">
                    {(["new", "hot", "top"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setBoardSort(s)}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
                          boardSort === s ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  {(boardPosts && boardPosts.length > 0
                    ? [...boardPosts].sort((a: any, b: any) =>
                        boardSort === "top" || boardSort === "hot"
                          ? (b.likes || 0) - (a.likes || 0)
                          : (b.createdAt || 0) - (a.createdAt || 0)
                      )
                    : []
                  ).map((p: any) => (
                    <div key={p.id} className="rounded-xl border border-border bg-card px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] font-semibold text-foreground">{p.authorName || p.author}</p>
                        {p.authorRole && p.authorRole !== "member" && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                            {p.authorRole}
                          </span>
                        )}
                        {p.pinned && (
                          <span className="text-[9px] font-bold uppercase text-emerald-600">Pinned</span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">{p.body || p.excerpt}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {!community.isJoined && (community.samplePosts?.length || 0) > 0 && (
              <section>
                <h2 className="mb-2 text-xs font-bold text-foreground">Sample posts</h2>
                <div className="space-y-2">
                  {community.samplePosts!.slice(0, 3).map((p) => (
                    <div key={p.id} className="rounded-xl border border-border bg-card px-3 py-2">
                      <p className="text-[11px] font-semibold text-muted-foreground">{p.author}</p>
                      <p className="mt-0.5 text-sm text-foreground">{p.excerpt}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {feedItems.length > 0 && (
              <section aria-labelledby="community-timeline-heading">
                <h2 id="community-timeline-heading" className="mb-2 text-xs font-bold text-foreground">
                  Community timeline
                </h2>
                <ul className="space-y-1.5">
                  {feedItems.slice(0, 12).map((item) => (
                    <li
                      key={`${item.kind}-${item.id}`}
                      className="rounded-xl border border-border/80 bg-card/80 px-3 py-2 text-[12px]"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wide text-teal-700 dark:text-teal-300">
                        {item.kind}
                      </span>
                      <p className="mt-0.5 font-medium text-foreground">
                        {item.title || item.body?.slice(0, 120) || item.authorName || "Update"}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

                        {pinnedAnnouncements.length > 0 && (
              <section>
                <h2 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <Megaphone size={14} className="text-emerald-600" />
                  Announcements
                </h2>
                <div className="space-y-2">
                  {pinnedAnnouncements.map((a) => (
                    <AnnouncementCard key={a.id} announcement={a} />
                  ))}
                </div>
              </section>
            )}

            {activePolls.length > 0 && (
              <section>
                <h2 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <BarChart3 size={14} className="text-sky-600" />
                  Polls
                </h2>
                <div className="space-y-2">
                  {activePolls.map((p) => (
                    <PollCard key={p.id} poll={p} />
                  ))}
                </div>
              </section>
            )}

            {upcoming.length > 0 && (
              <section>
                <h2 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <Calendar size={14} className="text-violet-600" />
                  Upcoming events
                </h2>
                <div className="space-y-2">
                  {upcoming.map((e) => (
                    <EventCard key={e.id} event={e} />
                  ))}
                </div>
              </section>
            )}

            {/* Quality loop */}
            <section className="rounded-2xl border border-border bg-card p-3">
              <h2 className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Sparkles size={14} className="text-amber-500" />
                This week’s contributors
              </h2>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Quality posts and helpful replies may earn recognition. GHC for community value is{" "}
                <strong>approved only</strong> — never for spam.
              </p>
              <ul className="mt-2 space-y-1.5 text-[11px] text-muted-foreground">
                <li className="flex justify-between rounded-lg bg-muted/50 px-2 py-1.5">
                  <span>Helpful discussion</span>
                  <span className="font-semibold text-foreground">Top signal</span>
                </li>
                <li className="flex justify-between rounded-lg bg-muted/50 px-2 py-1.5">
                  <span>Event hosting</span>
                  <span className="font-semibold text-foreground">Community value</span>
                </li>
              </ul>
            </section>

            {pinnedAnnouncements.length === 0 && activePolls.length === 0 && upcoming.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-8 text-center">
                <Bell size={22} className="mx-auto text-muted-foreground/50" />
                <p className="mt-2 text-sm font-semibold text-foreground">Community board</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Announcements, polls and events from moderators appear here.
                </p>
              </div>
            )}
          </div>
        )}

        {tab === "announcements" && (
          <div className="space-y-3">
            {isMod && onCreateAnnouncement ? (
              <div className="rounded-2xl border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-bold text-foreground">Publish announcement</p>
                  <button
                    type="button"
                    onClick={() => setAnnounceOpen((v) => !v)}
                    className="min-h-9 rounded-full border border-border px-3 text-[11px] font-bold"
                  >
                    {announceOpen ? "Cancel" : "New"}
                  </button>
                </div>
                {announceOpen ? (
                  <div className="mt-2 space-y-2">
                    <input
                      value={announceTitle}
                      onChange={(e) => setAnnounceTitle(e.target.value)}
                      placeholder="Title"
                      aria-label="Announcement title"
                      className="min-h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                    />
                    <textarea
                      value={announceBody}
                      onChange={(e) => setAnnounceBody(e.target.value)}
                      placeholder="Message for members…"
                      aria-label="Announcement body"
                      rows={3}
                      className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      disabled={!announceTitle.trim() || !announceBody.trim()}
                      onClick={() => {
                        onCreateAnnouncement({
                          title: announceTitle.trim(),
                          content: announceBody.trim(),
                        })
                        setAnnounceTitle("")
                        setAnnounceBody("")
                        setAnnounceOpen(false)
                      }}
                      className="min-h-10 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white disabled:opacity-50"
                    >
                      Publish
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
            {pinnedAnnouncements.length === 0 && announcements.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-8 text-center text-xs text-muted-foreground">
                No announcements yet
              </div>
            ) : (
              (pinnedAnnouncements.length ? pinnedAnnouncements : announcements).map((a) => (
                <AnnouncementCard key={a.id} announcement={a} />
              ))
            )}
          </div>
        )}

        {tab === "discussion" && (
          <div className="space-y-3">
            <p className="text-[11px] text-muted-foreground">
              Discussions are board posts — not the same as realtime chat.
            </p>
            {community.isJoined && onPost ? (
              <div className="rounded-2xl border border-border bg-card p-3">
                <label htmlFor="community-discussion-compose" className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Start a discussion
                </label>
                <textarea
                  id="community-discussion-compose"
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  rows={3}
                  placeholder="Share something with the community…"
                  className="mt-1.5 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                />
                <button
                  type="button"
                  disabled={!composeBody.trim()}
                  onClick={() => {
                    onPost(composeBody.trim(), "text")
                    setComposeBody("")
                  }}
                  className="mt-2 min-h-10 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  Post discussion
                </button>
              </div>
            ) : !community.isJoined ? (
              <p className="rounded-2xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                Join this community to start a discussion.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Posting is unavailable right now.</p>
            )}
            {(boardPosts?.length || 0) === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No discussions yet.</p>
            ) : (
              <ul className="space-y-2" aria-label="Community discussions">
                {[...(boardPosts || [])]
                  .filter((p: any) => !p.hidden)
                  .sort((a: any, b: any) => (Number(!!b.pinned) - Number(!!a.pinned)) || ((b.createdAt || 0) - (a.createdAt || 0)))
                  .map((p: any) => {
                    const replies = Array.isArray(p.replies) ? [...p.replies].sort((a: any, b: any) => a.createdAt - b.createdAt) : []
                    const open = !!expandedReplies[p.id]
                    return (
                    <li key={p.id} className="rounded-xl border border-border bg-card px-3 py-2.5">
                      <button
                        type="button"
                        className="text-left text-[11px] font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                        onClick={() => {
                          if (!p.authorId) return
                          try {
                            window.dispatchEvent(
                              new CustomEvent("ghc:open-profile", {
                                detail: { userId: p.authorId },
                              })
                            )
                          } catch { /* */ }
                        }}
                      >
                        {p.authorName || p.author || "Member"}
                      </button>
                      <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">{p.body || p.excerpt}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {onReactToPost ? (
                          <button
                            type="button"
                            onClick={() => onReactToPost(p.id)}
                            className="min-h-9 rounded-full border border-border px-2.5 text-[11px] font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                            aria-label={`Like discussion, ${p.likes || 0} likes`}
                          >
                            ♥ {p.likes || 0}
                          </button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">♥ {p.likes || 0}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => setExpandedReplies((s) => ({ ...s, [p.id]: !s[p.id] }))}
                          className="min-h-9 rounded-full border border-border px-2.5 text-[11px] font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                        >
                          Replies {p.comments || replies.length || 0}
                        </button>
                        {isMod && onPinPost && !p.pinned ? (
                          <button type="button" onClick={() => onPinPost(p.id)} className="min-h-9 rounded-full border border-border px-2.5 text-[11px] font-bold">
                            Pin
                          </button>
                        ) : null}
                        {isMod && onUnpinPost && p.pinned ? (
                          <button type="button" onClick={() => onUnpinPost(p.id)} className="min-h-9 rounded-full border border-border px-2.5 text-[11px] font-bold">
                            Unpin
                          </button>
                        ) : null}
                        {isMod && onHidePost ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (typeof window !== "undefined" && window.confirm("Hide this discussion from the board?")) {
                                onHidePost(p.id)
                              }
                            }}
                            className="min-h-9 rounded-full border border-destructive/40 px-2.5 text-[11px] font-bold text-destructive"
                          >
                            Hide
                          </button>
                        ) : null}
                      </div>
                      {open ? (
                        <div className="mt-2 space-y-2 border-t border-border/60 pt-2">
                          {replies.length === 0 ? (
                            <p className="text-[11px] text-muted-foreground">No replies yet.</p>
                          ) : (
                            replies.map((r: any) => (
                              <div key={r.id} className="rounded-lg bg-muted/40 px-2 py-1.5">
                                <p className="text-[10px] font-semibold text-foreground">{r.authorName || "Member"}</p>
                                <p className="text-[12px] text-foreground whitespace-pre-wrap">{r.body}</p>
                              </div>
                            ))
                          )}
                          {community.isJoined && onReplyToPost ? (
                            <div className="flex gap-2">
                              <input
                                value={replyDrafts[p.id] || ""}
                                onChange={(e) =>
                                  setReplyDrafts((s) => ({ ...s, [p.id]: e.target.value }))
                                }
                                placeholder="Write a reply…"
                                aria-label="Reply to discussion"
                                className="min-h-10 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm"
                              />
                              <button
                                type="button"
                                disabled={!(replyDrafts[p.id] || "").trim()}
                                onClick={() => {
                                  const body = (replyDrafts[p.id] || "").trim()
                                  if (!body) return
                                  onReplyToPost(p.id, body)
                                  setReplyDrafts((s) => ({ ...s, [p.id]: "" }))
                                }}
                                className="min-h-10 rounded-xl bg-emerald-600 px-3 text-[11px] font-bold text-white disabled:opacity-50"
                              >
                                Reply
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                    )
                  })}
              </ul>
            )}

            {isMod && onUnhidePost ? (
              <section className="mt-4" aria-label="Hidden discussions">
                <h3 className="text-[12px] font-bold text-foreground">Hidden discussions</h3>
                <ul className="mt-2 space-y-1">
                  {((boardPosts as any[]) || [])
                    .filter((p: any) => p.hidden)
                    .map((p: any) => (
                      <li key={p.id} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2">
                        <p className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">
                          {p.body?.slice(0, 80) || p.id}
                        </p>
                        <button
                          type="button"
                          className="min-h-9 rounded-full border border-border px-3 text-[11px] font-bold"
                          onClick={() => onUnhidePost(p.id)}
                        >
                          Unhide
                        </button>
                      </li>
                    ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}

        {tab === "chat" && (
          <div className="space-y-3">
            {!effectiveCanChat ? (
              <div className="rounded-2xl border border-border bg-card p-4 text-center">
                <p className="text-sm font-bold text-foreground">Chat is for members</p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Join to use live chat. You can still preview the Board on public communities.
                </p>
                {onJoin && (
                  <button
                    type="button"
                    onClick={() => onJoin()}
                    className="mt-3 min-h-10 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white"
                  >
                    Join to chat
                  </button>
                )}
              </div>
            ) : null}
            <div className={`rounded-2xl border border-teal-200/70 bg-teal-50/50 p-3 dark:border-teal-900/50 dark:bg-teal-950/30 ${!effectiveCanChat ? "opacity-50 pointer-events-none" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-teal-900 dark:text-teal-100">Community chat</p>
                {community.role && community.role !== "guest" && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${ROLE_BADGE[community.role] || ROLE_BADGE.member}`}>
                    {community.role}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-teal-800/90 dark:text-teal-200/80">
                Realtime conversation for members. Muting chat does <strong>not</strong> leave the community or hide the board.
              </p>
              {(community.chatUnread || 0) > 0 && (
                <p className="mt-1.5 text-[10px] font-bold text-teal-800">
                  {community.chatUnread} unread in chat · Board activity is separate
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setChatMuted((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold ${
                  chatMuted ? "bg-stone-700 text-white" : "bg-muted text-muted-foreground"
                }`}
              >
                <VolumeX size={13} /> {chatMuted ? "Chat muted" : "Mute chat only"}
              </button>
              {isMod && (
                <button
                  type="button"
                  onClick={() => setSlowMode((v) => !v)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold ${
                    slowMode ? "bg-amber-600 text-white" : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Timer size={13} /> {slowMode ? "Slow mode on" : "Slow mode"}
                </button>
              )}
              <button
                type="button"
                onClick={() => onOpenChat?.()}
                className="inline-flex items-center gap-1.5 rounded-full bg-teal-600 px-3 py-1.5 text-[11px] font-bold text-white"
              >
                <MessageCircle size={13} /> Open full chat
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Tools: reply in thread, pin important messages (mods), mute chat only, slow mode for busy rooms.
            </p>
          </div>
        )}

        {tab === "events" && (
          <div className="space-y-4">
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Events and activities are how this community meets offline and online — not just another chat thread.
            </p>
            <p className="text-[11px] text-muted-foreground">{participationHub.summaryLine}</p>
            <section aria-labelledby="community-upcoming-events">
              <h3 id="community-upcoming-events" className="text-[12px] font-bold text-foreground">
                Upcoming
              </h3>
              {upcoming.length === 0 ? (
                <div className="mt-2 rounded-2xl border border-dashed border-border bg-card px-4 py-6 text-center text-xs text-muted-foreground">
                  No upcoming events
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  {upcoming.map((e) => (
                    <EventCard key={e.id} event={e} onAttend={onRsvp ? () => onRsvp(e.id) : undefined} />
                  ))}
                </div>
              )}
            </section>
            <section aria-labelledby="community-past-events">
              <h3 id="community-past-events" className="text-[12px] font-bold text-foreground">
                Past
              </h3>
              {(() => {
                const now = Date.now()
                const past = (events || []).filter((e: any) => {
                  const t = e.startsAt || e.startAt || e.date || 0
                  return Number(t) > 0 && Number(t) < now
                })
                if (past.length === 0) {
                  return (
                    <p className="mt-2 text-[11px] text-muted-foreground">No past events.</p>
                  )
                }
                return (
                  <div className="mt-2 space-y-2 opacity-80">
                    {past.slice(0, 5).map((e: any) => (
                      <EventCard key={e.id} event={e} />
                    ))}
                  </div>
                )
              })()}
            </section>
          </div>
        )}

        {tab === "members" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground">Roles: Owner · Admin · Moderator · Member</p>
              {isMod && onInviteMember ? (
                <button
                  type="button"
                  onClick={() => setInviteOpen((v) => !v)}
                  className="min-h-10 rounded-full border border-teal-200 bg-teal-50 px-3 text-[11px] font-bold text-teal-900 dark:border-teal-900/40 dark:bg-teal-950/40 dark:text-teal-100"
                >
                  {inviteOpen ? "Close invite" : "Invite member"}
                </button>
              ) : null}
            </div>

            {isMod && pendingJoinRequests.length > 0 ? (
              <section aria-label="Pending join requests" className="space-y-2">
                <h3 className="text-[12px] font-bold text-foreground">Pending join requests</h3>
                {pendingJoinRequests.map((uid) => (
                  <div
                    key={uid}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2 dark:border-amber-900/40 dark:bg-amber-950/30"
                  >
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                      {uid === "current-user" ? "You" : uid}
                    </p>
                    <button
                      type="button"
                      onClick={() => onApproveRequest?.(uid)}
                      className="min-h-10 rounded-xl bg-teal-600 px-3 text-[11px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeclineRequest?.(uid)}
                      className="min-h-10 rounded-xl border border-border bg-card px-3 text-[11px] font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    >
                      Decline
                    </button>
                  </div>
                ))}
              </section>
            ) : isMod ? (
              <p className="text-[11px] text-muted-foreground">No pending join requests.</p>
            ) : null}

            {inviteOpen && isMod && onInviteMember ? (
              <section aria-label="Invite a member" className="space-y-2 rounded-2xl border border-border bg-card p-3">
                <h3 className="text-[12px] font-bold text-foreground">Invite someone</h3>
                {inviteCandidates.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    No eligible people to invite right now.
                  </p>
                ) : (
                  inviteCandidates.slice(0, 8).map((c) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{c.name}</p>
                      <button
                        type="button"
                        disabled={inviteBusy === c.id}
                        onClick={async () => {
                          setInviteBusy(c.id)
                          try {
                            await onInviteMember(c.id)
                          } finally {
                            setInviteBusy(null)
                          }
                        }}
                        className="min-h-10 rounded-xl bg-teal-600 px-3 text-[11px] font-bold text-white disabled:opacity-50"
                      >
                        {inviteBusy === c.id ? "…" : "Invite"}
                      </button>
                    </div>
                  ))
                )}
              </section>
            ) : null}

            {membersWithRoles.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                No members to show yet.
              </p>
            ) : (
              membersWithRoles.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2"
                >
                  <div className="h-9 w-9 overflow-hidden rounded-full bg-muted">
                    {m.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.photo} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{m.name}</p>
                    {m.role && (
                      <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${ROLE_BADGE[m.role] || ROLE_BADGE.member}`}>
                        {m.role}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}

            {community.isJoined ? (
              <CommunityPeopleYouMayKnow
                suggestions={peopleSuggestions}
                communityName={community.name}
                blockedUserIds={ghcSession.blockedUsers || []}
                onOpenProfile={(userId) => {
                  try {
                    window.dispatchEvent(
                      new CustomEvent("ghc:open-profile", { detail: { userId } })
                    )
                  } catch {
                    /* */
                  }
                }}
              />
            ) : null}
          </div>
        )}

        {tab === "about" && (
          <div className="space-y-4">
            <section className="rounded-2xl border border-border bg-card p-4">
              <h2 className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Shield size={14} /> About
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {community.description || "No description yet."}
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Privacy: <span className="font-semibold capitalize text-foreground">{community.privacy}</span>
                {community.category ? ` · ${community.category}` : ""}
                {community.region ? ` · ${community.region}` : ""}
              </p>
              {community.region && (
                <p className="mt-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                  Local chapter signal: grounded in {community.region}
                </p>
              )}
            </section>
            <section className="rounded-2xl border border-border bg-card p-4">
              <h2 className="text-xs font-bold text-foreground">Roles that matter</h2>
              <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                <li><strong className="text-foreground">Owner</strong> — full settings, roles, delete community</li>
                <li><strong className="text-foreground">Admin</strong> — settings, roles, removals</li>
                <li><strong className="text-foreground">Moderator</strong> — moderation, announcements, slow mode</li>
                <li><strong className="text-foreground">Member</strong> — post, discuss, chat per rules</li>
              </ul>
            </section>
            <section className="rounded-2xl border border-border bg-card p-4">
              <h2 className="text-xs font-bold text-foreground">Rules</h2>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-[11px] text-muted-foreground">
                {rules.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ol>
            </section>
            {(community as any).stats && (community.role === "owner" || community.role === "admin") && (
              <section className="rounded-2xl border border-border bg-card p-4">
                <h2 className="text-xs font-bold text-foreground">Owner snapshot (aggregate only)</h2>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-muted/50 px-2 py-2">
                    <p className="text-sm font-bold">{(community as any).stats.membersJoinedThisWeek ?? 0}</p>
                    <p className="text-[9px] text-muted-foreground">New members / wk</p>
                  </div>
                  <div className="rounded-xl bg-muted/50 px-2 py-2">
                    <p className="text-sm font-bold">{(community as any).stats.postsThisWeek ?? 0}</p>
                    <p className="text-[9px] text-muted-foreground">Posts / wk</p>
                  </div>
                  <div className="rounded-xl bg-muted/50 px-2 py-2">
                    <p className="text-sm font-bold">{(community as any).stats.activeChatApprox ?? 0}</p>
                    <p className="text-[9px] text-muted-foreground">Active chat ~</p>
                  </div>
                </div>
              </section>
            )}
            {(community as any).inviteCode && community.isJoined && (
              <section className="rounded-2xl border border-border bg-card p-4">
                <h2 className="text-xs font-bold text-foreground">Invite code</h2>
                <p className="mt-1 font-mono text-lg font-bold tracking-widest text-emerald-700">{(community as any).inviteCode}</p>
                <p className="text-[11px] text-muted-foreground">Share for private / invite-only joins</p>
              </section>
            )}
            <section className="rounded-2xl border border-border bg-card p-4" aria-label="Community activity digest">
              <h2 className="text-xs font-bold text-foreground">Activity digest</h2>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Non-financial summary of recent community activity.
              </p>
              {activityDigest.summaryLines.length === 0 ? (
                <p className="mt-2 text-[12px] text-muted-foreground">No activity to summarize yet.</p>
              ) : (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-[12px] text-foreground">
                  {activityDigest.summaryLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-card p-4" aria-label="Community governance">
              <h2 className="text-xs font-bold text-foreground">Community status</h2>
              <p className="mt-1 text-[12px] text-foreground">
                <span className="font-semibold">{lifecycleLabel(lifecycle)}</span>
                {" · "}
                <span className="capitalize text-muted-foreground">{governanceModel.role}</span>
              </p>
              <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                {healthSnapshot.signals.map((s) => (
                  <li key={s}>• {s}</li>
                ))}
              </ul>
              {isMod && onTransitionLifecycle ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {(["active", "quiet", "archived"] as const).map((next) => (
                    <button
                      key={next}
                      type="button"
                      disabled={lifecycle === next}
                      onClick={() => onTransitionLifecycle(next)}
                      className="min-h-9 rounded-full border border-border px-3 text-[11px] font-bold capitalize disabled:opacity-40"
                    >
                      Mark {next}
                    </button>
                  ))}
                </div>
              ) : null}
              {isMod && lifecycleSuggestion.suggested && onTransitionLifecycle ? (
                <div
                  className={`mt-3 rounded-xl border p-3 ${
                    lifecycleSuggestion.severity === "warning"
                      ? "border-amber-300 bg-amber-50/80 dark:border-amber-800 dark:bg-amber-950/30"
                      : "border-emerald-300/60 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20"
                  }`}
                  role="status"
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    Suggested status
                  </p>
                  <p className="mt-1 text-[12px] leading-snug text-foreground">
                    {lifecycleSuggestion.reason}
                  </p>
                  <button
                    type="button"
                    className="mt-2 min-h-9 rounded-full bg-foreground px-3 text-[11px] font-bold text-background"
                    onClick={() => {
                      const next = lifecycleSuggestion.suggested
                      if (!next) return
                      if (
                        typeof window !== "undefined" &&
                        window.confirm(
                          `Mark this community as "${next}"? This never happens automatically.`
                        )
                      ) {
                        onTransitionLifecycle(next)
                      }
                    }}
                  >
                    Mark as {lifecycleSuggestion.suggested}
                  </button>
                </div>
              ) : null}
            </section>

            {isMod && adminHealth ? (
              <section className="rounded-2xl border border-border bg-card p-4" aria-label="Admin health analytics">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-xs font-bold text-foreground">Community health</h2>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      Non-financial engagement signals for moderators only.
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                      adminHealth.grade === "healthy"
                        ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100"
                        : adminHealth.grade === "needs_attention"
                          ? "bg-amber-100 text-amber-900 dark:bg-amber-900/40"
                          : adminHealth.grade === "quiet"
                            ? "bg-muted text-muted-foreground"
                            : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {adminHealth.gradeLabel}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-muted/50 px-2 py-2">
                    <p className="text-sm font-bold text-foreground">{adminHealth.engagementScore}</p>
                    <p className="text-[9px] font-semibold text-muted-foreground">Engagement</p>
                  </div>
                  <div className="rounded-xl bg-muted/50 px-2 py-2">
                    <p className="text-sm font-bold text-foreground">{adminHealth.unansweredCount}</p>
                    <p className="text-[9px] font-semibold text-muted-foreground">Unanswered</p>
                  </div>
                  <div className="rounded-xl bg-muted/50 px-2 py-2">
                    <p className="text-sm font-bold text-foreground">{adminHealth.openReportCount}</p>
                    <p className="text-[9px] font-semibold text-muted-foreground">Open reports</p>
                  </div>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <div>Members: <span className="font-semibold text-foreground">{adminHealth.memberCount}</span></div>
                  <div>Discussions: <span className="font-semibold text-foreground">{adminHealth.discussionCount}</span></div>
                  <div>Events: <span className="font-semibold text-foreground">{adminHealth.upcomingEventCount}</span></div>
                  <div>Resources: <span className="font-semibold text-foreground">{adminHealth.resourceCount}</span></div>
                  <div className="col-span-2">
                    Last activity:{" "}
                    <span className="font-semibold text-foreground">
                      {adminHealth.daysSinceLastActivity === null
                        ? "—"
                        : adminHealth.daysSinceLastActivity === 0
                          ? "Today"
                          : `${adminHealth.daysSinceLastActivity}d ago`}
                    </span>
                  </div>
                </dl>
                {adminHealth.recommendations.length > 0 ? (
                  <ul className="mt-2 space-y-1 rounded-xl border border-border/80 bg-muted/30 p-2.5 text-[11px] text-foreground">
                    {adminHealth.recommendations.map((r) => (
                      <li key={r}>• {r}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ) : null}

            {isMod ? (
              <section className="rounded-2xl border border-border bg-card p-4" aria-label="Safety queue">
                <h2 className="text-xs font-bold text-foreground">Safety queue</h2>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Review reports. Session-scoped until durable audit is enabled.
                </p>
                {openReports.length === 0 ? (
                  <p className="mt-2 text-[12px] text-muted-foreground">No open reports.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {openReports.map((r) => (
                      <li key={r.id} className="rounded-xl border border-border bg-muted/30 p-2.5">
                        <p className="text-[12px] font-semibold text-foreground capitalize">
                          {r.targetType} · {r.reason}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Target {r.targetId.slice(0, 16)} · {new Date(r.createdAt).toLocaleString()}
                        </p>
                        {r.note ? (
                          <p className="mt-1 text-[11px] text-muted-foreground">{r.note}</p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="min-h-9 rounded-full border border-border px-3 text-[11px] font-bold"
                            onClick={() => {
                              resolveCommunityReport(
                                community.id,
                                r.id,
                                "reviewing",
                                IdentityService.getCurrentUserId() || "mod"
                              )
                              setSafetyTick((t) => t + 1)
                            }}
                          >
                            Reviewing
                          </button>
                          <button
                            type="button"
                            className="min-h-9 rounded-full bg-emerald-600 px-3 text-[11px] font-bold text-white"
                            onClick={() => {
                              resolveCommunityReport(
                                community.id,
                                r.id,
                                "resolved",
                                IdentityService.getCurrentUserId() || "mod"
                              )
                              setSafetyTick((t) => t + 1)
                            }}
                          >
                            Resolve
                          </button>
                          <button
                            type="button"
                            className="min-h-9 rounded-full border border-border px-3 text-[11px] font-bold text-muted-foreground"
                            onClick={() => {
                              resolveCommunityReport(
                                community.id,
                                r.id,
                                "dismissed",
                                IdentityService.getCurrentUserId() || "mod"
                              )
                              setSafetyTick((t) => t + 1)
                            }}
                          >
                            Dismiss
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {allReports.filter((r) => r.status !== "open").length > 0 ? (
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    {allReports.filter((r) => r.status !== "open").length} closed in this session
                  </p>
                ) : null}
              </section>
            ) : null}

            {isMod ? (
              <section className="rounded-2xl border border-border bg-card p-4" aria-label="Moderation log">
                <h2 className="text-xs font-bold text-foreground">Moderation log</h2>
                <p className="mt-1 text-[10px] text-muted-foreground">{governanceDurabilityLabel()}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Session audit trail (not multi-device durable yet).
                </p>
                {moderationLog.length === 0 ? (
                  <p className="mt-2 text-[12px] text-muted-foreground">No moderation actions yet.</p>
                ) : (
                  <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-[11px]">
                    {moderationLog.slice(0, 20).map((e) => (
                      <li key={e.id} className="rounded-lg bg-muted/40 px-2 py-1">
                        <span className="font-semibold capitalize">{e.action}</span>
                        {" · "}
                        {e.targetType} {e.targetId.slice(0, 12)}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ) : null}

            {onReportCommunity ? (
              <section className="rounded-2xl border border-border bg-card p-4" aria-label="Report community">
                <h2 className="text-xs font-bold text-foreground">Safety</h2>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Report content or this community if it violates GreenHaven guidelines. Reports go to moderators.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(
                    [
                      ["spam", "Spam"],
                      ["harassment", "Harassment"],
                      ["safety", "Safety"],
                      ["misinformation", "Misinfo"],
                      ["other", "Other"],
                    ] as const
                  ).map(([reason, label]) => (
                    <button
                      key={reason}
                      type="button"
                      className="min-h-9 rounded-full border border-destructive/30 px-3 text-[11px] font-bold text-destructive"
                      onClick={() => {
                        if (
                          typeof window !== "undefined" &&
                          window.confirm(`Submit a ${label.toLowerCase()} report for this community?`)
                        ) {
                          onReportCommunity({
                            targetType: "community",
                            targetId: community.id,
                            reason,
                          })
                          setSafetyTick((t) => t + 1)
                        }
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}


                        {Array.isArray((community as any).resources) && (community as any).resources.length > 0 ? (
              <section className="rounded-2xl border border-border bg-card p-4" aria-label="Community knowledge hub">
                <h2 className="text-xs font-bold text-foreground">Knowledge hub</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Pinned guides, links, and materials for members.</p>
                <div className="mt-2 space-y-2">
                  {((community as any).resources as any[]).slice(0, 8).map((r) => (
                    <PinnedResourceCard key={r.id || r.title} resource={r} />
                  ))}
                </div>
              </section>
            ) : community.isJoined ? (
              <p className="text-[11px] text-muted-foreground">No pinned resources yet.</p>
            ) : null}

            {Array.isArray((community as any).activities) && (community as any).activities.length > 0 ? (
              <section className="rounded-2xl border border-border bg-card p-4" aria-label="Community activities">
                <h2 className="text-xs font-bold text-foreground">Activities</h2>
                <ul className="mt-2 space-y-1.5">
                  {((community as any).activities as any[]).slice(0, 6).map((a) => (
                    <li key={a.id || a.title} className="rounded-xl border border-border px-3 py-2 text-[12px] font-medium text-foreground">
                      {a.title || a.name || "Activity"}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

                        <div className="flex flex-col gap-2">
              {onMute && community.isJoined && (
                <button
                  type="button"
                  onClick={onMute}
                  className="min-h-10 rounded-xl border border-border text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  aria-pressed={!!(community as any).isMuted}
                >
                  {(community as any).isMuted ? "Unmute community" : "Mute community"}
                </button>
              )}
              {onLeave && community.isJoined && community.role !== "owner" && (
                <button type="button" onClick={onLeave} className="min-h-10 rounded-xl border border-destructive/40 text-xs font-bold text-destructive">
                  Leave community
                </button>
              )}
              <button type="button" className="min-h-10 text-xs font-semibold text-muted-foreground">
                Report community
              </button>
            </div>
            {isMod && (
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-2.5 text-xs font-bold text-foreground"
              >
                <Settings2 size={14} />
                Moderation tools
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
