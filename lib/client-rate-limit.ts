/**
 * Soft client-side rate limits — UX guardrails only.
 * Server enforcement is required at go-live; this reduces accidental spam in demo/local use.
 */

type Bucket = { timestamps: number[] }

const buckets = new Map<string, Bucket>()

export type RateAction = "follow" | "connect" | "message" | "post" | "comment" | "like"

const LIMITS: Record<RateAction, { max: number; windowMs: number }> = {
  follow: { max: 30, windowMs: 60_000 },
  connect: { max: 20, windowMs: 60_000 },
  message: { max: 40, windowMs: 60_000 },
  post: { max: 8, windowMs: 60_000 },
  comment: { max: 25, windowMs: 60_000 },
  like: { max: 60, windowMs: 60_000 },
}

/** Returns true if action is allowed; records the attempt when allowed. */
export function allowClientAction(action: RateAction, userKey = "self"): boolean {
  const { max, windowMs } = LIMITS[action]
  const key = `${userKey}:${action}`
  const now = Date.now()
  let bucket = buckets.get(key)
  if (!bucket) {
    bucket = { timestamps: [] }
    buckets.set(key, bucket)
  }
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs)
  if (bucket.timestamps.length >= max) return false
  bucket.timestamps.push(now)
  return true
}

export function rateLimitMessage(action: RateAction): string {
  switch (action) {
    case "follow":
      return "You’re following a bit fast — try again in a moment."
    case "message":
      return "Slow down a little so messages stay thoughtful."
    case "post":
      return "Please wait a moment before posting again."
    case "comment":
      return "Too many comments too quickly — wait a few seconds."
    default:
      return "Please wait a moment and try again."
  }
}
