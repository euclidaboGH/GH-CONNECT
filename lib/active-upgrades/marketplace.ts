/**
 * Number(null) and Number("") are 0, which would turn "stock not reported" into "out of stock".
 * Only real numbers / numeric strings count as a stock figure; everything else is unknown.
 */
function stockFigure(stock: unknown): number | null {
  if (typeof stock === "string" && stock.trim() === "") return null
  if (typeof stock !== "number" && typeof stock !== "string") return null
  const n = Number(stock)
  return Number.isSafeInteger(n) && n >= 0 ? n : null
}

/**
 * Canonical, bounded marketplace search input shared by live input and persisted filters.
 * Normalize compatibility forms, replace control characters, collapse whitespace, and cap
 * the result before it reaches server-side listing search.
 */
export function normalizeListingSearch(value: unknown): string {
  return String(value ?? "")
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100)
    .trimEnd()
}

/** Marketplace browse/cart helpers. Pricing and stock authority stay on the server. */
export function safeListingQuantity(quantity: unknown, stock: unknown): number {
  const q = Number(quantity)
  if (!Number.isSafeInteger(q) || q < 1) return 0
  const s = stockFigure(stock)
  return s === null ? q : Math.min(q, s)
}

export function stockLabel(stock: unknown): "out_of_stock" | "low_stock" | "in_stock" | "unknown" {
  const n = stockFigure(stock)
  if (n === null) return "unknown"
  return n === 0 ? "out_of_stock" : n <= 5 ? "low_stock" : "in_stock"
}

export function canAddListingToCart(input: {
  listingActive?: boolean
  ownListing?: boolean
  stock?: unknown
  quantity?: unknown
}): boolean {
  return (
    input.listingActive === true &&
    input.ownListing !== true &&
    safeListingQuantity(input.quantity ?? 1, input.stock) > 0
  )
}

export function sellerResponseLabel(hours: unknown): string {
  const n = Number(hours)
  if (!Number.isFinite(n) || n < 0) return "Response time unavailable"
  return n < 1
    ? "Usually replies within an hour"
    : n < 24
      ? `Usually replies within ${Math.ceil(n)} hours`
      : "Usually replies within a day or more"
}

export function marketplaceBucketLabel(
  bucket: "browse" | "orders" | "saved" | "sell" | "mine" | "cart" | string,
): string {
  switch (bucket) {
    case "browse":
      return "Browse"
    case "orders":
      return "Orders"
    case "saved":
      return "Saved"
    case "sell":
      return "Sell"
    case "mine":
      return "My listings"
    case "cart":
      return "Cart"
    default:
      return "Marketplace"
  }
}
