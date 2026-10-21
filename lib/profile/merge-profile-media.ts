/**
 * Prefer local displayable media when server returns empty (common when
 * durable storage is not configured and only data: URLs exist client-side).
 */
import { isDisplayableProfileMediaUrl, isCrossDeviceMediaUrl } from "./sanitize-profile-media"

export function mergePhotos(
  local: unknown,
  server: unknown
): string[] {
  const loc = Array.isArray(local)
    ? local.map(String).filter(isDisplayableProfileMediaUrl)
    : []
  const srv = Array.isArray(server)
    ? server.map(String).filter(isCrossDeviceMediaUrl)
    : []
  if (srv.length > 0) return srv.slice(0, 6)
  return loc.slice(0, 6)
}

export function mergeCover(
  local: unknown,
  server: unknown
): string {
  const s = server === null || server === undefined ? "" : String(server).trim()
  const l = local === null || local === undefined ? "" : String(local).trim()
  if (s && isCrossDeviceMediaUrl(s)) return s
  // Explicit server clear only when durable and empty string with intent —
  // empty server must not wipe a good local preview.
  if (l && isDisplayableProfileMediaUrl(l)) return l
  return s && isDisplayableProfileMediaUrl(s) ? s : ""
}
