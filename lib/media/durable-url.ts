/**
 * Canonical durable-media URL policy.
 *
 * Only server-addressable HTTPS URLs (plus loopback HTTP for local development)
 * and same-origin root-relative application paths are accepted. This is a
 * client-side integrity guard; media APIs must still enforce authorization.
 */
export function isDurableMediaUrl(url: unknown): boolean {
  if (typeof url !== "string") return false
  const value = url.trim()
  if (!value || value.length > 4000) return false
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return false
  if (/^(?:blob|data|javascript|vbscript|file|filesystem):/i.test(value)) return false
  if (/placeholder/i.test(value)) return false

  // App-owned facade routes (including private-media content routes) remain
  // durable and same-origin. Protocol-relative URLs are intentionally rejected.
  if (value.startsWith("/")) return !value.startsWith("//")

  try {
    const parsed = new URL(value)
    if (parsed.username || parsed.password) return false
    if (parsed.protocol === "https:") return Boolean(parsed.hostname)
    if (parsed.protocol === "http:") {
      const host = parsed.hostname.toLowerCase()
      return host === "localhost" || host === "127.0.0.1" || host === "[::1]"
    }
    return false
  } catch {
    return false
  }
}

/** Keep only server-addressable media references. */
export function filterDurableUrls(urls: unknown): string[] {
  if (!Array.isArray(urls)) return []
  return urls.filter((value): value is string => isDurableMediaUrl(value))
}

export function isBlobUrl(url: unknown): boolean {
  return typeof url === "string" && /^blob:/i.test(url.trim())
}

/** True if string is a small-enough data URL for emergency offline preview only. */
export function isSmallDataUrl(url: string, maxChars = 180_000): boolean {
  return typeof url === "string" && /^data:/i.test(url.trim()) && url.length <= maxChars
}
