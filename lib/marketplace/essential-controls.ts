/**
 * Section 4 — Marketplace & Commerce essential controls (0.338.15)
 */

export const MARKETPLACE_COMMISSION_BPS = 500
export const CART_LINE_MAX = 50
export const CART_QTY_MAX = 99
export const LISTING_TITLE_MAX = 120
export const LISTING_DESC_MAX = 5000

/** Available stock never treats NaN/null as unlimited. */
export function availableStock(onHand: unknown, reserved: unknown): number {
  const h = typeof onHand === "number" ? onHand : Number(onHand)
  const r = typeof reserved === "number" ? reserved : Number(reserved)
  if (!Number.isFinite(h) || h < 0) return 0
  if (!Number.isFinite(r) || r < 0) return Math.floor(h)
  return Math.max(0, Math.floor(h) - Math.floor(r))
}

export function canPurchaseQuantity(available: number, qty: unknown): boolean {
  const q = typeof qty === "number" ? qty : Number(qty)
  if (!Number.isFinite(q) || q < 1 || !Number.isInteger(q)) return false
  if (q > CART_QTY_MAX) return false
  return available >= q
}

/** Seller cannot buy their own listing. */
export function isOwnListing(viewerId: string | null | undefined, sellerId: string | null | undefined): boolean {
  const v = String(viewerId || "").trim()
  const s = String(sellerId || "").trim()
  if (!v || !s) return false
  return v === s
}

export function commissionMinorFromGross(grossMinor: number, bps = MARKETPLACE_COMMISSION_BPS): number {
  if (!Number.isSafeInteger(grossMinor) || grossMinor < 0) return 0
  // ceil division to match SQL-friendly integer fee
  return Math.floor((grossMinor * bps + 9999) / 10000)
}
