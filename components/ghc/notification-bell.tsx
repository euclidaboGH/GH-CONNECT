"use client"

/**
 * Unified Notification Center
 * Buckets: All · Social · Messages · GHC · Rewards · Requests · System — deep-links never dump to Settings by default
 * Taps deep-link to the right surface — never dumps users into Settings by default.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { onCloseTransientUI, dispatchCloseTransientUI } from "@/lib/transient-ui"
import {
  Bell,
  X,
  Heart,
  MessageCircle,
  UserPlus,
  Users,
  Coins,
  Shield,
  Gift,
  Share2,
  CheckCheck,
} from "lucide-react"
import {
  notificationSystem,
  type Notification,
  type NotificationType,
} from "@/lib/notifications"
import {
  NOTIFICATION_CENTER_BUCKETS,
  filterByBucket,
  resolveNotificationDeepLink,
  navigateNotificationDeepLink,
  type NotificationCenterBucket,
} from "@/lib/notification-center"

const ICON: Partial<Record<NotificationType, React.ReactNode>> = {
  like: <Heart size={15} className="text-rose-500" />,
  comment: <MessageCircle size={15} className="text-sky-600" />,
  message: <MessageCircle size={15} className="text-violet-600" />,
  match: <Heart size={15} className="text-pink-500" />,
  friend_request: <UserPlus size={15} className="text-emerald-600" />,
  follow: <Users size={15} className="text-indigo-600" />,
  system: <Shield size={15} className="text-muted-foreground" />,
  story_reply: <MessageCircle size={15} className="text-fuchsia-600" />,
  share: <Share2 size={15} className="text-emerald-600" />,
  group: <Users size={15} className="text-teal-600" />,
  ghc_received: <Coins size={15} className="text-emerald-600" />,
  ghc_sent: <Coins size={15} className="text-emerald-700" />,
  reward: <Gift size={15} className="text-amber-600" />,
  payment: <Coins size={15} className="text-teal-600" />,
  mention: <MessageCircle size={15} className="text-sky-600" />,
}

function timeLabel(ts: number) {
  const d = Date.now() - (ts || 0)
  if (d < 45_000) return "just now"
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`
  if (d < 7 * 86_400_000) return `${Math.floor(d / 86_400_000)}d ago`
  try {
    return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" })
  } catch {
    return ""
  }
}

const EMPTY_COPY: Record<NotificationCenterBucket, { title: string; body: string }> = {
  all: {
    title: "You're all caught up",
    body: "Likes, messages, GHC, rewards, and system updates appear here.",
  },
  social: {
    title: "No social activity yet",
    body: "Likes, comments, follows, and matches show up in this tab.",
  },
  messages: {
    title: "No message alerts",
    body: "New chats and group mentions will land here.",
  },
  ghc: {
    title: "No GHC activity",
    body: "Transfers, payments, and wallet events appear here.",
  },
  rewards: {
    title: "No reward alerts",
    body: "Daily claims, streaks, missions, and XP updates appear here.",
  },
  requests: {
    title: "No pending requests",
    body: "Friend and join requests will show here.",
  },
  system: {
    title: "No system notices",
    body: "Security and account notices appear here when needed.",
  },
}

export function NotificationBell({
  onOpenTarget,
}: {
  onOpenTarget?: (n: Notification) => void
}) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [bucket, setBucket] = useState<NotificationCenterBucket>("all")

  const refresh = useCallback(() => {
    try {
      const visible =
        typeof notificationSystem.getVisibleNotifications === "function"
          ? notificationSystem.getVisibleNotifications()
          : notificationSystem.getNotifications()
      const all = (visible || []).slice().reverse()
      const seen = new Set<string>()
      const unique = all.filter((n) => {
        const k = n.id || `${n.type}-${n.title}-${n.timestamp}`
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
      setItems(unique)
      setUnread(unique.filter((n) => !n.read).length)
    } catch {
      setItems([])
      setUnread(0)
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = window.setInterval(refresh, 4000)
    return () => window.clearInterval(id)
  }, [refresh])

  useEffect(() => {
    return onCloseTransientUI(() => setOpen(false))
  }, [])

  const filtered = useMemo(() => filterByBucket(items, bucket), [items, bucket])

  const openPanel = () => {
    setOpen(true)
    refresh()
  }

  const closePanel = () => {
    setOpen(false)
    dispatchCloseTransientUI({ reason: "notification-close" })
  }

  const onTap = (n: Notification) => {
    try {
      notificationSystem.markAsRead?.(n.id)
    } catch {
      /* */
    }
    const link = resolveNotificationDeepLink(n)
    navigateNotificationDeepLink(link)
    onOpenTarget?.(n)
    refresh()
    closePanel()
  }

  const markAll = () => {
    try {
      notificationSystem.markAllAsRead?.()
    } catch {
      /* */
    }
    refresh()
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={openPanel}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-foreground transition hover:bg-muted"
        aria-label={unread > 0 ? `${unread} unread notifications` : "Notifications"}
      >
        <Bell size={20} strokeWidth={2.1} />
        {unread > 0 ? (
          <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[85]" role="dialog" aria-modal="true" aria-label="Notifications">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={closePanel} />
          <div className="absolute inset-x-0 top-0 mx-auto flex max-h-[min(88vh,640px)] w-full max-w-[var(--gh-content-max,28rem)] flex-col overflow-hidden rounded-b-3xl border border-border bg-card shadow-2xl sm:top-3 sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="text-[15px] font-bold text-foreground">Notifications</p>
                <p className="text-[11px] text-muted-foreground">
                  {unread > 0 ? `${unread} unread` : "All caught up"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {unread > 0 ? (
                  <button
                    type="button"
                    onClick={markAll}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300"
                  >
                    <CheckCheck size={14} /> Mark all read
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={closePanel}
                  className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex gap-1 overflow-x-auto border-b border-border px-2 py-2 scrollbar-hide">
              {NOTIFICATION_CENTER_BUCKETS.map((b) => {
                const active = bucket === b.id
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBucket(b.id)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
                      active
                        ? "bg-emerald-600 text-white"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {b.label}
                  </button>
                )
              })}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-14 text-center">
                  <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                    <Bell size={26} />
                  </span>
                  <p className="text-[15px] font-bold text-foreground">{EMPTY_COPY[bucket]?.title || "Nothing here"}</p>
                  <p className="mt-1 max-w-[16rem] text-[12px] leading-relaxed text-muted-foreground">
                    {EMPTY_COPY[bucket]?.body}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {filtered.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => onTap(n)}
                        className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-muted/50 ${
                          !n.read ? "bg-emerald-50/40 dark:bg-emerald-950/20" : ""
                        }`}
                      >
                        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                          {ICON[n.type] || <Bell size={15} className="text-muted-foreground" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className="text-[13px] font-bold leading-snug text-foreground">{n.title}</span>
                            <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
                              {timeLabel(n.timestamp)}
                            </span>
                          </span>
                          <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground line-clamp-2">
                            {n.message}
                          </span>
                        </span>
                        {!n.read ? (
                          <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-label="Unread" />
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default NotificationBell
