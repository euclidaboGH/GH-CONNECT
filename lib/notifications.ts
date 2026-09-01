// Real-time notifications system

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

const NOTIFICATIONS_KEY = "ghc_notifications"
const MAX_NOTIFICATIONS = 100

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

      const stored = localStorage.getItem(NOTIFICATIONS_KEY)
      const notifs: Notification[] = stored ? JSON.parse(stored) : []

      // Phase D6: dedupe by data.dedupeKey when present
      const dedupeKey = data && typeof data === "object" ? (data as any).dedupeKey : undefined
      if (dedupeKey) {
        const existing = notifs.find((n) => (n.data as any)?.dedupeKey === dedupeKey)
        if (existing) return existing
      }

      // Prevent near-duplicate notifications (same type+title within 30s)
      const dup = notifs.some(
        (n) =>
          n.type === type &&
          n.title === title &&
          n.message === message &&
          Date.now() - (n.timestamp || 0) < 30_000,
      )
      if (!dup) {
        notifs.push(notification)
      }

      // Keep only last MAX_NOTIFICATIONS
      const trimmed = notifs.slice(-MAX_NOTIFICATIONS)
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(trimmed))

      // Try to show browser notification if allowed
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, {
          body: message,
          icon: icon,
          tag: type,
        })
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
      const stored = localStorage.getItem(NOTIFICATIONS_KEY)
      return stored ? JSON.parse(stored) : []
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
      const from = (n.data?.fromUserId || n.data?.userId || n.data?.actorId) as string | undefined
      if (from && set.has(from)) return false
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
      const stored = localStorage.getItem(NOTIFICATIONS_KEY)
      if (!stored) return

      const notifs: Notification[] = JSON.parse(stored)
      const updated = notifs.map((n) => (n.id === notifId ? { ...n, read: true } : n))

      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated))
    } catch (e) {
      console.warn("[v0] Failed to mark as read:", e)
    }
  },

  // Mark all as read
  markAllAsRead: (): void => {
    try {
      const stored = localStorage.getItem(NOTIFICATIONS_KEY)
      if (!stored) return

      const notifs: Notification[] = JSON.parse(stored)
      const updated = notifs.map((n) => ({ ...n, read: true }))

      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated))
    } catch (e) {
      console.warn("[v0] Failed to mark all as read:", e)
    }
  },

  // Delete notification
  deleteNotification: (notifId: string): void => {
    try {
      const stored = localStorage.getItem(NOTIFICATIONS_KEY)
      if (!stored) return

      const notifs: Notification[] = JSON.parse(stored)
      const updated = notifs.filter((n) => n.id !== notifId)

      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated))
    } catch (e) {
      console.warn("[v0] Failed to delete notification:", e)
    }
  },

  // Request browser notification permission
  requestPermission: async (): Promise<boolean> => {
    if ("Notification" in window) {
      if (Notification.permission === "granted") return true
      if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission()
        return permission === "granted"
      }
    }
    return false
  },
}
