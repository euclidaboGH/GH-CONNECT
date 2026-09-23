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
  | {
      ok: true
      order: GhPayOrder
      paymentId: string
      txid?: string
      /** Server entitlement grant result — never inferred from Pi payment alone */
      membershipActivated?: boolean
      membershipActivationError?: string
    }
  | { ok: false; error: string; cancelled?: boolean }

export { isPiPaymentsAvailable, waitForPiPayments, probePiPayments, productForMembership, listProducts, getProduct }

/** Permanent activate failures — do not retry (payment stays successful; grant denied by policy). */
const MEMBERSHIP_ACTIVATE_PERMANENT = new Set([
  "PRODUCT_MISMATCH",
  "amount_mismatch",
  "CURRENCY_MISMATCH",
  "FORBIDDEN",
  "AUTH_REQUIRED",
  "INVALID_TIER",
  "INVALID_PERIOD",
  "INVALID_METHOD",
  "PAYMENT_NOT_COMPLETED",
  "INTENT_REQUIRED",
])

const ACTIVATE_MAX_ATTEMPTS = 3
const ACTIVATE_BACKOFF_MS = [0, 400, 1000] as const

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type ActivateOutcome =
  | { kind: "granted" }
  | { kind: "permanent"; error: string }
  | { kind: "transient"; error: string }

/**
 * Call existing /api/membership/activate. Server remains authoritative.
 * Retries only transient network/5xx failures. Never invents VIP locally.
 */
async function callMembershipActivate(input: {
  tier: "vip" | "vvip"
  period: "monthly" | "yearly"
  paymentId: string
  intentId?: string
  txid?: string
}): Promise<ActivateOutcome> {
  let lastTransient = "ACTIVATION_FAILED"
  for (let attempt = 0; attempt < ACTIVATE_MAX_ATTEMPTS; attempt++) {
    if (ACTIVATE_BACKOFF_MS[attempt]) {
      await sleep(ACTIVATE_BACKOFF_MS[attempt])
    }
    try {
      const res = await fetch("/api/membership/activate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...IdentityService.getAuthHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({
          method: "pi",
          tier: input.tier,
          period: input.period,
          paymentId: input.paymentId,
          intentId: input.intentId || undefined,
          txid: input.txid,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        message?: string
        entitlement?: { tier?: string }
      }
      if (res.ok && data?.ok) {
        return { kind: "granted" }
      }
      const code = String(data?.error || data?.message || `HTTP_${res.status}`)
      if (MEMBERSHIP_ACTIVATE_PERMANENT.has(code) || (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429)) {
        return { kind: "permanent", error: code }
      }
      lastTransient = code
    } catch (e) {
      lastTransient = e instanceof Error ? e.message : "NETWORK_ERROR"
    }
  }
  return { kind: "transient", error: lastTransient }
}

/**
 * Retry membership activation for a prior successful Pi membership payment.
 * Uses stored order paymentId/intentId — does not create a new payment.
 * Idempotent when entitlement already granted for the same purchaseRef.
 */
/**
 * Retry membership activation using local order cache and/or durable payment intents.
 * Cross-device: when order is missing, resolves COMPLETED/FULFILLED membership intents
 * for the current user via GET /api/payments/intents (server-authoritative list).
 */
export async function retryMembershipActivation(orderId: string): Promise<{
  ok: boolean
  membershipActivated: boolean
  error?: string
}> {
  let paymentId: string | undefined
  let intentId: string | undefined
  let txid: string | undefined
  let tier: "vip" | "vvip" | undefined
  let period: "monthly" | "yearly" | undefined

  const order = getOrder(orderId)
  if (order && order.category === "membership") {
    const f = order.fulfillment
    if (f && f.type === "membership") {
      tier = f.tier
      period = f.period
    }
    paymentId = order.paymentId || undefined
    intentId =
      typeof order.metadata?.intentId === "string" ? order.metadata.intentId : undefined
    txid = order.txid || undefined
  }

  // Cross-device / cold start: resolve from durable payment intents
  if (!paymentId || !tier || !period) {
    try {
      const res = await fetch("/api/payments/intents", {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
          ...IdentityService.getAuthHeaders(),
        },
        cache: "no-store",
      })
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        intents?: Array<{
          id?: string
          purpose?: string
          status?: string
          providerPaymentId?: string | null
          referenceId?: string
          txid?: string | null
          metadata?: Record<string, unknown>
        }>
      }
      const intents = Array.isArray(body.intents) ? body.intents : []
      const match =
        intents.find(
          (i) =>
            i.purpose === "membership" &&
            (i.id === orderId ||
              i.referenceId === orderId ||
              (typeof i.metadata?.orderId === "string" &&
                i.metadata.orderId === orderId) ||
              (paymentId && i.providerPaymentId === paymentId))
        ) ||
        intents.find(
          (i) =>
            i.purpose === "membership" &&
            (i.status === "COMPLETED" || i.status === "FULFILLED") &&
            i.providerPaymentId
        )
      if (match) {
        intentId = intentId || match.id
        paymentId = paymentId || match.providerPaymentId || undefined
        txid = txid || match.txid || undefined
        const meta = match.metadata || {}
        const mTier = String(meta.tier || meta.membershipTier || "").toLowerCase()
        const mPeriod = String(meta.period || meta.billingPeriod || "monthly").toLowerCase()
        if (!tier && (mTier === "vip" || mTier === "vvip")) tier = mTier
        if (!period && (mPeriod === "monthly" || mPeriod === "yearly")) period = mPeriod
        // productId like membership_vip_monthly
        const productId = String(meta.productId || "").toLowerCase()
        if (!tier && productId.includes("vvip")) tier = "vvip"
        else if (!tier && productId.includes("vip")) tier = "vip"
        if (!period && productId.includes("yearly")) period = "yearly"
        else if (!period && productId.includes("monthly")) period = "monthly"
      }
    } catch {
      /* offline */
    }
  }

  if (!paymentId) {
    return { ok: false, membershipActivated: false, error: "PAYMENT_ID_MISSING" }
  }
  if (!tier || !period) {
    return { ok: false, membershipActivated: false, error: "MEMBERSHIP_META_MISSING" }
  }

  const outcome = await callMembershipActivate({
    tier,
    period,
    paymentId,
    intentId,
    txid,
  })
  if (outcome.kind === "granted") {
    if (order) {
      updateOrderStatus(orderId, order.status, {
        metadata: {
          ...(order.metadata || {}),
          membershipActivation: "granted",
          membershipActivationError: undefined,
          intentId: intentId || order.metadata?.intentId,
        },
      })
    }
    return { ok: true, membershipActivated: true }
  }
  if (order) {
    updateOrderStatus(orderId, order.status, {
      metadata: {
        ...(order.metadata || {}),
        membershipActivation:
          outcome.kind === "permanent" ? "failed_permanent" : "pending",
        membershipActivationError: outcome.error,
        intentId: intentId || order.metadata?.intentId,
      },
    })
  }
  return {
    ok: false,
    membershipActivated: false,
    error: outcome.error,
  }
}

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

  // Fulfill durable payment intent (marks COMPLETED → FULFILLED; does not grant membership)
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
        intentId,
        fulfillment: product.fulfillment,
        engine: "gh_pay",
      }),
    })
    fulfilled = res.ok
  } catch {
    /* */
  }

  // Membership: authoritative entitlement via /api/membership/activate only.
  // Payment success is independent — never reverse Pi pay; never invent VIP locally.
  let membershipActivated: boolean | undefined
  let membershipActivationError: string | undefined
  if (
    fulfilled &&
    product.fulfillment &&
    typeof product.fulfillment === "object" &&
    (product.fulfillment as { type?: string }).type === "membership"
  ) {
    const f = product.fulfillment as { type: "membership"; tier?: string; period?: string }
    const tier = f.tier === "vvip" ? "vvip" : f.tier === "vip" ? "vip" : null
    const period = f.period === "yearly" ? "yearly" : f.period === "monthly" ? "monthly" : null
    if (tier && period && pay.paymentId) {
      const outcome = await callMembershipActivate({
        tier,
        period,
        paymentId: pay.paymentId,
        intentId,
        txid: pay.txid,
      })
      if (outcome.kind === "granted") {
        membershipActivated = true
      } else {
        membershipActivated = false
        membershipActivationError = outcome.error
      }
    }
  }

  const activationMeta =
    membershipActivated === undefined
      ? {}
      : {
          membershipActivation: membershipActivated
            ? ("granted" as const)
            : membershipActivationError &&
                MEMBERSHIP_ACTIVATE_PERMANENT.has(membershipActivationError)
              ? ("failed_permanent" as const)
              : ("pending" as const),
          membershipActivationError,
          intentId: intentId || undefined,
        }

  const final = updateOrderStatus(orderId, fulfilled ? "fulfilled" : "completed", {
    paymentId: pay.paymentId,
    txid: pay.txid,
    metadata: {
      ...(order.metadata || {}),
      ...activationMeta,
    },
  })

  return {
    ok: true,
    order:
      final || {
        ...order,
        status: fulfilled ? "fulfilled" : "completed",
        paymentId: pay.paymentId,
        txid: pay.txid,
        metadata: { ...(order.metadata || {}), ...activationMeta },
      },
    paymentId: pay.paymentId,
    txid: pay.txid,
    membershipActivated,
    membershipActivationError,
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
