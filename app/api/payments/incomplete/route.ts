/**
 * POST /api/payments/incomplete
 *
 * Pi.authenticate(..., onIncompletePaymentFound) recovery endpoint.
 * Reconciles durable intent + Pi API. Never auto-grants benefits.
 * Never creates a second charge.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  loadByProviderPaymentId,
  loadPaymentIntent,
  bindProviderPayment,
  transitionIntent,
  createPaymentIntent,
  getPaymentIntent,
} from "@/lib/server/payments/intent-store"
import {
  piGetPayment,
  piCompletePayment,
  getPiApiKey,
  amountsMatch,
} from "@/lib/server/payments/pi-api"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const paymentId =
    typeof body.paymentId === "string"
      ? body.paymentId.trim()
      : typeof body.identifier === "string"
        ? body.identifier.trim()
        : ""
  const txidRaw =
    typeof body.txid === "string"
      ? body.txid.trim()
      : body.transaction && typeof body.transaction === "object"
        ? String((body.transaction as { txid?: string }).txid || "").trim()
        : ""
  const intentId =
    typeof body.intentId === "string" ? body.intentId.trim() : ""

  if (!paymentId) {
    return NextResponse.json({ ok: false, error: "paymentId required" }, { status: 400 })
  }

  // Load durable state (DB → cache)
  let intent =
    (intentId ? await loadPaymentIntent(intentId) : null) ||
    (await loadByProviderPaymentId(paymentId))

  // Ensure cache has intent for transitions
  if (intent) {
    /* already cached by load */
  }

  if (intent && intent.userId !== auth.userId) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 })
  }

  // Already terminal success
  if (intent && (intent.status === "FULFILLED" || intent.status === "COMPLETED")) {
    return NextResponse.json({
      ok: true,
      action: intent.status === "FULFILLED" ? "already_fulfilled" : "already_completed",
      intent: getPaymentIntent(intent.id),
      paymentId,
      txid: intent.txid || txidRaw || null,
      idempotent: true,
    })
  }

  if (intent && (intent.status === "CANCELLED" || intent.status === "REFUNDED")) {
    return NextResponse.json({
      ok: true,
      action: "terminal_closed",
      intent: getPaymentIntent(intent.id),
      paymentId,
    })
  }

  if (!getPiApiKey()) {
    return NextResponse.json(
      {
        ok: false,
        error: "PI_API_KEY not configured",
        action: "manual_review",
        paymentId,
      },
      { status: 503 }
    )
  }

  const lookup = await piGetPayment(paymentId)
  if (!lookup.ok || !lookup.payment) {
    if (intent) {
      transitionIntent(intent.id, "INCOMPLETE", {
        actor: auth.userId,
        detail: "Pi lookup failed during recovery",
        providerPaymentId: paymentId,
        error: lookup.error || "lookup_failed",
      })
    }
    return NextResponse.json({
      ok: false,
      error: lookup.error || "PI_LOOKUP_FAILED",
      action: "retry",
      paymentId,
    })
  }

  const payment = lookup.payment
  const st = payment.status || {}
  const piTxid =
    txidRaw ||
    (payment.transaction && typeof payment.transaction === "object"
      ? String((payment.transaction as { txid?: string }).txid || "")
      : "") ||
    ""

  // Cancelled on Pi
  if (st.cancelled || st.user_cancelled) {
    if (intent) {
      transitionIntent(intent.id, "CANCELLED", {
        actor: "pi_platform",
        detail: "Cancelled on Pi during recovery",
        providerPaymentId: paymentId,
      })
    }
    return NextResponse.json({
      ok: true,
      action: "cancelled",
      paymentId,
      intent: intent ? getPaymentIntent(intent.id) : null,
    })
  }

  // Create shell intent if none (orphan incomplete from Pi)
  if (!intent) {
    const amount = Number(payment.amount) || 0
    if (!(amount > 0)) {
      return NextResponse.json({
        ok: false,
        error: "UNKNOWN_PAYMENT",
        action: "manual_review",
        paymentId,
      })
    }
    intent = createPaymentIntent({
      userId: auth.userId,
      purpose: "other",
      amount,
      currency: "PI",
      referenceId: `incomplete:${paymentId}`,
      idempotencyKey: `incomplete:${paymentId}`,
      metadata: {
        recovered: true,
        piPaymentId: paymentId,
      },
    })
    bindProviderPayment(intent.id, paymentId, auth.userId)
  } else {
    bindProviderPayment(intent.id, paymentId, auth.userId)
  }

  // Amount guard when we have expected amount
  if (intent.amount > 0 && payment.amount != null) {
    if (!amountsMatch(intent.amount, payment.amount)) {
      transitionIntent(intent.id, "FAILED", {
        actor: "system",
        detail: "Amount mismatch on incomplete recovery",
        error: `expected ${intent.amount} got ${payment.amount}`,
        providerPaymentId: paymentId,
      })
      return NextResponse.json(
        {
          ok: false,
          error: "AMOUNT_mismatch",
          action: "stop",
          paymentId,
          intent: getPaymentIntent(intent.id),
        },
        { status: 409 }
      )
    }
  }

  // Developer completed already on Pi
  if (st.developer_completed) {
    transitionIntent(intent.id, "COMPLETED", {
      actor: "pi_platform",
      detail: "Already completed on Pi",
      providerPaymentId: paymentId,
      txid: piTxid || undefined,
    })
    return NextResponse.json({
      ok: true,
      action: "already_completed",
      paymentId,
      txid: piTxid || intent.txid,
      intent: getPaymentIntent(intent.id),
      needsFulfillment: true,
    })
  }

  // Has blockchain tx → complete
  if (piTxid || st.transaction_verified) {
    if (!piTxid) {
      transitionIntent(intent.id, "INCOMPLETE", {
        actor: auth.userId,
        detail: "Verified on chain but txid missing",
        providerPaymentId: paymentId,
      })
      return NextResponse.json({
        ok: false,
        error: "txid_required",
        action: "retry_with_txid",
        paymentId,
        intent: getPaymentIntent(intent.id),
      })
    }

    transitionIntent(intent.id, "COMPLETION_PENDING", {
      actor: auth.userId,
      detail: "Incomplete recovery completing",
      providerPaymentId: paymentId,
      txid: piTxid,
    })

    const completed = await piCompletePayment(paymentId, piTxid)
    if (!completed.ok) {
      transitionIntent(intent.id, "INCOMPLETE", {
        actor: "system",
        detail: "Pi complete failed",
        error: completed.error,
        providerPaymentId: paymentId,
        txid: piTxid,
      })
      return NextResponse.json({
        ok: false,
        error: completed.error || "COMPLETE_FAILED",
        action: "retry",
        paymentId,
        txid: piTxid,
        intent: getPaymentIntent(intent.id),
      })
    }

    transitionIntent(intent.id, "COMPLETED", {
      actor: "system",
      detail: "Completed via incomplete recovery",
      providerPaymentId: paymentId,
      txid: piTxid,
    })

    return NextResponse.json({
      ok: true,
      action: "completed",
      paymentId,
      txid: piTxid,
      intent: getPaymentIntent(intent.id),
      needsFulfillment: true,
    })
  }

  // Approved but no tx yet — user must finish in wallet; do not create new payment
  transitionIntent(intent.id, "INCOMPLETE", {
    actor: auth.userId,
    detail: "Awaiting user transaction",
    providerPaymentId: paymentId,
  })

  return NextResponse.json({
    ok: true,
    action: "awaiting_user",
    message:
      "An incomplete Pi payment is still open. Finish or cancel it in Pi Wallet before starting a new one.",
    paymentId,
    intent: getPaymentIntent(intent.id),
  })
}
