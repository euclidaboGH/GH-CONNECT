/**
 * Shared list limits — prevents unbounded reads on high-traffic lists.
 * Cursor-style APIs should still enforce these maxima server-side.
 */

export const PAGINATION = {
  /** Default page size for feeds, messages, transactions */
  DEFAULT_LIMIT: 30,
  /** Hard ceiling for any list endpoint */
  MAX_LIMIT: 100,
  /** Transactions / financial history */
  TX_DEFAULT: 40,
  TX_MAX: 80,
  /** Notifications */
  NOTIF_DEFAULT: 25,
  NOTIF_MAX: 50,
} as const

/**
 * Clamp a client-supplied limit into a safe range.
 */
export function clampLimit(
  raw: unknown,
  fallback: number = PAGINATION.DEFAULT_LIMIT,
  max: number = PAGINATION.MAX_LIMIT
): number {
  const n = typeof raw === "number" ? raw : Number(raw)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(Math.floor(n), max)
}

/**
 * Optional cursor decode — opaque string passthrough with length bound.
 */
export function sanitizeCursor(raw: unknown, maxLen = 256): string | null {
  if (typeof raw !== "string") return null
  const s = raw.trim()
  if (!s || s.length > maxLen) return null
  return s
}
