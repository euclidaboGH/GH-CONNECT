"use client"

/**
 * GH Pay client — U2A purchases via Pi Browser SDK.
 */
import { startUserToAppPayment, isPiPaymentsAvailable } from "@/lib/pi-u2a-payment"
import { IdentityService } from "@/lib/identity/identity-service"
import { getProduct, productForMembership, listProducts } from "./catalog"
import { genOrderId, saveOrder, updateOrderStatus, listOrdersForUser, getOrder } from "./order-store"
import type { GhPayOrder, GhPayProduct, CreateOrderInput } from "./types"

export type GhPayResult =
  | { ok: true; order: GhPayOrder; paymentId: string; txid: string }
  | { ok: false; error: string; cancelled?: boolean }

export { isPiPaymentsAvailable, productForMembership, listProducts, getProduct }

/**
 * User → App purchase for a catalog product.
 */
export async function ghPayPurchase(
  productId: string,
  options?: { metadata?: Record<string, unknown>; amountPi?: number }
): Promise<GhPayResult> {
  const product = getProduct(productId)
  if (!product || product.direction !== "u2a") {
    return { ok: false, error: "Product not available for purchase" }
  }
  if (!isPiPaymentsAvailable()) {
    return {
      ok: false,
      error: "Open GreenHaven in the Pi Browser to pay with π",
    }
  }

  const amount =
    options?.amountPi != null && product.category === "donation"
      ? Math.min(Math.max(Number(options.amountPi), 0.01), 100)
      : product.amountPi

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Invalid amount" }
  }

  const userId = IdentityService.getCurrentUserId()
  const orderId = genOrderId()
  const order: GhPayOrder = {
    orderId,
    direction: "u2a",
    productId: product.id,
    category: product.category,
    amountPi: amount,
    memo: product.memo,
    userId,
    status: "created",
    fulfillment: product.fulfillment,
    metadata: options?.metadata,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  saveOrder(order)

  const headers = {
    "Content-Type": "application/json",
    ...IdentityService.getAuthHeaders(),
  }

  // Server order register
  try {
    await fetch("/api/payments/orders", {
      method: "POST",
      headers,
      body: JSON.stringify({
        orderId,
        productId: product.id,
        amountPi: amount,
        memo: product.memo,
        fulfillment: product.fulfillment,
        metadata: options?.metadata,
      }),
    })
  } catch {
    /* offline ok */
  }

  // Server Payment Intent — binds approve/complete to authenticated order
  let intentId: string | undefined
  try {
    const ir = await fetch("/api/payments/intents", {
      method: "POST",
      headers,
      body: JSON.stringify({
        purpose: product.category === "verification" ? "verification" : product.category,
        amount,
        currency: "PI",
        referenceId: orderId,
        idempotencyKey: `order:${orderId}`,
        metadata: {
          productId: product.id,
          orderId,
          fulfillment: product.fulfillment,
          purpose: product.category,
          ...(options?.metadata || {}),
        },
      }),
    })
    if (ir.ok) {
      const ij = await ir.json()
      intentId = ij?.intent?.id
    }
  } catch {
    /* Studio without auth — U2A may still run unbound */
  }

  updateOrderStatus(orderId, "awaiting_approval")

  const pay = await startUserToAppPayment({
    amount,
    memo: product.memo,
    intentId,
    authHeaders: IdentityService.getAuthHeaders(),
    metadata: {
      engine: "gh_pay",
      orderId,
      intentId,
      productId: product.id,
      category: product.category,
      userId,
      fulfillment: product.fulfillment,
      purpose: product.category,
      ...(options?.metadata || {}),
    },
  })

  if (!pay.ok) {
    updateOrderStatus(orderId, pay.cancelled ? "cancelled" : "failed")
    return { ok: false, error: pay.error, cancelled: pay.cancelled }
  }

  updateOrderStatus(orderId, "awaiting_completion", {
    paymentId: pay.paymentId,
    txid: pay.txid,
  })

  // Fulfill
  let fulfilled = false
  try {
    const res = await fetch("/api/payments/fulfill", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...IdentityService.getAuthHeaders(),
      },
      body: JSON.stringify({
        paymentId: pay.paymentId,
        txid: pay.txid,
        productId: product.id,
        orderId,
        fulfillment: product.fulfillment,
        engine: "gh_pay",
      }),
    })
    fulfilled = res.ok
  } catch {
    /* */
  }

  const final = updateOrderStatus(
    orderId,
    fulfilled ? "fulfilled" : "completed",
    { paymentId: pay.paymentId, txid: pay.txid }
  )

  return {
    ok: true,
    order: final || { ...order, status: "completed", paymentId: pay.paymentId, txid: pay.txid },
    paymentId: pay.paymentId,
    txid: pay.txid,
  }
}

/** Membership helper */
export async function ghPayMembership(
  tier: "vip" | "vvip",
  period: "monthly" | "yearly"
): Promise<GhPayResult> {
  const product = productForMembership(tier, period)
  return ghPayPurchase(product.id)
}

export function ghPayListMyOrders(): GhPayOrder[] {
  return listOrdersForUser(IdentityService.getCurrentUserId())
}

export function ghPayGetOrder(orderId: string): GhPayOrder | null {
  return getOrder(orderId)
}
