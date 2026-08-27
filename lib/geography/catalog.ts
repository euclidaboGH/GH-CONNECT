/**
 * Geography catalog — single API for countries, admin levels, search, timezone, privacy display.
 * UI must not hardcode geographic lists.
 */

import { GEO_COUNTRIES, CONTINENT_LABELS } from "./countries"
import { NG_STATES, NG_LGAS, NG_CITIES } from "./nigeria"
import { ADMIN1_BY_COUNTRY, LOCALITIES_BY_ADMIN1 } from "./admin1-seed"
import type {
  GeoCountry,
  GeoAdmin1,
  StructuredLocation,
  LocationPrivacyLevel,
} from "./types"
import { formatStructuredLocation } from "./types"

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
}

export function listContinents(): { code: string; label: string }[] {
  return Object.entries(CONTINENT_LABELS).map(([code, label]) => ({ code, label }))
}

export function listCountries(continentCode?: string): GeoCountry[] {
  if (!continentCode) return [...GEO_COUNTRIES]
  return GEO_COUNTRIES.filter((c) => c.continent === continentCode)
}

export function getCountry(idOrName: string): GeoCountry | undefined {
  const q = idOrName.trim().toLowerCase()
  return GEO_COUNTRIES.find(
    (c) => c.id === q || c.iso2.toLowerCase() === q || c.name.toLowerCase() === q
  )
}

export function listAdmin1(countryId: string): GeoAdmin1[] {
  const c = getCountry(countryId)
  if (!c) return []
  if (c.id === "ng") {
    return NG_STATES.map((s) => ({ id: s.id, countryId: "ng", name: s.name }))
  }
  return (ADMIN1_BY_COUNTRY[c.id] || []).map((s) => ({
    id: s.id,
    countryId: c.id,
    name: s.name,
  }))
}

export function listAdmin2(admin1Id: string): { id: string; name: string }[] {
  if (admin1Id.startsWith("ng-")) {
    const names = NG_LGAS[admin1Id] || []
    return names.map((name) => ({
      id: `${admin1Id}-${slug(name)}`,
      name,
    }))
  }
  // Other countries: admin2 optional — empty until expanded seed
  return []
}

export function listLocalities(
  admin1Id: string,
  admin2Id?: string
): { id: string; name: string }[] {
  if (admin1Id.startsWith("ng-")) {
    const cities = NG_CITIES[admin1Id] || []
    if (cities.length) {
      return cities.map((name) => ({
        id: `${admin1Id}-city-${slug(name)}`,
        name,
      }))
    }
    // Fall back to LGA names as locality choices
    return listAdmin2(admin1Id)
  }
  const names = LOCALITIES_BY_ADMIN1[admin1Id] || []
  return names.map((name) => ({
    id: `${admin1Id}-loc-${slug(name)}`,
    name,
  }))
}

export function buildStructuredLocation(input: {
  countryId: string
  admin1Id?: string
  admin2Id?: string
  localityId?: string
  localityName?: string
  sublocalityName?: string
}): StructuredLocation | null {
  const country = getCountry(input.countryId)
  if (!country) return null
  const admin1 = input.admin1Id
    ? listAdmin1(country.id).find((a) => a.id === input.admin1Id)
    : undefined
  const admin2 = input.admin2Id
    ? listAdmin2(input.admin1Id || "").find((a) => a.id === input.admin2Id)
    : undefined
  let localityName = input.localityName
  let localityId = input.localityId
  if (localityId && !localityName) {
    const locs = listLocalities(input.admin1Id || "", input.admin2Id)
    localityName = locs.find((l) => l.id === localityId)?.name
  }
  return {
    countryId: country.id,
    countryName: country.name,
    admin1Id: admin1?.id,
    admin1Name: admin1?.name,
    admin2Id: admin2?.id,
    admin2Name: admin2?.name,
    localityId,
    localityName,
    sublocalityName: input.sublocalityName?.trim() || undefined,
    timezone: country.defaultTimezone,
  }
}

/** Legacy free-text → best-effort structured (for existing profiles) */
export function parseLegacyLocation(
  city: string,
  country: string
): StructuredLocation | null {
  const c = getCountry(country)
  if (!c) {
    if (!country && !city) return null
    return {
      countryId: "xx",
      countryName: country || "Unknown",
      localityName: city || undefined,
      timezone: "UTC",
    }
  }
  const admin1List = listAdmin1(c.id)
  const cityLower = (city || "").toLowerCase()
  for (const a1 of admin1List) {
    const locs = listLocalities(a1.id)
    const match = locs.find((l) => l.name.toLowerCase() === cityLower)
    if (match) {
      return buildStructuredLocation({
        countryId: c.id,
        admin1Id: a1.id,
        localityId: match.id,
        localityName: match.name,
      })
    }
  }
  // City matches admin1 name (e.g. Cairo governorate)
  const a1Match = admin1List.find((a) => a.name.toLowerCase() === cityLower)
  if (a1Match) {
    return buildStructuredLocation({ countryId: c.id, admin1Id: a1Match.id })
  }
  return {
    countryId: c.id,
    countryName: c.name,
    localityName: city || undefined,
    timezone: c.defaultTimezone,
  }
}

export function searchPlaces(query: string, limit = 20): {
  type: "country" | "admin1" | "locality"
  id: string
  label: string
  countryId: string
}[] {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  const out: {
    type: "country" | "admin1" | "locality"
    id: string
    label: string
    countryId: string
  }[] = []
  for (const c of GEO_COUNTRIES) {
    if (c.name.toLowerCase().includes(q)) {
      out.push({ type: "country", id: c.id, label: c.name, countryId: c.id })
    }
    for (const a1 of listAdmin1(c.id)) {
      if (a1.name.toLowerCase().includes(q)) {
        out.push({
          type: "admin1",
          id: a1.id,
          label: `${a1.name}, ${c.name}`,
          countryId: c.id,
        })
      }
      for (const loc of listLocalities(a1.id)) {
        if (loc.name.toLowerCase().includes(q)) {
          out.push({
            type: "locality",
            id: loc.id,
            label: `${loc.name}, ${a1.name}, ${c.name}`,
            countryId: c.id,
          })
        }
        if (out.length >= limit) return out
      }
    }
    if (out.length >= limit) break
  }
  return out.slice(0, limit)
}

export function publicLocationLabel(
  loc: StructuredLocation | null | undefined,
  privacy: LocationPrivacyLevel
): string {
  return formatStructuredLocation(loc, privacy)
}

export function legacyCityCountry(loc: StructuredLocation | null | undefined): {
  city: string
  country: string
} {
  if (!loc) return { city: "", country: "" }
  return {
    city: loc.localityName || loc.admin2Name || loc.admin1Name || "",
    country: loc.countryName,
  }
}

export { formatStructuredLocation }
export type { StructuredLocation, LocationPrivacyLevel, GeoCountry }
