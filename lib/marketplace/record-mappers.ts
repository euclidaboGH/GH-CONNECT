import type { MarketplaceListing, MarketplaceOrder } from "@/lib/domains/marketplace-domain"
import { normalizeProductOptions } from "./product-options.ts"
import { normalizeProductVariants } from "./product-variants.ts"

type RecordValue = Record<string, unknown>

function record(value: unknown): RecordValue {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {}
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback
}

function number(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item) => item != null).map(String) : []
}

/** Accept the numeric epoch values used by the app and ISO timestamps returned by integrations. */
function timestamp(value: unknown, fallback: number): number {
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value)
    if (Number.isFinite(numeric)) return numeric
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return number(value, fallback)
}

/** Normalize API listing records at the domain boundary; never infer identity or price. */
export function mapMarketplaceListingRecord(value: unknown, now = Date.now()): MarketplaceListing | null {
  const row = record(value)
  const id = text(row.id).trim()
  if (!id) return null
  return {
    id,
    kind: (text(row.kind, "product") || "product") as MarketplaceListing["kind"],
    title: text(row.title, "Listing") || "Listing",
    description: text(row.description),
    media: strings(row.media),
    category: text(row.category, "Goods") || "Goods",
    tags: Array.isArray(row.tags) ? strings(row.tags) : undefined,
    productOptions: normalizeProductOptions(row.productOptions ?? row.product_options),
    variants: normalizeProductVariants(row.variants),
    price: number(row.price, 0),
    currency: text(row.currency, "GHC") || "GHC",
    condition: (text(row.condition, "new") || "new") as MarketplaceListing["condition"],
    location: row.location == null ? undefined : text(row.location) || undefined,
    shippingInfo: row.shippingInfo == null ? undefined : text(row.shippingInfo) || undefined,
    sellerId: text(row.sellerId ?? row.seller_id),
    // Missing stock is unknown, never a free unit. Fail closed so the UI cannot
    // advertise or add inventory that the server did not actually report.
    availability: number(row.availability, 0),
    status: (text(row.status, "active") || "active") as MarketplaceListing["status"],
    createdAt: timestamp(row.createdAt ?? row.created_at, now),
    updatedAt: timestamp(row.updatedAt ?? row.updated_at, timestamp(row.createdAt ?? row.created_at, now)),
  }
}

/** Saved-listing rows carry listing presentation metadata in a nested metadata object. */
export function mapSavedMarketplaceListingRecord(value: unknown, now = Date.now()): MarketplaceListing | null {
  const row = record(value)
  const metadata = record(row.metadata)
  return mapMarketplaceListingRecord({
    ...metadata,
    id: row.listingId ?? row.listing_id,
    kind: row.kind,
    title: row.title,
    description: row.description,
    price: row.price,
    currency: row.currency,
    sellerId: row.sellerId ?? row.seller_id,
    availability: row.availability,
    status: row.status,
    createdAt: row.createdAt ?? row.created_at,
    updatedAt: row.updatedAt ?? row.updated_at ?? row.createdAt ?? row.created_at,
    media: metadata.media,
    tags: metadata.tags,
    category: metadata.category,
    location: metadata.location,
    condition: "not_applicable",
  }, now)
}

/** Normalize durable order responses without changing server-authoritative lifecycle state. */
export function mapMarketplaceOrderRecord(value: unknown, now = Date.now()): MarketplaceOrder | null {
  const row = record(value)
  const id = text(row.id).trim()
  if (!id) return null
  return {
    id,
    listingId: text(row.listingId ?? row.listing_id),
    variantId: text(row.variantId ?? row.variant_id) || undefined,
    variantSku: text(row.variantSku ?? row.variant_sku) || undefined,
    variantLabel: text(row.variantLabel ?? row.variant_label) || undefined,
    buyerId: text(row.buyerId ?? row.buyer_id),
    sellerId: text(row.sellerId ?? row.seller_id),
    quantity: number(row.quantity, 1),
    unitPrice: number(row.unitPrice ?? row.unit_price, 0),
    currency: text(row.currency, "GHC") || "GHC",
    status: text(row.status, "created") as MarketplaceOrder["status"],
    createdAt: timestamp(row.createdAt ?? row.created_at, now),
    updatedAt: timestamp(row.updatedAt ?? row.updated_at, now),
    confirmedAt: row.confirmedAt == null && row.confirmed_at == null ? undefined : timestamp(row.confirmedAt ?? row.confirmed_at, now),
    fulfilledAt: row.fulfilledAt == null && row.fulfilled_at == null ? undefined : timestamp(row.fulfilledAt ?? row.fulfilled_at, now),
    completedAt: row.completedAt == null && row.completed_at == null ? undefined : timestamp(row.completedAt ?? row.completed_at, now),
    cancelledAt: row.cancelledAt == null && row.cancelled_at == null ? undefined : timestamp(row.cancelledAt ?? row.cancelled_at, now),
    paymentStatus: text(row.paymentStatus ?? row.payment_status, "none") as MarketplaceOrder["paymentStatus"],
    deliveryStatus: (text(row.deliveryStatus ?? row.delivery_status, "not_started") || "not_started") as MarketplaceOrder["deliveryStatus"],
    fulfilmentMethod: (text(row.fulfilmentMethod ?? row.fulfilment_method) || undefined) as MarketplaceOrder["fulfilmentMethod"],
    shippingCarrier: text(row.shippingCarrier ?? row.shipping_carrier) || undefined,
    trackingNumber: text(row.trackingNumber ?? row.tracking_number) || undefined,
    trackingUrl: text(row.trackingUrl ?? row.tracking_url) || undefined,
    estimatedDeliveryAt: row.estimatedDeliveryAt == null && row.estimated_delivery_at == null ? undefined : timestamp(row.estimatedDeliveryAt ?? row.estimated_delivery_at, 0),
    dispatchedAt: row.dispatchedAt == null && row.dispatched_at == null ? undefined : timestamp(row.dispatchedAt ?? row.dispatched_at, 0),
    paymentMethod: text(row.paymentMethod ?? row.payment_method, "none") as MarketplaceOrder["paymentMethod"],
    serverOrderId: id,
  }
}
