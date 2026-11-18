/**
 * Unified notification center — buckets + deep-links.
 *
 * Buckets: All | Social | Messages | GHC | Rewards | Requests | System
 *
 * Rules:
 * - Every notification resolves to a concrete surface (feed, chat, wallet, …).
 * - Generic / social / reward items NEVER open Settings.
 * - Settings only for explicit security / verification / privacy system items.
 */

import type { Notification, NotificationType } from "./notifications"
import { resolveNotificationDeepLinkFromRecord, sanitizeNotificationDeepLink, type NotificationDeepLink } from "./notification-targets"
export type { NotificationDeepLink } from "./notification-targets"
import { navigateTo, openCommunity, openChat } from "@/lib/navigation/navigate"
import {
  isCommunityNotification,
  communityNotificationLabel,
} from "@/lib/domains/adapters/community-notification"

export type NotificationCenterBucket =
  | "all"
  | "social"
  | "messages"
  | "ghc"
  | "rewards"
  | "requests"
  | "community"
  | "marketplace"
  | "system"

export const NOTIFICATION_CENTER_BUCKETS: {
  id: NotificationCenterBucket
  label: string
}[] = [
  { id: "all", label: "All" },
  { id: "social", label: "Social" },
  { id: "messages", label: "Messages" },
  { id: "ghc", label: "GHC" },
  { id: "rewards", label: "Rewards" },
  { id: "requests", label: "Requests" },
  { id: "community", label: "Community" },
  { id: "marketplace", label: "Market" },
  { id: "system", label: "System" },
]

const SOCIAL_TYPES = new Set<NotificationType>([
  "upvote",
  "downvote",
  "comment_reply",
  "like",
  "comment",
  "follow",
  "match",
  "share",
  "story_reply",
  "mention",
])
const MESSAGE_TYPES = new Set<NotificationType>(["message", "group"])
const REQUEST_TYPES = new Set<NotificationType>(["friend_request"])
const GHC_TYPES = new Set<NotificationType>(["ghc_received", "ghc_sent", "payment"])
const REWARD_TYPES = new Set<NotificationType>(["reward"])

function blobOf(n: Notification): string {
  return `${n.title || ""} ${n.message || ""}`.toLowerCase()
}

export function bucketForNotification(n: Notification): Exclude<NotificationCenterBucket, "all"> {
  const data = (n.data || {}) as Record<string, unknown>
  const cat = String(data.category || data.bucket || "").toLowerCase()
  const open = String(data.open || "").toLowerCase()

  if (REWARD_TYPES.has(n.type) || cat === "rewards" || open === "rewards" || /reward|streak|mission|claim|xp/i.test(blobOf(n))) {
    // Pure reward journey — not wallet ledger
    if (!GHC_TYPES.has(n.type) && open !== "wallet" && cat !== "wallet") {
      return "rewards"
    }
  }

  if (
    GHC_TYPES.has(n.type) ||
    cat === "wallet" ||
    cat === "ghc" ||
    open === "wallet" ||
    data.ghcEvent ||
    data.holdId ||
    data.amountGhc ||
    /transfer|payment|sent ghc|received ghc|balance/i.test(blobOf(n))
  ) {
    return "ghc"
  }

  if (isCommunityNotification(n) || cat === "community" || cat === "communities" || open === "communities") {
    // Community invite/join/announcement — distinct from friend requests
    return "community"
  }

  if (REQUEST_TYPES.has(n.type) || open === "requests" || open === "group-request" || cat === "requests") {
    return "requests"
  }

  if (MESSAGE_TYPES.has(n.type) || cat === "messages" || cat === "mentions" || open === "messages" || open === "chat") {
    return "messages"
  }

  if (
    cat === "system" ||
    (n.type === "system" && (open === "settings" || open === "security" || open === "verification"))
  ) {
    return "system"
  }

  if (
    cat === "marketplace" ||
    open === "marketplace" ||
    data.listingId ||
    n.type === "marketplace_listing" ||
    n.type === "marketplace_order" ||
    n.type === "marketplace_comment" ||
    n.type === "marketplace_reaction" ||
    /listing|marketplace|order sold|product/i.test(blobOf(n))
  ) {
    return "marketplace"
  }

  if (
    SOCIAL_TYPES.has(n.type) ||
    cat === "comments" ||
    cat === "matches" ||
    cat === "connections" ||
    cat === "stories" ||
    open === "feed" ||
    open === "home" ||
    open === "post"
  ) {
    return "social"
  }

  if (n.type === "system") {
    const b = blobOf(n)
    if (/privacy|security|password|verify|verification|account restricted/i.test(b)) return "system"
    if (/reward|streak|mission/i.test(b)) return "rewards"
    if (/wallet|ghc|transfer|payment/i.test(b)) return "ghc"
    if (/message|chat/i.test(b)) return "messages"
    return "social"
  }

  return "social"
}

export function filterByBucket(
  items: Notification[],
  bucket: NotificationCenterBucket
): Notification[] {
  if (bucket === "all") return items
  return items.filter((n) => bucketForNotification(n) === bucket)
}

/** Resolve deep-link from notification data + type — never default to Settings. */

/** Resolve every notification through the same strict target contract. */
export function resolveNotificationDeepLink(n: Notification): NotificationDeepLink {
  return resolveNotificationDeepLinkFromRecord({
    id: n.id,
    type: String(n.type || "system"),
    data: (n.data || {}) as Record<string, unknown>,
  })
}

/** Dispatch one deterministic in-app navigation request after the owning surface mounts. */
export function navigateNotificationDeepLink(rawLink: NotificationDeepLink): void {
  try {
    // Treat this exported dispatcher as a trust boundary: callers may pass
    // hand-built targets, not only values produced by the resolver.
    const link = sanitizeNotificationDeepLink(rawLink)
    const surface = link.open || link.tab
    const targetDetails = {
      transactionId: link.transactionId,
      paymentIntentId: link.paymentIntentId,
      payoutRequestId: link.payoutRequestId,
      requestId: link.requestId,
      referenceId: link.referenceId,
      rewardId: link.rewardId,
      claimId: link.claimId,
      orderId: link.orderId,
      listingId: link.listingId,
      postId: link.postId,
      commentId: link.commentId,
      parentId: link.parentId,
      threadRootId: link.threadRootId,
      responseAction: link.responseAction,
      responseAt: link.responseAt,
    }

    if (surface === "wallet" || link.tab === "wallet") {
      window.dispatchEvent(new CustomEvent("ghc:open-wallet", {
        detail: { ...targetDetails, section: link.section, openRequests: link.section === "transfer-request" },
      }))
    } else if (surface === "marketplace" || link.listingId || link.orderId) {
      navigateTo("marketplace", { listingId: link.listingId || undefined })
      window.setTimeout(() => window.dispatchEvent(new CustomEvent("ghc:open-marketplace", {
        detail: {
          bucket: link.orderId ? "orders" : "browse",
          listingId: link.listingId || undefined,
          orderId: link.orderId || undefined,
          responseAction: link.responseAction,
          responseAt: link.responseAt,
        },
      })), 120)
    } else if (surface === "rewards" || link.tab === "rewards") {
      window.dispatchEvent(new CustomEvent("ghc:open-rewards", {
        detail: { ...targetDetails, tab: "history", section: link.section || "history" },
      }))
    } else if (surface === "membership" || link.tab === "membership") {
      navigateTo("membership")
    } else if (surface === "settings" || link.tab === "settings") {
      window.dispatchEvent(new CustomEvent("ghc:open-settings", { detail: { section: link.section || "main" } }))
    } else if (surface === "communities" || link.tab === "communities") {
      if (link.groupId) openCommunity(link.groupId)
      else navigateTo("communities")
    } else if (surface === "messages" || surface === "chat" || link.tab === "messages") {
      navigateTo("messages")
      if (link.conversationId) {
        window.setTimeout(() => window.dispatchEvent(new CustomEvent("ghc:open-conversation", {
          detail: { conversationId: link.conversationId, peerUserId: link.userId, kind: link.groupId ? "community" : "dm" },
        })), 120)
      } else if (link.userId) {
        window.setTimeout(() => openChat(link.userId!), 120)
      }
    } else if (surface === "matches" || link.tab === "matches") {
      navigateTo("matches")
    } else if (surface === "discover" || link.tab === "discover") {
      navigateTo("discover")
      if (link.userId) window.setTimeout(() => window.dispatchEvent(new CustomEvent("ghc:open-profile", { detail: { userId: link.userId } })), 100)
    } else if (surface === "profile" || link.tab === "profile") {
      navigateTo("profile")
    } else if (surface === "feed" || surface === "home" || link.tab === "home") {
      navigateTo("home")
      if (link.postId) window.setTimeout(() => window.dispatchEvent(new CustomEvent("ghc:open-post-request", {
        detail: { postId: link.postId, commentId: link.commentId, parentId: link.parentId, threadRootId: link.threadRootId, action: link.section === "comments" ? "comment" : "focus" },
      })), 100)
    } else if (link.tab) {
      navigateTo(String(link.tab))
    } else {
      navigateTo("home")
    }

    if (link.groupId && surface !== "communities" && link.tab !== "communities") openCommunity(link.groupId)
    if (link.section === "friend-request" || link.section === "connection_requests") {
      window.setTimeout(() => window.dispatchEvent(new CustomEvent("ghc:open-connection-inbox", {
        detail: { focus: "incoming", userId: link.userId },
      })), 120)
    }
    if ((surface === "matches" || link.tab === "matches") && link.userId) {
      window.setTimeout(() => window.dispatchEvent(new CustomEvent("ghc:open-match", { detail: { userId: link.userId } })), 120)
    }
    window.dispatchEvent(new CustomEvent("ghc:notification-deep-link", { detail: link }))
  } catch {
    /* non-browser */
  }
}
