/** Durable, independently priced/inventoried marketplace SKU variants. */
export type MarketplaceProductVariant = {
  id: string
  sku: string
  label: string
  price: number
  currency: string
  stockOnHand: number
  stockReserved?: number
  available?: number
  active?: boolean
}

const CONTROL = /[\u0000-\u001f\u007f]/

export function normalizeProductVariants(value: unknown): MarketplaceProductVariant[] {
  if (!Array.isArray(value)) return []
  const output: MarketplaceProductVariant[] = []
  const skus = new Set<string>()
  const ids = new Set<string>()
  for (const raw of value.slice(0, 100)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue
    const row = raw as Record<string, unknown>
    const id = typeof row.id === "string" ? row.id.trim().slice(0, 80) : ""
    const sku = typeof row.sku === "string" ? row.sku.trim().slice(0, 64) : ""
    const label = typeof row.label === "string" ? row.label.trim().slice(0, 120) : ""
    const price = row.price
    const currency = typeof row.currency === "string" ? row.currency.trim().toUpperCase() : ""
    const stockOnHand = row.stockOnHand
    const skuKey = sku.toLocaleLowerCase("en-US")
    if (!id || !sku || !label || CONTROL.test(id) || CONTROL.test(sku) || CONTROL.test(label) ||
        ids.has(id) || skus.has(skuKey) || typeof price !== "number" || !Number.isFinite(price) ||
        price < 0 || price > 1_000_000 || !Number.isSafeInteger(stockOnHand) ||
        (stockOnHand as number) < 0 || (stockOnHand as number) > 1_000_000 || !["GHC", "PI"].includes(currency)) continue
    const stockReserved = row.stockReserved === undefined
      ? 0
      : Number.isSafeInteger(row.stockReserved) && Number(row.stockReserved) >= 0 && Number(row.stockReserved) <= (stockOnHand as number)
        ? Number(row.stockReserved)
        : -1
    if (stockReserved < 0) continue
    const computedAvailable = (stockOnHand as number) - stockReserved
    const available = row.available === undefined
      ? computedAvailable
      : Number.isSafeInteger(row.available) && Number(row.available) >= 0 && Number(row.available) <= computedAvailable
        ? Number(row.available)
        : computedAvailable
    ids.add(id)
    skus.add(skuKey)
    output.push({ id, sku, label, price, currency, stockOnHand: stockOnHand as number, stockReserved, available, active: row.active !== false })
  }
  return output
}

/** Seller authoring format: SKU | Label | Price | Stock (one variant per line). */
export function parseProductVariantsText(value: string, currency: string): Array<Omit<MarketplaceProductVariant, "id">> | null {
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (lines.length > 100) return null
  const rows: Array<Omit<MarketplaceProductVariant, "id">> = []
  const skus = new Set<string>()
  for (const line of lines) {
    const parts = line.split("|").map((part) => part.trim())
    if (parts.length !== 4) return null
    const [sku, label, rawPrice, rawStock] = parts
    if (!/^\d+(?:\.\d{1,8})?$/.test(rawPrice)) return null
    const price = Number(rawPrice)
    const stockOnHand = Number(rawStock)
    const key = sku.toLocaleLowerCase("en-US")
    if (!sku || sku.length > 64 || !label || label.length > 120 || CONTROL.test(line) ||
        skus.has(key) || !Number.isFinite(price) || price < 0 || price > 1_000_000 ||
        (String(rawPrice).split(".")[1]?.length || 0) > 8 || !Number.isSafeInteger(stockOnHand) ||
        stockOnHand < 0 || stockOnHand > 1_000_000 || !["GHC", "PI"].includes(currency.toUpperCase())) return null
    skus.add(key)
    rows.push({ sku, label, price, currency: currency.toUpperCase(), stockOnHand, active: true })
  }
  return rows
}

export function productVariantsToText(value: unknown): string {
  return normalizeProductVariants(value).filter((row) => row.active !== false).map((row) => `${row.sku} | ${row.label} | ${row.price} | ${row.stockOnHand}`).join("\n")
}
