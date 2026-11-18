/**
 * Client-side navigation helpers for GreenHaven shell.
 * Always prefer these over ad-hoc CustomEvent strings so destinations stay consistent.
 */

import {
  resolveDestination,
  isPrimaryTab,
  type DestinationId,
} from "./destinations"
import { getServiceById, isInteractiveStatus } from "./service-registry"

export type NavigateOptions = {
  /** Community / group deep link */
  groupId?: string
  /** Marketplace listing */
  listingId?: string
  /** Marketplace order deep link */
  orderId?: string
  /** Marketplace surface bucket */
  marketplaceBucket?: "browse" | "orders" | "saved" | "sell" | "mine" | "cart"
  /** Settings section when opening settings */
  section?: "main" | "wallet" | "rewards" | "membership" | "help" | "privacy" | "notifications" | "appearance" | "device-lock"
  /** Chat peer */
  userId?: string
  userName?: string
  userPhoto?: string
  /** Ecosystem service focus id */
  focus?: string
}

function bounded(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed && trimmed.length <= max && !/[\u0000-\u001f\u007f]/.test(trimmed) ? trimmed : undefined
}

const SETTINGS_SECTIONS = new Set(["main", "wallet", "rewards", "membership", "help", "privacy", "notifications", "appearance", "device-lock"] as const)

function safeSection(value: unknown): NavigateOptions["section"] {
  return typeof value === "string" && SETTINGS_SECTIONS.has(value as NonNullable<NavigateOptions["section"]>)
    ? value as NonNullable<NavigateOptions["section"]>
    : undefined
}

function safePhoto(value: unknown): string | undefined {
  const photo = bounded(value, 2000)
  if (!photo || photo.startsWith("//") || photo.includes("\\") || /[\u0000-\u001f\u007f]/.test(photo)) return undefined
  if (photo.startsWith("/") && !photo.startsWith("///")) return photo
  try {
    const parsed = new URL(photo)
    return parsed.protocol === "https:" ? photo : undefined
  } catch {
    return undefined
  }
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
  // This helper is a browser-shell command, never a server-side navigation primitive.
  if (typeof window === "undefined") return false
  // Bound externally sourced navigation values before emitting cross-component events.
  if (typeof raw !== "string" || raw.length > 100) return false
  const bucket =
    options.marketplaceBucket === "browse" ||
    options.marketplaceBucket === "orders" ||
    options.marketplaceBucket === "saved" ||
    options.marketplaceBucket === "sell" ||
    options.marketplaceBucket === "mine" ||
    options.marketplaceBucket === "cart"
      ? options.marketplaceBucket
      : undefined
  const safeOptions: NavigateOptions = {
    section: safeSection(options.section),
    groupId: bounded(options.groupId, 180),
    listingId: bounded(options.listingId, 180),
    orderId: bounded(options.orderId, 180),
    marketplaceBucket: bucket,
    userId: bounded(options.userId, 180),
    userName: bounded(options.userName, 120),
    userPhoto: safePhoto(options.userPhoto),
    focus: bounded(options.focus, 120),
  }
  const dest = resolveDestination(raw)
  if (!dest) return false

  if (isPrimaryTab(dest)) {
    emit("ghc:navigate-tab", dest)
    if (dest === "communities" && safeOptions.groupId) {
      const groupId = safeOptions.groupId
      emit("ghc:ensure-community-tab", { groupId })
      window.setTimeout(() => {
        emit("ghc:open-community", { groupId })
      }, 100)
    }
    if (dest === "messages" && safeOptions.userId) {
      emit("ghc:start-chat", {
        userId: safeOptions.userId,
        userName: safeOptions.userName,
        userPhoto: safeOptions.userPhoto,
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
      emit("ghc:open-settings", { section: safeOptions.section || "main" })
      return true
    case "membership":
      // Canonical: Settings membership section (never dead open-membership alone)
      emit("ghc:open-settings", { section: "membership" })
      return true
    case "help":
      emit("ghc:open-settings", { section: "help" })
      return true
    case "ecosystem":
      emit("ghc:open-ecosystem", { focus: safeOptions.focus || undefined })
      return true
    case "marketplace":
      // Dedicated marketplace product surface (listings from domain — no invented catalog)
      emit("ghc:open-marketplace", {
        listingId: safeOptions.listingId || undefined,
        orderId: safeOptions.orderId || undefined,
        bucket: safeOptions.marketplaceBucket || undefined,
      })
      return true
    case "create":
      emit("ghc:open-create-hub", {})
      return true
    default:
      return false
  }
}

/**
 * Open a registry service by id. ACTIVE/BETA run destination; others no-op
 * (UI should show Coming Soon landing instead of calling this).
 *
 * ACTIVE deep-links (12 live modules):
 * - community → Communities
 * - gh-chat → Messages
 * - connections → Matches + connection-requests inbox
 * - matches → Matches
 * - marketplace → Marketplace browse
 * - orders → Marketplace orders bucket
 * - field-research → /field/studio
 * - wallet | ghc | pi-payments → Wallet (with asset-rail focus)
 * - rewards → Rewards
 * - membership → Settings membership
 */
export function openService(serviceId: string): boolean {
  const service = getServiceById(serviceId)
  if (!service) return false
  if (!isInteractiveStatus(service.status)) return false

  // Field Research: real product surface is the authenticated studio route.
  if (service.id === "field-research") {
    if (typeof window === "undefined") return false
    try {
      window.location.assign("/field/studio")
      return true
    } catch {
      return false
    }
  }

  // Connections: Matches tab + open the connection-requests inbox after the tab mounts.
  if (service.id === "connections") {
    const ok = navigateTo("matches")
    if (ok && typeof window !== "undefined") {
      window.setTimeout(() => {
        try {
          window.dispatchEvent(new CustomEvent("ghc:open-connection-inbox"))
        } catch {
          /* */
        }
      }, 280)
    }
    return ok
  }

  // Wallet family: seed one-shot focus for the wallet screen asset rail.
  if (service.id === "wallet" || service.id === "ghc" || service.id === "pi-payments") {
    if (typeof window !== "undefined") {
      try {
        const focus =
          service.id === "pi-payments" ? "pi-payments" : service.id === "ghc" ? "ghc" : "wallet"
        window.sessionStorage.setItem("ghc.wallet.focus", focus)
      } catch {
        /* focus is best-effort */
      }
    }
    return navigateTo("wallet")
  }

  const dest = service.destination
  if (dest.kind === "tab") {
    return navigateTo(dest.tab)
  }
  if (dest.kind === "overlay") {
    if (dest.overlay === "marketplace") {
      // ACTIVE "Orders" opens the orders bucket; generic marketplace opens browse.
      if (service.id === "orders") {
        return navigateTo("marketplace", { marketplaceBucket: "orders" })
      }
      return navigateTo("marketplace", { marketplaceBucket: "browse" })
    }
    return navigateTo(dest.overlay)
  }
  if (dest.kind === "focus") {
    return navigateTo("ecosystem", { focus: dest.serviceId })
  }
  return false
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

/** Open membership via canonical settings section. */
export function openMembership() {
  navigateTo("membership")
}

export type { DestinationId }
