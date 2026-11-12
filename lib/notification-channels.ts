/**
 * Notification channels — thread history by source (actor + surface + entity).
 * Same channel keeps prior notifications readable until the user deletes them.
 */

import type { Notification, NotificationType } from "./notifications"
import type { NotificationCenterBucket } from "./notification-center"

/** Stable channel id for grouping history (like a DM thread). */
export function notificationChannelKey(n: Notification): string {
  const d = (n.data || {}) as Record<string, unknown>
  const actor =
    String(d.actorId || d.actorUserId || d.fromUserId || d.userId || "").trim() || "system"
  const entity =
    String(d.postId || d.entityId || d.listingId || d.conversationId || d.requestId || d.groupId || "").trim() ||
    "general"
  const surface = channelSurface(n.type)
  return `${surface}:${actor}:${entity}`
}

export function channelSurface(type: NotificationType): string {
  switch (type) {
    case "message":
      return "messages"
    case "like":
    case "post_like":
    case "comment":
    case "post_comment":
    case "story_reply":
    case "share":
    case "mention":
    case "curation":
      return "social"
    case "match":
    case "follow":
    case "friend_request":
    case "connection_request":
      return "requests"
    case "group":
      return "community"
    case "ghc_received":
    case "ghc_sent":
    case "payment":
      return "ghc"
    case "reward":
      return "rewards"
    case "system":
      return "system"
    default:
      return "other"
  }
}

export type NotificationThread = {
  channelKey: string
  latest: Notification
  history: Notification[]
  unreadCount: number
}

/** Group newest-first list into threads; history sorted oldest→newest within thread. */
export function groupNotificationsIntoThreads(items: Notification[]): NotificationThread[] {
  const map = new Map<string, Notification[]>()
  for (const n of items) {
    const key = notificationChannelKey(n)
    const bucket = map.get(key) || []
    bucket.push(n)
    map.set(key, bucket)
  }
  const threads: NotificationThread[] = []
  for (const [channelKey, list] of map) {
    const sorted = [...list].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    const history = [...sorted].reverse()
    threads.push({
      channelKey,
      latest: sorted[0],
      history,
      unreadCount: sorted.filter((x) => !x.read).length,
    })
  }
  threads.sort((a, b) => (b.latest.timestamp || 0) - (a.latest.timestamp || 0))
  return threads
}

export function marketplaceBucketTypes(): Set<string> {
  return new Set([
    "marketplace_listing",
    "marketplace_order",
    "marketplace_comment",
    "marketplace_reaction",
  ])
}

/** Extended client type strings that may appear in data.kind */
export function resolveBucketFromNotification(n: Notification): NotificationCenterBucket {
  const d = (n.data || {}) as Record<string, unknown>
  const kind = String(d.kind || d.category || "").toLowerCase()
  if (kind.startsWith("marketplace") || d.listingId) return "marketplace"
  if (kind === "community" || n.type === "group") return "community"
  const surface = channelSurface(n.type)
  if (surface === "messages") return "messages"
  if (surface === "social") return "social"
  if (surface === "requests") return "requests"
  if (surface === "ghc") return "ghc"
  if (surface === "rewards") return "rewards"
  if (surface === "community") return "community"
  if (surface === "system") return "system"
  return "system"
}
