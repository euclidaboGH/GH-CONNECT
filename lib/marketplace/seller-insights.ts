/**
 * Phase 2 — Seller Centre insights derived only from recorded listings and
 * orders. Money is grouped by currency and never converted or summed across
 * currencies.
 */
export interface InsightListing {
  id: string
  title?: string
  kind?: string
  status?: string
  availability?: number
  updatedAt?: number
  createdAt?: number
}
export interface InsightOrder {
  id: string
  listingId?: string
  status?: string
  quantity?: number
  unitPrice?: number
  currency?: string
  createdAt?: number
  completedAt?: number
}

const DAY = 86_400_000
const ms = (ts?: number) => { const n = Number(ts); return Number.isFinite(n) && n > 0 ? (n < 100_000_000_000 ? n * 1000 : n) : 0 }

export function completedRevenueByCurrency(orders: readonly InsightOrder[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const o of orders) {
    if (o.status !== "completed") continue
    const unit = Number(o.unitPrice); const qty = Number(o.quantity)
    if (!Number.isFinite(unit) || unit < 0 || !Number.isFinite(qty) || qty < 1) continue
    const cur = (String(o.currency || "GHC").trim().toUpperCase() === "Π" ? "PI" : String(o.currency || "GHC").trim().toUpperCase()) || "GHC"
    out[cur] = Math.round(((out[cur] ?? 0) + unit * qty) * 1e8) / 1e8
  }
  return out
}

/** Average hours from order creation to completion; null when no completed orders have both times. */
export function averageHoursToComplete(orders: readonly InsightOrder[]): number | null {
  const spans = orders
    .filter((o) => o.status === "completed" && ms(o.createdAt) && ms(o.completedAt) >= ms(o.createdAt))
    .map((o) => (ms(o.completedAt) - ms(o.createdAt)) / 3_600_000)
  if (!spans.length) return null
  return Math.round((spans.reduce((a, b) => a + b, 0) / spans.length) * 10) / 10
}

export function topSellingListings(orders: readonly InsightOrder[], limit = 3): Array<{ listingId: string; units: number }> {
  const units = new Map<string, number>()
  for (const o of orders) {
    if (o.status !== "completed" || !o.listingId) continue
    const q = Math.floor(Number(o.quantity))
    if (!Number.isFinite(q) || q < 1) continue
    units.set(o.listingId, (units.get(o.listingId) ?? 0) + q)
  }
  const safe = Math.max(0, Math.min(10, Math.floor(Number.isFinite(limit) ? limit : 3)))
  return [...units.entries()].map(([listingId, u]) => ({ listingId, units: u })).sort((a, b) => b.units - a.units || a.listingId.localeCompare(b.listingId)).slice(0, safe)
}

export function staleListings<T extends InsightListing>(listings: readonly T[], now: number = Date.now(), days = 60): T[] {
  return listings.filter((l) => l.status === "active" && ms(l.updatedAt || l.createdAt) > 0 && now - ms(l.updatedAt || l.createdAt) > days * DAY)
}

export function restockCandidates<T extends InsightListing>(listings: readonly T[]): T[] {
  return listings.filter((l) => l.kind === "product" && l.status !== "draft" && Number.isFinite(Number(l.availability)) && Number(l.availability) <= 3)
}
