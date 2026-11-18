/**
 * Phase 2 — recently viewed listings.
 * Stores listing ids only (no personal data), scoped per account, bounded, and
 * fails closed when storage is unavailable.
 */
export const RECENTLY_VIEWED_MAX = 12
const PREFIX = "gh_marketplace_recent_v1:"
const ID_RE = /^[A-Za-z0-9_-]{1,80}$/

type StorageLike = Pick<Storage, "getItem" | "setItem">

function keyFor(accountId: string): string | null {
  const id = String(accountId ?? "").trim()
  return ID_RE.test(id) ? PREFIX + id : null
}

export function sanitizeRecentIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of value) {
    const id = typeof v === "string" ? v.trim() : ""
    if (!ID_RE.test(id) || seen.has(id)) continue
    seen.add(id); out.push(id)
    if (out.length >= RECENTLY_VIEWED_MAX) break
  }
  return out
}

export function readRecentlyViewed(accountId: string, storage?: StorageLike | null): string[] {
  const key = keyFor(accountId)
  if (!key || !storage) return []
  try { return sanitizeRecentIds(JSON.parse(storage.getItem(key) || "[]")) } catch { return [] }
}

export function recordRecentlyViewed(accountId: string, listingId: string, storage?: StorageLike | null): string[] {
  const key = keyFor(accountId)
  const id = String(listingId ?? "").trim()
  if (!key || !storage || !ID_RE.test(id)) return readRecentlyViewed(accountId, storage)
  const next = sanitizeRecentIds([id, ...readRecentlyViewed(accountId, storage)])
  try { storage.setItem(key, JSON.stringify(next)) } catch { /* storage full or blocked */ }
  return next
}
