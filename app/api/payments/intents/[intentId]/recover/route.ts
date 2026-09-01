/**
 * POST — incomplete payment recovery: lookup Pi payment + advance status when possible.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  getPaymentIntent,
  transitionIntent,
  bindProviderPayment,
} from "@/lib/server/payments/intent-store"
import { piGetPayment, amountsMatch } from "@/lib/server/payments/pi-api"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  ctx: { params: Promise<{ intentId: string }> }
) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const { intentId } = await ctx.params
  const intent = getPaymentIntent(intentId)
  if (!intent || intent.userId !== auth.userId) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 })
  }

  if (intent.status === "COMPLETED") {
    return NextResponse.json({ ok: true, intent, recovered: false, message: "Already completed" })
  }

  const body = await request.json().catch(() => ({}))
  const paymentId =
    (typeof body.paymentId === "string" && body.paymentId.trim()) ||
    intent.providerPaymentId ||
    ""

  if (!paymentId) {
    return NextResponse.json(
      { ok: false, error: "No provider payment id to recover" },
      { status: 400 }
    )
  }

  bindProviderPayment(intentId, paymentId, auth.userId)

  const lookup = await piGetPayment(paymentId)
  if (!lookup.ok || !lookup.payment) {
    return NextResponse.json(
      { ok: false, error: lookup.error || "Pi lookup failed", intent },
      { status: 502 }
    )
  }

  const payment = lookup.payment
  if (!amountsMatch(intent.amount, payment.amount)) {
    transitionIntent(intentId, "FAILED", {
      actor: "system",
      detail: "Amount mismatch on recover",
      error: `expected ${intent.amount} got ${payment.amount}`,
    })
    return NextResponse.json(
      { ok: false, error: "AMOUNT_mismatch", payment },
      { status: 409 }
    )
  }

  const st = payment.status || {}
  if (st.cancelled || st.user_cancelled) {
    transitionIntent(intentId, "CANCELLED", {
      actor: "system",
      detail: "Pi reports cancelled",
    })
    return NextResponse.json({ ok: true, intent: getPaymentIntent(intentId), recovered: true })
  }

  if (st.developer_completed) {
    const txid = payment.transaction?.txid || intent.txid || undefined
    transitionIntent(intentId, "COMPLETED", {
      actor: "system",
      detail: "Recovered completed from Pi",
      txid: txid || undefined,
      providerPaymentId: paymentId,
    })
    return NextResponse.json({ ok: true, intent: getPaymentIntent(intentId), recovered: true })
  }

  if (st.developer_approved) {
    if (intent.status === "CREATED" || intent.status === "APPROVAL_PENDING") {
      transitionIntent(intentId, "APPROVED", {
        actor: "system",
        detail: "Recovered approved from Pi",
        providerPaymentId: paymentId,
      })
    }
  }

  return NextResponse.json({
    ok: true,
    intent: getPaymentIntent(intentId),
    payment,
    recovered: true,
  })
}
