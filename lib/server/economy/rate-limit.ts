/**
 * Lightweight in-process rate limiter for economy API routes.
 * Not a substitute for edge/WAF limits; reduces burst double-submit and farming.
 * Multi-instance deployments should front this with platform rate limiting.
 *
 * The bucket map is deliberately bounded. At capacity, expired buckets are
 * reclaimed first; if all buckets are still active, new keys fail closed
 * rather than evicting active limits and allowing a rate-limit bypass.
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()
const MAX_BUCKETS = 50_000

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSec: number }

function pruneExpiredBuckets(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  if (typeof key !== "string" || key.length === 0 || key.length > 512) {
    throw new Error("INVALID_RATE_LIMIT_KEY")
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(windowMs) || windowMs < 1) {
    throw new Error("INVALID_RATE_LIMIT_CONFIGURATION")
  }

  const now = Date.now()
  let bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    if (bucket) buckets.delete(key)
    if (buckets.size >= MAX_BUCKETS) pruneExpiredBuckets(now)
    // Do not evict active buckets: that would reset another user's limit.
    if (buckets.size >= MAX_BUCKETS) {
      return { ok: false, retryAfterSec: Math.max(1, Math.ceil(windowMs / 1000)) }
    }
    bucket = { count: 0, resetAt: now + windowMs }
    buckets.set(key, bucket)
  }

  bucket.count += 1
  if (bucket.count > limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) }
  }
  return { ok: true, remaining: Math.max(0, limit - bucket.count) }
}

/** Periodic cleanup to avoid unbounded map growth in long-lived processes. */
export function pruneRateLimitBuckets(max = MAX_BUCKETS): void {
  if (!Number.isSafeInteger(max) || max < 1) return
  if (buckets.size < max) return
  pruneExpiredBuckets(Date.now())
}
