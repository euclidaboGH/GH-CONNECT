import type { PendingHold } from "./wallet-types"

export function formatGhc(n: number) {
  if (!Number.isFinite(n)) return "0.00"
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatWhen(ts: number) {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return ""
  }
}

export function formatDay(ts: number) {
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return ""
  }
}

export function statusLabel(status?: string): { text: string; className: string } {
  switch ((status || "").toLowerCase()) {
    case "pending":
      return { text: "Pending", className: "text-amber-700 dark:text-amber-400" }
    case "failed":
      return { text: "Failed", className: "text-red-600 dark:text-red-400" }
    case "cancelled":
    case "canceled":
      return { text: "Cancelled", className: "text-muted-foreground" }
    case "reversed":
      return { text: "Reversed", className: "text-muted-foreground" }
    case "posted":
    case "confirmed":
    case "completed":
    case "sent":
    case "delivered":
      return { text: "Confirmed", className: "text-emerald-700 dark:text-emerald-400" }
    default:
      return {
        text: status ? String(status) : "Confirmed",
        className: "text-muted-foreground",
      }
  }
}

export function classifyPendingSource(
  reason: string,
  sourceEvent: string
): PendingHold["source"] {
  const s = `${reason} ${sourceEvent}`.toLowerCase()
  if (s.includes("challenge")) return "challenge"
  if (s.includes("achievement") || s.includes("badge")) return "achievement"
  if (s.includes("valid") || s.includes("review") || s.includes("pending")) return "validation"
  if (s.includes("reward") || s.includes("earn") || s.includes("profile")) return "reward"
  return "other"
}

export function expectedClearWindow(createdAt: number, expiresAt?: number): string {
  if (expiresAt && expiresAt > Date.now()) {
    const h = Math.max(1, Math.round((expiresAt - Date.now()) / 3600000))
    if (h < 48) return `Usually clears within ~${h}h`
    return `Usually clears by ${formatDay(expiresAt)}`
  }
  const ageH = (Date.now() - createdAt) / 3600000
  if (ageH < 12) return "Usually clears within ~24 hours"
  if (ageH < 36) return "Validation in progress · often within a day"
  return "Still under review · contact support if longer than 72h"
}

export function navigateTab(tab: string) {
  try {
    window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: tab }))
  } catch {
    /* */
  }
}

export function navigateSettingsSection(section: string) {
  try {
    window.dispatchEvent(
      new CustomEvent("ghc:open-settings-section", { detail: { section } })
    )
  } catch {
    /* */
  }
}
