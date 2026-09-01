/**
 * POST /api/marketplace/orders/[orderId]/pay
 * Body: { method: "ghc" | "pi", intentId?, paymentId?, txid? }
 *
 * Verifies payment then moves order: payment_pending → payment_verified → confirmed
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { getOrder, transitionOrder, saveOrder } from "@/lib/server/marketplace/order-store"
import { getPaymentIntent } from "@/lib/server/payments/intent-store"
import {
  executeAuthoritativeSpend,
  getProcessGhcStore,
} from "@/lib/server/economy/store"
import { allowMemoryServer, isDatabaseConfigured } from "@/lib/server/economy/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  ctx: { params: Promise<{ orderId: string }> }
) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const { orderId } = await ctx.params
  const order = getOrder(orderId)
  if (!order) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 })
  }
  if (order.buyerId !== auth.userId) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 })
  }
  if (order.status !== "payment_pending" && order.status !== "created") {
    return NextResponse.json(
      { ok: false, error: "NOT_PAYABLE", status: order.status },
      { status: 409 }
    )
  }

  const body = await request.json().catch(() => ({}))
  const method = String(body.method || "").toLowerCase()

  if (method === "ghc") {
    if (!allowMemoryServer() && !isDatabaseConfigured()) {
      return NextResponse.json({ ok: false, error: "SERVER_UNAVAILABLE" }, { status: 503 })
    }
    if (!allowMemoryServer()) {
      return NextResponse.json(
        { ok: false, error: "DB_SPEND_NOT_WIRED", message: "Wire marketplace GHC spend to ledger RPC" },
        { status: 503 }
      )
    }

    const referenceId = `market_order_${order.id}`
    const spend = await executeAuthoritativeSpend(getProcessGhcStore(), {
      userId: auth.userId,
      amount: order.totalAmount,
      referenceId,
      reason: `Marketplace order ${order.listingTitle}`,
      sourceEvent: "MARKETPLACE_PURCHASE",
    })
    if (!spend.ok) {
      return NextResponse.json({ ok: false, error: spend.error || "SPEND_FAILED" }, { status: 400 })
    }

    order.paymentMethod = "ghc"
    order.paymentStatus = "verified"
    order.ghcSpendRef = spend.tx?.id || referenceId
    order.updatedAt = Date.now()
    order.audit.push({ at: Date.now(), action: "PAY_GHC", detail: order.ghcSpendRef })
    saveOrder(order)

    transitionOrder(order.id, "payment_verified", auth.userId, "ghc")
    // Auto-confirm after verified payment (seller still fulfills)
    transitionOrder(order.id, "confirmed", "system", "payment_auto_confirm")

    return NextResponse.json({ ok: true, order: getOrder(order.id), spend: spend.tx })
  }

  if (method === "pi") {
    const intentId = String(body.intentId || "").trim()
    const paymentId = String(body.paymentId || "").trim()
    const txid = String(body.txid || "").trim()

    if (!intentId) {
      return NextResponse.json(
        { ok: false, error: "INTENT_REQUIRED", message: "Complete GH Pay intent first" },
        { status: 400 }
      )
    }

    const intent = getPaymentIntent(intentId)
    if (!intent || intent.userId !== auth.userId) {
      return NextResponse.json({ ok: false, error: "INTENT_NOT_FOUND" }, { status: 404 })
    }
    if (intent.status !== "COMPLETED") {
      return NextResponse.json(
        { ok: false, error: "PAYMENT_NOT_COMPLETED", status: intent.status },
        { status: 409 }
      )
    }
    // Amount check (π total)
    if (Math.abs(intent.amount - order.totalAmount) > 0.001 && order.currency === "PI") {
      return NextResponse.json(
        { ok: false, error: "amount_mismatch", expected: order.totalAmount, actual: intent.amount },
        { status: 409 }
      )
    }

    order.paymentMethod = "pi"
    order.paymentStatus = "verified"
    order.paymentIntentId = intentId
    order.paymentId = intent.providerPaymentId || paymentId
    order.txid = intent.txid || txid
    order.updatedAt = Date.now()
    order.audit.push({ at: Date.now(), action: "PAY_PI", detail: intentId })
    saveOrder(order)

    transitionOrder(order.id, "payment_verified", auth.userId, "pi")
    transitionOrder(order.id, "confirmed", "system", "payment_auto_confirm")

    return NextResponse.json({ ok: true, order: getOrder(order.id) })
  }

  return NextResponse.json({ ok: false, error: "INVALID_METHOD" }, { status: 400 })
}
