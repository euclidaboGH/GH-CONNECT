/**
 * Phase 1 — stock, delivery and seller trust badges.
 * Pure functions over data already shown elsewhere; nothing is invented.
 */
import { parseDeliveryMode, DELIVERY_MODE_LABELS } from "./trust.ts"

export type BadgeTone = "good" | "warn" | "bad" | "neutral"
export interface Badge { id: string; label: string; tone: BadgeTone }

export const LOW_STOCK_THRESHOLD = 3

export function stockBadge(kind: string, availability: number): Badge | null {
  if (kind !== "product") return null
  if (!Number.isFinite(availability)) return null
  if (availability <= 0) return { id: "stock-out", label: "Sold out", tone: "bad" }
  if (availability <= LOW_STOCK_THRESHOLD) return { id: "stock-low", label: `${Math.floor(availability)} left`, tone: "warn" }
  return { id: "stock-ok", label: "In stock", tone: "good" }
}

export function deliveryBadge(shippingInfo?: string | null): Badge | null {
  const mode = parseDeliveryMode(shippingInfo)
  return mode ? { id: `delivery-${mode}`, label: DELIVERY_MODE_LABELS[mode], tone: "neutral" } : null
}

export interface SellerTrustInput {
  identityVerified?: boolean
  completedOrders?: number
  reviewCount?: number
  averageRating?: number
}

/** Badges derived only from recorded seller facts. */
export function sellerTrustBadges(seller: SellerTrustInput | null | undefined): Badge[] {
  if (!seller) return []
  const badges: Badge[] = []
  if (seller.identityVerified) badges.push({ id: "seller-identity", label: "Identity signals present", tone: "good" })
  const completed = Math.max(0, Math.floor(Number(seller.completedOrders) || 0))
  if (completed >= 25) badges.push({ id: "seller-experienced", label: "25+ completed orders", tone: "good" })
  else if (completed >= 5) badges.push({ id: "seller-active", label: "5+ completed orders", tone: "good" })
  else if (completed === 0) badges.push({ id: "seller-new", label: "New seller", tone: "neutral" })
  const reviews = Math.max(0, Math.floor(Number(seller.reviewCount) || 0))
  const avg = Number(seller.averageRating) || 0
  if (reviews >= 5 && avg >= 4.5) badges.push({ id: "seller-rated", label: "Highly rated", tone: "good" })
  return badges
}
