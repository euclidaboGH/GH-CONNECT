export type ServiceDirectoryListing = {
  id: string
  title: string
  description: string
  category: string
  price: number
  currency: "GHC" | "PI"
  location: string | null
}

const SAFE_CATEGORY = /^[\p{L}\p{N}][\p{L}\p{N} &+/_.-]{0,63}$/u

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null
  const normalized = value.normalize("NFKC").trim()
  if (!normalized || normalized.length > max || /[\u0000-\u001f\u007f]/.test(normalized)) return null
  return normalized
}

/** Accepts only server-returned active service listings with supported rails. */
export function normalizeServiceDirectoryListing(raw: unknown): ServiceDirectoryListing | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>
  const id = text(row.id, 160)
  const title = text(row.title, 200)
  const description = typeof row.description === "string" ? row.description.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 5000) : ""
  const category = text(row.category, 64)
  const price = typeof row.price === "number" ? row.price : Number.NaN
  const currency = row.currency
  if (!id || !/^[A-Za-z0-9._:-]{1,160}$/.test(id) || !title || !category || !SAFE_CATEGORY.test(category)) return null
  if (row.kind !== "service" || row.status !== "active") return null
  if (!Number.isFinite(price) || price < 0 || price > 1_000_000) return null
  if (currency !== "GHC" && currency !== "PI") return null
  const location = typeof row.location === "string" ? text(row.location, 120) : null
  return { id, title, description, category, price, currency, location }
}

export function formatServicePrice(price: number, currency: "GHC" | "PI"): string {
  const formatted = new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 8 }).format(price)
  return `${formatted} ${currency}`
}
