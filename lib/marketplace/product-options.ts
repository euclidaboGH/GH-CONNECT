/** Safe, descriptive product options. Variants share the listing's authoritative price and stock. */
export type MarketplaceProductOption = { name: string; values: string[] }

const CONTROL = /[\u0000-\u001f\u007f]/

export function normalizeProductOptions(value: unknown): MarketplaceProductOption[] {
  if (!Array.isArray(value)) return []
  const output: MarketplaceProductOption[] = []
  const names = new Set<string>()
  for (const item of value.slice(0, 4)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue
    const row = item as Record<string, unknown>
    const name = typeof row.name === "string" ? row.name.trim().slice(0, 32) : ""
    const key = name.toLocaleLowerCase("en-US")
    if (!name || CONTROL.test(name) || names.has(key) || !Array.isArray(row.values)) continue
    const seen = new Set<string>()
    const values: string[] = []
    for (const raw of row.values.slice(0, 12)) {
      if (typeof raw !== "string") continue
      const entry = raw.trim().slice(0, 40)
      const normalized = entry.toLocaleLowerCase("en-US")
      if (!entry || CONTROL.test(entry) || seen.has(normalized)) continue
      seen.add(normalized)
      values.push(entry)
    }
    if (!values.length) continue
    names.add(key)
    output.push({ name, values })
  }
  return output
}

/** Seller form format: one option group per line, e.g. Size: S, M, L */
export function parseProductOptionsText(value: string): MarketplaceProductOption[] | null {
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (lines.length > 4) return null
  const rows: MarketplaceProductOption[] = []
  for (const line of lines) {
    const separator = line.indexOf(":")
    if (separator < 1) return null
    const name = line.slice(0, separator).trim()
    const values = line.slice(separator + 1).split(",").map((entry) => entry.trim()).filter(Boolean)
    if (!name || !values.length || values.length > 12) return null
    rows.push({ name, values })
  }
  const normalized = normalizeProductOptions(rows)
  if (normalized.length !== rows.length || normalized.some((row, i) => row.values.length !== rows[i].values.length)) return null
  return normalized
}

export function productOptionsToText(value: unknown): string {
  return normalizeProductOptions(value).map((row) => `${row.name}: ${row.values.join(", ")}`).join("\n")
}
