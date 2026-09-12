/**
 * POST /api/payments/fulfill
 * Grant benefit only when durable intent is COMPLETED and owned by caller.
 * Client paymentId/txid alone is never sufficient.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  loadByProviderPaymentId,
  loadPaymentIntent,
  markIntentFulfilled,
  getPaymentIntent,
} from "@/lib/server/payments/intent-store"
import { piGetPayment, getPiApiKey } from "@/lib/server/payments/pi-api"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const auth = await resolveAuthenticatedUser(request.headers)
    if (!auth) {
      return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const paymentId = typeof body.paymentId === "string" ? body.paymentId.trim() : ""
    const txid = typeof body.txid === "string" ? body.txid.trim() : ""
    const intentId = typeof body.intentId === "string" ? body.intentId.trim() : ""

    if (!paymentId && !intentId) {
      return NextResponse.json(
        { ok: false, error: "intentId or paymentId required" },
        { status: 400 }
      )
    }

    let intent =
      (intentId ? await loadPaymentIntent(intentId) : null) ||
      (paymentId ? await loadByProviderPaymentId(paymentId) : null) ||
      (intentId ? getPaymentIntent(intentId) : null)

    if (!intent) {
      return NextResponse.json(
        {
          ok: false,
          error: "INTENT_NOT_FOUND",
          message: "No durable completed payment intent — refuse fulfillment",
        },
        { status: 409 }
      )
    }

    if (intent.userId !== auth.userId) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 })
    }

    if (paymentId && intent.providerPaymentId && intent.providerPaymentId !== paymentId) {
      return NextResponse.json({ ok: false, error: "PAYMENT_MISMATCH" }, { status: 409 })
    }

    if (intent.status === "FULFILLED") {
      return NextResponse.json({
        ok: true,
        idempotent: true,
        paymentId: intent.providerPaymentId,
        intent: getPaymentIntent(intent.id),
        message: "Already fulfilled",
      })
    }

    if (intent.status !== "COMPLETED") {
      return NextResponse.json(
        {
          ok: false,
          error: "PAYMENT_NOT_COMPLETED",
          status: intent.status,
          message: "Fulfillment requires COMPLETED durable intent",
        },
        { status: 409 }
      )
    }

    if (txid && intent.txid && intent.txid !== txid) {
      return NextResponse.json({ ok: false, error: "TXID_MISMATCH" }, { status: 409 })
    }

    if (getPiApiKey() && intent.providerPaymentId) {
      const lookup = await piGetPayment(intent.providerPaymentId)
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

    const fulfilled = await markIntentFulfilled(intent.id, auth.userId)
    return NextResponse.json({
      ok: true,
      paymentId: intent.providerPaymentId,
      txid: intent.txid || txid || null,
      intent: fulfilled || getPaymentIntent(intent.id),
      productId: intent.metadata?.productId || null,
      referenceId: intent.referenceId,
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "fulfill_failed" },
      { status: 500 }
    )
  }
}
