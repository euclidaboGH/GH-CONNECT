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
  const safeOptions: NavigateOptions = {
    section: safeSection(options.section),
    groupId: bounded(options.groupId, 180),
    listingId: bounded(options.listingId, 180),
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
 */
export function openService(serviceId: string): boolean {
  const service = getServiceById(serviceId)
  if (!service) return false
  if (!isInteractiveStatus(service.status)) return false

  const dest = service.destination
  if (dest.kind === "tab") {
    return navigateTo(dest.tab)
  }
  if (dest.kind === "overlay") {
    if (dest.overlay === "marketplace") {
      return navigateTo("marketplace")
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
