/**
 * Phase B — Marketplace order lifecycle labels & steps (UI authority only).
 * Durable transitions remain server-side via commerce actions.
 */

export type OrderLifecycleStepId =
  | "created"
  | "paid"
  | "fulfill"
  | "delivered"
  | "done"

export const ORDER_LIFECYCLE_STEPS: Array<{ id: OrderLifecycleStepId; label: string }> = [
  { id: "created", label: "Created" },
  { id: "paid", label: "Paid" },
  { id: "fulfill", label: "Fulfilling" },
  { id: "delivered", label: "Delivered" },
  { id: "done", label: "Complete" },
]

export function orderLifecycleIndex(input: {
  status?: string
  paymentStatus?: string
  deliveryStatus?: string
}): number {
  const status = String(input.status || "created").toLowerCase()
  const pay = String(input.paymentStatus || "none").toLowerCase()
  const delivery = String(input.deliveryStatus || "not_started").toLowerCase()

  if (["cancelled", "refunded", "disputed"].includes(status)) {
    // Park terminal non-success at paid/fulfill boundary for clarity
    if (status === "cancelled" && pay !== "verified" && pay !== "captured") return 0
    if (status === "refunded") return 1
    return 2
  }
  if (status === "completed" || delivery === "completed") return 4
  if (["delivered", "service_active"].includes(delivery) || status === "fulfilled") return 3
  if (status === "fulfilling" || status === "processing" || delivery === "shipped" || delivery === "processing") {
    return 2
  }
  if (
    pay === "verified" ||
    pay === "captured" ||
    pay === "held" ||
    status === "confirmed" ||
    status === "payment_captured"
  ) {
    return 1
  }
  return 0
}

export function orderStatusLabel(status?: string): string {
  const raw = String(status || "created").toLowerCase()
  const map: Record<string, string> = {
    created: "Created",
    pending: "Pending",
    payment_pending: "Awaiting payment",
    confirmed: "Paid",
    processing: "Processing",
    fulfilling: "Fulfilling",
    fulfilled: "Fulfilled",
    completed: "Completed",
    cancelled: "Cancelled",
    disputed: "Disputed",
    refunded: "Refunded",
  }
  if (map[raw]) return map[raw]
  const s = raw.replace(/_/g, " ")
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Buyer-facing next step hint (presentation only). */
export function orderNextActionHint(input: {
  status?: string
  paymentStatus?: string
  deliveryStatus?: string
  isSeller: boolean
}): string | null {
  const status = String(input.status || "").toLowerCase()
  const pay = String(input.paymentStatus || "").toLowerCase()
  const delivery = String(input.deliveryStatus || "").toLowerCase()
  if (["cancelled", "refunded", "disputed", "completed"].includes(status)) return null
  if (!input.isSeller && ["created", "payment_pending"].includes(status)) return "Pay to confirm this order"
  if (input.isSeller && status === "confirmed") return "Start fulfillment when ready"
  if (input.isSeller && status === "fulfilling" && !["delivered", "service_active"].includes(delivery)) {
    return "Mark delivered when the buyer has the item or service"
  }
  if (!input.isSeller && status === "fulfilling" && ["delivered", "service_active"].includes(delivery)) {
    return "Confirm received to complete"
  }
  if (!input.isSeller && status === "completed") return "Leave a review if you have not already"
  if (pay === "verified" || status === "confirmed") return input.isSeller ? "Fulfill the order" : "Seller is preparing your order"
  return null
}

export function orderRoleForViewer(order: { buyerId?: string; sellerId?: string }, viewerId: string): "buyer" | "seller" | "other" {
  if (viewerId && viewerId === order.sellerId) return "seller"
  if (viewerId && viewerId === order.buyerId) return "buyer"
  return "other"
}

export type BrowseSort = "newest" | "price_asc" | "price_desc"

export function sortMarketplaceListings<T extends { createdAt?: number; price?: number }>(
  items: T[],
  sort: BrowseSort,
): T[] {
  const copy = [...items]
  if (sort === "price_asc") {
    copy.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0))
  } else if (sort === "price_desc") {
    copy.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0))
  } else {
    copy.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0))
  }
  return copy
}
