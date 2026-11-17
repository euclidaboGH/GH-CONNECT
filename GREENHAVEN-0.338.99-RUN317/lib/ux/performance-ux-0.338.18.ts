/**
 * Safe performance & UX helpers — 0.338.18
 * No financial settlement changes. Client-side only contracts.
 */

/** Debounce delay for search/filter inputs (ms). */
export const SEARCH_DEBOUNCE_MS = 280

/** Idle prefetch budget for signed media URLs. */
export const MEDIA_IDLE_PREFETCH_MAX = 6

/** List virtualization soft threshold (items). */
export const LIST_VIRTUALIZE_AFTER = 40

/** Skeleton minimum display so UI does not flash empty (ms). */
export const SKELETON_MIN_MS = 180

/** Toast dwell time for success vs error. */
export const TOAST_SUCCESS_MS = 2_800
export const TOAST_ERROR_MS = 4_500

/** Pull-to-refresh cool-down (ms). */
export const PULL_REFRESH_COOLDOWN_MS = 1_200

/** Focus trap restore delay after modal close (ms). */
export const FOCUS_RESTORE_MS = 16

/** Prefer reduced motion: disable non-essential transitions. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  } catch {
    return false
  }
}

/** Clamp page size for feed/list endpoints. */
export function clampPageSize(n: number, min = 5, max = 40): number {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, Math.floor(n)))
}

/** Honest empty-state copy factory — never invents counts. */
export function emptyStateCopy(surface: string): string {
  switch (surface) {
    case "feed":
      return "No posts to show yet. Pull to refresh when you are online."
    case "messages":
      return "No conversations yet. Start one from a profile or community."
    case "cart":
      return "Your cart is empty. Cart is separate from Wallet balances."
    case "notifications":
      return "You are all caught up. New alerts will appear here."
    default:
      return "Nothing here yet."
  }
}
