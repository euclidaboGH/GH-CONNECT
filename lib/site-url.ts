/**
 * Canonical public site origin helpers.
 * Prefer window.location.origin in the browser; use env or production default on server.
 */
export const PRODUCTION_SITE_URL = "https://gh-connect-tau.vercel.app"

export function getPublicSiteOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin
  }
  const fromEnv = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "")
  if (fromEnv) return fromEnv
  return PRODUCTION_SITE_URL
}
