"use client"

/**
 * Community directory card — one semantic open action, with independent join
 * and invitation controls. The card must never nest interactive controls.
 */

import { useState, memo } from "react"
import { Users, MessageSquare, LayoutGrid, ChevronRight } from "lucide-react"
import { LazyImage } from "./lazy-image"
import { formatCommunityRole, communityRoleBadgeClass } from "@/lib/community/role-labels"

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
  /** Privacy-aware CTA — Join vs Request to join */
  joinLabel?: string
  membershipStatus?: "pending" | "invited"
  onAcceptInvite?: () => Promise<boolean>
  onDeclineInvite?: () => Promise<boolean>
  memberAvatars?: Array<{ id: string; name: string; photo?: string }>
  onMemberProfile?: (memberId: string) => void
  region?: string
  role?: "owner" | "admin" | "moderator" | "member" | "guest"
  isSample?: boolean
}

function formatActivityTime(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "No recent activity"
  const diff = Date.now() - value
  if (diff < 60_000) return "Just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function GroupCardContent({
  id,
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
  joinLabel = "Preview & join",
  membershipStatus,
  onAcceptInvite,
  onDeclineInvite,
  region,
  role,
  isSample = false,
}: GroupCardProps) {
  const [inviteBusy, setInviteBusy] = useState(false)
  const initial = groupName?.trim()?.charAt(0)?.toUpperCase() || "?"
  const safeMemberCount = Number.isFinite(memberCount) ? Math.max(0, Math.floor(memberCount)) : 0
  const safeBoardUnread = Number.isFinite(boardUnread) ? Math.max(0, Math.floor(boardUnread)) : 0
  const safeChatUnread = Number.isFinite(chatUnread) ? Math.max(0, Math.floor(chatUnread)) : 0
  const safeUnreadCount = Number.isFinite(unreadCount) ? Math.max(0, Math.floor(unreadCount)) : 0
  const chatUnreadResolved = safeChatUnread > 0 ? safeChatUnread : safeBoardUnread === 0 ? safeUnreadCount : 0
  const activityTime = formatActivityTime(lastMessageTime)

  return (
    <article className="relative rounded-[1.35rem] border border-border/60 bg-card p-3.5 shadow-[var(--gh-card-shadow)] transition hover:border-emerald-400/50 hover:shadow-[var(--gh-card-shadow-lg)]">
      {isPinned ? <span className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-[var(--gh-green)]" aria-hidden /> : null}
      {isSample ? (
        <span className="absolute right-2 top-2 z-10 rounded-md bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm">Sample</span>
      ) : null}

      <button
        type="button"
        onClick={onClick}
        className="flex min-h-0 w-full items-start gap-3 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        aria-label={`Open community ${groupName}, ${safeMemberCount} ${safeMemberCount === 1 ? "member" : "members"}`}
        data-community-open-id={id}
      >
        <span className="relative flex h-[4.25rem] w-[4.25rem] shrink-0 items-center justify-center overflow-hidden rounded-[1.1rem] bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 text-lg font-bold text-white shadow-md ring-2 ring-emerald-500/15">
          {coverImage || groupAvatar ? (
            <LazyImage src={coverImage || groupAvatar || ""} alt="Community cover" className="h-full w-full object-cover" />
          ) : initial}
          {onlineCount > 0 ? <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-400" aria-label={`${onlineCount} online`} /> : null}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="min-w-0">
              <span className="block truncate text-base font-semibold leading-tight text-foreground">{groupName}</span>
              {region && region !== "Global" ? (
                <span className="mt-0.5 block truncate text-[12px] font-semibold text-sky-800 dark:text-sky-200">{region}{category ? ` · ${category}` : ""}</span>
              ) : category ? (
                <span className="mt-0.5 block truncate text-[12px] capitalize text-muted-foreground">{category}</span>
              ) : null}
              <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] text-muted-foreground">
                <span className="inline-flex items-center gap-0.5"><Users size={12} aria-hidden />{safeMemberCount.toLocaleString()} {safeMemberCount === 1 ? "member" : "members"}</span>
                <span aria-hidden>·</span>
                <span>{activityTime}</span>
                {role && role !== "guest" ? <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${communityRoleBadgeClass(role)}`}>{formatCommunityRole(role)}</span> : null}
              </span>
            </span>
            <ChevronRight size={18} className="mt-0.5 shrink-0 text-muted-foreground/60" aria-hidden />
          </span>
          <span className="mt-1 block line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">{lastMessage || "Posts, events, and member chat"}</span>
        </span>
      </button>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {isJoined ? (
          <span className="rounded-full border border-emerald-200 bg-emerald-50/80 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">Joined</span>
        ) : null}
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${safeBoardUnread > 0 ? "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200" : "bg-muted text-muted-foreground"}`}>
          <LayoutGrid size={11} aria-hidden />Board{safeBoardUnread > 0 ? <span className="tabular-nums">{safeBoardUnread > 99 ? "99+" : safeBoardUnread}</span> : null}
        </span>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${chatUnreadResolved > 0 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200" : "bg-muted text-muted-foreground"}`}>
          <MessageSquare size={11} aria-hidden />Chat{chatUnreadResolved > 0 ? <span className="tabular-nums">{chatUnreadResolved > 99 ? "99+" : chatUnreadResolved}</span> : null}
        </span>
        {isMuted ? <span className="text-[10px] font-medium text-muted-foreground">Muted</span> : null}
        {membershipStatus === "pending" && !isJoined ? <span className="ml-auto rounded-full border border-amber-300/70 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100" role="status">Request pending</span> : null}
        {membershipStatus === "invited" && !isJoined ? (
          <span className="ml-auto flex items-center gap-1.5">
            {onAcceptInvite ? <button type="button" disabled={inviteBusy} onClick={async () => { if (inviteBusy) return; setInviteBusy(true); try { await onAcceptInvite() } finally { setInviteBusy(false) } }} className="min-h-9 rounded-full bg-[var(--gh-green)] px-3 text-[11px] font-bold text-white disabled:opacity-60">{inviteBusy ? "Working…" : "Accept"}</button> : null}
            {onDeclineInvite ? <button type="button" disabled={inviteBusy} onClick={async () => { if (inviteBusy) return; setInviteBusy(true); try { await onDeclineInvite() } finally { setInviteBusy(false) } }} className="min-h-9 rounded-full border border-border px-2.5 text-[11px] font-semibold text-muted-foreground disabled:opacity-60">Decline</button> : null}
          </span>
        ) : null}
        {!isJoined && !membershipStatus && onJoin ? <button type="button" onClick={onJoin} className="ml-auto min-h-9 rounded-full bg-[var(--gh-green)] px-3 text-[11px] font-bold text-white">{joinLabel}</button> : null}
      </div>
    </article>
  )
}

export const GroupCard = memo(GroupCardContent)
GroupCard.displayName = "GroupCard"

export default GroupCard
