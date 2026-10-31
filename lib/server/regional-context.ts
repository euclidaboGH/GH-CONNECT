/** Server-side regional request context. Headers are hints, never identity or authorization. */

export type RequestRegionalContext = {
  locale: string
  timeZone: string
  latitude: number | null
  longitude: number | null
  locationCapturedAt: string | null
}

const TIME_ZONE_RE = /^[A-Za-z0-9._+\/-]{1,80}$/
const LOCALE_RE = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{2,8}){0,3}$/

function safeFinite(value: string | null, min: number, max: number): number | null {
  if (!value) return null
  const n = Number(value)
  return Number.isFinite(n) && n >= min && n <= max ? n : null
}

export function getRequestRegionalContext(headers: Headers): RequestRegionalContext {
  const localeRaw = String(headers.get("x-gh-locale") || "en-US").trim()
  const timeZoneRaw = String(headers.get("x-gh-timezone") || "UTC").trim()
  const locale = LOCALE_RE.test(localeRaw) ? localeRaw : "en-US"
  const timeZone = TIME_ZONE_RE.test(timeZoneRaw) ? timeZoneRaw : "UTC"
  const latitude = safeFinite(headers.get("x-gh-location-latitude"), -90, 90)
  const longitude = safeFinite(headers.get("x-gh-location-longitude"), -180, 180)
  const captured = headers.get("x-gh-location-captured-at")
  const locationCapturedAt = captured && Number.isFinite(Date.parse(captured)) ? new Date(captured).toISOString() : null
  return { locale, timeZone, latitude, longitude, locationCapturedAt }
}
