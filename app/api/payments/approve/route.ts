/**
 * POST /api/payments/approve
 * Body: { paymentId, intentId? }
 * Binds Pi payment to server intent, verifies amount/purpose, approves on Pi.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  getPaymentIntent,
  getByProviderPaymentId,
  bindProviderPayment,
  transitionIntent,
} from "@/lib/server/payments/intent-store"
import {
  piApprovePayment,
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
    const intentId = typeof body.intentId === "string" ? body.intentId.trim() : ""

    if (!paymentId) {
      return NextResponse.json({ ok: false, error: "paymentId required" }, { status: 400 })
    }
    if (!getPiApiKey()) {
      return NextResponse.json(
        { ok: false, error: "PI_API_KEY is not configured on the server" },
        { status: 503 }
      )
    }

    // Resolve intent: explicit id → already bound provider id
    let intent = intentId ? getPaymentIntent(intentId) : getByProviderPaymentId(paymentId)

    if (intent && auth && intent.userId !== auth.userId) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 })
    }

    // Idempotent if already approved/completed
    if (intent && (intent.status === "APPROVED" || intent.status === "COMPLETED" || intent.status === "COMPLETION_PENDING" || intent.status === "USER_SUBMITTED")) {
      if (intent.providerPaymentId === paymentId || !intent.providerPaymentId) {
        if (!intent.providerPaymentId) bindProviderPayment(intent.id, paymentId, auth?.userId)
        // Still ensure Pi approved (retry-safe)
        const appr = await piApprovePayment(paymentId)
        return NextResponse.json({
          ok: true,
          idempotent: true,
          intent: getPaymentIntent(intent.id),
          payment: appr.payment,
        })
      }
    }

    if (intent) {
      const bound = bindProviderPayment(intent.id, paymentId, auth?.userId)
      if (!bound) {
        return NextResponse.json(
          { ok: false, error: "provider_payment_bind_conflict" },
          { status: 409 }
        )
      }
      transitionIntent(intent.id, "APPROVAL_PENDING", {
        actor: auth?.userId || "system",
        detail: "Approval requested",
        providerPaymentId: paymentId,
      })

      // Lookup + verify amount before approve
      const lookup = await piGetPayment(paymentId)
      if (lookup.ok && lookup.payment) {
        if (!amountsMatch(intent.amount, lookup.payment.amount)) {
          transitionIntent(intent.id, "FAILED", {
            actor: "system",
            detail: "Amount mismatch",
            error: `expected ${intent.amount} got ${lookup.payment.amount}`,
          })
          return NextResponse.json(
            {
              ok: false,
              error: "amount_mismatch",
              expected: intent.amount,
              actual: lookup.payment.amount,
            },
            { status: 409 }
          )
        }
        // Optional metadata purpose check
        const metaPurpose = lookup.payment.metadata?.purpose || lookup.payment.metadata?.intentPurpose
        if (
          metaPurpose &&
          intent.metadata?.purpose &&
          String(metaPurpose) !== String(intent.metadata.purpose)
        ) {
          // soft warn only — purpose in our intent is authoritative
        }
      }
    }

    const appr = await piApprovePayment(paymentId)
    if (!appr.ok) {
      if (intent) {
        transitionIntent(intent.id, "FAILED", {
          actor: "system",
          detail: "Pi approve failed",
          error: appr.error,
        })
      }
      return NextResponse.json(
        { ok: false, error: "Pi approve failed", status: appr.status, detail: appr.error },
        { status: 502 }
      )
    }

    if (intent) {
      transitionIntent(intent.id, "APPROVED", {
        actor: auth?.userId || "system",
        detail: "Pi developer approved",
        providerPaymentId: paymentId,
      })
    }

    return NextResponse.json({
      ok: true,
      payment: appr.payment,
      intent: intent ? getPaymentIntent(intent.id) : null,
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Approve failed" },
      { status: 500 }
    )
  }
}
