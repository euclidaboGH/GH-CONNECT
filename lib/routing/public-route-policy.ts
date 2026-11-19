/**
 * Explicit public-route policy.
 *
 * Research and field routes are temporarily disconnected at middleware.
 * They must not be classified as public while the service is suspended.
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

  return false
}
