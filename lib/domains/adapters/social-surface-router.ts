/**
 * Social surface router — one vocabulary for deep links across GreenHaven.
 * Feed · Discover · Messages · Profile · Matches · Marketplace · Communities · Create · Wallet · Rewards
 *
 * Mirrors production notification deep-link policy:
 * never dump social actions into Settings by default.
 */

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
  create: "home", // create is a sheet, not always a tab
  wallet: "profile", // wallet often under profile/more
  rewards: "profile",
  settings: "settings",
  notifications: "home",
}

export function navigateToSocialSurface(target: SocialNavigateTarget): void {
  if (typeof window === "undefined") return
  const tab = TAB_MAP[target.surface] || "home"

  try {
    // Entity-specific events first
    if (target.userId && (target.surface === "profile" || target.surface === "discover")) {
      window.dispatchEvent(
        new CustomEvent("ghc:open-profile", {
          detail: { userId: target.userId, ...(target.detail || {}) },
        })
      )
    }
    if (target.conversationId && target.surface === "messages") {
      window.dispatchEvent(
        new CustomEvent("ghc:open-conversation", {
          detail: { conversationId: target.conversationId, ...(target.detail || {}) },
        })
      )
    }
    if (target.communityId && target.surface === "communities") {
      window.dispatchEvent(
        new CustomEvent("ghc:open-community", {
          detail: { groupId: target.communityId, ...(target.detail || {}) },
        })
      )
    }
    if (target.postId && target.surface === "home") {
      window.dispatchEvent(
        new CustomEvent("ghc:open-post", {
          detail: { postId: target.postId, ...(target.detail || {}) },
        })
      )
    }
    if (target.listingId && target.surface === "marketplace") {
      window.dispatchEvent(
        new CustomEvent("ghc:open-listing", {
          detail: { listingId: target.listingId, ...(target.detail || {}) },
        })
      )
    }
    if (target.surface === "create") {
      if (target.composeMode === "poll") {
        window.dispatchEvent(new CustomEvent("ghc:open-create-hub"))
        // Parent may open poll; also emit specific
        window.dispatchEvent(new CustomEvent("ghc:open-poll"))
      } else if (target.composeMode === "challenge") {
        window.dispatchEvent(new CustomEvent("ghc:open-challenge"))
      } else if (target.composeMode === "story") {
        window.dispatchEvent(
          new CustomEvent("ghc:open-compose", { detail: { mode: "story" } })
        )
      } else if (target.composeMode === "community") {
        window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "communities" }))
        window.dispatchEvent(new CustomEvent("ghc:open-community-compose", { detail: {} }))
      } else {
        window.dispatchEvent(
          new CustomEvent("ghc:open-compose", { detail: { mode: target.composeMode || "post" } })
        )
      }
      return
    }

    window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: tab }))
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
  if (o === "profile" || o === "user") return "profile"
  if (o === "matches" || o === "match") return "matches"
  if (o === "marketplace" || o === "listing") return "marketplace"
  if (o === "communities" || o === "community" || o === "group") return "communities"
  if (o === "wallet" || o === "ghc") return "wallet"
  if (o === "rewards" || o === "reward") return "rewards"
  if (o === "settings") return "settings"
  if (o === "create" || o === "compose") return "create"
  return "home"
}
