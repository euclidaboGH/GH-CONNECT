/**
 * GreenHaven — Canonical geography types.
 * Hierarchy is country-specific; labels adapt (State/Province/Region, LGA/County/etc.).
 */

export type ContinentCode =
  | "AF"
  | "AS"
  | "EU"
  | "NA"
  | "SA"
  | "OC"

export type GeoLevel =
  | "country"
  | "admin1" // state / province / region / prefecture
  | "admin2" // LGA / county / district / municipality
  | "locality" // city / town
  | "sublocality" // ward / area (optional, expandable)

/** Labels used in UI for a country's admin hierarchy */
export interface CountryAdminLabels {
  admin1: string
  admin2: string
  locality: string
  sublocality?: string
}

export interface GeoCountry {
  id: string
  name: string
  iso2: string
  continent: ContinentCode
  labels: CountryAdminLabels
  /** IANA timezone fallback when finer data unavailable */
  defaultTimezone: string
}

export interface GeoAdmin1 {
  id: string
  countryId: string
  name: string
  aliases?: string[]
}

export interface GeoAdmin2 {
  id: string
  admin1Id: string
  name: string
  aliases?: string[]
}

export interface GeoLocality {
  id: string
  /** Prefer admin2 parent; may attach to admin1 when admin2 sparse */
  parentId: string
  parentLevel: "admin1" | "admin2"
  name: string
  aliases?: string[]
}

/** User-selected structured place (stable IDs + denormalized labels for display) */
export interface StructuredLocation {
  countryId: string
  countryName: string
  admin1Id?: string
  admin1Name?: string
  admin2Id?: string
  admin2Name?: string
  localityId?: string
  localityName?: string
  sublocalityName?: string
  /** Derived IANA timezone */
  timezone?: string
  /** Optional approximate coords — never required for MVP */
  lat?: number
  lng?: number
}

/** What others may see */
export type LocationPrivacyLevel =
  | "hidden"
  | "country"
  | "admin1"
  | "admin2"
  | "locality"

export interface UserLocationProfile {
  /** Permanent / home base */
  home?: StructuredLocation
  /** Where the user is now (optional) */
  current?: StructuredLocation
  privacy: LocationPrivacyLevel
  /** Legacy free-text fields kept in sync for older screens */
  displayCity?: string
  displayCountry?: string
}

export function formatStructuredLocation(
  loc: StructuredLocation | null | undefined,
  privacy: LocationPrivacyLevel = "locality"
): string {
  if (!loc || privacy === "hidden") return "Hidden"
  if (privacy === "country") return loc.countryName
  if (privacy === "admin1") {
    return [loc.admin1Name, loc.countryName].filter(Boolean).join(", ")
  }
  if (privacy === "admin2") {
    return [loc.admin2Name, loc.admin1Name, loc.countryName].filter(Boolean).join(", ")
  }
  return (
    [loc.localityName || loc.admin2Name, loc.admin1Name, loc.countryName]
      .filter(Boolean)
      .join(", ") || loc.countryName
  )
}
