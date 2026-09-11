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
import { navigateTo, openCommunity, openChat, openWallet } from "@/lib/navigation/navigate"
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
  { id: "system", label: "System" },
]

export type NotificationDeepLink = {
  /** Primary app surface */
  open?:
    | "feed"
    | "home"
    | "chat"
    | "messages"
    | "wallet"
    | "rewards"
    | "membership"
    | "communities"
    | "discover"
    | "matches"
    | "profile"
    | "settings"
  tab?:
    | "home"
    | "discover"
    | "matches"
    | "messages"
    | "communities"
    | "profile"
    | "wallet"
    | "rewards"
    | "membership"
    | "settings"
  section?:
    | "post"
    | "conversation"
    | "transaction"
    | "transfer-request"
    | "friend-request"
    | "group-request"
    | "membership"
    | "verification"
    | "security"
  id?: string
  postId?: string
  conversationId?: string
  userId?: string
  transactionId?: string
  requestId?: string
  groupId?: string
  greenHavenId?: string
}

const SOCIAL_TYPES = new Set<NotificationType>([
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
export function resolveNotificationDeepLink(n: Notification): NotificationDeepLink {
  const data = (n.data || {}) as Record<string, unknown>
  if (data.deepLink && typeof data.deepLink === "object") {
    const forced = data.deepLink as NotificationDeepLink
    // Guard: social/share types must not be forced into settings
    if (
      SOCIAL_TYPES.has(n.type) &&
      (forced.tab === "settings" || forced.open === "settings")
    ) {
      return { open: "feed", tab: "home", section: "post", postId: forced.postId || String(data.postId || "") }
    }
    return forced
  }

  const open = String(data.open || "").toLowerCase()
  const link: NotificationDeepLink = {
    id: data.id != null ? String(data.id) : n.id,
    postId: data.postId != null ? String(data.postId) : undefined,
    conversationId:
      data.conversationId != null ? String(data.conversationId) : undefined,
    userId:
      data.userId != null
        ? String(data.userId)
        : data.fromUserId != null
          ? String(data.fromUserId)
          : undefined,
    transactionId:
      data.transactionId != null
        ? String(data.transactionId)
        : data.txId != null
          ? String(data.txId)
          : undefined,
    requestId: data.requestId != null ? String(data.requestId) : undefined,
    groupId:
      data.groupId != null
        ? String(data.groupId)
        : data.communityId != null
          ? String(data.communityId)
          : undefined,
    greenHavenId: data.greenHavenId != null ? String(data.greenHavenId) : undefined,
  }

  // Explicit open field from emitter (preferred)
  if (open === "feed" || open === "home" || open === "post") {
    link.open = "feed"
    link.tab = "home"
    link.section = "post"
    return link
  }
  if (open === "chat" || open === "messages") {
    link.open = "chat"
    link.tab = "messages"
    link.section = "conversation"
    return link
  }
  if (open === "wallet" || open === "transaction") {
    link.open = "wallet"
    link.tab = "wallet"
    link.section = "transaction"
    return link
  }
  if (open === "rewards") {
    link.open = "rewards"
    link.tab = "rewards"
    return link
  }
  if (open === "membership" || open === "premium") {
    link.open = "membership"
    link.tab = "membership"
    link.section = "membership"
    return link
  }
  if (open === "communities") {
    link.open = "communities"
    link.tab = "communities"
    return link
  }
  if (open === "matches") {
    link.open = "matches"
    link.tab = "matches"
    return link
  }
  if (open === "discover" || open === "find") {
    link.open = "discover"
    link.tab = "discover"
    return link
  }
  if (open === "security" || open === "verification") {
    link.open = "settings"
    link.tab = "settings"
    link.section = open === "security" ? "security" : "verification"
    return link
  }
  // open === "settings" only when explicitly intended for system prefs
  if (open === "settings" && (n.type === "system" || String(data.category) === "system")) {
    link.open = "settings"
    link.tab = "settings"
    link.section = (data.section as NotificationDeepLink["section"]) || "main" as any
    return link
  }

  // Type-based routing
  if (n.type === "message") {
    link.open = "chat"
    link.tab = "messages"
    link.section = "conversation"
  } else if (n.type === "group") {
    link.open = "communities"
    link.tab = "communities"
  } else if (n.type === "match") {
    link.open = "matches"
    link.tab = "matches"
  } else if (n.type === "friend_request") {
    // Connection request inbox — not messages
    link.open = "matches"
    link.tab = "matches"
    link.section = "connection_requests"
  } else if (n.type === "follow") {
    link.open = "discover"
    link.tab = "discover"
  } else if (n.type === "like" || n.type === "comment" || n.type === "share" || n.type === "mention" || n.type === "story_reply") {
    link.open = "feed"
    link.tab = "home"
    link.section = "post"
  } else if (n.type === "ghc_received" || n.type === "ghc_sent" || n.type === "payment") {
    link.open = "wallet"
    link.tab = "wallet"
    link.section = "transaction"
  } else if (n.type === "reward") {
    link.open = "rewards"
    link.tab = "rewards"
  } else if (n.type === "system") {
    const b = blobOf(n)
    if (/privacy|security|password|verification|restricted/i.test(b)) {
      link.open = "settings"
      link.tab = "settings"
      link.section = /verif/i.test(b) ? "verification" : "security"
    } else if (/reward|streak|mission|claim/i.test(b)) {
      link.open = "rewards"
      link.tab = "rewards"
    } else if (/wallet|ghc|transfer|payment/i.test(b)) {
      link.open = "wallet"
      link.tab = "wallet"
    } else if (/message|chat/i.test(b)) {
      link.open = "chat"
      link.tab = "messages"
    } else if (/membership|vip|vvip|premium/i.test(b)) {
      link.open = "membership"
      link.tab = "membership"
    } else if (/post|feed|story|like|comment/i.test(b)) {
      link.open = "feed"
      link.tab = "home"
      link.section = "post"
    } else {
      // Safe default: Home — never Settings
      link.open = "feed"
      link.tab = "home"
    }
  } else {
    // Unknown type — Home
    link.open = "feed"
    link.tab = "home"
  }

  
  // Final safety: social / content types must never land in Settings
  if (
    SOCIAL_TYPES.has(n.type) &&
    (link.open === "settings" || link.tab === "settings")
  ) {
    link.open = "feed"
    link.tab = "home"
    link.section = "post"
  }

  return link
}

/** Dispatch navigation for a deep-link — Settings only when tab/open is settings. */
export function navigateNotificationDeepLink(link: NotificationDeepLink): void {
  try {
    const surface = link.open || link.tab

    // Primary surface via canonical navigation map
    if (surface === "wallet" || link.tab === "wallet") {
      openWallet()
    } else if (surface === "rewards" || link.tab === "rewards") {
      navigateTo("rewards")
    } else if (surface === "membership" || link.tab === "membership") {
      navigateTo("membership")
    } else if (surface === "settings" || link.tab === "settings") {
      navigateTo("settings", {
        section: (link.section as "main" | "wallet" | "rewards" | "membership" | "help") || "main",
      })
    } else if (surface === "communities" || link.tab === "communities") {
      if (link.groupId) openCommunity(link.groupId)
      else navigateTo("communities")
    } else if (surface === "messages" || surface === "chat" || link.tab === "messages") {
      navigateTo("messages")
    } else if (surface === "matches" || link.tab === "matches") {
      navigateTo("matches")
    } else if (surface === "discover" || link.tab === "discover") {
      navigateTo("discover")
    } else if (surface === "profile" || link.tab === "profile") {
      navigateTo("profile")
    } else if (surface === "feed" || surface === "home" || link.tab === "home") {
      navigateTo("home")
    } else if (link.tab) {
      navigateTo(String(link.tab))
    } else {
      navigateTo("home")
    }

    if (link.conversationId) {
      window.setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("ghc:open-conversation", {
            detail: { conversationId: link.conversationId },
          })
        )
      }, 60)
    }
    if (link.groupId && surface !== "communities" && link.tab !== "communities") {
      openCommunity(link.groupId)
    }
    if (link.userId && (link.tab === "discover" || link.section === "friend-request")) {
      window.dispatchEvent(
        new CustomEvent("ghc:open-profile", {
          detail: {
            userId: link.userId,
            section: "friend-request",
            intents: (link as { intents?: string[] }).intents,
          },
        })
      )
    }
    if (link.userId && (surface === "messages" || surface === "chat") && !link.conversationId) {
      openChat(link.userId)
    }
    if (link.postId && (link.tab === "home" || link.open === "feed" || surface === "home" || surface === "feed")) {
      window.dispatchEvent(
        new CustomEvent("ghc:open-post", {
          detail: { postId: link.postId },
        })
      )
    }

    if (link.section === "connection_requests" || link.section === "friend-request") {
      window.dispatchEvent(
        new CustomEvent("ghc:open-connection-inbox", {
          detail: { focus: "incoming", userId: link.userId },
        })
      )
    }

    window.dispatchEvent(new CustomEvent("ghc:notification-deep-link", { detail: link }))

    if (link.section === "listing" || (link as { listingId?: string }).listingId) {
      const listingId = (link as { listingId?: string }).listingId || link.id
      navigateTo("marketplace", { listingId: listingId || undefined })
    }
    if (link.open === "matches" || link.tab === "matches" || link.section === "match") {
      navigateTo("matches")
      if (link.userId) {
        window.dispatchEvent(
          new CustomEvent("ghc:open-match", {
            detail: { userId: link.userId },
          })
        )
      }
    }
  } catch {
    /* */
  }
}

export { communityNotificationLabel, isCommunityNotification } from "@/lib/domains/adapters/community-notification"
