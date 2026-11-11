/**
 * Shared premium UX helpers — haptic-safe, reduced-motion aware.
 * No network, no financial authority.
 */

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  } catch {
    return false
  }
}

/** Soft device feedback when available; never throws. */
export function softHaptic(ms = 8): void {
  if (typeof navigator === "undefined") return
  try {
    const v = (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }).vibrate
    if (typeof v === "function" && !prefersReducedMotion()) v.call(navigator, [ms])
  } catch { /* */ }
}

/** Clamp sheet height for mobile keyboards / safe areas. */
export function sheetMaxHeightCss(vh = 92): string {
  return `min(100dvh, ${vh}vh)`
}

/** Debounce for search / filter fields. */
export function debounce<T extends (...args: never[]) => void>(fn: T, waitMs: number): T {
  let t: ReturnType<typeof setTimeout> | null = null
  const wrapped = ((...args: never[]) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => fn(...args), waitMs)
  }) as T
  return wrapped
}

/** Format relative time without “0s ago” noise. */
export function friendlyRelativeTime(isoOrMs: string | number | null | undefined): string {
  if (isoOrMs == null) return ""
  const ms = typeof isoOrMs === "number" ? isoOrMs : Date.parse(String(isoOrMs))
  if (!Number.isFinite(ms)) return ""
  const delta = Math.max(0, Date.now() - ms)
  if (delta < 15_000) return "Just now"
  if (delta < 60_000) return `${Math.floor(delta / 1000)}s ago`
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`
  if (delta < 7 * 86_400_000) return `${Math.floor(delta / 86_400_000)}d ago`
  try {
    return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" })
  } catch {
    return ""
  }
}

/** Hide zero metrics that look demo-like. */
export function showMetric(n: number | null | undefined): boolean {
  return typeof n === "number" && Number.isFinite(n) && n > 0
}
