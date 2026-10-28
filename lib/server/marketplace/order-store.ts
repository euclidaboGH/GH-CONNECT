/**
 * Server marketplace orders — payment lifecycle authority.
 * Durable via Supabase when configured; memory only for local/studio.
 * Production refuses to treat process memory as source of truth.
 */

import { readGhcServerEnv } from "@/lib/server/economy/env"

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
  reservationExpiresAt?: number
  escrowStatus?: "none" | "held" | "releasable" | "released" | "refund_pending" | "refunded"
  deliveryStatus?: "not_started" | "processing" | "shipped" | "delivered" | "service_active" | "completed"
  disputeReason?: string
  cancellationReason?: string
  buyerNote?: string
  sellerNote?: string
  deliveredAt?: number
  buyerConfirmedAt?: number
  sellerConfirmedAt?: number
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

function dbConfigured(): boolean {
  const env = readGhcServerEnv()
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey)
}

function isProd(): boolean {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production"
}

async function rpcJson(fn: string, body: Record<string, unknown>): Promise<unknown | null> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  try {
    const res = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) return null
    const text = await res.text()
    if (!text) return { ok: true }
    try {
      return JSON.parse(text)
    } catch {
      return { ok: true }
    }
  } catch {
    return null
  }
}

function orderToRow(order: ServerMarketOrder): Record<string, unknown> {
  return {
    id: order.id,
    listingId: order.listingId,
    listingTitle: order.listingTitle,
    buyerId: order.buyerId,
    sellerId: order.sellerId,
    quantity: order.quantity,
    unitPrice: order.unitPrice,
    currency: order.currency,
    totalAmount: order.totalAmount,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    paymentIntentId: order.paymentIntentId ?? null,
    paymentId: order.paymentId ?? null,
    txid: order.txid ?? null,
    ghcSpendRef: order.ghcSpendRef ?? null,
    audit: order.audit || [],
    createdAt: new Date(order.createdAt).toISOString(),
    confirmedAt: order.confirmedAt ? new Date(order.confirmedAt).toISOString() : null,
    fulfilledAt: order.fulfilledAt ? new Date(order.fulfilledAt).toISOString() : null,
    completedAt: order.completedAt ? new Date(order.completedAt).toISOString() : null,
    cancelledAt: order.cancelledAt ? new Date(order.cancelledAt).toISOString() : null,
    escrowStatus: order.escrowStatus ?? "none", deliveryStatus: order.deliveryStatus ?? "not_started",
    disputeReason: order.disputeReason ?? null, cancellationReason: order.cancellationReason ?? null,
    buyerNote: order.buyerNote ?? null, sellerNote: order.sellerNote ?? null,
    deliveredAt: order.deliveredAt ? new Date(order.deliveredAt).toISOString() : null,
    buyerConfirmedAt: order.buyerConfirmedAt ? new Date(order.buyerConfirmedAt).toISOString() : null,
    sellerConfirmedAt: order.sellerConfirmedAt ? new Date(order.sellerConfirmedAt).toISOString() : null,
  }
}


/** Accept database epoch milliseconds/seconds and ISO timestamps without
 * silently replacing valid persisted history with the current wall clock. */
function timestampMs(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 0 && value < 100_000_000_000 ? Math.trunc(value * 1000) : Math.trunc(value)
  }
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value)
    if (Number.isFinite(numeric)) return timestampMs(numeric, fallback)
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function rowToOrder(data: Record<string, unknown>): ServerMarketOrder {
  return {
    id: String(data.id || ""),
    listingId: String(data.listingId || ""),
    listingTitle: String(data.listingTitle || ""),
    buyerId: String(data.buyerId || ""),
    sellerId: String(data.sellerId || ""),
    quantity: Number(data.quantity) || 1,
    unitPrice: Number(data.unitPrice) || 0,
    currency: String(data.currency || "GHC"),
    totalAmount: Number(data.totalAmount) || 0,
    status: (data.status as MarketOrderStatus) || "created",
    paymentMethod: (data.paymentMethod as MarketPaymentMethod) || "none",
    paymentStatus: (data.paymentStatus as MarketPaymentStatus) || "none",
    paymentIntentId: data.paymentIntentId ? String(data.paymentIntentId) : undefined,
    paymentId: data.paymentId ? String(data.paymentId) : undefined,
    txid: data.txid ? String(data.txid) : undefined,
    ghcSpendRef: data.ghcSpendRef ? String(data.ghcSpendRef) : undefined,
    reservationExpiresAt: data.reservationExpiresAt != null ? timestampMs(data.reservationExpiresAt) : undefined,
    escrowStatus: data.escrowStatus as ServerMarketOrder["escrowStatus"], deliveryStatus: data.deliveryStatus as ServerMarketOrder["deliveryStatus"],
    disputeReason: data.disputeReason ? String(data.disputeReason) : undefined, cancellationReason: data.cancellationReason ? String(data.cancellationReason) : undefined,
    buyerNote: data.buyerNote ? String(data.buyerNote) : undefined, sellerNote: data.sellerNote ? String(data.sellerNote) : undefined,
    deliveredAt: data.deliveredAt != null ? timestampMs(data.deliveredAt) : undefined, buyerConfirmedAt: data.buyerConfirmedAt != null ? timestampMs(data.buyerConfirmedAt) : undefined, sellerConfirmedAt: data.sellerConfirmedAt != null ? timestampMs(data.sellerConfirmedAt) : undefined,
    createdAt: timestampMs(data.createdAt, 0),
    updatedAt: timestampMs(data.updatedAt, 0),
    confirmedAt: data.confirmedAt != null ? timestampMs(data.confirmedAt) : undefined,
    fulfilledAt: data.fulfilledAt != null ? timestampMs(data.fulfilledAt) : undefined,
    completedAt: data.completedAt != null ? timestampMs(data.completedAt) : undefined,
    cancelledAt: data.cancelledAt != null ? timestampMs(data.cancelledAt) : undefined,
    audit: Array.isArray(data.audit) ? (data.audit as ServerMarketOrder["audit"]) : [],
  }
}

export function genOrderId(): string {
  return `mord_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}

/** Sync cache read — prefer loadOrder when durability matters */
export function getOrder(id: string): ServerMarketOrder | null {
  return map().get(id) || null
}

export async function loadOrder(id: string): Promise<ServerMarketOrder | null> {
  // When Supabase is configured, always refresh from the authoritative database.
  // A process-local cache can be stale after reservation expiry or another instance's payment/cancellation transition.
  if (!dbConfigured()) return map().get(id) || null
  const data = await rpcJson("gh_marketplace_order_get", { p_id: id })
  if (!data || typeof data !== "object") return null
  const order = rowToOrder(data as Record<string, unknown>)
  map().set(order.id, order)
  return order
}

/** Create an order and reserve finite inventory in one database transaction.
 * The caller-supplied idempotency key is scoped to the authenticated buyer.
 */
export async function createReservedOrder(
  order: ServerMarketOrder,
  idempotencyKey: string
): Promise<{ ok: true; order: ServerMarketOrder; idempotent: boolean } | { ok: false; error: string; available?: number }> {
  if (!dbConfigured()) return { ok: false, error: "DURABLE_RESERVATION_REQUIRED" }
  const result = await rpcJson("gh_marketplace_order_create_reserved", {
    p_row: orderToRow(order),
    p_idempotency_key: idempotencyKey,
  })
  if (!result || typeof result !== "object") {
    return { ok: false, error: "RESERVATION_RPC_UNAVAILABLE" }
  }
  const payload = result as Record<string, unknown>
  if (payload.ok !== true) {
    return {
      ok: false,
      error: String(payload.error || "RESERVATION_FAILED"),
      available: payload.available == null ? undefined : Number(payload.available),
    }
  }
  if (!payload.order || typeof payload.order !== "object") {
    return { ok: false, error: "RESERVATION_RESPONSE_INVALID" }
  }
  const created = rowToOrder(payload.order as Record<string, unknown>)
  map().set(created.id, created)
  return { ok: true, order: created, idempotent: Boolean(payload.idempotent) }
}

/** Claim the durable inventory reservation before starting a payment operation. */
export async function claimOrderForPayment(
  orderId: string,
  buyerId: string,
  method: "ghc" | "pi"
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!dbConfigured()) return { ok: false, error: "DURABLE_RESERVATION_REQUIRED" }
  const result = await rpcJson("gh_marketplace_order_claim_payment", {
    p_order_id: orderId,
    p_buyer_id: buyerId,
    p_method: method,
  })
  if (!result || typeof result !== "object") return { ok: false, error: "PAYMENT_CLAIM_RPC_UNAVAILABLE" }
  const payload = result as Record<string, unknown>
  return payload.ok === true
    ? { ok: true }
    : { ok: false, error: String(payload.error || "PAYMENT_CLAIM_FAILED") }
}

/** Release a claim only after the payment operation has definitely failed. */
export async function releaseOrderPaymentClaim(
  orderId: string,
  buyerId: string,
  detail: string
): Promise<void> {
  if (!dbConfigured()) return
  await rpcJson("gh_marketplace_order_release_payment_claim", {
    p_order_id: orderId,
    p_buyer_id: buyerId,
    p_detail: detail.slice(0, 120),
  })
}

/**
 * Persist order. Production + DB configured: fail closed if write fails.
 * Local without DB: memory only.
 */
export async function saveOrder(
  order: ServerMarketOrder
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!dbConfigured()) {
    if (isProd()) {
      return {
        ok: false,
        error: "DURABLE_REQUIRED: production requires Supabase marketplace orders schema",
      }
    }
    map().set(order.id, order)
    return { ok: true }
  }
  const res = await rpcJson("gh_marketplace_order_upsert", { p_row: orderToRow(order) })
  if (res == null || (typeof res === "object" && (res as { ok?: boolean }).ok === false)) {
    if (isProd() || dbConfigured()) {
      return { ok: false, error: "DURABLE_WRITE_FAILED: gh_marketplace_order_upsert" }
    }
  }
  map().set(order.id, order)
  return { ok: true }
}

export function listOrdersForUser(userId: string): ServerMarketOrder[] {
  return [...map().values()]
    .filter((o) => o.buyerId === userId || o.sellerId === userId)
    .sort((a, b) => b.createdAt - a.createdAt)
}

/** Durable list across Vercel instances — prefer over memory-only listOrdersForUser */
export async function listOrdersForUserDurable(userId: string): Promise<ServerMarketOrder[]> {
  const uid = String(userId || "").trim()
  if (!uid) return []
  if (dbConfigured()) {
    const data = await rpcJson("gh_marketplace_orders_list_for_user", { p_user_id: uid })
    if (Array.isArray(data)) {
      const orders = data.map((row) => rowToOrder(row as Record<string, unknown>))
      for (const o of orders) map().set(o.id, o)
      return orders
    }
    // DB credentials present but RPC/table missing or failed — never treat process
    // memory as cross-instance durable history in production (or any DB-configured deploy).
    console.error("[marketplace] listOrdersForUserDurable RPC unavailable or failed")
    return []
  }
  return listOrdersForUser(uid)
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

export async function transitionOrder(
  orderId: string,
  to: MarketOrderStatus,
  actor: string,
  detail?: string
): Promise<{ ok: true; order: ServerMarketOrder } | { ok: false; error: string }> {
  // Durable state is authoritative whenever configured: never transition from a
  // process-local snapshot that may predate another instance’s payment/fulfilment.
  let order = dbConfigured() ? await loadOrder(orderId) : (map().get(orderId) || null)
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

  const saved = await saveOrder(order)
  if (!saved.ok) return { ok: false, error: saved.error }
  return { ok: true, order }
}

export async function updateCommerceOrder(orderId: string, actorId: string, action: "seller_fulfill" | "seller_mark_delivered" | "buyer_confirm" | "dispute" | "cancel_unpaid", note?: string): Promise<{ok:true;order:ServerMarketOrder}|{ok:false;error:string}> {
  if (!dbConfigured()) return {ok:false,error:"DATABASE_REQUIRED"}
  const result=await rpcJson("gh_marketplace_order_commerce_update",{p_order_id:orderId,p_actor_id:actorId,p_action:action,p_note:note||null})
  if (!result || typeof result!=="object") return {ok:false,error:"COMMERCE_RPC_UNAVAILABLE"}
  const payload=result as Record<string,unknown>
  if(payload.ok!==true || !payload.order || typeof payload.order!=="object") return {ok:false,error:String(payload.error||"COMMERCE_UPDATE_FAILED")}
  const order=rowToOrder(payload.order as Record<string,unknown>); map().set(order.id,order); return {ok:true,order}
}

export function marketplaceOrdersDurable(): boolean {
  return dbConfigured()
}


/** Ops: list orders with payment claims older than N minutes (service-role RPC). */
export async function listStalePaymentClaims(
  olderThanMinutes = 60,
  limit = 50
): Promise<{ ok: boolean; orders: unknown[]; error?: string }> {
  if (!dbConfigured()) return { ok: false, orders: [], error: "DB_NOT_CONFIGURED" }
  const result = await rpcJson("gh_marketplace_list_stale_payment_claims", {
    p_older_than_minutes: olderThanMinutes,
    p_limit: limit,
  })
  if (!result || typeof result !== "object") {
    return { ok: false, orders: [], error: "RPC_UNAVAILABLE" }
  }
  const payload = result as { ok?: boolean; orders?: unknown[]; error?: string }
  if (payload.ok !== true) {
    return { ok: false, orders: [], error: String(payload.error || "LIST_FAILED") }
  }
  return { ok: true, orders: Array.isArray(payload.orders) ? payload.orders : [] }
}

/**
 * Ops: force-release a stale payment claim after confirming payment is not in flight.
 * Does not mark the order paid and does not mint GHC.
 */
export async function forceReleaseStalePaymentClaim(
  orderId: string,
  operatorNote: string,
  minAgeMinutes = 60
): Promise<{ ok: boolean; error?: string }> {
  if (!dbConfigured()) return { ok: false, error: "DB_NOT_CONFIGURED" }
  const result = await rpcJson("gh_marketplace_force_release_stale_payment_claim", {
    p_order_id: orderId,
    p_operator_note: operatorNote.slice(0, 160),
    p_min_age_minutes: minAgeMinutes,
  })
  if (!result || typeof result !== "object") return { ok: false, error: "RPC_UNAVAILABLE" }
  const payload = result as { ok?: boolean; error?: string }
  return payload.ok === true
    ? { ok: true }
    : { ok: false, error: String(payload.error || "RELEASE_FAILED") }
}
