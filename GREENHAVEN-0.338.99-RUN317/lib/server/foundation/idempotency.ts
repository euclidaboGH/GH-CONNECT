/**
 * Idempotency key helpers for financial and membership operations.
 * Authoritative dedupe remains in DB unique indexes / domain stores
 * (payment intents, membership purchase_ref, spend reference_id).
 */

const MAX_KEY_LEN = 128

/**
 * Normalize a client or server idempotency key.
 * Returns null if missing/invalid — callers should reject or mint server-side.
 */
export function normalizeIdempotencyKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const s = raw.trim()
  if (!s || s.length > MAX_KEY_LEN) return null
  // Allow URL-safe tokens only
  if (!/^[A-Za-z0-9._:\-]+$/.test(s)) return null
  return s
}

/**
 * Build a stable server-side reference for membership/GHC operations.
 */
export function buildScopedReference(parts: Array<string | number | null | undefined>): string {
  return parts
    .map((p) => String(p ?? "").trim())
    .filter(Boolean)
    .join(":")
    .slice(0, MAX_KEY_LEN)
}
