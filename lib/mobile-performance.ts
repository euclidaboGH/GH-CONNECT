/**
 * Mobile performance helpers for Android / low-end WebViews.
 * Does not change business logic — pagination, caching, rendering aids only.
 *
 * Canonical module: import from `@/lib/mobile-performance` (or re-export via domains).
 * Keep a single implementation of each helper — no duplicates in this file.
 */

/** Default page sizes tuned for lower-end devices */
export const MOBILE_PAGE_SIZES = {
  /** Initial feed window — grows via infinite scroll */
  feed: 8,
  discovery: 10,
  messages: 24,
  notifications: 16,
  marketplace: 12,
  comments: 16,
} as const

export function paginateSlice<T>(
  items: T[],
  page: number,
  pageSize: number
): {
  items: T[]
  page: number
  pageSize: number
  total: number
  hasMore: boolean
} {
  const safePage = Math.max(0, page)
  const size = Math.max(1, pageSize)
  const start = safePage * size
  const slice = items.slice(start, start + size)
  return {
    items: slice,
    page: safePage,
    pageSize: size,
    total: items.length,
    hasMore: start + size < items.length,
  }
}

/** Simple in-memory LRU for resolved media / profile thumbnails */
export function createLruCache<V>(maxEntries = 80) {
  const map = new Map<string, V>()
  return {
    get(key: string): V | undefined {
      if (!map.has(key)) return undefined
      const v = map.get(key)!
      map.delete(key)
      map.set(key, v)
      return v
    },
    set(key: string, value: V) {
      if (map.has(key)) map.delete(key)
      map.set(key, value)
      while (map.size > maxEntries) {
        const first = map.keys().next().value
        if (first !== undefined) map.delete(first)
      }
    },
    clear() {
      map.clear()
    },
    size() {
      return map.size
    },
  }
}

export const mediaUrlCache = createLruCache<string>(100)

/**
 * Prefer smaller decode: request width via query when CDN supports it.
 * No-op for data/blob/local paths.
 */
export function optimizedImageUrl(
  url: string | null | undefined,
  width = 480
): string {
  if (!url) return "/placeholder.svg?height=320&width=320"
  if (url.startsWith("data:") || url.startsWith("blob:")) return url
  if (url.includes("dicebear.com") || url.includes("placeholder")) return url
  try {
    const u = new URL(
      url,
      typeof window !== "undefined" ? window.location.origin : "https://local"
    )
    if (!u.searchParams.has("w")) u.searchParams.set("w", String(width))
    return u.toString()
  } catch {
    return url
  }
}

/** Debounced scroll handler factory (feed infinite load) */
export function createScrollLoadMore(options: {
  thresholdPx?: number
  onLoadMore: () => void
  isLoading?: () => boolean
  hasMore?: () => boolean
}) {
  const threshold = options.thresholdPx ?? 400
  let locked = false
  return function onScroll(event: { currentTarget: HTMLElement }) {
    if (locked) return
    if (options.isLoading?.() || options.hasMore?.() === false) return
    const el = event.currentTarget
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight
    if (remaining < threshold) {
      locked = true
      try {
        options.onLoadMore()
      } finally {
        requestAnimationFrame(() => {
          locked = false
        })
      }
    }
  }
}

/**
 * Startup deferral: run non-critical work after first paint.
 * Single canonical implementation — do not redeclare elsewhere.
 */
export function afterFirstPaint(fn: () => void): void {
  if (typeof window === "undefined") {
    fn()
    return
  }
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number })
    .requestIdleCallback
  if (typeof ric === "function") {
    ric(() => fn(), { timeout: 2000 })
  } else if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => setTimeout(fn, 0))
  } else {
    setTimeout(fn, 100)
  }
}

/** Debounce for search inputs on low-end devices */
export function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms = 200): T {
  let t: ReturnType<typeof setTimeout> | undefined
  return ((...args: Parameters<T>) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }) as T
}

/** Cap concurrent image decode pressure */
export const IMG_LOADING = {
  eagerAboveFold: 2,
  lazy: "lazy" as const,
  decoding: "async" as const,
} as const

/** Inline style hint for large offscreen sections (optional consumers) */
export const contentVisibilityAutoStyle: {
  contentVisibility: "auto"
  containIntrinsicSize: string
} = {
  contentVisibility: "auto",
  containIntrinsicSize: "1px 280px",
}

/**
 * Video: only attach src when near viewport — caller uses IntersectionObserver.
 */
export function shouldLoadVideo(isNearViewport: boolean, saveData?: boolean): boolean {
  if (saveData) return false
  return isNearViewport
}

export function preferReducedData(): boolean {
  if (typeof navigator === "undefined") return false
  const conn = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } })
    .connection
  if (conn?.saveData) return true
  if (conn?.effectiveType === "2g" || conn?.effectiveType === "slow-2g") return true
  return false
}
