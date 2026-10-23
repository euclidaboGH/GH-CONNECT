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
  Trash2,
  ChevronLeft,
  ArrowUp,
  ArrowDown,
  Store,
  RefreshCw,
} from "lucide-react"
import {
  notificationSystem,
  type Notification,
  type NotificationType,
  NOTIFICATIONS_CHANGED_EVENT,
  requestBrowserNotificationPermission,
} from "@/lib/notifications"
import {
  NOTIFICATION_CENTER_BUCKETS,
  filterByBucket,
  resolveNotificationDeepLink,
  navigateNotificationDeepLink,
  type NotificationCenterBucket,
} from "@/lib/notification-center"
import {
  groupNotificationsIntoThreads,
  notificationChannelKey,
  type NotificationThread,
} from "@/lib/notification-channels"

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
  post_like: <Heart size={15} className="text-rose-500" />,
  post_comment: <MessageCircle size={15} className="text-sky-600" />,
  comment_reply: <MessageCircle size={15} className="text-sky-700" />,
  upvote: <ArrowUp size={15} className="text-emerald-600" />,
  downvote: <ArrowDown size={15} className="text-orange-600" />,
  curation: <ArrowUp size={15} className="text-emerald-700" />,
  marketplace_listing: <Store size={15} className="text-amber-700" />,
  marketplace_order: <Store size={15} className="text-amber-600" />,
  marketplace_comment: <MessageCircle size={15} className="text-amber-600" />,
  marketplace_reaction: <Heart size={15} className="text-amber-600" />,
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
  marketplace: {
    title: "No marketplace alerts",
    body: "Listing updates, orders, and product reactions will show here.",
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
  const [readFilter, setReadFilter] = useState<"all" | "unread">("all")
  const [isOffline, setIsOffline] = useState(false)
  const [listLoading, setListLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [durableOk, setDurableOk] = useState<boolean | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [threadKey, setThreadKey] = useState<string | null>(null)
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
    // Merge both durable notification stores (social activity + GHC economy).
    // The old implementation replaced the unread count with the social count,
    // hiding local rewards and durable GHC events from the bell.
    void (async () => {
      setListLoading(true)
      try {
        const [socialRes, economyRes, socialCountRes, economyCountRes, announcementsRes] = await Promise.all([
          fetch("/api/notifications?limit=80", {
            credentials: "include", cache: "no-store", headers: { Accept: "application/json" },
          }).catch(() => null),
          fetch("/api/economy/notifications?limit=60", {
            credentials: "include", cache: "no-store", headers: { Accept: "application/json" },
          }).catch(() => null),
          fetch("/api/social/notifications?countOnly=1", {
            credentials: "include", cache: "no-store", headers: { Accept: "application/json" },
          }).catch(() => null),
          fetch("/api/notifications?countOnly=1", {
            credentials: "include", cache: "no-store", headers: { Accept: "application/json" },
          }).catch(() => null),
          fetch("/api/system/announcements?limit=25", {
            credentials: "include", cache: "no-store", headers: { Accept: "application/json" },
          }).catch(() => null),
        ])
        const [unifiedData, economyData, socialCountData, economyCountData, announcementsData] = await Promise.all([
          socialRes?.json().catch(() => ({})) || {},
          economyRes?.json().catch(() => ({})) || {},
          socialCountRes?.json().catch(() => ({})) || {},
          economyCountRes?.json().catch(() => ({})) || {},
          announcementsRes?.json().catch(() => ({})) || {},
        ]) as [
          { ok?: boolean; durable?: boolean; notifications?: Array<{ id?: string; type?: string; title?: string; body?: string; createdAt?: string; readAt?: string | null; actorUserId?: string; sourceId?: string; sourceType?: string; metadata?: Record<string, unknown>; correlationId?: string | null }> },
          { ok?: boolean; items?: Array<{ id?: string; eventType?: string; title?: string; body?: string; createdAt?: number; readAt?: number | string | null; referenceId?: string; requestId?: string; metadata?: Record<string, unknown> }> },
          { ok?: boolean; unreadCount?: number },
          { ok?: boolean; count?: number },
          { ok?: boolean; announcements?: Array<{ id?: string; title?: string; body?: string; severity?: string; actionPath?: string | null; publishedAt?: number; read?: boolean }>; unreadCount?: number },
        ]

        const socialRows = socialRes?.ok && unifiedData.ok && Array.isArray(unifiedData.notifications)
          ? unifiedData.notifications : []
        const economyRows = economyRes?.ok && economyData.ok && Array.isArray(economyData.items)
          ? economyData.items : []
        setDurableOk(Boolean(socialRows.length || economyRows.length || (unifiedData.ok && economyData.ok)))

        const unifiedRows = socialRows
        const mappedUnified: Notification[] = unifiedRows.map((n) => {
          const eventType = String(n.type || "system")
          const meta = (n.metadata || {}) as Record<string, unknown>
          const postId = typeof meta.postId === "string" ? meta.postId : undefined
          const commentId = typeof meta.commentId === "string" ? meta.commentId : undefined
          const conversationId = typeof meta.conversationId === "string" ? meta.conversationId : undefined
          const open = typeof meta.open === "string" ? meta.open : undefined
          const type: NotificationType =
            /message|chat/i.test(eventType) || open === "messages" ? "message" :
            /reward|claim|streak/i.test(eventType) ? "reward" :
            /ghc|transfer|payment/i.test(eventType) ? "ghc_received" :
            /follow|connection|friend/i.test(eventType) ? "friend_request" :
            /like|curation|upvote|downvote/i.test(eventType) ? "like" :
            /comment|reply|mention/i.test(eventType) ? "comment" :
            /marketplace|order|listing/i.test(eventType) ? "marketplace_order" : "system"
          return {
            id: String(n.id || ""), type,
            title: String(n.title || "Activity"), message: String(n.body || ""),
            icon: type === "message" ? "✉️" : type === "like" ? "❤️" : type === "comment" ? "💬" : type === "reward" ? "🎁" : "🔔",
            timestamp: n.createdAt ? new Date(n.createdAt).getTime() : Date.now(),
            read: Boolean(n.readAt),
            data: {
              ...meta, durable: true, actorUserId: n.actorUserId, sourceId: n.sourceId, sourceType: n.sourceType,
              postId, commentId, conversationId,
              transactionId: meta.transactionId,
              requestId: n.requestId,
              fromUserId: n.actorUserId, userId: meta.userId || n.actorUserId,
              open: open || (type === "message" ? "messages" : undefined),
              correlationId: n.correlationId,
            },
          }
        })

        const mappedSocial: Notification[] = unifiedData?.durable ? [] : unifiedRows.map((n) => {
          const socialType = String(n.type || "")
          const type = (
            socialType === "follow" ? "follow"
            : socialType === "friend_request" || socialType === "connection_request" || socialType === "connection" || socialType === "connection_accept" ? "friend_request"
            : socialType === "post_created" ? "system"
            : socialType === "post_like" || socialType === "like" || socialType === "upvote" || socialType === "post_upvote" || socialType === "downvote" || socialType === "post_downvote" || socialType === "curation" || socialType === "post_curation" ? "like"
            : socialType === "post_comment" || socialType === "comment_reply" || socialType === "reply" || socialType === "comment" || socialType === "mention" ? "comment"
            : socialType === "share" ? "share"
            : socialType === "match" ? "match"
            : socialType === "message" || socialType === "new_message" || socialType === "dm" || socialType === "chat" ? "message"
            : "system"
          ) as NotificationType
          const meta = (n.metadata || {}) as Record<string, unknown>
          const postId =
            (typeof meta.postId === "string" && meta.postId) ||
            (n.entityType === "post" && n.entityId ? String(n.entityId) : undefined) ||
            (socialType === "post_created" && n.entityId ? String(n.entityId) : undefined) ||
            undefined
          const conversationId =
            (typeof meta.conversationId === "string" && meta.conversationId) ||
            (n.entityType === "conversation" || n.entityType === "message"
              ? (n.entityId ? String(n.entityId) : undefined)
              : undefined) ||
            (typeof meta.threadId === "string" ? meta.threadId : undefined)
          return {
            id: String(n.id || ""),
            type,
            title: String(n.title || "Activity"),
            message: String(n.body || ""),
            icon:
              type === "message" ? "✉️"
              : socialType.includes("like") ? "❤️"
              : socialType.includes("upvote") || socialType.includes("downvote") ? "▲"
              : socialType.includes("comment") ? "💬"
              : socialType.includes("connection") || socialType.includes("friend") ? "🤝"
              : "🔔",
            timestamp: Number(n.createdAt) || Date.now(),
            read: Boolean(n.readAt),
            data: {
              ...meta,
              durable: true,
              actorUserId: n.actorUserId,
              entityId: n.entityId,
              entityType: n.entityType,
              postId,
              conversationId,
              fromUserId: n.actorUserId,
              userId: meta.userId || n.actorUserId,
              open: type === "message" ? "messages"
                : socialType === "connection_accept" ? "matches"
                : socialType === "connection" || socialType === "connection_request" || socialType === "friend_request" ? "matches"
                : meta.open,
              section: socialType === "connection" || socialType === "connection_request" || socialType === "friend_request"
                ? "connection_requests"
                : socialType === "connection_accept"
                  ? "matches"
                  : meta.section,
              socialType,
            },
          }
        })

        const mappedEconomy: Notification[] = economyRows.map((n) => {
          const eventType = String(n.eventType || "")
          const type: NotificationType = eventType === "GHC_RECEIVED" ? "ghc_received"
            : eventType === "GHC_SENT" ? "ghc_sent"
            : eventType.includes("REQUEST") ? "group"
            : eventType.includes("REWARD") ? "reward"
            : eventType.includes("MEMBERSHIP") || eventType.includes("PREMIUM") ? "system"
            : "system"
          return {
            id: String(n.id || ""), type,
            title: String(n.title || "GreenHaven update"), message: String(n.body || ""),
            icon: eventType.includes("REWARD") ? "🎁" : eventType.startsWith("GHC_") ? "🪙" : "🔔",
            timestamp: Number(n.createdAt) || Date.now(),
            read: Boolean(n.readAt),
            data: {
              durableEconomy: true, eventType, referenceId: n.referenceId, requestId: n.requestId,
              ...(n.metadata || {}),
            },
          }
        })

        const suppress = new Set([...blockedUsers, ...mutedUsers].map(String))
        const durableSocialVisible = mappedSocial.filter((n) => {
          const actor = String((n.data as { actorUserId?: string } | undefined)?.actorUserId || "")
          return !actor || !suppress.has(actor)
        })
        const mappedAnnouncements: Notification[] = announcementsRes?.ok && announcementsData.ok && Array.isArray(announcementsData.announcements)
          ? announcementsData.announcements.map((n) => ({
              id: `announcement:${String(n.id || "")}`,
              type: "system" as NotificationType,
              title: String(n.title || "GreenHaven update"),
              message: String(n.body || ""),
              icon: n.severity === "critical" || n.severity === "warning" ? "⚠️" : "📢",
              timestamp: Number(n.publishedAt) || Date.now(),
              read: Boolean(n.read),
              data: { durableAnnouncement: true, announcementId: String(n.id || ""), actionPath: n.actionPath || undefined },
            })).filter((n) => Boolean((n.data as { announcementId?: string }).announcementId))
          : []
        const durableEconomyVisible = mappedEconomy
        setItems((prev) => {
          const localOnly = prev.filter((x) => {
            const d = x.data as { durable?: boolean; durableEconomy?: boolean } | undefined
            return !d?.durable && !d?.durableEconomy
          })
          const byId = new Map<string, Notification>()
          for (const x of [...mappedUnified, ...durableEconomyVisible, ...mappedAnnouncements, ...localOnly]) {
            if (x.id && !byId.has(x.id)) byId.set(x.id, x)
          }
          return Array.from(byId.values())
            .filter((x) => {
              try {
                return !notificationSystem.isDeleted?.(x.id)
              } catch {
                return true
              }
            })
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        })

        const localUnread = notificationSystem.getVisibleNotifications(blockedUsers, mutedUsers).filter((n) => !n.read).length
        const socialUnread = economyCountData.ok && typeof (economyCountData as any).unreadCount === "number"
          ? Math.max(0, Number((economyCountData as any).unreadCount)) : mappedUnified.filter((n) => !n.read).length
        const economyUnread = unifiedData?.durable ? 0 : (economyCountData.ok && typeof (economyCountData as any).count === "number"
          ? Math.max(0, Number((economyCountData as any).count)) : mappedEconomy.filter((n) => !n.read).length)
        const announcementUnread = announcementsRes?.ok && announcementsData.ok && typeof announcementsData.unreadCount === "number"
          ? Math.max(0, announcementsData.unreadCount) : mappedAnnouncements.filter((n) => !n.read).length
        setUnread(localUnread + socialUnread + economyUnread + announcementUnread)
      } catch {
        setDurableOk(false)
        /* Local-only notifications remain visible if a server store is unavailable. */
      } finally {
        setListLoading(false)
      }
    })()
  }, [blockedUsers, mutedUsers])

  useEffect(() => {
    refresh()
    let id: number | null = null
    const schedule = () => {
      if (id !== null) window.clearInterval(id)
      if (document.visibilityState !== "visible") return
      const interval = open ? 12000 : 30000
      id = window.setInterval(refresh, interval)
    }
    schedule()
    const onVisibility = () => {
      if (document.visibilityState === "visible") { refresh(); schedule() }
      else if (id !== null) { window.clearInterval(id); id = null }
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      if (id !== null) window.clearInterval(id)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [open, refresh])

  // Phase 8: refresh when app returns to foreground
  useEffect(() => {
    const onVis = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        refresh()
      }
    }
    const onFocus = () => refresh()
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVis)
    }
    window.addEventListener("focus", onFocus)
    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVis)
      }
      window.removeEventListener("focus", onFocus)
    }
  }, [refresh])

  // Phase 5 — live refresh when local or product events fire
  useEffect(() => {
    const onChange = () => refresh()
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChange as EventListener)
    window.addEventListener("ghc:daily-reward-claimed", onChange as EventListener)
    window.addEventListener("ghc:post-engagement", onChange as EventListener)
    window.addEventListener("ghc:new-message", onChange as EventListener)
    window.addEventListener("ghc:connection-updated", onChange as EventListener)
    window.addEventListener("ghc:notification", onChange as EventListener)
    return () => {
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChange as EventListener)
      window.removeEventListener("ghc:daily-reward-claimed", onChange as EventListener)
      window.removeEventListener("ghc:post-engagement", onChange as EventListener)
      window.removeEventListener("ghc:new-message", onChange as EventListener)
      window.removeEventListener("ghc:connection-updated", onChange as EventListener)
      window.removeEventListener("ghc:notification", onChange as EventListener)
    }
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

  const filtered = useMemo(() => {
    const bucketed = filterByBucket(items, bucket)
    return readFilter === "unread" ? bucketed.filter((n) => !n.read) : bucketed
  }, [items, bucket, readFilter])
  const bucketUnreadCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const b of NOTIFICATION_CENTER_BUCKETS) {
      counts[b.id] = filterByBucket(items, b.id as NotificationCenterBucket).filter((n) => !n.read).length
    }
    return counts
  }, [items])
  const threads = useMemo(() => groupNotificationsIntoThreads(filtered), [filtered])
  const expanded = useMemo(
    () => (expandedId ? filtered.find((x) => x.id === expandedId) || null : null),
    [expandedId, filtered],
  )
  const activeThread = useMemo(() => {
    if (!threadKey) return null
    return threads.find((th) => th.channelKey === threadKey) || null
  }, [threadKey, threads])

  const openPanel = () => {
    setOpen(true)
    try {
      requestBrowserNotificationPermission()
    } catch {
      /* */
    }
    refresh()
  }

  const closePanel = () => {
    setOpen(false)
    setExpandedId(null)
    setThreadKey(null)
    dispatchCloseTransientUI({ reason: "notification-close" })
  }

  const markOneRead = (n: Notification) => {
    try {
      notificationSystem.markAsRead?.(n.id)
    } catch {
      /* */
    }
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
    setUnread((u) => Math.max(0, u - (n.read ? 0 : 1)))
    const notificationData = (n.data || {}) as {
      durable?: boolean
      durableEconomy?: boolean
      durableAnnouncement?: boolean
      announcementId?: string
    }
    if (notificationData.durable && n.id) {
      void fetch("/api/notifications", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_read", ids: [n.id] }),
      })
        .then(() => window.dispatchEvent(new CustomEvent("ghc:notifications-read")))
        .catch(() => null)
    } else if (notificationData.durableAnnouncement && notificationData.announcementId) {
      void fetch("/api/system/announcements", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notificationData.announcementId }),
      })
        .then(() => window.dispatchEvent(new CustomEvent("ghc:notifications-read")))
        .catch(() => null)
    } else if (notificationData.durableEconomy && n.id) {
      void fetch(`/api/economy/notifications/${encodeURIComponent(n.id)}/read`, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      })
        .then(() => window.dispatchEvent(new CustomEvent("ghc:notifications-read")))
        .catch(() => null)
    }
  }

  /** Tap opens detail + channel history (like DM thread). Navigate via Open action. */
  const onTap = (n: Notification) => {
    markOneRead(n)
    setExpandedId(n.id)
    setThreadKey(notificationChannelKey(n))
  }

  const openTarget = (n: Notification) => {
    markOneRead(n)
    const notificationData = (n.data || {}) as { actionPath?: string }
    const link = resolveNotificationDeepLink(n)
    if (
      notificationData.actionPath &&
      notificationData.actionPath.startsWith("/") &&
      !notificationData.actionPath.startsWith("//")
    ) {
      window.location.assign(notificationData.actionPath)
    } else {
      navigateNotificationDeepLink(link)
    }
    onOpenTarget?.(n)
    closePanel()
    window.setTimeout(() => refresh(), 400)
  }

  const onDelete = (n: Notification) => {
    try {
      notificationSystem.deleteNotification?.(n.id)
    } catch {
      /* */
    }
    setItems((prev) => prev.filter((x) => x.id !== n.id))
    if (expandedId === n.id) {
      setExpandedId(null)
      setThreadKey(null)
    }
    setStatusMsg("Notification deleted")
    window.setTimeout(() => setStatusMsg(null), 2000)
    window.setTimeout(() => refresh(), 300)
  }

  const markAll = () => {
    try {
      notificationSystem.markAllAsRead?.()
    } catch {
      /* */
    }
    void Promise.all([
      fetch("/api/social/notifications", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      }).catch(() => null),
      fetch("/api/economy/notifications/read-all", {
        method: "POST", credentials: "include", headers: { Accept: "application/json" },
      }).catch(() => null),
      fetch("/api/system/announcements", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      }).catch(() => null),
    ]).then(() => window.dispatchEvent(new CustomEvent("ghc:notifications-read")))
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
        <div className="gh-world-notifications fixed inset-0 z-[85]" role="dialog" aria-modal="true" aria-label="Notifications">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={closePanel} />
          <div className="absolute inset-x-0 top-0 mx-auto flex max-h-[min(88vh,640px)] w-full max-w-[36rem] flex-col overflow-hidden rounded-b-[1.25rem] border border-border/50 bg-card shadow-2xl sm:top-3 sm:rounded-[1.25rem]">
            <div className="flex items-center justify-between border-b border-border/50 px-4 py-3.5">
              <div>
                <p className="text-[15px] font-bold text-foreground">Notifications</p>
                <p className="text-[11px] text-muted-foreground">
                  {unread > 0 ? `${unread} unread` : "All caught up"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => { setStatusMsg("Refreshing notifications…"); refresh() }}
                  disabled={listLoading}
                  className="inline-flex h-9 items-center gap-1 rounded-full px-2.5 text-[11px] font-bold text-muted-foreground hover:bg-muted disabled:opacity-50"
                  aria-label="Refresh notifications"
                >
                  <RefreshCw size={14} className={listLoading ? "animate-spin" : ""} />
                  Refresh
                </button>
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
                Some notifications are temporarily unavailable. Please try again shortly.
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
            <div className="flex items-center gap-1 border-b border-border/60 px-3 py-2" aria-label="Notification read filter">
              {(["all", "unread"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setReadFilter(mode)}
                  className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${readFilter === mode ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}
                >
                  {mode === "all" ? "All" : `Unread${bucketUnreadCounts[bucket] ? ` (${bucketUnreadCounts[bucket]})` : ""}`}
                </button>
              ))}
              <span className="ml-auto text-[10px] text-muted-foreground">Auto-sync 12s</span>
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
              ) : expanded && activeThread ? (
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-[12px] font-semibold text-muted-foreground hover:bg-muted"
                        onClick={() => {
                          setExpandedId(null)
                          setThreadKey(null)
                        }}
                      >
                        <ChevronLeft size={16} /> Back
                      </button>
                      <p className="text-[12px] font-bold text-foreground">Conversation history</p>
                    </div>
                    <div className="border-b border-border/40 bg-muted/20 px-4 py-4">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted">
                          {ICON[expanded.type] || <Bell size={16} className="text-muted-foreground" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] font-bold text-foreground">{expanded.title}</p>
                          <p className="mt-1 text-[13px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
                            {expanded.message}
                          </p>
                          <p className="mt-2 text-[11px] text-muted-foreground">{timeLabel(expanded.timestamp)}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => openTarget(expanded)}
                              className="rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white"
                            >
                              Open
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete(expanded)}
                              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted"
                            >
                              <Trash2 size={12} /> Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      Earlier in this channel ({activeThread.history.length})
                    </p>
                    <ul className="divide-y divide-border" role="list">
                      {activeThread.history.map((n) => (
                        <li key={n.id}>
                          <button
                            type="button"
                            onClick={() => {
                              markOneRead(n)
                              setExpandedId(n.id)
                            }}
                            className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/40 ${
                              n.id === expanded.id ? "bg-emerald-50/50 dark:bg-emerald-950/30" : ""
                            } ${!n.read ? "font-semibold" : ""}`}
                          >
                            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                              {ICON[n.type] || <Bell size={13} />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex justify-between gap-2">
                                <span className="text-[12px] font-bold text-foreground">{n.title}</span>
                                <span className="text-[10px] text-muted-foreground">{timeLabel(n.timestamp)}</span>
                              </span>
                              <span className="mt-0.5 block text-[11px] text-muted-foreground line-clamp-2">
                                {n.message}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                <ul className="divide-y divide-border" role="list" aria-label="Notification list">
                  {threads.map((th) => {
                    const n = th.latest
                    return (
                    <li key={th.channelKey}>
                      <button
                        type="button"
                        onClick={() => onTap(n)}
                        className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-muted/50 ${
                          th.unreadCount > 0 ? "bg-emerald-50/40 dark:bg-emerald-950/20" : ""
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
                          {th.history.length > 1 ? (
                            <span className="mt-0.5 block text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                              {th.history.length} updates in this channel
                            </span>
                          ) : null}
                          {isCommunityNotification(n) ? (
                            <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                              {communityNotificationLabel(n)}
                            </span>
                          ) : null}
                          <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground line-clamp-2">
                            {n.message}
                          </span>
                        </span>
                        {th.unreadCount > 0 ? (
                          <span className="mt-2 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[var(--gh-green)] px-1 text-[10px] font-bold text-white">
                            {th.unreadCount > 9 ? "9+" : th.unreadCount}
                          </span>
                        ) : null}
                      </button>
                    </li>
                    )
                  })}
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
