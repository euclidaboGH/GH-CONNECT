"use client"

/**
 * Community list card — Board vs Chat clarity, local chapters, sample honesty.
 */

import { useState, useEffect, memo } from "react"
import { Users, MessageSquare, LayoutGrid, ChevronRight } from "lucide-react"
import { LazyImage } from "./lazy-image"

interface GroupCardProps {
  id: string
  groupName: string
  lastSenderName: string
  lastMessage: string
  lastMessageTime: number
  memberCount: number
  onlineCount: number
  unreadCount?: number
  boardUnread?: number
  chatUnread?: number
  isPinned?: boolean
  isMuted?: boolean
  isTyping?: boolean
  groupAvatar?: string
  coverImage?: string
  category?: string
  isJoined?: boolean
  onClick: () => void
  onToggleMute?: () => void
  onTogglePin?: () => void
  onJoin?: () => void
  memberAvatars?: Array<{ id: string; name: string; photo?: string }>
  onMemberProfile?: (memberId: string) => void
  region?: string
  role?: "owner" | "admin" | "moderator" | "member" | "guest"
  isSample?: boolean
}

function GroupCardContent({
  groupName,
  lastMessage,
  lastMessageTime,
  memberCount,
  onlineCount,
  unreadCount = 0,
  boardUnread = 0,
  chatUnread = 0,
  isPinned = false,
  isMuted = false,
  groupAvatar,
  coverImage,
  category = "community",
  isJoined = true,
  onClick,
  onJoin,
  region,
  role,
  isSample = false,
}: GroupCardProps) {
  const [timeAgo, setTimeAgo] = useState("")

  useEffect(() => {
    const calculateTimeAgo = () => {
      const now = Date.now()
      const diffMs = now - lastMessageTime
      const diffMins = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMs / 3600000)
      const diffDays = Math.floor(diffMs / 86400000)
      if (diffMins < 1) return "now"
      if (diffMins < 60) return `${diffMins}m`
      if (diffHours < 24) return `${diffHours}h`
      if (diffDays < 7) return `${diffDays}d`
      return new Date(lastMessageTime).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    }
    setTimeAgo(calculateTimeAgo())
    const interval = setInterval(() => setTimeAgo(calculateTimeAgo()), 60000)
    return () => clearInterval(interval)
  }, [lastMessageTime])

  const initial =
    groupName && groupName.length > 0 ? groupName.charAt(0).toUpperCase() : "?"

  const chatUnreadResolved =
    chatUnread > 0 ? chatUnread : boardUnread === 0 ? unreadCount : 0

  return (
    <div
      onClick={onClick}
      className="relative"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick()
        }
      }}
      aria-label={`Open community ${groupName}, ${memberCount} members. Board and chat are separate.`}
    >
      <article className="flex gap-3 rounded-[1.25rem] border border-border/60 bg-card p-3.5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] transition hover:border-emerald-400/40 hover:shadow-[0_8px_24px_rgba(16,185,129,0.12)] active:scale-[0.995] dark:shadow-[0_2px_12px_rgba(0,0,0,0.25)]">
        {isPinned && (
          <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-emerald-600" aria-hidden />
        )}

        {isSample && (
          <span className="absolute right-2 top-2 z-10 rounded-md bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm">
            Sample
          </span>
        )}

        {/* 64px cover */}
        <div className="relative h-[4.25rem] w-[4.25rem] shrink-0 overflow-hidden rounded-[1.1rem] bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 text-lg font-bold text-white shadow-md ring-2 ring-emerald-500/15">
          {coverImage || groupAvatar ? (
            <LazyImage
              src={coverImage || groupAvatar || ""}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center">{initial}</span>
          )}
          {onlineCount > 0 && (
            <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-400" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold leading-tight text-foreground">
                {groupName}
              </h3>
              {region && region !== "Global" ? (
                <p className="mt-0.5 truncate text-[12px] font-semibold text-sky-800 dark:text-sky-200">
                  {region}
                  {category ? ` · ${category}` : ""}
                </p>
              ) : category ? (
                <p className="mt-0.5 truncate text-[12px] text-muted-foreground capitalize">
                  {category}
                </p>
              ) : null}
              <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] text-muted-foreground">
                <span className="inline-flex items-center gap-0.5">
                  <Users size={12} aria-hidden />
                  {memberCount.toLocaleString()} members
                </span>
                <span aria-hidden>·</span>
                <span>{timeAgo || "—"}</span>
                {role && role !== "guest" && role !== "member" && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="font-semibold capitalize text-emerald-700 dark:text-emerald-400">
                      {role}
                    </span>
                  </>
                )}
              </p>
            </div>
            <ChevronRight size={18} className="mt-0.5 shrink-0 text-muted-foreground/60" aria-hidden />
          </div>

          <p className="mt-1 line-clamp-1 text-[12px] text-muted-foreground">
            {lastMessage || "Posts, events, and member chat"}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {isJoined && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50/80 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                Joined
              </span>
            )}
            {/* Board unread — blue */}
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                boardUnread > 0
                  ? "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <LayoutGrid size={11} aria-hidden />
              Board
              {boardUnread > 0 && (
                <span className="tabular-nums">{boardUnread > 99 ? "99+" : boardUnread}</span>
              )}
            </span>
            {/* Chat unread — green */}
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                chatUnreadResolved > 0
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <MessageSquare size={11} aria-hidden />
              Chat
              {chatUnreadResolved > 0 && (
                <span className="tabular-nums">
                  {chatUnreadResolved > 99 ? "99+" : chatUnreadResolved}
                </span>
              )}
            </span>
            {isMuted && (
              <span className="text-[10px] font-medium text-muted-foreground">Muted</span>
            )}
            {!isJoined && onJoin && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onJoin()
                }}
                className="ml-auto min-h-9 rounded-full bg-emerald-600 px-3 text-[11px] font-bold text-white"
              >
                Preview & join
              </button>
            )}
          </div>
        </div>
      </article>
    </div>
  )
}

export const GroupCard = memo(GroupCardContent)
export default GroupCard
