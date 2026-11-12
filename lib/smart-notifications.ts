/**
 * Smart Notifications — prioritization helpers.
 *
 * Compatibility: persistence / canonical in-app list is owned by
 * `lib/notifications.ts` (`notificationSystem`). This module keeps its
 * priority + push-queue API but mirrors creates into notificationSystem
 * so gradual migration does not fork notification storage.
 */

import { notificationSystem } from "./notifications"
import { loadNotificationPreferences, type NotificationCategory } from "./domains/notification-domain"
import { IdentityService } from "@/lib/identity/identity-service"

export type NotificationType = "match" | "message" | "like" | "friend-request" | "system"
export type NotificationPriority = "high" | "medium" | "low"

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  priority: NotificationPriority
  timestamp: number
  read: boolean
  actionUrl?: string
  deepLink?: string
  ownerUserId?: string
}

const TYPE_ICON: Record<NotificationType, string> = {
  match: "heart",
  message: "message",
  like: "thumbs-up",
  "friend-request": "user-plus",
  system: "bell",
}

/** Map smart type → notificationSystem type */
function toSystemType(type: NotificationType): Parameters<typeof notificationSystem.addNotification>[0] {
  if (type === "friend-request") return "friend_request"
  return type as Parameters<typeof notificationSystem.addNotification>[0]
}

let smartNotificationOwner = IdentityService.getCurrentUserId()
function ensureSmartNotificationOwner(): string {
  const current = IdentityService.getCurrentUserId()
  if (current !== smartNotificationOwner) {
    smartNotificationOwner = current
    smartNotifications.notifications = []
    smartNotifications.browserAlertQueue = []
  }
  return current
}

export const smartNotifications = {
  // Local prioritization mirror (non-authoritative), scoped to the active identity.
  notifications: [] as Notification[],

  // Legacy local browser-alert batching queue; this is not a remote Web Push queue.
  browserAlertQueue: [] as Notification[],

  // Generate notification — mirrors into canonical notificationSystem
  create: (
    type: NotificationType,
    title: string,
    message: string,
    options?: {
      actionUrl?: string
      deepLink?: string
      priority?: NotificationPriority
    }
  ): Notification => {
    const ownerUserId = ensureSmartNotificationOwner()
    const notification: Notification = {
      id: `notif-${Date.now()}-${Math.random()}`,
      type,
      title,
      message,
      timestamp: Date.now(),
      read: false,
      priority: options?.priority || smartNotifications.getPriorityForType(type),
      actionUrl: options?.actionUrl,
      deepLink: options?.deepLink,
      ownerUserId,
    }

    smartNotifications.notifications.push(notification)
    // notificationSystem owns in-app persistence. Suppress its browser-alert
    // side effect here, then route the optional browser alert through this
    // module exactly once so push-only preferences continue to work.
    try {
      const categoryByType: Record<NotificationType, NotificationCategory> = {
        match: "matches", message: "messages", like: "comments",
        "friend-request": "connections", system: "system",
      }
      const category = categoryByType[type]
      if (loadNotificationPreferences()[category]?.inApp) {
        notificationSystem.addNotification(
          toSystemType(type),
          title,
          message,
          TYPE_ICON[type] || "bell",
          { actionUrl: options?.actionUrl, deepLink: options?.deepLink, priority: notification.priority, category, pushEnabled: false }
        )
      }
    } catch {
      /* notificationSystem may be unavailable in non-browser tests */
    }

    smartNotifications.scheduleNotification(notification)
    return notification
  },

  // Determine priority based on notification type
  getPriorityForType: (type: NotificationType): NotificationPriority => {
    switch (type) {
      case "match":
      case "friend-request":
        return "high"
      case "message":
        return "high"
      case "like":
        return "medium"
      case "system":
        return "low"
      default:
        return "medium"
    }
  },

  // Schedule a local browser alert (respects user preferences). Not remote Web Push.
  scheduleNotification: (notification: Notification) => {
    const ownerUserId = ensureSmartNotificationOwner()
    if (notification.ownerUserId && notification.ownerUserId !== ownerUserId) return
    // Check whether the user opted into local browser alerts for this category.
    if (smartNotifications.shouldSendNotification(notification)) {
      smartNotifications.browserAlertQueue.push(notification)

      // Send immediately if high priority
      if (notification.priority === "high") {
        smartNotifications.showBrowserAlert(notification)
      } else {
        // Batch send lower priority notifications
        setTimeout(() => {
          smartNotifications.flushBrowserAlertQueue()
        }, 5000)
      }
    }
  },

  // Check if notification should be sent based on user settings
  shouldSendNotification: (notification: Notification): boolean => {
    const categoryByType: Record<NotificationType, NotificationCategory> = {
      match: "matches",
      message: "messages",
      like: "comments",
      "friend-request": "connections",
      system: "system",
    }
    try {
      return Boolean(loadNotificationPreferences()[categoryByType[notification.type]]?.push)
    } catch {
      return false
    }
  },

  // Display a local browser alert through the service worker. This does not contact a push provider.
  showBrowserAlert: async (notification: Notification) => {
    const ownerUserId = ensureSmartNotificationOwner()
    if (notification.ownerUserId && notification.ownerUserId !== ownerUserId) return
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      const options = {
        body: notification.message,
        icon: "/icon-light-32x32.png",
        tag: notification.type,
        requireInteraction: notification.priority === "high",
        data: { deepLink: notification.deepLink, actionUrl: notification.actionUrl },
      }
      try {
        if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
          const registration = await navigator.serviceWorker.ready
          // Local display only; no PushSubscription or remote provider is involved.
          await registration.showNotification(notification.title, options)
        } else {
          new Notification(notification.title, options)
        }
      } catch (error) {
        console.warn("[GreenHaven] Local browser alert failed:", error)
      }
    }
  },

  // Flush queued local browser alerts.
  flushBrowserAlertQueue: async () => {
    const ownerUserId = ensureSmartNotificationOwner()
    while (smartNotifications.browserAlertQueue.length > 0 && IdentityService.getCurrentUserId() === ownerUserId) {
      const notification = smartNotifications.browserAlertQueue.shift()
      if (notification) {
        await smartNotifications.showBrowserAlert(notification)
        // Stagger notifications
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }
  },

  // Mark notification as read
  markAsRead: (notificationId: string) => {
    ensureSmartNotificationOwner()
    const notif = smartNotifications.notifications.find((n) => n.id === notificationId)
    if (notif) {
      notif.read = true
    }
  },

  // Get unread count
  getUnreadCount: (): number => {
    ensureSmartNotificationOwner()
    return smartNotifications.notifications.filter((n) => !n.read).length
  },

  // Get notifications by type
  getByType: (type: NotificationType): Notification[] => {
    ensureSmartNotificationOwner()
    return smartNotifications.notifications.filter((n) => n.type === type)
  },

  // Clear old notifications (older than 7 days)
  cleanup: () => {
    ensureSmartNotificationOwner()
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    smartNotifications.notifications = smartNotifications.notifications.filter(
      (n) => n.timestamp > weekAgo
    )
  },

  // Get notification summary
  getSummary: () => {
    ensureSmartNotificationOwner()
    return {
      total: smartNotifications.notifications.length,
      unread: smartNotifications.getUnreadCount(),
      byType: {
        match: smartNotifications.getByType("match").length,
        message: smartNotifications.getByType("message").length,
        like: smartNotifications.getByType("like").length,
        friendRequest: smartNotifications.getByType("friend-request").length,
      },
    }
  },
}
