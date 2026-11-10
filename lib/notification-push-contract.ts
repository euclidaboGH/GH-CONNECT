import { createHash } from "node:crypto"

export const PUSH_CATEGORIES = [
  "messages", "matches", "connections", "comments", "mentions", "communities",
  "stories", "marketplace", "rewards", "wallet", "premium", "profile_views",
  "product_updates", "system",
] as const
export type PushCategory = typeof PUSH_CATEGORIES[number]
export type PushCategoryPreferences = Partial<Record<PushCategory, boolean>>

export function normalizePushEndpoint(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 4096) return null
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.hash || (url.port && url.port !== "443")) return null
    const host = url.hostname.toLowerCase()
    const allowedHosts = ["fcm.googleapis.com", "push.services.mozilla.com", "updates.push.services.mozilla.com", "notify.windows.com", "push.apple.com"]
    const allowedSuffixes = [".notify.windows.com", ".push.apple.com"]
    const knownProvider = allowedHosts.includes(host) || allowedSuffixes.some((suffix) => host.endsWith(suffix))
    if (!knownProvider || host.includes("..") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return null
    return url.toString()
  } catch { return null }
}

export function validatePushSubscription(value: unknown): {
  endpoint: string; p256dh: string; auth: string; expirationTime: number | null
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  const endpoint = normalizePushEndpoint(input.endpoint)
  const keys = input.keys && typeof input.keys === "object" && !Array.isArray(input.keys)
    ? input.keys as Record<string, unknown> : {}
  const p256dh = typeof keys.p256dh === "string" ? keys.p256dh : ""
  const auth = typeof keys.auth === "string" ? keys.auth : ""
  if (!endpoint || !/^[A-Za-z0-9_-]{40,256}$/.test(p256dh) || !/^[A-Za-z0-9_-]{16,128}$/.test(auth)) return null
  const expirationTime = typeof input.expirationTime === "number" && Number.isFinite(input.expirationTime)
    ? Math.max(0, Math.floor(input.expirationTime)) : null
  return { endpoint, p256dh, auth, expirationTime }
}

export function hashPushEndpoint(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex")
}

export function normalizePushDeviceId(value: unknown): string | null {
  if (typeof value !== "string") return null
  const id = value.trim()
  return /^[A-Za-z0-9_-]{20,100}$/.test(id) ? id : null
}

export function normalizePushCategoryPreferences(value: unknown): PushCategoryPreferences | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  if (Object.keys(input).length > PUSH_CATEGORIES.length) return null
  const result: PushCategoryPreferences = {}
  for (const [key, enabled] of Object.entries(input)) {
    if (!(PUSH_CATEGORIES as readonly string[]).includes(key) || typeof enabled !== "boolean") return null
    result[key as PushCategory] = enabled
  }
  return result
}
