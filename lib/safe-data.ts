/**
 * Safe data accessors — prevent refresh crashes from null/undefined arrays & profiles.
 */

export function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

export function asString(value: unknown, fallback: string = ""): string {
  if (typeof value === "string") return value
  if (value == null) return fallback
  return String(value)
}

export function asNumber(value: unknown, fallback: number = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function asInterests(value: unknown): string[] {
  return asArray<unknown>(value).filter(function (x): x is string {
    return typeof x === "string" && x.trim().length > 0
  })
}

export function safeLocation(
  city: unknown,
  country: unknown,
  fallback: string = "Global"
): string {
  const parts = [city, country]
    .map(function (p) {
      return typeof p === "string" ? p.trim() : ""
    })
    .filter(Boolean)
  return parts.length ? parts.join(", ") : fallback
}

export function safeProfile(profile: unknown): {
  displayName: string
  photos: string[]
  interests: string[]
  primaryMode: string
  [key: string]: unknown
} {
  if (profile && typeof profile === "object") {
    return profile as {
      displayName: string
      photos: string[]
      interests: string[]
      primaryMode: string
      [key: string]: unknown
    }
  }
  return {
    displayName: "Member",
    photos: [],
    interests: [],
    primaryMode: "friendship",
  }
}

export function uniqueIds(ids: unknown): string[] {
  return Array.from(
    new Set(
      asArray<unknown>(ids)
        .map(function (id) {
          return asString(id)
        })
        .filter(Boolean)
    )
  )
}
