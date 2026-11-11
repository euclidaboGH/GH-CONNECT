// Real-time notifications system

import { IdentityService } from "./identity/identity-service.ts"

export type NotificationType =
  | "match"
  | "message"
  | "like"
  | "comment"
  | "friend_request"
  | "follow"
  | "system"
  | "story_reply"
  | "share"
  | "group"
  | "ghc_received"
  | "ghc_sent"
  | "reward"
  | "payment"
  | "mention"
  | "post_like"
  | "post_comment"
  | "connection_request"
  | "curation"
  | "upvote"
  | "downvote"
  | "comment_reply"
  | "marketplace_listing"
  | "marketplace_order"
  | "marketplace_comment"
  | "marketplace_reaction"

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  icon: string
  timestamp: number
  read: boolean
  data?: Record<string, any>
}

export const NOTIFICATIONS_CHANGED_EVENT = "ghc:notifications-changed" as const

const NOTIFICATIONS_KEY = "ghc_notifications"
const LEGACY_NOTIFICATIONS_KEY = "ghc_notifications"
function scopedNotificationsKey(): string {
  const userId = String(IdentityService.getCurrentUserId() || "current-user").trim()
  return `${NOTIFICATIONS_KEY}:${encodeURIComponent(userId || "anonymous")}`
}
function scopedDeletedKey(): string {
  return `${scopedNotificationsKey()}:deleted`
}
function readStoredNotifications(): Notification[] {
  try {
    const key = scopedNotificationsKey()
    const scoped = localStorage.getItem(key)
    if (scoped) {
      const parsed = JSON.parse(scoped)
      return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === "object" && typeof item.id === "string") : []
    }
    // Preserve legacy local-studio data only. Never attribute an old shared
    // browser cache to a newly authenticated account.
    if (IdentityService.getCurrentUserId() === "current-user") {
      const legacy = localStorage.getItem(LEGACY_NOTIFICATIONS_KEY)
      if (legacy) {
        const parsed = JSON.parse(legacy)
        const safe = Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === "object" && typeof item.id === "string") : []
        if (safe.length) localStorage.setItem(key, JSON.stringify(safe))
        return safe
      }
    }
  } catch { /* corrupted or unavailable storage */ }
  return []
}
function writeStoredNotifications(items: Notification[]): void {
  localStorage.setItem(scopedNotificationsKey(), JSON.stringify(items.slice(-MAX_NOTIFICATIONS)))
}

function notificationPreferenceCategory(type: NotificationType, data?: Record<string, any>): string {
  const explicit = String(data?.category || "").toLowerCase()
  const allowed = new Set(["messages", "matches", "connections", "comments", "mentions", "communities", "stories", "marketplace", "rewards", "wallet", "premium", "profile_views", "product_updates", "system"])
  if (allowed.has(explicit)) return explicit
  if (type === "message") return "messages"
  if (type === "match") return "matches"
  if (["friend_request", "follow", "connection_request"].includes(type)) return "connections"
  if (["comment", "like", "post_like", "post_comment", "curation", "upvote", "downvote", "comment_reply"].includes(type)) return "comments"
  if (type === "story_reply") return "stories"
  if (type === "group") return "communities"
  if (["ghc_received", "ghc_sent", "payment"].includes(type)) return "wallet"
  if (type === "reward") return "rewards"
  if (type.startsWith("marketplace_")) return "marketplace"
  return "system"
}

function isNotificationChannelAllowed(type: NotificationType, data: Record<string, any> | undefined, channel: "inApp" | "push"): boolean {
  const override = channel === "push" ? data?.pushEnabled : data?.inAppEnabled
  if (typeof override === "boolean") return override
  if (typeof window === "undefined") return false
  const category = notificationPreferenceCategory(type, data)
  const defaults: Record<string, { inApp: boolean; push: boolean }> = {
    system: { inApp: true, push: false },
    profile_views: { inApp: false, push: false },
    product_updates: { inApp: false, push: false },
  }
  try {
    const userId = String(IdentityService.getCurrentUserId() || "anonymous").trim()
    const encodedUser = encodeURIComponent(userId)
    const deviceId = localStorage.getItem("ghc_notification_device_id") || "unavailable"
    const key = channel === "inApp"
      ? `ghc_notification_account_preferences:${encodedUser}`
      : `ghc_notification_device_preferences:${encodedUser}:${encodeURIComponent(deviceId)}`
    const raw = localStorage.getItem(key)
    let parsed: Record<string, any> | null = raw ? JSON.parse(raw) : null
    const saved = parsed?.[category]?.[channel]
    if (typeof saved === "boolean") return saved
    // Compatibility read for existing accounts until settings completes migration.
    const legacyRaw = localStorage.getItem(`ghc_notification_preferences:${encodedUser}`) || (userId === "current-user" ? localStorage.getItem("ghc_notification_preferences") : null)
    const legacy = legacyRaw ? JSON.parse(legacyRaw) : null
    if (typeof legacy?.[category]?.[channel] === "boolean") return legacy[category][channel]
    return defaults[category]?.[channel] ?? true
  } catch {
    return false
  }
}

const MAX_NOTIFICATIONS = 300

export const notificationSystem = {
  // Add notification
  addNotification: (
    type: NotificationType,
    title: string,
    message: string,
    icon: string,
    data?: Record<string, any>
  ): Notification => {
    try {
      const notification: Notification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        title,
        message,
        icon,
        timestamp: Date.now(),
        read: false,
        data,
      }

      const inAppAllowed = isNotificationChannelAllowed(type, data, "inApp")
      const pushAllowed = isNotificationChannelAllowed(type, data, "push")
      const notifs: Notification[] = inAppAllowed ? readStoredNotifications() : []

      // Phase D6: dedupe by data.dedupeKey when present
      const dedupeKey = data && typeof data === "object" ? (data as any).dedupeKey : undefined
      if (inAppAllowed && dedupeKey) {
        const existing = notifs.find((n) => (n.data as any)?.dedupeKey === dedupeKey)
        if (existing) return existing
      }

      // Prevent near-duplicate in-app rows (same type+title within 30s).
      const dup = inAppAllowed && notifs.some(
        (n) => n.type === type && n.title === title && n.message === message && Date.now() - (n.timestamp || 0) < 30_000,
      )
      if (inAppAllowed && !dup) {
        notifs.push(notification)
        writeStoredNotifications(notifs.slice(-MAX_NOTIFICATIONS))
        try { window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT, { detail: { reason: "add", type } })) } catch { /* */ }
      }

      // Browser alerts are local UI delivery only. The persisted inbox remains a
      // separate channel; remote Web Push requires a server-managed subscription
      // and provider, neither of which is configured in this release.
      if (pushAllowed && typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        const options = { body: message, icon, tag: type }
        if ("serviceWorker" in navigator) {
          void navigator.serviceWorker.ready
            .then((registration) => registration.showNotification(title, options))
            .catch(() => { try { new Notification(title, options) } catch { /* browser disallowed local display */ } })
        } else {
          try { new Notification(title, options) } catch { /* browser disallowed local display */ }
        }
      }

      return notification
    } catch (e) {
      console.warn("[v0] Failed to add notification:", e)
      return {
        id: "",
        type,
        title,
        message,
        icon,
        timestamp: Date.now(),
        read: false,
      }
    }
  },

  // Get all notifications
  getNotifications: (): Notification[] => {
    try {
      return readStoredNotifications()
    } catch {
      return []
    }
  },

  /**
   * Suppress notifications from blocked or muted actors.
   * Restrict does not hide notifications by itself.
   */
  getVisibleNotifications: (
    blockedUserIds: string[] = [],
    mutedUserIds: string[] = []
  ): Notification[] => {
    const all = notificationSystem.getNotifications()
    const set = new Set([...blockedUserIds, ...mutedUserIds])
    if (!set.size) return all
    return all.filter((n) => {
      const from = (
        n.data?.fromUserId ||
        n.data?.userId ||
        n.data?.actorId ||
        n.data?.actorUserId
      ) as string | undefined
      if (from && set.has(String(from))) return false
      return true
    })
  },

  // Get unread notifications
  getUnreadNotifications: (): Notification[] => {
    return notificationSystem.getNotifications().filter((n) => !n.read)
  },

  // Get unread count
  getUnreadCount: (): number => {
    return notificationSystem.getUnreadNotifications().length
  },

  // Mark as read
  markAsRead: (notifId: string): void => {
    try {
      const notifs: Notification[] = readStoredNotifications()
      if (!notifs.length) return
      const updated = notifs.map((n) => (n.id === notifId ? { ...n, read: true } : n))

      writeStoredNotifications(updated)
      try {
        window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT, { detail: { reason: "read" } }))
      } catch { /* */ }
    } catch (e) {
      console.warn("[v0] Failed to mark as read:", e)
    }
  },

  // Mark all as read
  markAllAsRead: (): void => {
    try {
      const notifs: Notification[] = readStoredNotifications()
      if (!notifs.length) return
      const updated = notifs.map((n) => ({ ...n, read: true }))

      writeStoredNotifications(updated)
      try {
        window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT, { detail: { reason: "read-all" } }))
      } catch { /* */ }
    } catch (e) {
      console.warn("[v0] Failed to mark all as read:", e)
    }
  },

  // Delete notification
  deleteNotification: (notifId: string): void => {
    try {
      const notifs: Notification[] = readStoredNotifications()
      const updated = notifs.filter((n) => n.id !== notifId)
      writeStoredNotifications(updated)
      try {
        const delKey = scopedDeletedKey()
        const deleted: string[] = JSON.parse(localStorage.getItem(delKey) || "[]")
        if (notifId && !deleted.includes(notifId)) {
          deleted.push(notifId)
          localStorage.setItem(delKey, JSON.stringify(deleted.slice(-500)))
        }
      } catch { /* */ }
      try {
        window.dispatchEvent(
          new CustomEvent(NOTIFICATIONS_CHANGED_EVENT, { detail: { reason: "delete", id: notifId } }),
        )
      } catch { /* */ }
    } catch (e) {
      console.warn("[ghc] Failed to delete notification:", e)
    }
  },

  isDeleted: (notifId: string): boolean => {
    try {
      const deleted: string[] = JSON.parse(localStorage.getItem(scopedDeletedKey()) || "[]")
      return deleted.includes(notifId)
    } catch {
      return false
    }
  },

  // Request browser notification permission
  requestPermission: async (): Promise<boolean> => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") return true
      if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission()
        return permission === "granted"
      }
    }
    return false
  },
}


/** Phase 5 — in-app reward notification (no balance invention). */
export function notifyRewardClaimed(input: {
  title?: string
  message: string
  amountLabel?: string
}): void {
  notificationSystem.addNotification(
    "reward",
    input.title || "Daily reward",
    input.message,
    "🎁",
    { kind: "daily_claim", amountLabel: input.amountLabel },
  )
}

/** Local mirror when you receive engagement on your content (author-only). */
export function notifyContentEngagement(input: {
  kind: "comment" | "like" | "curation" | "upvote" | "downvote" | "comment_reply"
  title: string
  message: string
  postId?: string
  fromUserId?: string
  actorId?: string
}): void {
  const typeMap: Record<string, NotificationType> = {
    comment: "post_comment",
    like: "post_like",
    curation: "curation",
    upvote: "upvote",
    downvote: "downvote",
    comment_reply: "comment_reply",
  }
  const type = typeMap[input.kind] || "system"
  const icon =
    input.kind === "upvote" ? "⬆️" :
    input.kind === "downvote" ? "⬇️" :
    input.kind === "like" ? "❤️" :
    input.kind === "comment" || input.kind === "comment_reply" ? "💬" : "🔔"
  notificationSystem.addNotification(type, input.title, input.message, icon, {
    postId: input.postId,
    fromUserId: input.fromUserId,
    actorId: input.actorId || input.fromUserId,
    kind: input.kind,
    category: "social",
    open: "feed",
  })
}

export function notifyMarketplaceEvent(input: {
  kind: "listing" | "order" | "comment" | "reaction"
  title: string
  message: string
  listingId?: string
}): void {
  const type =
    input.kind === "listing" ? "marketplace_listing" :
    input.kind === "order" ? "marketplace_order" :
    input.kind === "comment" ? "marketplace_comment" : "marketplace_reaction"
  notificationSystem.addNotification(type, input.title, input.message, "🛒", {
    listingId: input.listingId,
    kind: `marketplace_${input.kind}`,
    category: "marketplace",
    open: "marketplace",
  })
}

/** Soft-request browser notification permission once (fail-soft). */
export function requestBrowserNotificationPermission(): void {
  if (typeof window === "undefined" || !("Notification" in window)) return
  if (Notification.permission !== "default") return
  try {
    void Notification.requestPermission()
  } catch {
    /* */
  }
}
