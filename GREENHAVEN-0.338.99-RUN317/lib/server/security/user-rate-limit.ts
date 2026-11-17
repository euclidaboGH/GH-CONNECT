/**
 * Durable per-user mutation throttle for authenticated routes.
 *
 * Returns a ready-made 429/503 response when the caller is over the limit, otherwise null.
 * Money-moving routes use `failClosed: true` so a degraded rate-limit store denies the
 * request instead of silently falling back to a per-instance counter.
 */
import { NextResponse } from "next/server"
import {
  checkDurableRateLimit,
  durableRateLimitCode,
  durableRateLimitStatus,
} from "@/lib/server/security/control-plane"

export async function enforceUserMutationRateLimit(
  userId: string,
  bucket: string,
  limit: number,
  windowMs: number,
  options: { failClosed?: boolean } = {},
): Promise<NextResponse | null> {
  const result = await checkDurableRateLimit(`user-mutation:${bucket}:${userId}`, limit, windowMs, {
    onUnavailable: options.failClosed ? "deny" : "local",
  })
  if (result.ok) return null
  return NextResponse.json(
    { ok: false, error: durableRateLimitCode(result), retryAfterSec: result.retryAfterSec },
    {
      status: durableRateLimitStatus(result),
      headers: { "Cache-Control": "no-store", "Retry-After": String(result.retryAfterSec) },
    },
  )
}
