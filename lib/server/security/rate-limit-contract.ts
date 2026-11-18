import type { RateLimitResult } from "@/lib/server/economy/rate-limit"

export type DurableRateLimitPayload = {
  ok?: unknown
  remaining?: unknown
  retryAfterSec?: unknown
}

export function assertDurableRateLimitInput(key: string, limit: number, windowMs: number): void {
  if (typeof key !== "string" || key.length < 1 || key.length > 512) {
    throw new Error("INVALID_RATE_LIMIT_KEY")
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100_000 ||
      !Number.isSafeInteger(windowMs) || windowMs < 1_000 || windowMs > 86_400_000) {
    throw new Error("INVALID_RATE_LIMIT_CONFIGURATION")
  }
}

/** Returns null for malformed/untrusted RPC data so callers can fail closed. */
export function parseDurableRateLimitResult(value: unknown): RateLimitResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const result = value as DurableRateLimitPayload
  if (result.ok === true && Number.isSafeInteger(result.remaining) &&
      Number(result.remaining) >= 0 && Number(result.remaining) <= 100_000) {
    return { ok: true, remaining: Number(result.remaining) }
  }
  if (result.ok === false && Number.isSafeInteger(result.retryAfterSec) &&
      Number(result.retryAfterSec) >= 1 && Number(result.retryAfterSec) <= 86_400) {
    return { ok: false, retryAfterSec: Number(result.retryAfterSec) }
  }
  return null
}

/** HTTP mapping keeps quota exhaustion (429) distinct from unavailable protection (503). */
export function getDurableRateLimitFailure(result: Extract<RateLimitResult, { ok: false }>): {
  status: 429 | 503
  code: "RATE_LIMITED" | "RATE_LIMIT_UNAVAILABLE"
} {
  const unavailable = result.unavailable === true
  return {
    status: unavailable ? 503 : 429,
    code: unavailable ? "RATE_LIMIT_UNAVAILABLE" : "RATE_LIMITED",
  }
}
