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
  }
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
    createdAt: Number(data.createdAt) || Date.now(),
    updatedAt: Number(data.updatedAt) || Date.now(),
    confirmedAt: data.confirmedAt != null ? Number(data.confirmedAt) : undefined,
    fulfilledAt: data.fulfilledAt != null ? Number(data.fulfilledAt) : undefined,
    completedAt: data.completedAt != null ? Number(data.completedAt) : undefined,
    cancelledAt: data.cancelledAt != null ? Number(data.cancelledAt) : undefined,
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
  const mem = map().get(id)
  if (mem) return mem
  if (!dbConfigured()) return null
  const data = await rpcJson("gh_marketplace_order_get", { p_id: id })
  if (!data || typeof data !== "object") return null
  const order = rowToOrder(data as Record<string, unknown>)
  map().set(order.id, order)
  return order
}

/**
 * Persist order. Production + DB configured: fail closed if write fails.
 * Local without DB: memory only.
 */
export async function saveOrder(
  order: ServerMarketOrder
): Promise<{ ok: true } | { ok: false; error: string }> {
  map().set(order.id, order)
  if (!dbConfigured()) {
    if (isProd()) {
      return {
        ok: false,
        error: "DURABLE_REQUIRED: production requires Supabase marketplace orders schema",
      }
    }
    return { ok: true }
  }
  const res = await rpcJson("gh_marketplace_order_upsert", { p_row: orderToRow(order) })
  if (res == null || (typeof res === "object" && (res as { ok?: boolean }).ok === false)) {
    if (isProd() || dbConfigured()) {
      return { ok: false, error: "DURABLE_WRITE_FAILED: gh_marketplace_order_upsert" }
    }
  }
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
  }
  if (isProd() && dbConfigured()) {
    // DB configured but RPC failed — do not pretend empty memory is complete history
    console.error("[marketplace] listOrdersForUserDurable RPC failed")
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
  let order = map().get(orderId) || null
  if (!order && dbConfigured()) {
    order = await loadOrder(orderId)
  }
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

export function marketplaceOrdersDurable(): boolean {
  return dbConfigured()
}
