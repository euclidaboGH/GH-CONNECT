/**
 * NotificationDomain — single canonical notification pipeline.
 *
 * Domain events → preference filter → in-app store (+ optional push).
 * Screens must not implement their own notification rules.
 *
 * Reuses lib/notifications.ts storage; does not invent a second store.
 */

import { domainEvents, type DomainEvent, type DomainEventType } from "../realtime/event-bus.ts"
import { IdentityService } from "../identity/identity-service.ts"
import {
  notificationSystem,
  type Notification,
  type NotificationType,
} from "../notifications.ts"

/** User-facing preference categories */
export type NotificationCategory =
  | "messages"
  | "matches"
  | "connections"
  | "comments"
  | "mentions"
  | "communities"
  | "stories"
  | "marketplace"
  | "rewards"
  | "wallet"
  | "premium"
  | "profile_views"
  | "product_updates"
  | "system"

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  "messages",
  "matches",
  "connections",
  "comments",
  "mentions",
  "communities",
  "stories",
  "marketplace",
  "rewards",
  "wallet",
  "premium",
  "profile_views",
  "product_updates",
  "system",
]

export type NotificationChannelPrefs = {
  inApp: boolean
  push: boolean
}

export type NotificationPreferences = Record<NotificationCategory, NotificationChannelPrefs>

const PREFS_KEY = "ghc_notification_preferences"
const ACCOUNT_PREFS_KEY = "ghc_notification_account_preferences"
const DEVICE_PREFS_KEY = "ghc_notification_device_preferences"
function scopedAccountKey(userId = IdentityService.getCurrentUserId()): string {
  return `${ACCOUNT_PREFS_KEY}:${encodeURIComponent(String(userId || "anonymous"))}`
}
function deviceId(): string {
  if (typeof localStorage === "undefined") return "unavailable"
  const key = "ghc_notification_device_id"
  try {
    let id = localStorage.getItem(key)
    if (!id) {
      id = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `device_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`
      localStorage.setItem(key, id)
    }
    return id
  } catch { return "unavailable" }
}
function scopedDeviceKey(userId = IdentityService.getCurrentUserId()): string {
  return `${DEVICE_PREFS_KEY}:${encodeURIComponent(String(userId || "anonymous"))}:${encodeURIComponent(deviceId())}`
}
function parsePrefs(raw: string | null): Partial<Record<NotificationCategory, Partial<NotificationChannelPrefs>>> {
  if (!raw) return {}
  const parsed = JSON.parse(raw)
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}
}
export function defaultNotificationPreferences(): NotificationPreferences {
  const base: NotificationChannelPrefs = { inApp: true, push: true }
  const prefs = {} as NotificationPreferences
  for (const c of NOTIFICATION_CATEGORIES) prefs[c] = { ...base }
  // Security/system notices remain in-app; optional categories start muted.
  prefs.system = { inApp: true, push: false }
  prefs.profile_views = { inApp: false, push: false }
  prefs.product_updates = { inApp: false, push: false }
  return prefs
}

/**
 * Synchronous compatibility view used by notification producers.
 * Account-level inApp choices and this browser's push/browser-alert choices
 * are stored separately. The server is the cross-device account preference
 * authority; localStorage is only its cache.
 */
export function loadNotificationPreferences(userId = IdentityService.getCurrentUserId()): NotificationPreferences {
  try {
    if (typeof localStorage === "undefined") return defaultNotificationPreferences()
    const account = parsePrefs(localStorage.getItem(scopedAccountKey(userId)))
    const device = parsePrefs(localStorage.getItem(scopedDeviceKey(userId)))
    const legacy = parsePrefs(localStorage.getItem(`${PREFS_KEY}:${encodeURIComponent(String(userId || "anonymous"))}`) || (userId === "current-user" ? localStorage.getItem(PREFS_KEY) : null))
    const merged = defaultNotificationPreferences()
    for (const category of NOTIFICATION_CATEGORIES) {
      const old = legacy[category]
      const accountSaved = account[category]
      const deviceSaved = device[category]
      merged[category] = {
        inApp: typeof accountSaved?.inApp === "boolean" ? accountSaved.inApp : typeof old?.inApp === "boolean" ? old.inApp : merged[category].inApp,
        push: typeof deviceSaved?.push === "boolean" ? deviceSaved.push : typeof old?.push === "boolean" ? old.push : merged[category].push,
      }
    }
    return merged
  } catch { return defaultNotificationPreferences() }
}

export function saveNotificationPreferences(prefs: NotificationPreferences, userId = IdentityService.getCurrentUserId()): void {
  saveAccountNotificationPreferences(prefs, userId)
  saveDeviceNotificationPreferences(prefs, userId)
}

export function saveAccountNotificationPreferences(prefs: NotificationPreferences, userId = IdentityService.getCurrentUserId()): void {
  try {
    if (typeof localStorage === "undefined") return
    const account: Record<string, { inApp: boolean }> = {}
    for (const category of NOTIFICATION_CATEGORIES) account[category] = { inApp: Boolean(prefs[category]?.inApp) }
    localStorage.setItem(scopedAccountKey(userId), JSON.stringify(account))
  } catch { /* local cache is best effort; server sync is handled by settings */ }
}

export function saveDeviceNotificationPreferences(prefs: NotificationPreferences, userId = IdentityService.getCurrentUserId()): void {
  try {
    if (typeof localStorage === "undefined") return
    const device: Record<string, { push: boolean }> = {}
    for (const category of NOTIFICATION_CATEGORIES) device[category] = { push: Boolean(prefs[category]?.push) }
    localStorage.setItem(scopedDeviceKey(userId), JSON.stringify(device))
  } catch { /* device preference cache is best effort */ }
}

export function mergeAccountNotificationPreferences(
  prefs: NotificationPreferences,
  accountPrefs: Partial<Record<NotificationCategory, Partial<NotificationChannelPrefs>>>,
  userId = IdentityService.getCurrentUserId(),
): NotificationPreferences {
  const next = { ...prefs }
  for (const category of NOTIFICATION_CATEGORIES) {
    if (typeof accountPrefs[category]?.inApp === "boolean") {
      next[category] = { ...next[category], inApp: accountPrefs[category]!.inApp! }
    }
  }
  saveAccountNotificationPreferences(next, userId)
  return next
}

export function serializeAccountNotificationPreferences(prefs: NotificationPreferences): Record<string, { inApp: boolean }> {
  return Object.fromEntries(NOTIFICATION_CATEGORIES.map((category) => [category, { inApp: Boolean(prefs[category]?.inApp) }]))
}

/** Hydrate account-level in-app choices once after authenticated app bootstrap. */
export async function hydrateAccountNotificationPreferences(userId = IdentityService.getCurrentUserId()): Promise<boolean> {
  const owner = String(userId || "").trim()
  if (!owner || owner === "anonymous" || owner === "current-user" || typeof window === "undefined") return false
  try {
    const response = await fetch("/api/notifications/preferences", {
      headers: { ...IdentityService.getAuthHeaders(), Accept: "application/json" },
      cache: "no-store",
    })
    const body = await response.json().catch(() => null)
    if (!response.ok || body?.ok !== true || !body?.preferences || IdentityService.getCurrentUserId() !== owner) return false
    mergeAccountNotificationPreferences(loadNotificationPreferences(owner), body.preferences, owner)
    return body.durable === true
  } catch { return false }
}

/** Map domain event → category + presentation */
export function mapEventToNotification(
  event: DomainEvent
): {
  category: NotificationCategory
  type: NotificationType
  title: string
  message: string
  icon: string
  data?: Record<string, unknown>
} | null {
  const p = (event.payload || {}) as Record<string, any>
  switch (event.type as DomainEventType) {
    case "FOLLOW_CREATED":
      return {
        category: "connections",
        type: "follow",
        title: "New follower",
        message: "Someone started following you",
        icon: "👤",
        data: {
          ...p,
          open: "discover",
          deepLink: { tab: "discover", userId: p.followerId || p.fromUserId || p.userId },
        },
      }
    case "FRIEND_REQUEST_SENT":
      return {
        category: "connections",
        type: "friend_request",
        title: "Connection request",
        message: "You have a new connection request",
        icon: "🤝",
        data: p,
      }
    case "FRIEND_ACCEPTED":
      return {
        category: "connections",
        type: "friend_request",
        title: "Request accepted",
        message: "Your connection request was accepted",
        icon: "✅",
        data: p,
      }
    case "MATCH_CREATED":
      return {
        category: "matches",
        type: "match",
        title: "It's a Match!",
        message: "You have a new match",
        icon: "💕",
        data: p,
      }
    case "COMMENT_CREATED":
      return {
        category: p.replyTo ? "comments" : "comments",
        type: "comment",
        title: p.replyTo ? "New reply" : "New comment",
        message: p.replyTo ? "Someone replied to a comment" : "Someone commented on your post",
        icon: "💬",
        data: p,
      }
    case "LIKE_ADDED":
      return {
        category: "comments",
        type: "like",
        title: "New reaction",
        message: "Someone liked your content",
        icon: "❤️",
        data: p,
      }
    case "MESSAGE_CREATED":
      return {
        category: "messages",
        type: "message",
        title: "New message",
        message: "You received a message",
        icon: "✉️",
        data: p,
      }
    case "STORY_CREATED":
      return {
        category: "stories",
        type: "story_reply",
        title: "New story",
        message: "Someone you follow posted a story",
        icon: "📱",
        data: p,
      }
    case "CONVERSATION_CREATED":
      if (p.kind === "community") {
        return {
          category: "communities",
          type: "group",
          title: "Community",
          message: "Community conversation opened",
          icon: "🏘️",
          data: p,
        }
      }
      return null
    case "GROUP_JOINED":
      return {
        category: "communities",
        type: "group",
        title: "Community invitation",
        message: "You joined a community",
        icon: "🏘️",
        data: p,
      }
    case "COMMUNITY_ANNOUNCEMENT":
      return {
        category: "communities",
        type: "group",
        title: "Community announcement",
        message: p.title || "New announcement in a community",
        icon: "📢",
        data: p,
      }
    case "MARKETPLACE_ORDER_CREATED":
    case "MARKETPLACE_ORDER_UPDATED":
    case "MARKETPLACE_ORDER_COMPLETED":
      return {
        category: "marketplace",
        type: "system",
        title: "Marketplace",
        message: "Your order status was updated",
        icon: "🛍️",
        data: {
          ...p,
          open: "discover",
          deepLink: { open: "discover", tab: "discover" },
        },
      }
    case "WALLET_TRANSFER_COMPLETED": {
      const amount = p.amount != null ? Number(p.amount) : null
      const amtLabel = amount != null && Number.isFinite(amount) ? String(amount) : "GHC"
      const role = p.role || (p.direction === "receive" ? "received" : "sent")
      const name =
        p.counterpartyName || p.toUserName || p.fromUserName || p.toUserId || p.fromUserId || "member"
      const ref = p.referenceId || p.requestId || event.requestId
      if (role === "received") {
        return {
          category: "wallet",
          type: "ghc_received",
          title: "GHC received",
          message: `You received ${amtLabel} GHC from ${name}.`,
          icon: "🪙",
          data: {
            ...p,
            open: "wallet",
            referenceId: ref,
            dedupeKey: ref ? `GHC_RECEIVED:${ref}` : undefined,
            ghcEvent: "GHC_RECEIVED",
            deepLink: { open: "wallet", tab: "wallet", section: "transaction", transactionId: ref },
          },
        }
      }
      return {
        category: "wallet",
        type: "ghc_sent",
        title: "GHC sent",
        message: `${amtLabel} GHC sent to ${name}.`,
        icon: "🪙",
        data: {
          ...p,
          open: "wallet",
          referenceId: ref,
          dedupeKey: ref ? `GHC_SENT:${ref}` : undefined,
          ghcEvent: "GHC_SENT",
          deepLink: { open: "wallet", tab: "wallet", section: "transaction", transactionId: ref },
        },
      }
    }
    case "WALLET_TRANSFER_FAILED":
      return {
        category: "wallet",
        type: "system",
        title: "GHC transfer failed",
        message: p.reason || p.message || "Your GHC transfer could not be completed.",
        icon: "⚠️",
        data: {
          ...p,
          open: "transaction",
          dedupeKey: p.referenceId
            ? `GHC_TRANSFER_FAILED:${p.referenceId}:${p.code || "fail"}`
            : undefined,
          ghcEvent: "GHC_TRANSFER_FAILED",
        },
      }
    case "WALLET_TRANSFER_CREATED": {
      const ev = String(p.event || "")
      if (ev === "GHC_REQUEST_DECLINED") {
        return {
          category: "wallet",
          type: "system",
          title: "Request declined",
          message: p.message || "Your GHC request was declined.",
          icon: "🪙",
          data: {
            ...p,
            open: "requests",
            dedupeKey: p.referenceId ? `GHC_REQUEST_DECLINED:${p.referenceId}` : undefined,
            ghcEvent: "GHC_REQUEST_DECLINED",
          },
        }
      }
      if (ev === "GHC_REQUEST_CANCELLED") {
        return {
          category: "wallet",
          type: "system",
          title: "Request cancelled",
          message: p.message || "A GHC request was cancelled.",
          icon: "🪙",
          data: {
            ...p,
            open: "requests",
            dedupeKey: p.referenceId ? `GHC_REQUEST_CANCELLED:${p.referenceId}` : undefined,
            ghcEvent: "GHC_REQUEST_CANCELLED",
          },
        }
      }
      if (ev === "GHC_REQUEST_EXPIRED") {
        return {
          category: "wallet",
          type: "system",
          title: "Request expired",
          message: p.message || "A GHC request has expired.",
          icon: "🪙",
          data: {
            ...p,
            open: "requests",
            dedupeKey: p.referenceId ? `GHC_REQUEST_EXPIRED:${p.referenceId}` : undefined,
            ghcEvent: "GHC_REQUEST_EXPIRED",
          },
        }
      }
      if (p.request || p.kind === "request" || ev === "GHC_REQUEST_CREATED") {
        return {
          category: "wallet",
          type: "system",
          title: "GHC request",
          message: p.message || `${p.counterpartyName || "Someone"} requested GHC.`,
          icon: "🪙",
          data: {
            ...p,
            open: "requests",
            dedupeKey: p.referenceId ? `GHC_REQUEST_CREATED:${p.referenceId}` : undefined,
            ghcEvent: "GHC_REQUEST_CREATED",
          },
        }
      }
      return null
    }
    case "WALLET_BALANCE_UPDATED":
      // Balance updates alone are not user-facing when transfer completed already notified
      return null
    case "REWARD_EARNED":
      return {
        category: "rewards",
        type: "reward",
        title: "Reward earned",
        message: p.message || p.title || "You earned a reward — claim it in Rewards",
        icon: "🎁",
        data: {
          ...p,
          open: "rewards",
          deepLink: { open: "rewards", tab: "rewards", id: p.rewardId || p.holdId },
        },
      }
    case "PREMIUM_ACTIVATED":
    case "PREMIUM_UPDATED":
      return {
        category: "premium",
        type: "system",
        title: "Membership updated",
        message: p.message || "Your membership benefits were updated",
        icon: "⭐",
        data: {
          ...p,
          open: "membership",
          deepLink: { open: "membership", tab: "membership" },
        },
      }
    case "REPORT_CREATED":
      return {
        category: "system",
        type: "system",
        title: "Report received",
        message: "Thanks — we received your report",
        icon: "🛡️",
        data: {
          ...p,
          open: "feed",
          deepLink: { open: "feed", tab: "home" },
        },
      }
    default:
      return null
  }
}

/** Explicit emit for marketplace / wallet / rewards / premium (events may arrive later) */
export type ExplicitNotificationInput = {
  category: NotificationCategory
  type?: NotificationType
  title: string
  message: string
  icon?: string
  data?: Record<string, unknown>
  actorId?: string
}

export function createNotificationDomain(deps?: {
  getPreferences?: () => NotificationPreferences
  setPreferences?: (p: NotificationPreferences) => void
  /** Skip notifying the actor about their own actions */
  suppressSelf?: boolean
  currentUserId?: string
}) {
  const actorMe = deps?.currentUserId || "current-user"
  let unsub: (() => void) | null = null

  function prefs(): NotificationPreferences {
    return deps?.getPreferences?.() || loadNotificationPreferences(actorMe)
  }

  function shouldDeliver(category: NotificationCategory, channel: "inApp" | "push"): boolean {
    const p = prefs()[category] || { inApp: true, push: true }
    return Boolean(p[channel])
  }

  function deliver(
    mapped: NonNullable<ReturnType<typeof mapEventToNotification>>,
    actorId?: string
  ): Notification | null {
    if (deps?.suppressSelf !== false && actorId && actorId === actorMe) {
      // Wallet: allow sender confirmations (GHC sent / failed)
      if (mapped.category !== "system" && mapped.category !== "wallet") return null
    }
    // Recipient-targeted events: only deliver when this session is the target
    const target = (mapped.data?.targetUserId || mapped.data?.toUserId) as string | undefined
    const role = mapped.data?.role as string | undefined
    if (role === "received" && target && target !== actorMe) {
      return null
    }
    if (!shouldDeliver(mapped.category, "inApp")) return null

    // Push: only if preference allows (browser Notification is inside notificationSystem)
    if (!shouldDeliver(mapped.category, "push") && typeof window !== "undefined") {
      // Soft: add in-app only by temporarily skipping browser — still store in-app
    }

    return notificationSystem.addNotification(
      mapped.type,
      mapped.title,
      mapped.message,
      mapped.icon || "🔔",
      { ...mapped.data, category: mapped.category, actorId, pushEnabled: shouldDeliver(mapped.category, "push") }
    )
  }

  return {
    getPreferences: prefs,

    updatePreferences(
      patch: Partial<Record<NotificationCategory, Partial<NotificationChannelPrefs>>>
    ): NotificationPreferences {
      const next = { ...prefs() }
      for (const key of Object.keys(patch) as NotificationCategory[]) {
        next[key] = { ...next[key], ...patch[key] }
      }
      if (deps?.setPreferences) deps.setPreferences(next)
      else saveNotificationPreferences(next, actorMe)
      return next
    },

    setCategoryEnabled(
      category: NotificationCategory,
      channel: "inApp" | "push",
      enabled: boolean
    ): NotificationPreferences {
      return this.updatePreferences({ [category]: { [channel]: enabled } })
    },

    list(blockedUserIds: string[] = [], mutedUserIds: string[] = []): Notification[] {
      if (typeof notificationSystem.getVisibleNotifications === "function") {
        return notificationSystem.getVisibleNotifications(blockedUserIds, mutedUserIds)
      }
      return notificationSystem.getNotifications()
    },

    markRead(id: string) {
      notificationSystem.markAsRead?.(id)
    },

    markAllRead() {
      notificationSystem.markAllAsRead?.()
    },

    /** Emit from non-event sources (marketplace, wallet, rewards, premium) */
    notify(input: ExplicitNotificationInput): Notification | null {
      return deliver(
        {
          category: input.category,
          type: input.type || "system",
          title: input.title,
          message: input.message,
          icon: input.icon || "🔔",
          data: input.data,
        },
        input.actorId
      )
    },

    /** Handle a single domain event */
    handleDomainEvent(event: DomainEvent): Notification | null {
      const mapped = mapEventToNotification(event)
      if (!mapped) return null
      return deliver(mapped, event.actorId)
    },

    /** Subscribe to the global domain event bus (call once per session) */
    startEventBridge(): () => void {
      if (unsub) return unsub
      unsub = domainEvents.on("*", (event) => {
        try {
          this.handleDomainEvent(event)
        } catch {
          /* never break publishers */
        }
      })
      return () => {
        unsub?.()
        unsub = null
      }
    },

    stopEventBridge() {
      unsub?.()
      unsub = null
    },
  }
}

export type NotificationDomain = ReturnType<typeof createNotificationDomain>
