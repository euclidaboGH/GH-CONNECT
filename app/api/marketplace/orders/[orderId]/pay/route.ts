/**
 * POST /api/marketplace/orders/[orderId]/pay
 * Body: { method: "ghc" | "pi", intentId?, paymentId?, txid? }
 *
 * Buyer identity = authenticated session only.
 * Amount = durable order.totalAmount only (never client).
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { loadOrder, marketplaceOrdersDurable } from "@/lib/server/marketplace/order-store"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { validateListingStockReservation } from "@/lib/server/marketplace/listing-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function rpcMarketplacePayment(name: string, args: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      body: JSON.stringify(args), cache: "no-store",
    })
    const data = await response.json().catch(() => null) as Record<string, unknown> | null
    return data
  } catch { return null }
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ orderId: string }> }
) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const rateLimit = checkRateLimit(`market-order-pay:${auth.userId}`, 10, 60_000)
  if (!rateLimit.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED", retryAfterSec: rateLimit.retryAfterSec }, { status: 429 })

  const { orderId } = await ctx.params
  const order = await loadOrder(orderId)
  if (!order) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 })
  }
  if (order.buyerId !== auth.userId) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 })
  }

  // Idempotent recovery must run BEFORE the payable-status narrow.
  // After a successful pay, status is no longer created|payment_pending.
  if (
    order.paymentStatus === "verified" &&
    ((order.paymentMethod === "ghc" && order.ghcSpendRef) || (order.paymentMethod === "pi" && order.paymentIntentId)) &&
    (order.status === "payment_verified" ||
      order.status === "confirmed" ||
      order.status === "fulfilling" ||
      order.status === "completed")
  ) {
    return NextResponse.json({ ok: true, order, idempotent: true, recovered: true })
  }

  if (order.status !== "payment_pending" && order.status !== "created") {
    return NextResponse.json(
      { ok: false, error: "NOT_PAYABLE", status: order.status },
      { status: 409 }
    )
  }

  const stockReservation = await validateListingStockReservation(order.id)
  if (!stockReservation.ok) {
    return NextResponse.json({
      ok: false,
      error: stockReservation.error || "STOCK_RESERVATION_INVALID",
      message: "Checkout stock reservation is missing or expired. No payment was attempted; create a new order.",
    }, { status: 409 })
  }

  const body = await request.json().catch(() => ({}))
  const method = String(body.method || "").toLowerCase()
  // Ignore client amount/balance claims
  void body.amount
  void body.balance
  void body.userId

  if (process.env.GH_MARKETPLACE_PAUSED === "1") return NextResponse.json({ ok: false, error: "MARKETPLACE_PAUSED" }, { status: 503 })

  if (method === "ghc") {
    if (String(order.currency).toUpperCase() !== "GHC") {
      return NextResponse.json({ ok: false, error: "CURRENCY_METHOD_MISMATCH", message: "GHC ledger spend can only settle GHC-denominated orders." }, { status: 409 })
    }
    const result = await rpcMarketplacePayment("gh_marketplace_pay_ghc_atomic", {
      p_order_id: order.id,
      p_buyer_id: auth.userId,
    })
    if (!result) return NextResponse.json({ ok: false, error: "PAYMENT_SERVICE_UNAVAILABLE" }, { status: 503 })
    if (result.ok !== true) {
      const error = String(result.error || "SPEND_FAILED")
      const status = error === "INSUFFICIENT_BALANCE" ? 402 : ["STOCK_RESERVATION_INVALID", "NOT_PAYABLE", "PAYMENT_INTENT_ORDER_MISMATCH"].includes(error) ? 409 : error === "FORBIDDEN" ? 403 : 503
      return NextResponse.json({ ok: false, error, detail: result.detail }, { status })
    }
    return NextResponse.json({
      ok: true,
      order: result.order || await loadOrder(order.id),
      spend: result.spend,
      idempotent: Boolean(result.duplicate),
      durableOrders: marketplaceOrdersDurable(),
      settlement: "atomic-ledger-stock-order",
    }, { headers: { "Cache-Control": "no-store" } })
  }

  if (method === "pi") {
    if (String(order.currency).toUpperCase() !== "PI") {
      return NextResponse.json({ ok: false, error: "CURRENCY_METHOD_MISMATCH", message: "Pi payment can only settle PI-denominated orders." }, { status: 409 })
    }
    const intentId = String(body.intentId || "").trim()
    if (!intentId) return NextResponse.json({ ok: false, error: "INTENT_REQUIRED", message: "Complete GH Pay intent first" }, { status: 400 })

    // The database function locks and verifies the durable provider intent, exact
    // order reference, amount, currency, buyer and stock reservation in one transaction.
    const result = await rpcMarketplacePayment("gh_marketplace_pay_pi_atomic", {
      p_order_id: order.id,
      p_buyer_id: auth.userId,
      p_intent_id: intentId,
      p_payment_id: null,
      p_txid: null,
    })
    if (!result) return NextResponse.json({ ok: false, error: "PAYMENT_SERVICE_UNAVAILABLE" }, { status: 503 })
    if (result.ok !== true) {
      const error = String(result.error || "PAYMENT_FAILED")
      const status = error === "FORBIDDEN" ? 403 : error === "INTENT_NOT_FOUND" ? 404 : ["STOCK_RESERVATION_INVALID", "NOT_PAYABLE", "PAYMENT_INTENT_ORDER_MISMATCH"].includes(error) ? 409 : 503
      return NextResponse.json({ ok: false, error }, { status })
    }
    return NextResponse.json({
      ok: true,
      order: result.order || await loadOrder(order.id),
      idempotent: Boolean(result.duplicate),
      durableOrders: marketplaceOrdersDurable(),
      settlement: "provider-verified-atomic-stock-order",
    }, { headers: { "Cache-Control": "no-store" } })
  }

  return NextResponse.json({ ok: false, error: "INVALID_METHOD" }, { status: 400 })
}
