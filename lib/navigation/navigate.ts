/**
 * Client-side navigation helpers for GreenHaven shell.
 * Always prefer these over ad-hoc CustomEvent strings so destinations stay consistent.
 */

import {
  resolveDestination,
  isPrimaryTab,
  type DestinationId,
} from "./destinations"

export type NavigateOptions = {
  /** Community / group deep link */
  groupId?: string
  /** Marketplace listing */
  listingId?: string
  /** Settings section when opening settings */
  section?: "main" | "wallet" | "rewards" | "membership" | "help"
  /** Chat peer */
  userId?: string
  userName?: string
  userPhoto?: string
}

function emit(name: string, detail?: unknown) {
  try {
    if (typeof window === "undefined") return
    window.dispatchEvent(new CustomEvent(name, { detail }))
  } catch {
    /* */
  }
}

/**
 * Navigate to a canonical destination (tab or overlay).
 * Safe to call from feed cards, home shortcuts, search, notifications.
 */
export function navigateTo(raw: string, options: NavigateOptions = {}): boolean {
  const dest = resolveDestination(raw)
  if (!dest) return false

  if (isPrimaryTab(dest)) {
    emit("ghc:navigate-tab", dest)
    // Deep links that need the tab mounted first
    if (dest === "communities" && options.groupId) {
      const groupId = options.groupId
      // Shell ensures Communities mounts, then re-delivers open-community
      emit("ghc:ensure-community-tab", { groupId })
      window.setTimeout(() => {
        emit("ghc:open-community", { groupId })
      }, 100)
    }
    if (dest === "messages" && options.userId) {
      emit("ghc:start-chat", {
        userId: options.userId,
        userName: options.userName,
        userPhoto: options.userPhoto,
      })
    }
    return true
  }

  switch (dest) {
    case "wallet":
      emit("ghc:open-wallet", {})
      return true
    case "rewards":
      emit("ghc:open-rewards", {})
      return true
    case "settings":
      emit("ghc:open-settings", { section: options.section || "main" })
      return true
    case "membership":
      emit("ghc:open-settings", { section: "membership" })
      return true
    case "help":
      emit("ghc:open-settings", { section: "help" })
      return true
    case "ecosystem":
      emit("ghc:open-ecosystem", {})
      return true
    case "marketplace":
      // Marketplace lives under ecosystem until a dedicated tab exists
      emit("ghc:open-ecosystem", { focus: "marketplace" })
      if (options.listingId) {
        window.setTimeout(() => {
          emit("ghc:open-listing", { listingId: options.listingId })
        }, 60)
      }
      return true
    case "create":
      emit("ghc:open-create-hub", {})
      return true
    default:
      return false
  }
}

/** Open a community board (switches to Communities tab first). */
export function openCommunity(groupId: string) {
  if (!groupId?.trim()) return
  navigateTo("communities", { groupId: groupId.trim() })
}

/** Open wallet overlay. */
export function openWallet() {
  navigateTo("wallet")
}

/** Start or focus a DM and open Messages. */
export function openChat(userId: string, userName?: string, userPhoto?: string) {
  navigateTo("messages", { userId, userName, userPhoto })
}

export type { DestinationId }
