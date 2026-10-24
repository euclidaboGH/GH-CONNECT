/**
 * Phase 2 — durable media URL guards.
 * blob: and empty strings must never be persisted on posts/stories for other clients.
 */

export function isDurableMediaUrl(url: unknown): boolean {
  if (typeof url !== "string") return false
  const u = url.trim()
  if (!u) return false
  if (u.startsWith("blob:")) return false
  // data: allowed only as emergency tiny offline image; callers decide size policy
  if (u.startsWith("data:")) return false
  if (u.includes("placeholder")) return false
  // Private-bucket facade paths are durable application URLs.
  if (u.includes("/api/media/") && u.includes("/content")) return true
  return true
}

/** Keep only non-blob, non-empty media URLs (http(s), app media paths, etc.). */
export function filterDurableUrls(urls: unknown): string[] {
  if (!Array.isArray(urls)) return []
  return urls.filter((u): u is string => typeof u === "string" && isDurableMediaUrl(u))
}

export function isBlobUrl(url: unknown): boolean {
  return typeof url === "string" && url.trim().startsWith("blob:")
}

/** True if string is a small-enough data URL for emergency offline attach (bytes heuristic). */
export function isSmallDataUrl(url: string, maxChars = 180_000): boolean {
  return typeof url === "string" && url.startsWith("data:") && url.length <= maxChars
}
