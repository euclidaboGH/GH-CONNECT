/**
 * Server marketplace orders — payment lifecycle authority.
 *
 * Order created → Payment pending → Pi/GHC verified → Confirmed
 *   → Seller fulfills → Completed → Seller payout entitlement
 */

export type MarketOrderStatus =
  | "created"
  | "payment_pending"
  | "payment_verified"
  | "confirmed"
  | "fulfilling"
  | "completed"
  | "cancelled"
  | "refunded"
  | "disputed"

export type MarketPaymentMethod = "ghc" | "pi" | "none"
export type MarketPaymentStatus =
  | "none"
  | "pending"
  | "verified"
  | "failed"
  | "refunded"

export type ServerMarketOrder = {
  id: string
  listingId: string
  listingTitle: string
  buyerId: string
  sellerId: string
  quantity: number
  unitPrice: number
  currency: "GHC" | "PI" | string
  totalAmount: number
  status: MarketOrderStatus
  paymentMethod: MarketPaymentMethod
  paymentStatus: MarketPaymentStatus
  paymentIntentId?: string
  paymentId?: string
  txid?: string
  ghcSpendRef?: string
  createdAt: number
  updatedAt: number
  confirmedAt?: number
  fulfilledAt?: number
  completedAt?: number
  cancelledAt?: number
  audit: Array<{ at: number; action: string; detail?: string }>
}

const g = globalThis as unknown as {
  __ghMarketOrders?: Map<string, ServerMarketOrder>
}

function map(): Map<string, ServerMarketOrder> {
  if (!g.__ghMarketOrders) g.__ghMarketOrders = new Map()
  return g.__ghMarketOrders
}

export function genOrderId(): string {
  return `mord_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}

export function saveOrder(order: ServerMarketOrder): void {
  map().set(order.id, order)
}

export function getOrder(id: string): ServerMarketOrder | null {
  return map().get(id) || null
}

export function listOrdersForUser(userId: string): ServerMarketOrder[] {
  return [...map().values()]
    .filter((o) => o.buyerId === userId || o.sellerId === userId)
    .sort((a, b) => b.createdAt - a.createdAt)
}

const ALLOWED: Record<MarketOrderStatus, MarketOrderStatus[]> = {
  created: ["payment_pending", "cancelled"],
  payment_pending: ["payment_verified", "cancelled", "payment_pending"],
  payment_verified: ["confirmed", "cancelled", "refunded"],
  confirmed: ["fulfilling", "cancelled", "disputed"],
  fulfilling: ["completed", "disputed"],
  completed: ["refunded"],
  cancelled: [],
  refunded: [],
  disputed: ["refunded", "completed", "cancelled"],
}

export function transitionOrder(
  orderId: string,
  to: MarketOrderStatus,
  actor: string,
  detail?: string
): { ok: true; order: ServerMarketOrder } | { ok: false; error: string } {
  const order = map().get(orderId)
  if (!order) return { ok: false, error: "NOT_FOUND" }
  if (order.status === to) return { ok: true, order }

  const allowed = ALLOWED[order.status] || []
  if (!allowed.includes(to)) {
    return { ok: false, error: `INVALID_TRANSITION:${order.status}->${to}` }
  }

  order.status = to
  order.updatedAt = Date.now()
  if (to === "confirmed") order.confirmedAt = Date.now()
  if (to === "fulfilling") order.fulfilledAt = Date.now()
  if (to === "completed") order.completedAt = Date.now()
  if (to === "cancelled") order.cancelledAt = Date.now()
  order.audit = [
    ...(order.audit || []),
    { at: Date.now(), action: to, detail: `${actor}${detail ? `:${detail}` : ""}` },
  ].slice(-40)
  map().set(orderId, order)
  return { ok: true, order }
}
