/**
 * GreenHaven regional context.
 *
 * Principles:
 * - Server timestamps remain UTC/ISO and are never rewritten to a user's clock.
 * - Client presentation uses the device locale/time zone.
 * - Browser GPS is opt-in, ephemeral by default, and never persisted here.
 * - Location sent to APIs is opt-in and coarse-rounded to reduce unnecessary precision.
 */

export type RegionalLocation = {
  latitude: number
  longitude: number
  accuracyMeters?: number
  capturedAt: number
  source: "browser"
}

export type RegionalContextSnapshot = {
  locale: string
  timeZone: string
  offsetMinutes: number
  location: RegionalLocation | null
  locationPermission: PermissionState | "unsupported" | "unknown"
}

export function getClientLocale(): string {
  if (typeof navigator === "undefined") return "en-US"
  return navigator.language || "en-US"
}

export function getClientTimeZone(): string {
  if (typeof Intl === "undefined") return "UTC"
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

export function getTimeZoneOffsetMinutes(at = Date.now(), timeZone = getClientTimeZone()): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longOffset",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(new Date(at))
    const value = parts.find((p) => p.type === "timeZoneName")?.value || "GMT"
    const match = value.match(/^GMT([+-])(\d{2})(?::?(\d{2}))?$/)
    if (!match) return 0
    const minutes = Number(match[2]) * 60 + Number(match[3] || 0)
    return match[1] === "-" ? -minutes : minutes
  } catch {
    return 0
  }
}

export function formatDateTime(
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = {},
  context?: Pick<RegionalContextSnapshot, "locale" | "timeZone">,
): string {
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) return ""
  const locale = context?.locale || getClientLocale()
  const timeZone = context?.timeZone || getClientTimeZone()
  try {
    return new Intl.DateTimeFormat(locale, { timeZone, ...options }).format(date)
  } catch {
    return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...options }).format(date)
  }
}

export function formatDateTimeWithZone(value: string | number | Date, context?: Pick<RegionalContextSnapshot, "locale" | "timeZone">): string {
  return formatDateTime(value, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZoneName: "short",
  }, context)
}

export function formatRelativeTime(value: string | number | Date, now = Date.now(), locale = getClientLocale()): string {
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return ""
  const diffSeconds = Math.round((timestamp - now) / 1000)
  const abs = Math.abs(diffSeconds)
  const unit: Intl.RelativeTimeFormatUnit = abs < 60 ? "second" : abs < 3600 ? "minute" : abs < 86400 ? "hour" : "day"
  const divisor = unit === "second" ? 1 : unit === "minute" ? 60 : unit === "hour" ? 3600 : 86400
  const valueRounded = Math.round(diffSeconds / divisor)
  try {
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" }).format(valueRounded, unit)
  } catch {
    return `${valueRounded} ${unit}${Math.abs(valueRounded) === 1 ? "" : "s"}`
  }
}

export function locationHeaders(location: RegionalLocation | null): Record<string, string> {
  if (!location) return {}
  // Coarse precision is enough for nearby/discovery lanes and avoids broadcasting exact GPS.
  const latitude = Math.round(location.latitude * 1000) / 1000
  const longitude = Math.round(location.longitude * 1000) / 1000
  return {
    "X-GH-Location-Latitude": String(latitude),
    "X-GH-Location-Longitude": String(longitude),
    "X-GH-Location-Captured-At": new Date(location.capturedAt).toISOString(),
    "X-GH-Location-Source": "browser",
  }
}

export function regionalHeaders(location: RegionalLocation | null = null): Record<string, string> {
  const headers: Record<string, string> = {
    "X-GH-Locale": getClientLocale(),
    "X-GH-Timezone": getClientTimeZone(),
  }
  Object.assign(headers, locationHeaders(location))
  return headers
}

export async function getLocationPermission(): Promise<PermissionState | "unsupported" | "unknown"> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return "unsupported"
  try {
    if (!navigator.permissions?.query) return "unknown"
    const status = await navigator.permissions.query({ name: "geolocation" })
    return status.state
  } catch {
    return "unknown"
  }
}

export function captureBrowserLocation(options?: PositionOptions): Promise<RegionalLocation> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.reject(new Error("Location is not supported on this device."))
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = Number(position.coords.latitude)
        const longitude = Number(position.coords.longitude)
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          reject(new Error("The device returned an invalid location."))
          return
        }
        resolve({
          latitude,
          longitude,
          accuracyMeters: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : undefined,
          capturedAt: Date.now(),
          source: "browser",
        })
      },
      (error) => reject(new Error(error.message || "Location permission was not granted.")),
      { enableHighAccuracy: false, maximumAge: 120_000, timeout: 10_000, ...options },
    )
  })
}
