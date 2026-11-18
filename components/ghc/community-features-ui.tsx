"use client"

import { useState } from "react"
import { Bell, Calendar, CheckCircle2, ChevronRight, Clock, FileText, Heart, MapPin, MessageSquare, Pin, Share2, ThumbsUp, Trash2, Users, X } from "lucide-react"
import type {
  Announcement,
  Poll,
  ScheduledEvent,
  PinnedResource,
  CommunityGuideline,
  WelcomeMessage,
} from "@/lib/community-features-engine"
import { formatEventDate, getUpcomingEvents, getActivePolls } from "@/lib/community-features-engine"
import { safeCommunityResourceUrl } from "@/lib/domains/adapters/community-participation-hub"
import { safeCommunityCount, safeCommunityCountTotal } from "@/lib/active-upgrades/community"

// Announcements Component
export function AnnouncementCard({ announcement, onDismiss }: { announcement: Announcement; onDismiss?: () => void }) {
  const type = ["info", "important", "celebration", "maintenance"].includes(announcement.type) ? announcement.type : "info"
  const typeLabels = { info: "Update", important: "Important", celebration: "Celebration", maintenance: "Maintenance" }
  const createdAt = Number.isFinite(Number(announcement.createdAt)) && Number(announcement.createdAt) > 0 ? new Date(Number(announcement.createdAt)) : null
  const typeStyles = {
    info: "border-border/70 bg-card text-foreground",
    important: "border-amber-300/70 bg-amber-50/60 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100",
    celebration: "border-violet-200/70 bg-violet-50/50 text-violet-950 dark:border-violet-900/50 dark:bg-violet-950/15 dark:text-violet-100",
    maintenance: "border-slate-300/70 bg-slate-50/70 text-slate-900 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-100",
  }
  return (
    <article className={`rounded-2xl border p-3.5 shadow-[var(--gh-card-shadow)] ${typeStyles[type]}`} aria-label={`${typeLabels[type]} announcement`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background/80 text-muted-foreground ring-1 ring-border/60" aria-hidden="true">
          {announcement.pinned ? <Pin size={16} /> : <Bell size={16} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{typeLabels[type]}</span>
            {announcement.pinned ? <span className="inline-flex items-center gap-1 rounded-full bg-background/80 px-2 py-0.5 text-[9px] font-semibold text-muted-foreground ring-1 ring-border/60"><Pin size={10} /> Pinned</span> : null}
            {createdAt && Number.isFinite(createdAt.getTime()) ? (
              <time className="ml-auto text-[10px] text-muted-foreground" dateTime={createdAt.toISOString()}>{new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(createdAt)}</time>
            ) : null}
          </div>
          <h3 className="mt-1 text-[13px] font-bold leading-5">{announcement.title}</h3>
          <p className="mt-1 whitespace-pre-wrap break-words text-[12px] leading-[1.6] text-current/80">{announcement.content}</p>
        </div>
        {onDismiss ? (
          <button type="button" onClick={onDismiss} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-background/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50" aria-label="Dismiss announcement">
            <X size={15} />
          </button>
        ) : null}
      </div>
    </article>
  )
}

// Polls Component
export function PollCard({
  poll,
  onVote,
  userVoted,
}: {
  poll: Poll
  onVote?: (optionId: string) => void
  userVoted?: string[]
}) {
  const options = Array.isArray(poll.options)
    ? poll.options.filter((option) => option && typeof option.id === "string" && option.id.length <= 120 && typeof option.text === "string").slice(0, 20)
    : []
  const totalVotes = safeCommunityCountTotal(options.map((option) => option.votes))
  const status = typeof poll.status === "string" && poll.status.length <= 40 ? poll.status : "unavailable"
  const isActive = status === "active" && typeof onVote === "function"

  return (
    <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-4 border border-blue-200">
      <div className="flex items-start gap-2 mb-3">
        <div className="text-lg">📊</div>
        <div className="flex-1">
          <h3 className="font-semibold text-sm text-foreground">{poll.question}</h3>
          <p className="text-xs text-muted-foreground mt-0.5" aria-live="polite">{totalVotes.toLocaleString()} votes</p>
        </div>
      </div>

      <div className="space-y-2">
        {options.map((option) => {
          const safeVotes = safeCommunityCount(option.votes)
          const percentage = totalVotes > 0 ? Math.min(100, Math.max(0, (safeVotes / totalVotes) * 100)) : 0
          const userVotedThis = userVoted?.includes(option.id) === true

          return (
            <button
              key={option.id}
              onClick={() => isActive && onVote?.(option.id)}
              disabled={!isActive}
              aria-pressed={userVotedThis}
              aria-label={`${option.text}, ${safeVotes} votes, ${Math.round(percentage)} percent${userVotedThis ? ", selected" : ""}`}
              className={`w-full text-left p-2 rounded-lg border transition ${
                userVotedThis
                  ? "bg-blue-100 border-blue-400"
                  : "bg-white border-border/70 hover:border-blue-300 disabled:opacity-60"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{option.text}</p>
                  <div className="w-full bg-muted rounded-full h-2 mt-1 overflow-hidden">
                    <div
                      role="progressbar"
                      aria-label={`${option.text} vote share`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(percentage)}
                      className={`h-full transition-all ${userVotedThis ? "bg-[var(--gh-green)]" : "bg-emerald-300 dark:bg-emerald-800"}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs font-semibold text-muted-foreground flex-shrink-0 w-8 text-right">
                  {safeVotes}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {!isActive && (
        <p className="text-xs text-muted-foreground mt-3 text-center">Poll is {status}</p>
      )}
    </div>
  )
}

// Events Component
export function EventCard({ event, onAttend }: { event: ScheduledEvent; onAttend?: (attending: boolean) => void }) {
  const [isAttending, setIsAttending] = useState(false)
  const safeVirtualLink = safeCommunityResourceUrl(event.virtualLink)

  const handleAttend = () => {
    setIsAttending(!isAttending)
    onAttend?.(!isAttending)
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-base dark:bg-emerald-950/40" aria-hidden>
            📅
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-foreground">{event.title}</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{formatEventDate(event)}</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold capitalize text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100">
          {event.status}
        </span>
      </div>

      {event.description ? (
        <p className="mb-3 text-[13px] leading-relaxed text-muted-foreground">{event.description}</p>
      ) : null}

      <div className="space-y-1 text-xs text-muted-foreground mb-3">
        {event.location && (
          <div className="flex items-center gap-2">
            <MapPin size={14} />
            <span>{event.location}</span>
          </div>
        )}
        {safeVirtualLink && (
          <div className="flex items-center gap-2">
            <Users size={14} />
            <a
              href={safeVirtualLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Join Virtual Meeting
            </a>
          </div>
        )}
        {event.attendees && (
          <div className="flex items-center gap-2">
            <Users size={14} />
            <span>{event.attendees.length} attending</span>
          </div>
        )}
      </div>

      <button
        onClick={handleAttend}
        className={`min-h-10 w-full rounded-xl px-3 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
          isAttending
            ? "bg-emerald-600 text-white hover:bg-emerald-700"
            : "border border-emerald-300 bg-background text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300"
        }`}
      >
        {isAttending ? "✓ Attending" : "Attend"}
      </button>
    </div>
  )
}

// Pinned Resources Component
export function PinnedResourceCard({ resource, onRemove }: { resource: PinnedResource; onRemove?: () => void }) {
  const safeResourceUrl = safeCommunityResourceUrl(resource.url)
  const resourceIcons = {
    document: "📄",
    link: "🔗",
    guide: "📖",
    template: "📋",
    media: "🎬",
  }

  return (
    <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-lg" aria-hidden>
        {resourceIcons[resource.resourceType as keyof typeof resourceIcons] || "📌"}
      </span>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm text-foreground">{resource.title}</h3>
        <p className="text-xs text-muted-foreground mt-1">{resource.description}</p>
        {safeResourceUrl && (
          <a
            href={safeResourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline mt-1 block"
          >
            Open Resource →
          </a>
        )}
      </div>
      {onRemove && (
        <button
          onClick={onRemove}
          className="p-1 hover:bg-amber-200 rounded transition flex-shrink-0"
          aria-label="Remove"
        >
          <X size={16} className="text-amber-700" />
        </button>
      )}
    </div>
  )
}

// Welcome Message Component
export function WelcomeMessageBanner({ message }: { message: WelcomeMessage }) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg p-4 border border-indigo-200 flex gap-3">
      <div className="text-2xl flex-shrink-0">👋</div>
      <div className="flex-1">
        <h2 className="font-semibold text-sm text-indigo-900 mb-2">Welcome to this group!</h2>
        <p className="text-sm text-indigo-800">{message.content}</p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 hover:bg-indigo-200 rounded transition flex-shrink-0"
        aria-label="Dismiss"
      >
        <X size={16} className="text-indigo-600" />
      </button>
    </div>
  )
}

// Community Guidelines Component
export function GuidelinesCard({ guideline }: { guideline: CommunityGuideline }) {
  const categoryIcons = {
    behavior: "👥",
    content: "📝",
    technical: "⚙️",
    general: "📌",
  }

  const categoryColors = {
    behavior: "text-purple-700 bg-purple-50",
    content: "text-blue-700 bg-blue-50",
    technical: "text-orange-700 bg-orange-50",
    general: "text-foreground/90 bg-muted/40",
  }

  const priorityLabel = { 1: "Critical", 2: "Important", 3: "Nice to Know" }
  const priorityColors = {
    1: "text-red-700 bg-red-50",
    2: "text-amber-700 bg-amber-50",
    3: "text-green-700 bg-green-50",
  }

  return (
    <div className={`rounded-lg p-3 border ${categoryColors[guideline.category]}`}>
      <div className="flex items-start gap-2 mb-2">
        <span className="text-lg flex-shrink-0">{categoryIcons[guideline.category]}</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">{guideline.title}</h3>
        </div>
      </div>
      <p className="text-sm opacity-80 mb-2">{guideline.content}</p>
      <span className={`inline-block text-xs font-semibold px-2 py-1 rounded ${priorityColors[guideline.priority]}`}>
        {priorityLabel[guideline.priority]}
      </span>
    </div>
  )
}

// Upcoming Events Summary
export function UpcomingEventsSummary({ events }: { events: ScheduledEvent[] }) {
  const upcoming = getUpcomingEvents(events, 3)

  if (upcoming.length === 0) return null

  return (
    <div className="bg-white rounded-lg border border-border/70 p-4">
      <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
        <Calendar size={16} />
        Upcoming Events
      </h3>
      <div className="space-y-2">
        {upcoming.map((event) => (
          <div key={event.id} className="flex items-start gap-2 text-sm">
            <span className="text-xs text-muted-foreground min-w-fit">
              {new Date(event.startsAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{event.title}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(event.startsAt).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <ChevronRight size={14} className="text-muted-foreground flex-shrink-0 mt-0.5" />
          </div>
        ))}
      </div>
    </div>
  )
}

// Active Polls Summary
export function ActivePollsSummary({ polls }: { polls: Poll[] }) {
  const active = getActivePolls(polls)

  if (active.length === 0) return null

  return (
    <div className="bg-white rounded-lg border border-border/70 p-4">
      <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
        <MessageSquare size={16} />
        Active Polls
      </h3>
      <div className="space-y-2">
        {active.slice(0, 3).map((poll) => (
          <div key={poll.id} className="flex items-start gap-2 text-sm">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{poll.question}</p>
              <p className="text-xs text-muted-foreground">
                {poll.options.reduce((sum, opt) => sum + opt.votes, 0)} votes
              </p>
            </div>
            <ChevronRight size={14} className="text-muted-foreground flex-shrink-0 mt-0.5" />
          </div>
        ))}
      </div>
    </div>
  )
}

// Community Stats
export function CommunityStats({
  memberCount,
  activeNow,
  lastWeekPosts,
}: {
  memberCount: number
  activeNow: number
  lastWeekPosts: number
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-3 border border-blue-200">
        <div className="text-2xl font-bold text-blue-600">{memberCount}</div>
        <div className="text-xs text-muted-foreground mt-1">Members</div>
      </div>
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-3 border border-green-200">
        <div className="text-2xl font-bold text-green-600">{activeNow}</div>
        <div className="text-xs text-muted-foreground mt-1">Active Now</div>
      </div>
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg p-3 border border-emerald-200">
        <div className="text-2xl font-bold text-emerald-700">{lastWeekPosts}</div>
        <div className="text-xs text-muted-foreground mt-1">Posts This Week</div>
      </div>
    </div>
  )
}
