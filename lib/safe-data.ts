/**
 * Safe data accessors — prevent refresh crashes from null/undefined arrays & profiles.
 */

export function asArray(value) {
  return Array.isArray(value) ? value : []
}

export function asString(value, fallback) {
  if (fallback === undefined) fallback = ""
  if (typeof value === "string") return value
  if (value == null) return fallback
  return String(value)
}

export function asNumber(value, fallback) {
  if (fallback === undefined) fallback = 0
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function asInterests(value) {
  return asArray(value).filter(function (x) {
    return typeof x === "string" && x.trim().length > 0
  })
}

export function safeLocation(city, country, fallback) {
  if (fallback === undefined) fallback = "Global"
  const parts = [city, country]
    .map(function (p) {
      return typeof p === "string" ? p.trim() : ""
    })
    .filter(Boolean)
  return parts.length ? parts.join(", ") : fallback
}

export function safeProfile(profile) {
  if (profile && typeof profile === "object") return profile
  return {
    displayName: "Member",
    photos: [],
    interests: [],
    primaryMode: "friendship",
  }
}

export function uniqueIds(ids) {
  return Array.from(
    new Set(
      asArray(ids)
        .map(function (id) {
          return asString(id)
        })
        .filter(Boolean)
    )
  )
}
