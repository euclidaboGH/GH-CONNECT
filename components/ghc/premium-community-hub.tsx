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
  onCreateEvent,
  onRsvp,
  onApproveRequest,
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
  onCreateEvent?: (input: { title: string; startsAt: number; location?: string; isOnline?: boolean }) => void
  onRsvp?: (eventId: string) => void
  onApproveRequest?: (userId: string) => void
  announcements?: Announcement[]
  polls?: Poll[]
  events?: ScheduledEvent[] | any[]
  boardPosts?: any[]
  memberPreview?: { id: string; name: string; photo?: string; role?: string }[]
  canChat?: boolean
  role?: string
}) {
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

  const membersWithRoles =
    memberPreview.length > 0
      ? memberPreview
      : [
          { id: "owner-1", name: "Alex Owner", role: "owner" },
          { id: "mod-1", name: "Sam Mod", role: "moderator" },
          { id: "mem-1", name: "Jordan", role: "member" },
          { id: "mem-2", name: "Riley", role: "member" },
        ]

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
            <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/50 px-3 py-2.5 dark:border-emerald-900/50 dark:bg-emerald-950/30">
              <p className="text-[11px] font-semibold text-emerald-900 dark:text-emerald-100">Board ≠ Chat</p>
              <p className="mt-0.5 text-[11px] text-emerald-800/85 dark:text-emerald-200/80">
                <strong>Board</strong> holds announcements, discussion, polls and events.{" "}
                <strong>Chat</strong> is realtime member conversation — a tool inside this place, not the whole community.
              </p>
            </div>

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
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">
              Announcements are typically <strong>admin / moderator</strong> only.
            </p>
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
          <div className="rounded-2xl border border-border bg-card px-4 py-8 text-center">
            <Pin size={22} className="mx-auto text-emerald-500" />
            <p className="mt-2 text-sm font-semibold text-foreground">Discussion</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Community posts and threaded conversation live here — not the same as realtime chat.
            </p>
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
          <div className="space-y-2">
            {upcoming.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-8 text-center text-xs text-muted-foreground">
                No upcoming events
              </div>
            ) : (
              upcoming.map((e) => <EventCard key={e.id} event={e} />)
            )}
          </div>
        )}

        {tab === "members" && (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">Roles: Owner · Admin · Moderator · Member</p>
            {membersWithRoles.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                {community.memberCount} members · roster loads with membership
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
            <div className="flex flex-col gap-2">
              {onMute && community.isJoined && (
                <button type="button" onClick={onMute} className="min-h-10 rounded-xl border border-border text-xs font-bold">
                  Mute community
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
