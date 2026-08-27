"use client"

import { useState } from "react"
import { Bell, Calendar, CheckCircle2, ChevronRight, Clock, FileText, Heart, MapPin, MessageSquare, Share2, ThumbsUp, Trash2, Users, X } from "lucide-react"
import type {
  Announcement,
  Poll,
  ScheduledEvent,
  PinnedResource,
  CommunityGuideline,
  WelcomeMessage,
} from "@/lib/community-features-engine"
import { formatEventDate, getUpcomingEvents, getActivePolls } from "@/lib/community-features-engine"

// Announcements Component
export function AnnouncementCard({ announcement, onDismiss }: { announcement: Announcement; onDismiss?: () => void }) {
  const typeStyles = {
    info: "bg-blue-50 border-blue-200 text-blue-900",
    important: "bg-red-50 border-red-200 text-red-900",
    celebration: "bg-purple-50 border-purple-200 text-purple-900",
    maintenance: "bg-yellow-50 border-yellow-200 text-yellow-900",
  }

  const typeIcons = {
    info: "ℹ️",
    important: "⚠️",
    celebration: "🎉",
    maintenance: "🔧",
  }

  return (
    <div className={`border rounded-lg p-4 flex gap-3 ${typeStyles[announcement.type]}`}>
      <div className="text-xl flex-shrink-0">{typeIcons[announcement.type]}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">{announcement.title}</h3>
            <p className="text-sm mt-1 opacity-80">{announcement.content}</p>
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1 hover:bg-black hover:bg-opacity-10 rounded transition flex-shrink-0"
              aria-label="Dismiss"
            >
              <X size={16} />
            </button>
          )}
        </div>
        {announcement.pinned && (
          <div className="text-xs font-semibold mt-2 opacity-70">📌 Pinned</div>
        )}
      </div>
    </div>
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
  const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0)
  const isActive = poll.status === "active"

  return (
    <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-4 border border-blue-200">
      <div className="flex items-start gap-2 mb-3">
        <div className="text-lg">📊</div>
        <div className="flex-1">
          <h3 className="font-semibold text-sm text-gray-900">{poll.question}</h3>
          <p className="text-xs text-gray-600 mt-0.5">{totalVotes} votes</p>
        </div>
      </div>

      <div className="space-y-2">
        {poll.options.map((option) => {
          const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0
          const userVotedThis = userVoted?.includes(option.id)

          return (
            <button
              key={option.id}
              onClick={() => isActive && onVote?.(option.id)}
              disabled={!isActive}
              className={`w-full text-left p-2 rounded-lg border transition ${
                userVotedThis
                  ? "bg-blue-100 border-blue-400"
                  : "bg-white border-gray-200 hover:border-blue-300 disabled:opacity-60"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{option.text}</p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1 overflow-hidden">
                    <div
                      className={`h-full transition-all ${userVotedThis ? "bg-blue-500" : "bg-blue-300"}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs font-semibold text-gray-600 flex-shrink-0 w-8 text-right">
                  {option.votes}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {!isActive && (
        <p className="text-xs text-gray-600 mt-3 text-center">Poll is {poll.status}</p>
      )}
    </div>
  )
}

// Events Component
export function EventCard({ event, onAttend }: { event: ScheduledEvent; onAttend?: (attending: boolean) => void }) {
  const [isAttending, setIsAttending] = useState(false)

  const handleAttend = () => {
    setIsAttending(!isAttending)
    onAttend?.(!isAttending)
  }

  return (
    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <div className="text-lg flex-shrink-0">📅</div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-gray-900">{event.title}</h3>
            <p className="text-xs text-gray-600 mt-1">{formatEventDate(event)}</p>
          </div>
        </div>
        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-200 text-green-800 flex-shrink-0">
          {event.status}
        </span>
      </div>

      <p className="text-sm text-gray-700 mb-3">{event.description}</p>

      <div className="space-y-1 text-xs text-gray-600 mb-3">
        {event.location && (
          <div className="flex items-center gap-2">
            <MapPin size={14} />
            <span>{event.location}</span>
          </div>
        )}
        {event.virtualLink && (
          <div className="flex items-center gap-2">
            <Users size={14} />
            <a
              href={event.virtualLink}
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
        className={`w-full px-3 py-2 rounded-lg font-semibold text-sm transition ${
          isAttending
            ? "bg-green-600 text-white hover:bg-green-700"
            : "bg-white text-green-600 border border-green-300 hover:bg-green-50"
        }`}
      >
        {isAttending ? "✓ Attending" : "Attend Event"}
      </button>
    </div>
  )
}

// Pinned Resources Component
export function PinnedResourceCard({ resource, onRemove }: { resource: PinnedResource; onRemove?: () => void }) {
  const resourceIcons = {
    document: "📄",
    link: "🔗",
    guide: "📖",
    template: "📋",
    media: "🎬",
  }

  return (
    <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 flex items-start gap-3">
      <span className="text-lg flex-shrink-0">{resourceIcons[resource.resourceType]}</span>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm text-gray-900">{resource.title}</h3>
        <p className="text-xs text-gray-600 mt-1">{resource.description}</p>
        {resource.url && (
          <a
            href={resource.url}
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
    general: "text-gray-700 bg-gray-50",
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
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="font-semibold text-sm text-gray-900 mb-3 flex items-center gap-2">
        <Calendar size={16} />
        Upcoming Events
      </h3>
      <div className="space-y-2">
        {upcoming.map((event) => (
          <div key={event.id} className="flex items-start gap-2 text-sm">
            <span className="text-xs text-gray-500 min-w-fit">
              {new Date(event.startsAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{event.title}</p>
              <p className="text-xs text-gray-600">
                {new Date(event.startsAt).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <ChevronRight size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
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
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="font-semibold text-sm text-gray-900 mb-3 flex items-center gap-2">
        <MessageSquare size={16} />
        Active Polls
      </h3>
      <div className="space-y-2">
        {active.slice(0, 3).map((poll) => (
          <div key={poll.id} className="flex items-start gap-2 text-sm">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{poll.question}</p>
              <p className="text-xs text-gray-600">
                {poll.options.reduce((sum, opt) => sum + opt.votes, 0)} votes
              </p>
            </div>
            <ChevronRight size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
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
        <div className="text-xs text-gray-600 mt-1">Members</div>
      </div>
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-3 border border-green-200">
        <div className="text-2xl font-bold text-green-600">{activeNow}</div>
        <div className="text-xs text-gray-600 mt-1">Active Now</div>
      </div>
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-3 border border-purple-200">
        <div className="text-2xl font-bold text-purple-600">{lastWeekPosts}</div>
        <div className="text-xs text-gray-600 mt-1">Posts This Week</div>
      </div>
    </div>
  )
}
