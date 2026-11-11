/** Canonical filter primitives shared by browser state and server query parsing. */
export type FilterDateRange = { from: string | null; to: string | null }
export type FilterNumberRange = { min: number | null; max: number | null }
export type FilterLocationRange = { latitude: number | null; longitude: number | null; radiusKm: number | null }
export type FilterSortDirection = "asc" | "desc"
export type FilterQueryContract = {
  q: string
  category: string | null
  from: string | null
  to: string | null
  min: number | null
  max: number | null
  latitude: number | null
  longitude: number | null
  radiusKm: number | null
  sort: string | null
  direction: FilterSortDirection
  limit: number
  cursor: string | null
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const CATEGORY = /^[\p{L}\p{N}][\p{L}\p{N} &+/_.-]{0,63}$/u
const SORT = /^[a-z][a-z0-9_]{0,31}$/

export function parseIsoDate(value: string | null): string | null {
  if (!value || !ISO_DATE.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null
}

export function parseFiniteRange(minRaw: string | null, maxRaw: string | null, bounds: { min?: number; max?: number } = {}): FilterNumberRange | null {
  const read = (raw: string | null) => raw == null || raw === "" ? null : /^-?\d{1,12}(?:\.\d{1,6})?$/.test(raw) ? Number(raw) : NaN
  const min = read(minRaw), max = read(maxRaw)
  if (Number.isNaN(min) || Number.isNaN(max)) return null
  if (min != null && (!Number.isFinite(min) || (bounds.min != null && min < bounds.min))) return null
  if (max != null && (!Number.isFinite(max) || (bounds.max != null && max > bounds.max))) return null
  if (min != null && max != null && min > max) return null
  return { min, max }
}

export function parseLocationRange(latRaw: string | null, lonRaw: string | null, radiusRaw: string | null): FilterLocationRange | null {
  if (latRaw == null && lonRaw == null && radiusRaw == null) return { latitude: null, longitude: null, radiusKm: null }
  if (latRaw == null || lonRaw == null || radiusRaw == null) return null
  if (!/^-?\d{1,3}(?:\.\d{1,6})?$/.test(latRaw) || !/^-?\d{1,3}(?:\.\d{1,6})?$/.test(lonRaw) || !/^\d{1,3}(?:\.\d{1,2})?$/.test(radiusRaw)) return null
  const latitude = Number(latRaw), longitude = Number(lonRaw), radiusKm = Number(radiusRaw)
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180 || radiusKm < 1 || radiusKm > 500) return null
  return { latitude, longitude, radiusKm }
}

export function parseFilterQuery(params: URLSearchParams, options: { defaultLimit?: number; maxLimit?: number; sorts?: readonly string[] } = {}): FilterQueryContract | null {
  const fromRaw = params.get("from"), toRaw = params.get("to")
  const from = parseIsoDate(fromRaw), to = parseIsoDate(toRaw)
  if ((fromRaw && !from) || (toRaw && !to) || (from && to && from > to)) return null
  const range = parseFiniteRange(params.get("min"), params.get("max"))
  if (!range) return null
  const location = parseLocationRange(params.get("lat"), params.get("lon"), params.get("radiusKm"))
  if (!location) return null
  const categoryRaw = params.get("category")?.trim() || null
  if (categoryRaw && !CATEGORY.test(categoryRaw)) return null
  const sort = params.get("sort")?.trim() || null
  if (sort && (!SORT.test(sort) || (options.sorts && !options.sorts.includes(sort)))) return null
  const direction = params.get("direction") || "desc"
  if (direction !== "asc" && direction !== "desc") return null
  const limitRaw = params.get("limit")
  if (limitRaw && !/^\d{1,3}$/.test(limitRaw)) return null
  const maxLimit = options.maxLimit ?? 100
  const limit = Math.min(Math.max(Number(limitRaw || options.defaultLimit || 50), 1), maxLimit)
  const cursor = params.get("cursor")
  if (cursor && cursor.length > 512) return null
  return { q: (params.get("q") || "").normalize("NFKC").trim().slice(0, 160), category: categoryRaw, from, to, min: range.min, max: range.max, ...location, sort, direction, limit, cursor }
}

export function matchesFilterDateRange(timestamp: number | string | null | undefined, range: FilterDateRange): boolean {
  if (!range.from && !range.to) return true
  if (timestamp == null) return false
  const value = typeof timestamp === "number" ? timestamp : Date.parse(timestamp)
  if (!Number.isFinite(value)) return false
  const from = range.from ? Date.parse(`${range.from}T00:00:00.000Z`) : null
  const to = range.to ? Date.parse(`${range.to}T23:59:59.999Z`) : null
  return (from == null || value >= from) && (to == null || value <= to)
}

export function matchesFilterNumberRange(value: number | null | undefined, range: FilterNumberRange): boolean {
  if (range.min == null && range.max == null) return true
  if (typeof value !== "number" || !Number.isFinite(value)) return false
  return (range.min == null || value >= range.min) && (range.max == null || value <= range.max)
}

export function matchesFilterCategory(value: unknown, category: string | null): boolean {
  if (!category || category === "all") return true
  return String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase() === category.normalize("NFKC").trim().toLocaleLowerCase()
}

export function haversineDistanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const radians = (degrees: number) => degrees * Math.PI / 180
  const dLat = radians(b.latitude - a.latitude), dLon = radians(b.longitude - a.longitude)
  const lat1 = radians(a.latitude), lat2 = radians(b.latitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

export function serializeFilterQuery(contract: Partial<FilterQueryContract>): URLSearchParams {
  const params = new URLSearchParams()
  for (const key of ["q", "category", "from", "to", "sort", "cursor"] as const) if (contract[key]) params.set(key, String(contract[key]))
  for (const key of ["min", "max", "latitude", "longitude", "radiusKm", "limit"] as const) if (contract[key] != null) params.set(({ latitude: "lat", longitude: "lon" } as Record<string, string>)[key] || key, String(contract[key]))
  if (contract.direction) params.set("direction", contract.direction)
  return params
}

/** Never compare GHC and PI numeric amounts as if they shared one price scale. */
export function matchesFilterCurrencyRange(value: number | null | undefined, currency: string | null | undefined, range: FilterNumberRange, selectedCurrency: "all" | "GHC" | "PI"): boolean {
  const hasRange = range.min != null || range.max != null
  if (selectedCurrency === "all") return !hasRange
  if (String(currency || "").toUpperCase() !== selectedCurrency) return false
  return matchesFilterNumberRange(value, range)
}
