/**
 * Continent-aware discovery helpers — global by design.
 * Uses coarse region signals; never requires precise GPS without consent.
 */

export type ContinentId =
  | "africa"
  | "asia"
  | "europe"
  | "north_america"
  | "south_america"
  | "oceania"
  | "global"

export const CONTINENT_LABELS: Record<ContinentId, string> = {
  africa: "Africa",
  asia: "Asia",
  europe: "Europe",
  north_america: "North America",
  south_america: "South America",
  oceania: "Oceania",
  global: "Worldwide",
}

/** Seed mapping for major countries already in geography catalog */
const COUNTRY_TO_CONTINENT: Record<string, ContinentId> = {
  nigeria: "africa",
  egypt: "africa",
  "south africa": "africa",
  kenya: "africa",
  ghana: "africa",
  morocco: "africa",
  china: "asia",
  india: "asia",
  japan: "asia",
  "south korea": "asia",
  indonesia: "asia",
  "saudi arabia": "asia",
  "united kingdom": "europe",
  france: "europe",
  germany: "europe",
  italy: "europe",
  spain: "europe",
  netherlands: "europe",
  "united states": "north_america",
  canada: "north_america",
  mexico: "north_america",
  cuba: "north_america",
  jamaica: "north_america",
  "costa rica": "north_america",
  brazil: "south_america",
  argentina: "south_america",
  colombia: "south_america",
  chile: "south_america",
  peru: "south_america",
  venezuela: "south_america",
  australia: "oceania",
  "new zealand": "oceania",
  "papua new guinea": "oceania",
  fiji: "oceania",
  samoa: "oceania",
  tonga: "oceania",
}

export function continentFromCountry(country?: string | null): ContinentId {
  if (!country?.trim()) return "global"
  const key = country.trim().toLowerCase()
  return COUNTRY_TO_CONTINENT[key] || "global"
}

export function candidateInContinent(
  candidate: { country?: string; location?: string; city?: string },
  continent: ContinentId
): boolean {
  if (continent === "global") return true
  const fromCountry = continentFromCountry(candidate.country)
  if (fromCountry === continent) return true
  const blob = `${candidate.location || ""} ${candidate.city || ""} ${candidate.country || ""}`.toLowerCase()
  // Soft fallback: country name substring
  return Object.entries(COUNTRY_TO_CONTINENT).some(
    ([name, id]) => id === continent && blob.includes(name)
  )
}
