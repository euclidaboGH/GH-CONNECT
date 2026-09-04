/**
 * POST /api/payments/complete
 * Body: { paymentId, txid, intentId? }
 * Verifies intent + Pi payment, completes on Pi, marks COMPLETED (idempotent).
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  getPaymentIntent,
  getByProviderPaymentId,
  bindProviderPayment,
  transitionIntent,
  loadPaymentIntent,
  loadByProviderPaymentId,
} from "@/lib/server/payments/intent-store"
import {
  piCompletePayment,
  piGetPayment,
  amountsMatch,
  getPiApiKey,
} from "@/lib/server/payments/pi-api"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const auth = await resolveAuthenticatedUser(request.headers)
    const body = await request.json().catch(() => ({}))
    const paymentId = typeof body.paymentId === "string" ? body.paymentId.trim() : ""
    const txid = typeof body.txid === "string" ? body.txid.trim() : ""
    const intentId = typeof body.intentId === "string" ? body.intentId.trim() : ""

    if (!paymentId) {
      return NextResponse.json({ ok: false, error: "paymentId required" }, { status: 400 })
    }
    if (!txid) {
      return NextResponse.json({ ok: false, error: "txid required" }, { status: 400 })
    }
    if (!getPiApiKey()) {
      return NextResponse.json(
        { ok: false, error: "PI_API_KEY is not configured on the server" },
        { status: 503 }
      )
    }

    let intent = intentId
      ? (await loadPaymentIntent(intentId)) || getPaymentIntent(intentId)
      : (await loadByProviderPaymentId(paymentId)) || getByProviderPaymentId(paymentId)

    if (intent && auth && intent.userId !== auth.userId) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 })
    }

    // Idempotent complete
    if (intent?.status === "COMPLETED") {
      return NextResponse.json({
        ok: true,
        idempotent: true,
        intent,
        paymentId,
        txid: intent.txid || txid,
      })
    }

    if (intent) {
      bindProviderPayment(intent.id, paymentId, auth?.userId)
      transitionIntent(intent.id, "COMPLETION_PENDING", {
        actor: auth?.userId || "system",
        detail: "Completion requested",
        providerPaymentId: paymentId,
        txid,
      })

      const lookup = await piGetPayment(paymentId)
      if (lookup.ok && lookup.payment) {
        if (!amountsMatch(intent.amount, lookup.payment.amount)) {
          transitionIntent(intent.id, "FAILED", {
            actor: "system",
            detail: "Amount mismatch on complete",
            error: `expected ${intent.amount} got ${lookup.payment.amount}`,
          })
          return NextResponse.json({ ok: false, error: "amount_mismatch" }, { status: 409 })
        }
      }
    }

    const done = await piCompletePayment(paymentId, txid)
    if (!done.ok) {
      // Retry-friendly: leave COMPLETION_PENDING if intent exists
      if (intent) {
        transitionIntent(intent.id, "COMPLETION_PENDING", {
          actor: "system",
          detail: "Pi complete failed — retryable",
          error: done.error,
          txid,
        })
      }
      return NextResponse.json(
        {
          ok: false,
          error: "Pi complete failed",
          status: done.status,
          detail: done.error,
          retryable: true,
        },
        { status: 502 }
      )
    }

    if (intent) {
      transitionIntent(intent.id, "COMPLETED", {
        actor: auth?.userId || "system",
        detail: "Pi developer completed",
        providerPaymentId: paymentId,
        txid,
      })
    }

    return NextResponse.json({
      ok: true,
      payment: done.payment,
      intent: intent ? getPaymentIntent(intent.id) : null,
      paymentId,
      txid,
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Complete failed" },
      { status: 500 }
    )
  }
}
