"use client"

/**
 * Unified Notification Center
 * Buckets: All · Social · Messages · GHC · Rewards · Requests · System — deep-links never dump to Settings by default
 * Taps deep-link to the right surface — never dumps users into Settings by default.
 */

import { communityNotificationLabel, isCommunityNotification } from "@/lib/domains/adapters/community-notification"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useGHC } from "@/contexts/ghc-context"
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
    body: "Friend and connection requests will show here.",
  },
  community: {
    title: "No community alerts",
    body: "Invites, join requests, and community announcements appear here.",
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
  const [unread, setUnread] = useState<number>(0)
  const [bucket, setBucket] = useState<NotificationCenterBucket>("all")
  const [isOffline, setIsOffline] = useState(false)
  const [listLoading, setListLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [durableOk, setDurableOk] = useState<boolean | null>(null)
  const ghc = useGHC() as { blockedUsers?: string[]; mutedUsers?: string[] }
  const blockedKey = Array.isArray(ghc.blockedUsers) ? ghc.blockedUsers.join("|") : ""
  const mutedKey = Array.isArray(ghc.mutedUsers) ? ghc.mutedUsers.join("|") : ""
  const blockedUsers = useMemo(
    () => (blockedKey ? blockedKey.split("|").filter(Boolean) : []),
    [blockedKey]
  )
  const mutedUsers = useMemo(
    () => (mutedKey ? mutedKey.split("|").filter(Boolean) : []),
    [mutedKey]
  )

  const refresh = useCallback(() => {
    try {
      const visible =
        typeof notificationSystem.getVisibleNotifications === "function"
          ? notificationSystem.getVisibleNotifications(blockedUsers, mutedUsers)
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
    // Merge durable social notifications (server-authoritative)
    void (async () => {
      setListLoading(true)
      try {
        const res = await fetch("/api/social/notifications?limit=40", {
          credentials: "include",
          headers: { Accept: "application/json" },
        })
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          notifications?: Array<{
            id?: string
            type?: string
            title?: string
            body?: string
            createdAt?: number
            readAt?: string | null
            actorUserId?: string
            entityId?: string
            entityType?: string
          }>
        }
        if (!res.ok || !data.ok || !Array.isArray(data.notifications)) {
          setDurableOk(false)
          return
        }
        setDurableOk(true)
        const mapped: Notification[] = data.notifications.map((n) => ({
          id: String(n.id || ""),
          type: (n.type === "follow"
            ? "follow"
            : n.type === "post_like"
              ? "like"
              : n.type === "post_comment" || n.type === "comment_reply" || n.type === "mention"
                ? "comment"
              : n.type === "curation"
                ? "system"
              : n.type === "reputation_level_up"
                ? "system"
              : n.type === "share"
                ? "share"
                : "system") as NotificationType,
          title: String(n.title || "Activity"),
          message: String(n.body || ""),
          icon: "🔔",
          timestamp: Number(n.createdAt) || Date.now(),
          read: Boolean(n.readAt),
          data: {
            durable: true,
            actorUserId: n.actorUserId,
            entityId: n.entityId,
            entityType: n.entityType,
            socialType: n.type,
          },
        }))
        // Durable server notifications are authoritative when available
        const suppress = new Set([...blockedUsers, ...mutedUsers].map(String))
        const durableVisible = mapped.filter((n) => {
          const actor = String(
            (n.data as { actorUserId?: string } | undefined)?.actorUserId || ""
          )
          if (actor && suppress.has(actor)) return false
          return true
        })
        setItems((prev) => {
          const localOnly = prev.filter((x) => !(x.data as { durable?: boolean } | undefined)?.durable)
          const byId = new Map<string, Notification>()
          for (const x of [...durableVisible, ...localOnly]) {
            if (x.id && !byId.has(x.id)) byId.set(x.id, x)
          }
          return Array.from(byId.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        })
        const durableUnread = mapped.filter((m) => !m.read).length
        // Prefer server unread count when durable list loaded
        void fetch("/api/social/notifications?countOnly=1", {
          credentials: "include",
          headers: { Accept: "application/json" },
        })
          .then((r) => r.json())
          .then((c: { ok?: boolean; unreadCount?: number }) => {
            if (c && c.ok && typeof c.unreadCount === "number") {
              setUnread(Math.max(0, Number(c.unreadCount) || 0))
            } else {
              setUnread(durableUnread)
            }
          })
          .catch(() => setUnread(durableUnread))
      } catch {
        setDurableOk(false)
        /* local-only remains */
      } finally {
        setListLoading(false)
      }
    })()
  }, [blockedUsers, mutedUsers])

  useEffect(() => {
    refresh()
    const id = window.setInterval(refresh, 12000)
    return () => window.clearInterval(id)
  }, [refresh])

  useEffect(() => {
    return onCloseTransientUI(() => setOpen(false))
  }, [])

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

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        setOpen(false)
        try {
          dispatchCloseTransientUI({ reason: "notification-escape" })
        } catch {
          /* */
        }
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

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
    // Optimistic UI — durable rows only update after server merge otherwise
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
    setUnread((u) => Math.max(0, u - (n.read ? 0 : 1)))
    if (n.data && (n.data as { durable?: boolean }).durable && n.id) {
      void fetch("/api/social/notifications", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_read", ids: [n.id] }),
      }).catch(() => null)
    }
    const link = resolveNotificationDeepLink(n)
    navigateNotificationDeepLink(link)
    onOpenTarget?.(n)
    closePanel()
    // Background reconcile — do not block navigation
    window.setTimeout(() => refresh(), 400)
  }

  const markAll = () => {
    try {
      notificationSystem.markAllAsRead?.()
    } catch {
      /* */
    }
    void fetch("/api/social/notifications", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    }).catch(() => null)
    setItems((prev) => prev.map((x) => ({ ...x, read: true })))
    setUnread(0)
    setStatusMsg("Marked all as read")
    window.setTimeout(() => setStatusMsg(null), 2000)
    window.setTimeout(() => refresh(), 400)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={openPanel}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-foreground transition hover:bg-muted"
        aria-label={unread > 0 ? `${unread} unread notifications` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
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
          <div className="absolute inset-x-0 top-0 mx-auto flex max-h-[min(88vh,640px)] w-full max-w-[var(--gh-content-max,28rem)] flex-col overflow-hidden rounded-b-[1.25rem] border border-border/50 bg-card shadow-2xl sm:top-3 sm:rounded-[1.25rem]">
            <div className="flex items-center justify-between border-b border-border/50 px-4 py-3.5">
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

            <div className="sr-only" role="status" aria-live="polite">
              {statusMsg || (listLoading ? "Refreshing notifications" : "")}
            </div>
            {isOffline ? (
              <div className="mx-3 mt-2 rounded-[1.25rem] border border-amber-200/80 bg-amber-50/90 px-3.5 py-2 text-[11px] leading-snug text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100" role="status">
                Offline — showing notifications already on this device. New activity syncs when you reconnect.
              </div>
            ) : null}
            {durableOk === false && !isOffline ? (
              <div className="mx-3 mt-2 rounded-[1.25rem] border border-border/60 bg-muted/40 px-3.5 py-2 text-[11px] leading-snug text-muted-foreground" role="status">
                Server notifications unavailable — local notifications only.
              </div>
            ) : null}
            <div
              className="flex gap-1 overflow-x-auto border-b border-border px-2 py-2 scrollbar-hide"
              role="tablist"
              aria-label="Notification categories"
              onKeyDown={(e) => {
                const ids = NOTIFICATION_CENTER_BUCKETS.map((b) => b.id as NotificationCenterBucket)
                const idx = ids.indexOf(bucket)
                if (idx < 0) return
                if (e.key === "ArrowRight") {
                  e.preventDefault()
                  setBucket(ids[(idx + 1) % ids.length])
                } else if (e.key === "ArrowLeft") {
                  e.preventDefault()
                  setBucket(ids[(idx - 1 + ids.length) % ids.length])
                } else if (e.key === "Home") {
                  e.preventDefault()
                  setBucket(ids[0])
                } else if (e.key === "End") {
                  e.preventDefault()
                  setBucket(ids[ids.length - 1])
                }
              }}
            >
              {NOTIFICATION_CENTER_BUCKETS.map((b) => {
                const active = bucket === b.id
                return (
                  <button
                    key={b.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    tabIndex={active ? 0 : -1}
                    onClick={() => setBucket(b.id)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                      active
                        ? "bg-[var(--gh-green)] text-white"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {b.label}
                  </button>
                )
              })}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {filtered.length > 0 ? (
                <p className="px-4 pt-2 text-[11px] font-medium text-muted-foreground" aria-live="polite">
                  {filtered.length} notification{filtered.length === 1 ? "" : "s"}
                  {bucket !== "all" ? " in this category" : ""}
                  {listLoading ? " · refreshing…" : ""}
                </p>
              ) : null}
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
                <ul className="divide-y divide-border" role="list" aria-label="Notification list">
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
                          {isCommunityNotification(n) ? (
                            <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                              {communityNotificationLabel(n)}
                            </span>
                          ) : null}
                          <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground line-clamp-2">
                            {n.message}
                          </span>
                        </span>
                        {!n.read ? (
                          <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--gh-green)]" aria-label="Unread" />
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
