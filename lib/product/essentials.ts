/** Production-safe product essentials — no invented balances or authority. */

export function copyTextToClipboard(text: string): Promise<boolean> {
  const value = String(text || "").trim()
  if (!value) return Promise.resolve(false)
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(value).then(() => true).catch(() => fallbackCopy(value))
  }
  return Promise.resolve(fallbackCopy(value))
}

function fallbackCopy(value: string): boolean {
  try {
    if (typeof document === "undefined") return false
    const el = document.createElement("textarea")
    el.value = value
    el.setAttribute("readonly", "")
    el.style.position = "fixed"
    el.style.left = "-9999px"
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand("copy")
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}

/** Relative time for UI; use full ISO in title attribute for accessibility. */
export function formatRelativeTime(ts: number, now = Date.now()): string {
  if (!Number.isFinite(ts) || ts <= 0) return ""
  const diff = Math.max(0, now - ts)
  const sec = Math.floor(diff / 1000)
  if (sec < 45) return "just now"
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d`
  try {
    return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" })
  } catch {
    return ""
  }
}

export function absoluteTimeLabel(ts: number): string {
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return ""
  }
}

/** Detect http(s) URLs in plain text for safe linkification. */
export function extractHttpUrls(text: string): string[] {
  const re = /https?:\/\/[^\s<>"')\]]+/gi
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(String(text || ""))) !== null) {
    out.push(m[0].replace(/[.,;:!?)]+$/, ""))
  }
  return out
}

export function isProbablyExternalUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

const DRAFT_KEY = "ghc-compose-draft-meta-v1"

export function setDraftSavedAt(ts = Date.now()): void {
  try {
    if (typeof window === "undefined") return
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: ts }))
  } catch {
    /* */
  }
}

export function getDraftSavedAt(): number | null {
  try {
    if (typeof window === "undefined") return null
    const raw = window.localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const j = JSON.parse(raw) as { savedAt?: number }
    return typeof j.savedAt === "number" ? j.savedAt : null
  } catch {
    return null
  }
}

export function clearDraftSavedAt(): void {
  try {
    if (typeof window === "undefined") return
    window.localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* */
  }
}

/** Count offline queue actions for status UI (read-only). */
export function countPendingOfflineActions(): number {
  try {
    // offlineQueue is the live source when available
    const { offlineQueue } = require("@/lib/network-resilience") as {
      offlineQueue: { getQueue?: () => Array<{ id: string }> }
    }
    const q = offlineQueue.getQueue?.() || []
    return Array.isArray(q) ? q.length : 0
  } catch {
    return 0
  }
}

export const DISCOVER_FILTERS_KEY = "ghc-discover-filters-v1"

export type DiscoverFiltersState = {
  onlineOnly?: boolean
  intent?: string | null
}

export function loadDiscoverFilters(): DiscoverFiltersState {
  try {
    if (typeof window === "undefined") return {}
    const raw = window.localStorage.getItem(DISCOVER_FILTERS_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as DiscoverFiltersState
  } catch {
    return {}
  }
}

export function saveDiscoverFilters(next: DiscoverFiltersState): void {
  try {
    if (typeof window === "undefined") return
    window.localStorage.setItem(DISCOVER_FILTERS_KEY, JSON.stringify(next))
  } catch {
    /* */
  }
}
