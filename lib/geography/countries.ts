import type { GeoCountry } from "./types"

/** 36 seed countries — 6 per inhabited continent */
export const GEO_COUNTRIES: GeoCountry[] = [
  // AFRICA
  { id: "ng", name: "Nigeria", iso2: "NG", continent: "AF", labels: { admin1: "State", admin2: "LGA", locality: "City / Town", sublocality: "Ward / Area" }, defaultTimezone: "Africa/Lagos" },
  { id: "eg", name: "Egypt", iso2: "EG", continent: "AF", labels: { admin1: "Governorate", admin2: "Markaz", locality: "City" }, defaultTimezone: "Africa/Cairo" },
  { id: "za", name: "South Africa", iso2: "ZA", continent: "AF", labels: { admin1: "Province", admin2: "Municipality", locality: "City / Town" }, defaultTimezone: "Africa/Johannesburg" },
  { id: "ke", name: "Kenya", iso2: "KE", continent: "AF", labels: { admin1: "County", admin2: "Sub-county", locality: "Town" }, defaultTimezone: "Africa/Nairobi" },
  { id: "gh", name: "Ghana", iso2: "GH", continent: "AF", labels: { admin1: "Region", admin2: "District", locality: "City / Town" }, defaultTimezone: "Africa/Accra" },
  { id: "ma", name: "Morocco", iso2: "MA", continent: "AF", labels: { admin1: "Region", admin2: "Province", locality: "City" }, defaultTimezone: "Africa/Casablanca" },
  // ASIA
  { id: "cn", name: "China", iso2: "CN", continent: "AS", labels: { admin1: "Province", admin2: "Prefecture", locality: "City" }, defaultTimezone: "Asia/Shanghai" },
  { id: "in", name: "India", iso2: "IN", continent: "AS", labels: { admin1: "State", admin2: "District", locality: "City" }, defaultTimezone: "Asia/Kolkata" },
  { id: "jp", name: "Japan", iso2: "JP", continent: "AS", labels: { admin1: "Prefecture", admin2: "Municipality", locality: "City / Ward" }, defaultTimezone: "Asia/Tokyo" },
  { id: "kr", name: "South Korea", iso2: "KR", continent: "AS", labels: { admin1: "Province / City", admin2: "District", locality: "Neighborhood" }, defaultTimezone: "Asia/Seoul" },
  { id: "id", name: "Indonesia", iso2: "ID", continent: "AS", labels: { admin1: "Province", admin2: "Regency", locality: "City" }, defaultTimezone: "Asia/Jakarta" },
  { id: "sa", name: "Saudi Arabia", iso2: "SA", continent: "AS", labels: { admin1: "Province", admin2: "Governorate", locality: "City" }, defaultTimezone: "Asia/Riyadh" },
  // EUROPE
  { id: "gb", name: "United Kingdom", iso2: "GB", continent: "EU", labels: { admin1: "Nation / Region", admin2: "County", locality: "City / Town" }, defaultTimezone: "Europe/London" },
  { id: "fr", name: "France", iso2: "FR", continent: "EU", labels: { admin1: "Region", admin2: "Department", locality: "City" }, defaultTimezone: "Europe/Paris" },
  { id: "de", name: "Germany", iso2: "DE", continent: "EU", labels: { admin1: "State (Land)", admin2: "District", locality: "City" }, defaultTimezone: "Europe/Berlin" },
  { id: "it", name: "Italy", iso2: "IT", continent: "EU", labels: { admin1: "Region", admin2: "Province", locality: "City" }, defaultTimezone: "Europe/Rome" },
  { id: "es", name: "Spain", iso2: "ES", continent: "EU", labels: { admin1: "Autonomous community", admin2: "Province", locality: "City" }, defaultTimezone: "Europe/Madrid" },
  { id: "nl", name: "Netherlands", iso2: "NL", continent: "EU", labels: { admin1: "Province", admin2: "Municipality", locality: "City / Town" }, defaultTimezone: "Europe/Amsterdam" },
  // NORTH AMERICA
  { id: "us", name: "United States", iso2: "US", continent: "NA", labels: { admin1: "State", admin2: "County", locality: "City" }, defaultTimezone: "America/New_York" },
  { id: "ca", name: "Canada", iso2: "CA", continent: "NA", labels: { admin1: "Province", admin2: "Region", locality: "City" }, defaultTimezone: "America/Toronto" },
  { id: "mx", name: "Mexico", iso2: "MX", continent: "NA", labels: { admin1: "State", admin2: "Municipality", locality: "City" }, defaultTimezone: "America/Mexico_City" },
  { id: "cu", name: "Cuba", iso2: "CU", continent: "NA", labels: { admin1: "Province", admin2: "Municipality", locality: "City" }, defaultTimezone: "America/Havana" },
  { id: "jm", name: "Jamaica", iso2: "JM", continent: "NA", labels: { admin1: "Parish", admin2: "District", locality: "Town" }, defaultTimezone: "America/Jamaica" },
  { id: "cr", name: "Costa Rica", iso2: "CR", continent: "NA", labels: { admin1: "Province", admin2: "Canton", locality: "District" }, defaultTimezone: "America/Costa_Rica" },
  // SOUTH AMERICA
  { id: "br", name: "Brazil", iso2: "BR", continent: "SA", labels: { admin1: "State", admin2: "Municipality", locality: "City" }, defaultTimezone: "America/Sao_Paulo" },
  { id: "ar", name: "Argentina", iso2: "AR", continent: "SA", labels: { admin1: "Province", admin2: "Department", locality: "City" }, defaultTimezone: "America/Argentina/Buenos_Aires" },
  { id: "co", name: "Colombia", iso2: "CO", continent: "SA", labels: { admin1: "Department", admin2: "Municipality", locality: "City" }, defaultTimezone: "America/Bogota" },
  { id: "cl", name: "Chile", iso2: "CL", continent: "SA", labels: { admin1: "Region", admin2: "Province", locality: "City" }, defaultTimezone: "America/Santiago" },
  { id: "pe", name: "Peru", iso2: "PE", continent: "SA", labels: { admin1: "Region", admin2: "Province", locality: "City" }, defaultTimezone: "America/Lima" },
  { id: "ve", name: "Venezuela", iso2: "VE", continent: "SA", labels: { admin1: "State", admin2: "Municipality", locality: "City" }, defaultTimezone: "America/Caracas" },
  // OCEANIA
  { id: "au", name: "Australia", iso2: "AU", continent: "OC", labels: { admin1: "State / Territory", admin2: "LGA", locality: "Suburb / City" }, defaultTimezone: "Australia/Sydney" },
  { id: "nz", name: "New Zealand", iso2: "NZ", continent: "OC", labels: { admin1: "Region", admin2: "District", locality: "City / Town" }, defaultTimezone: "Pacific/Auckland" },
  { id: "pg", name: "Papua New Guinea", iso2: "PG", continent: "OC", labels: { admin1: "Province", admin2: "District", locality: "Town" }, defaultTimezone: "Pacific/Port_Moresby" },
  { id: "fj", name: "Fiji", iso2: "FJ", continent: "OC", labels: { admin1: "Division", admin2: "Province", locality: "Town" }, defaultTimezone: "Pacific/Fiji" },
  { id: "ws", name: "Samoa", iso2: "WS", continent: "OC", labels: { admin1: "District", admin2: "Village group", locality: "Village" }, defaultTimezone: "Pacific/Apia" },
  { id: "to", name: "Tonga", iso2: "TO", continent: "OC", labels: { admin1: "Island group", admin2: "District", locality: "Village" }, defaultTimezone: "Pacific/Tongatapu" },
]

export const CONTINENT_LABELS: Record<string, string> = {
  AF: "Africa",
  AS: "Asia",
  EU: "Europe",
  NA: "North America",
  SA: "South America",
  OC: "Oceania",
}
