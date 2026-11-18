/**
 * Explicit public-route policy.
 *
 * Public respondents must not be forced through Pi authentication. Keep the
 * field desk exact-match only: /field/studio and /field/admin/** remain inside
 * the authenticated GreenHaven application boundary.
 */
const PUBLIC_PREFIX_ROUTES = [
  "/privacy",
  "/terms",
  "/support",
  "/portal-setup",
  "/validation-key.txt",
] as const

export function isPublicRoutePath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  const path = pathname.split("?")[0]?.split("#")[0] || ""
  if (!path || path === "/") return false

  if (PUBLIC_PREFIX_ROUTES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return true
  }

  // Public, opaque survey links only. Nested or owner-facing research routes
  // are deliberately excluded from the public policy.
  if (/^\/r\/[^/]+\/?$/.test(path)) return true

  // Public agent intake desk only. Do not turn this into a /field prefix.
  return path === "/field" || path === "/field/"
}
