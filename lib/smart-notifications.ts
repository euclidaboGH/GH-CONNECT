/**
 * Smart Notifications — prioritization helpers.
 *
 * Compatibility: persistence / canonical in-app list is owned by
 * `lib/notifications.ts` (`notificationSystem`). This module keeps its
 * priority + push-queue API but mirrors creates into notificationSystem
 * so gradual migration does not fork notification storage.
 */

import { notificationSystem } from "./notifications"

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

export const smartNotifications = {
  // Local prioritization mirror (non-authoritative)
  notifications: [] as Notification[],

  // Queue for Web Push API
  pushQueue: [] as Notification[],

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
    }

    smartNotifications.notifications.push(notification)
    smartNotifications.scheduleNotification(notification)

    try {
      notificationSystem.addNotification(
        toSystemType(type),
        title,
        message,
        TYPE_ICON[type] || "bell",
        { actionUrl: options?.actionUrl, deepLink: options?.deepLink, priority: notification.priority }
      )
    } catch {
      /* notificationSystem may be unavailable in non-browser tests */
    }

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

  // Schedule notification delivery (respects user preferences)
  scheduleNotification: (notification: Notification) => {
    // Check if notifications are enabled and notification time is appropriate
    if (smartNotifications.shouldSendNotification(notification)) {
      smartNotifications.pushQueue.push(notification)

      // Send immediately if high priority
      if (notification.priority === "high") {
        smartNotifications.sendPushNotification(notification)
      } else {
        // Batch send lower priority notifications
        setTimeout(() => {
          smartNotifications.flushPushQueue()
        }, 5000)
      }
    }
  },

  // Check if notification should be sent based on user settings
  shouldSendNotification: (notification: Notification): boolean => {
    // In production, would check user notification settings
    // For now, always send
    return true
  },

  // Send Web Push notification
  sendPushNotification: async (notification: Notification) => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      try {
        const registration = await navigator.serviceWorker.ready
        
        // Send notification via service worker
        registration.showNotification(notification.title, {
          body: notification.message,
          icon: "/icon-light-32x32.png",
          tag: notification.type,
          requireInteraction: notification.priority === "high",
          data: {
            deepLink: notification.deepLink,
            actionUrl: notification.actionUrl,
          },
        })
      } catch (error) {
        console.log("[v0] Push notification failed:", error)
      }
    }
  },

  // Flush queued notifications
  flushPushQueue: async () => {
    while (smartNotifications.pushQueue.length > 0) {
      const notification = smartNotifications.pushQueue.shift()
      if (notification) {
        await smartNotifications.sendPushNotification(notification)
        // Stagger notifications
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }
  },

  // Mark notification as read
  markAsRead: (notificationId: string) => {
    const notif = smartNotifications.notifications.find((n) => n.id === notificationId)
    if (notif) {
      notif.read = true
    }
  },

  // Get unread count
  getUnreadCount: (): number => {
    return smartNotifications.notifications.filter((n) => !n.read).length
  },

  // Get notifications by type
  getByType: (type: NotificationType): Notification[] => {
    return smartNotifications.notifications.filter((n) => n.type === type)
  },

  // Clear old notifications (older than 7 days)
  cleanup: () => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    smartNotifications.notifications = smartNotifications.notifications.filter(
      (n) => n.timestamp > weekAgo
    )
  },

  // Get notification summary
  getSummary: () => {
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
