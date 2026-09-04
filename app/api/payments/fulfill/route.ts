/**
 * POST /api/payments/fulfill — after U2A complete, mark order fulfilled (idempotent).
 * Verifies payment with Pi Platform API when PI_API_KEY is available.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { updateOrderStatus, getOrder, saveOrder, genOrderId } from "@/lib/gh-pay/order-store"
import type { GhPayOrder } from "@/lib/gh-pay/types"
import { piGetPayment, getPiApiKey } from "@/lib/server/payments/pi-api"
import {
  loadByProviderPaymentId,
  markIntentFulfilled,
  getPaymentIntent,
} from "@/lib/server/payments/intent-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const fulfilledPayments = new Set<string>()

export async function POST(request: Request) {
  try {
    const auth = await resolveAuthenticatedUser(request.headers)
    const body = await request.json().catch(() => ({}))
    const paymentId = typeof body.paymentId === "string" ? body.paymentId.trim() : ""
    const txid = typeof body.txid === "string" ? body.txid.trim() : ""
    const productId = typeof body.productId === "string" ? body.productId.trim() : ""
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : ""
    const fulfillment = body.fulfillment

    if (!paymentId || !txid) {
      return NextResponse.json(
        { ok: false, error: "paymentId and txid required" },
        { status: 400 }
      )
    }

    if (fulfilledPayments.has(paymentId)) {
      return NextResponse.json({
        ok: true,
        idempotent: true,
        paymentId,
        message: "Already fulfilled",
      })
    }

    if (getPiApiKey()) {
      const lookup = await piGetPayment(paymentId)
      if (lookup.ok && lookup.payment) {
        const st = lookup.payment.status
        if (st?.cancelled || st?.user_cancelled) {
          return NextResponse.json(
            { ok: false, error: "payment_cancelled_on_pi" },
            { status: 409 }
          )
        }
      }
    }

    let order = orderId ? getOrder(orderId) : null
    if (!order && orderId) {
      const created: GhPayOrder = {
        orderId: orderId || genOrderId(),
        direction: "u2a",
        productId: productId || "unknown",
        category: "service",
        amountPi: 0,
        memo: "GH Pay",
        userId: auth?.userId || "unknown",
        status: "completed",
        paymentId,
        txid,
        fulfillment: fulfillment || { type: "none" },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      saveOrder(created)
      order = created
    }

    if (order) {
      updateOrderStatus(order.orderId, "fulfilled", { paymentId, txid })
    }

    fulfilledPayments.add(paymentId)

    // Durable fulfillment flag (idempotent)
    try {
      const intent = await loadByProviderPaymentId(paymentId)
      if (intent && intent.status === "COMPLETED") {
        markIntentFulfilled(intent.id, auth?.userId)
      } else if (intent && intent.status === "FULFILLED") {
        /* already */
      }
    } catch {
      /* non-blocking */
    }

    return NextResponse.json({
      ok: true,
      paymentId,
      productId,
      orderId: order?.orderId || orderId,
      fulfillment,
      applyClientMembership: fulfillment?.type === "membership",
      engine: "gh_pay",
      ghcCredit: false,
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Fulfill failed" },
      { status: 500 }
    )
  }
}
