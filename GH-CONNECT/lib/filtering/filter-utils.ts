/** Shared deterministic text-filter helpers for client and server surfaces. */
export function normalizeFilterText(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return ""
  return String(value)
    .normalize("NFKC")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/** Every query token must match somewhere in the combined searchable fields. */
export function matchesFilterQuery(query: string, ...fields: unknown[]): boolean {
  const normalizedQuery = normalizeFilterText(query).slice(0, 160)
  if (!normalizedQuery) return true
  const haystack = normalizeFilterText(fields.filter((field) => field != null).join(" "))
  return normalizedQuery.split(" ").filter(Boolean).every((token) => haystack.includes(token))
}

export function countActiveFilters(values: readonly unknown[]): number {
  return values.reduce<number>((count, value) => {
    if (typeof value === "boolean") return count + (value ? 1 : 0)
    if (typeof value === "string") return count + (value.trim() ? 1 : 0)
    if (Array.isArray(value)) return count + (value.length ? 1 : 0)
    return count + (value !== null && value !== undefined ? 1 : 0)
  }, 0)
}


/** Phase 9: short accessible summary of how many filters are active. */
export function describeActiveFilterSummary(count: number): string {
  const n = Math.max(0, Math.floor(Number(count) || 0))
  if (n <= 0) return "No filters applied"
  if (n === 1) return "1 filter applied"
  return `${n} filters applied`
}
