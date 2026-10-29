/**
 * Phase C — Marketplace trust helpers (presentation + local report queue).
 * Reviews remain domain-gated to completed buyer orders.
 */

export type DeliveryMode = "meetup" | "shipping" | "digital" | "service"

export const DELIVERY_MODE_LABELS: Record<DeliveryMode, string> = {
  meetup: "Local meetup",
  shipping: "Shipping",
  digital: "Digital delivery",
  service: "Service / remote",
}

export function parseDeliveryMode(raw?: string | null): DeliveryMode | null {
  const s = String(raw || "").trim().toLowerCase()
  if (!s) return null
  if (s.startsWith("meetup") || s === "pickup" || s === "local") return "meetup"
  if (s.startsWith("ship")) return "shipping"
  if (s.startsWith("digital") || s === "download" || s === "online") return "digital"
  if (s.startsWith("service") || s === "remote") return "service"
  // free-text shippingInfo may encode mode as "meetup: …"
  const head = s.split(":")[0]?.trim()
  if (head === "meetup" || head === "shipping" || head === "digital" || head === "service") {
    return head as DeliveryMode
  }
  return null
}

export function formatDeliveryLine(shippingInfo?: string | null, location?: string | null): string {
  const mode = parseDeliveryMode(shippingInfo)
  const detail = String(shippingInfo || "")
    .replace(/^(meetup|shipping|digital|service)\s*:\s*/i, "")
    .trim()
  const parts: string[] = []
  if (mode) parts.push(DELIVERY_MODE_LABELS[mode])
  if (detail && detail.toLowerCase() !== String(shippingInfo || "").toLowerCase()) parts.push(detail)
  else if (detail && !mode) parts.push(detail)
  if (location) parts.push(location)
  return parts.join(" · ") || "Delivery details on request"
}

export function encodeShippingInfo(mode: DeliveryMode, notes?: string): string {
  const n = String(notes || "").trim().slice(0, 200)
  return n ? `${mode}: ${n}` : mode
}

export function formatRating(avg: number, count: number): string {
  if (!count || !Number.isFinite(avg)) return "New seller"
  return `${avg.toFixed(1)}★ · ${count} review${count === 1 ? "" : "s"}`
}

export type ListingReportReason =
  | "scam"
  | "prohibited"
  | "misleading"
  | "counterfeit"
  | "other"

const REPORTS_KEY = "ghc_marketplace_listing_reports_v1"

export type LocalListingReport = {
  id: string
  listingId: string
  sellerId?: string
  reason: ListingReportReason
  note?: string
  createdAt: number
  status: "queued"
}

export function queueListingReport(input: {
  listingId: string
  sellerId?: string
  reason: ListingReportReason
  note?: string
}): LocalListingReport | null {
  if (typeof window === "undefined") return null
  const listingId = String(input.listingId || "").trim()
  if (!listingId) return null
  const row: LocalListingReport = {
    id: `rpt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    listingId,
    sellerId: input.sellerId,
    reason: input.reason,
    note: String(input.note || "").trim().slice(0, 500) || undefined,
    createdAt: Date.now(),
    status: "queued",
  }
  try {
    const raw = window.localStorage.getItem(REPORTS_KEY)
    const list: LocalListingReport[] = raw ? JSON.parse(raw) : []
    const next = [row, ...(Array.isArray(list) ? list : [])].slice(0, 100)
    window.localStorage.setItem(REPORTS_KEY, JSON.stringify(next))
  } catch {
    /* private mode */
  }
  return row
}

export function listQueuedListingReports(): LocalListingReport[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(REPORTS_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}
