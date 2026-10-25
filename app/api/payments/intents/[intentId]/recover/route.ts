/**
 * POST — incomplete payment recovery: lookup Pi payment + advance status when possible.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  getPaymentIntent,
  loadPaymentIntent,
  transitionIntent,
  bindProviderPayment,
} from "@/lib/server/payments/intent-store"
import { piGetPayment, amountsMatch } from "@/lib/server/payments/pi-api"
import { tryGrantMembershipFromCompletedIntent } from "@/lib/server/membership/entitlement-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"


function describeFeatureAttempts(intent: NonNullable<Awaited<ReturnType<typeof loadPaymentIntent>>>) {
  const meta = (intent.metadata && typeof intent.metadata === "object" ? intent.metadata : {}) as Record<string, unknown>
  const kind = String(meta.kind || meta.feeKind || "").toLowerCase()
  const attempts: Array<{ feature: string; ok: boolean; code?: string; message?: string }> = []
  if (kind === "listing_fee") {
    attempts.push({
      feature: "marketplace_listing_fee",
      ok: intent.status === "COMPLETED" || intent.status === "FULFILLED",
      code: "LISTING_FEE_PAYMENT_STATE",
      message:
        intent.status === "COMPLETED" || intent.status === "FULFILLED"
          ? "Pi listing fee payment is recorded. Publish/retry listing create with this intent id if the listing is not active yet."
          : "Listing fee payment is not completed on the durable intent.",
    })
  }
  if (kind === "community_create_fee" || String(intent.referenceId || "").startsWith("community_create_fee_")) {
    attempts.push({
      feature: "community_create_fee",
      ok: intent.status === "COMPLETED" || intent.status === "FULFILLED",
      code: "COMMUNITY_FEE_PAYMENT_STATE",
      message:
        intent.status === "COMPLETED" || intent.status === "FULFILLED"
          ? "Pi community fee payment is recorded. Retry create with feePaymentId if the community is missing."
          : "Community fee payment is not completed on the durable intent.",
    })
  }
  if (String(intent.purpose || "").toLowerCase() === "membership") {
    attempts.push({
      feature: "membership",
      ok: intent.status === "FULFILLED" || intent.status === "COMPLETED",
      code: "MEMBERSHIP_PAYMENT_STATE",
      message: "Membership grant is attempted only from completed intents via server entitlement rules.",
    })
  }
  return attempts
}

async function ensureRecoveredMembership(userId: string, intent: NonNullable<Awaited<ReturnType<typeof loadPaymentIntent>>>) {
  try {
    return await tryGrantMembershipFromCompletedIntent({
      userId,
      intent: {
        id: intent.id,
        userId: intent.userId,
        purpose: intent.purpose,
        status: intent.status,
        amount: intent.amount,
        currency: intent.currency,
        providerPaymentId: intent.providerPaymentId,
        metadata: intent.metadata,
      },
    })
  } catch (e) {
    return { granted: false, error: e instanceof Error ? e.message : "GRANT_FAILED" }
  }
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ intentId: string }> }
) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const { intentId } = await ctx.params
  // Durable-only: cold starts must recover from DB; never use process memory as authority
  let intent = (await loadPaymentIntent(intentId))
  if (!intent || intent.userId !== auth.userId) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 })
  }

  if (intent.status === "COMPLETED" || intent.status === "FULFILLED") {
    const membership = await ensureRecoveredMembership(auth.userId, intent)
    const featureAttempts = describeFeatureAttempts(intent)
    return NextResponse.json({
      ok: true,
      intent,
      recovered: false,
      message: "Already completed",
      membership,
      featureAttempts,
    })
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

  const bound = await bindProviderPayment(intentId, paymentId, auth.userId)
  if (!bound) return NextResponse.json({ ok: false, error: "PAYMENT_INTENT_BIND_UNAVAILABLE", retryable: true }, { status: 503 })

  const lookup = await piGetPayment(paymentId)
  if (!lookup.ok || !lookup.payment) {
    return NextResponse.json(
      { ok: false, error: lookup.error || "Pi lookup failed", intent },
      { status: 502 }
    )
  }

  const payment = lookup.payment
  if (!amountsMatch(intent.amount, payment.amount)) {
    await transitionIntent(intentId, "FAILED", {
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
    const cancelledIntent = await transitionIntent(intentId, "CANCELLED", {
      actor: "system",
      detail: "Pi reports cancelled",
    })
    if (!cancelledIntent || cancelledIntent.status !== "CANCELLED") {
      return NextResponse.json({ ok: false, error: "PAYMENT_INTENT_DURABILITY_UNAVAILABLE", retryable: true }, { status: 503 })
    }
    return NextResponse.json({ ok: true, intent: cancelledIntent, recovered: true })
  }

  if (st.developer_completed) {
    const txid = payment.transaction?.txid || intent.txid || undefined
    const completedIntent = await transitionIntent(intentId, "COMPLETED", {
      actor: "system",
      detail: "Recovered completed from Pi",
      txid: txid || undefined,
      providerPaymentId: paymentId,
    })
    if (!completedIntent || completedIntent.status !== "COMPLETED") {
      return NextResponse.json({ ok: false, error: "PAYMENT_INTENT_DURABILITY_UNAVAILABLE", retryable: true }, { status: 503 })
    }
    const recoveredIntent = completedIntent
    const membership = await ensureRecoveredMembership(auth.userId, recoveredIntent)
    const featureAttempts = describeFeatureAttempts(recoveredIntent)
    return NextResponse.json({
      ok: true,
      intent: recoveredIntent,
      recovered: true,
      membership,
      featureAttempts,
    })
  }

  if (st.developer_approved) {
    if (intent.status === "CREATED" || intent.status === "APPROVAL_PENDING") {
      const approvedIntent = await transitionIntent(intentId, "APPROVED", {
        actor: "system",
        detail: "Recovered approved from Pi",
        providerPaymentId: paymentId,
      })
      if (!approvedIntent || approvedIntent.status !== "APPROVED") {
        return NextResponse.json({ ok: false, error: "PAYMENT_INTENT_DURABILITY_UNAVAILABLE", retryable: true }, { status: 503 })
      }
      intent = approvedIntent
    }
  }

  return NextResponse.json({
    ok: true,
    intent: getPaymentIntent(intentId),
    payment,
    recovered: true,
  })
}
