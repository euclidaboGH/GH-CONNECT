"use client"

/**
 * GH Pay client — U2A purchases via Pi Browser SDK.
 */
import { startUserToAppPayment, isPiPaymentsAvailable, waitForPiPayments, probePiPayments } from "@/lib/pi-u2a-payment"
import { IdentityService } from "@/lib/identity/identity-service"
import { getProduct, productForMembership, listProducts } from "./catalog"
import { genOrderId, saveOrder, updateOrderStatus, listOrdersForUser, getOrder } from "./order-store"
import type { GhPayOrder, GhPayProduct, CreateOrderInput } from "./types"

export type GhPayResult =
  | { ok: true; order: GhPayOrder; paymentId: string; txid: string }
  | { ok: false; error: string; cancelled?: boolean }

export { isPiPaymentsAvailable, waitForPiPayments, probePiPayments, productForMembership, listProducts, getProduct }

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

  // Step-up: local app lock must be unlocked recently when PIN is configured.
  // Does not replace Pi Wallet authorization or server approve/complete.
  try {
    const { canPerformSensitiveAction, hasPinConfigured, setSoftLocked } = await import(
      "@/lib/session-security"
    )
    const uid = IdentityService.getCurrentUserId()
    const step = canPerformSensitiveAction("pi_payment", {
      pinConfigured: hasPinConfigured(uid),
    })
    if (!step.allowed) {
      setSoftLocked(true)
      try {
        window.dispatchEvent(new CustomEvent("ghc:security-lock-required", { detail: { action: "pi_payment" } }))
      } catch {
        /* */
      }
      return {
        ok: false,
        error:
          step.reason === "locked"
            ? "Unlock GreenHaven with your PIN, then try payment again."
            : "Confirm your device PIN to continue with this payment.",
      }
    }
  } catch {
    /* lock module unavailable — server + Pi Wallet still protect funds */
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

  // Server Payment Intent — REQUIRED before depending on Pi.createPayment when authenticated.
  // Durable intent binds user, amount, purpose, environment; prevents unbound approve races.
  let intentId: string | undefined
  const hasAuthHeader = Boolean(
    (headers as Record<string, string>).Authorization ||
      (headers as Record<string, string>).authorization
  )
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
    } else if (hasAuthHeader) {
      const errBody = await ir.json().catch(() => ({}))
      updateOrderStatus(orderId, "failed")
      return {
        ok: false,
        error:
          (errBody as { error?: string }).error ||
          `Could not create payment intent (HTTP ${ir.status}). Payment was not started.`,
      }
    }
  } catch (e) {
    if (hasAuthHeader) {
      updateOrderStatus(orderId, "failed")
      return {
        ok: false,
        error:
          e instanceof Error
            ? `Payment intent failed: ${e.message}`
            : "Payment intent could not be created. Payment was not started.",
      }
    }
    /* Unauthenticated studio probe may still attempt unbound U2A */
  }

  if (hasAuthHeader && !intentId) {
    updateOrderStatus(orderId, "failed")
    return {
      ok: false,
      error: "Payment intent missing. Payment was not started.",
    }
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
