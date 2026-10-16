/**
 * Lightweight in-process rate limiter for economy API routes.
 * Not a substitute for edge/WAF limits; reduces burst double-submit and farming.
 * Multi-instance deployments should front this with platform rate limiting.
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSec: number }

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now()
  let b = buckets.get(key)
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs }
    buckets.set(key, b)
  }
  b.count += 1
  if (b.count > limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) }
  }
  return { ok: true, remaining: Math.max(0, limit - b.count) }
}

/** Periodic cleanup to avoid unbounded map growth in long-lived processes */
export function pruneRateLimitBuckets(max = 50_000): void {
  if (buckets.size < max) return
  const now = Date.now()
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k)
  }
}
