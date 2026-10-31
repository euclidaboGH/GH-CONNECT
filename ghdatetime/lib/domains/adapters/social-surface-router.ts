/**
 * Social surface router — one vocabulary for deep links across GreenHaven.
 * Feed · Discover · Messages · Profile · Matches · Marketplace · Communities · Create · Wallet · Rewards
 *
 * Mirrors production notification deep-link policy:
 * never dump social actions into Settings by default.
 *
 * Resolves through lib/navigation/navigate (canonical destinations).
 */

import { navigateTo, openCommunity } from "@/lib/navigation/navigate"

export type SocialSurface =
  | "home"
  | "discover"
  | "messages"
  | "profile"
  | "matches"
  | "marketplace"
  | "communities"
  | "create"
  | "wallet"
  | "rewards"
  | "settings"
  | "notifications"

export interface SocialNavigateTarget {
  surface: SocialSurface
  /** Optional entity ids */
  userId?: string
  postId?: string
  conversationId?: string
  listingId?: string
  communityId?: string
  matchId?: string
  /** Compose mode when surface is create */
  composeMode?: "post" | "story" | "poll" | "challenge" | "community"
  /** Extra detail for listeners */
  detail?: Record<string, unknown>
}

const TAB_MAP: Record<SocialSurface, string> = {
  home: "home",
  discover: "discover",
  messages: "messages",
  profile: "profile",
  matches: "matches",
  marketplace: "marketplace",
  communities: "communities",
  create: "create",
  wallet: "wallet",
  rewards: "rewards",
  settings: "settings",
  notifications: "home",
}

export function navigateToSocialSurface(target: SocialNavigateTarget): void {
  if (typeof window === "undefined") return

  try {
    if (target.surface === "marketplace") {
      navigateTo("marketplace", { listingId: target.listingId })
      return
    }
    if (target.surface === "wallet") {
      navigateTo("wallet")
      return
    }
    if (target.surface === "rewards") {
      navigateTo("rewards")
      return
    }
    if (target.surface === "settings") {
      navigateTo("settings")
      return
    }
    if (target.surface === "create") {
      if (target.composeMode === "poll") {
        navigateTo("create")
        window.dispatchEvent(new CustomEvent("ghc:open-poll"))
      } else if (target.composeMode === "challenge") {
        window.dispatchEvent(new CustomEvent("ghc:open-challenge"))
      } else if (target.composeMode === "story") {
        window.dispatchEvent(
          new CustomEvent("ghc:open-compose", { detail: { mode: "story" } })
        )
      } else if (target.composeMode === "community") {
        navigateTo("communities")
        window.dispatchEvent(new CustomEvent("ghc:open-community-compose", { detail: {} }))
      } else {
        navigateTo("create")
        window.dispatchEvent(
          new CustomEvent("ghc:open-compose", { detail: { mode: target.composeMode || "post" } })
        )
      }
      return
    }

    if (target.surface === "communities" && target.communityId) {
      openCommunity(target.communityId)
      return
    }
    if (target.surface === "messages" && target.conversationId) {
      navigateTo("messages")
      window.dispatchEvent(
        new CustomEvent("ghc:open-conversation", {
          detail: { conversationId: target.conversationId, ...(target.detail || {}) },
        })
      )
      return
    }
    if (target.userId && (target.surface === "profile" || target.surface === "discover")) {
      // No shell profile-preview overlay yet — Discover is the safe landing surface
      navigateTo("discover")
      window.dispatchEvent(
        new CustomEvent("ghc:open-profile", {
          detail: { userId: target.userId, ...(target.detail || {}) },
        })
      )
      return
    }
    if (target.postId && target.surface === "home") {
      navigateTo("home")
      window.dispatchEvent(
        new CustomEvent("ghc:open-post", {
          detail: { postId: target.postId, ...(target.detail || {}) },
        })
      )
      return
    }
    if (target.matchId || target.surface === "matches") {
      navigateTo("matches")
      return
    }

    const tab = TAB_MAP[target.surface] || "home"
    navigateTo(tab)
  } catch {
    /* non-browser */
  }
}

/** Map legacy notification open targets → SocialSurface */
export function surfaceFromNotificationOpen(open: string | undefined | null): SocialSurface {
  const o = String(open || "").toLowerCase()
  if (o === "feed" || o === "home" || o === "post") return "home"
  if (o === "discover" || o === "find") return "discover"
  if (o === "chat" || o === "messages" || o === "message") return "messages"
  if (o === "profile" || o === "me") return "profile"
  if (o === "match" || o === "matches" || o === "connections") return "matches"
  if (o === "marketplace" || o === "listing" || o === "shop") return "marketplace"
  if (o === "community" || o === "communities" || o === "group") return "communities"
  if (o === "wallet" || o === "ghc") return "wallet"
  if (o === "rewards" || o === "reward") return "rewards"
  if (o === "settings") return "settings"
  if (o === "create" || o === "compose") return "create"
  return "home"
}
