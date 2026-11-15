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
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"
import { getByGhUserId } from "@/lib/server/identity/pi-identity-store"
import { resolvePiSandbox } from "@/lib/pi-env"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" }
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE })

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
        provider: intent.provider,
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
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  const limit = await checkDurableRateLimit(`pi-payment-recover:${auth.userId}`, 12, 60_000, { onUnavailable: "deny" })
  if (!limit.ok) return reply({ ok: false, error: durableRateLimitCode(limit), retryAfterSec: limit.retryAfterSec }, durableRateLimitStatus(limit))
  const { intentId } = await ctx.params
  // Durable-only: cold starts must recover from DB; never use process memory as authority
  let intent = (await loadPaymentIntent(intentId))
  if (!intent || intent.userId !== auth.userId) {
    return reply({ ok: false, error: "NOT_FOUND" }, 404)
  }

  if (intent.status === "COMPLETED" || intent.status === "FULFILLED") {
    const membership = await ensureRecoveredMembership(auth.userId, intent)
    const featureAttempts = describeFeatureAttempts(intent)
    return reply({
      ok: true,
      intent,
      recovered: false,
      message: "Already completed",
      membership,
      featureAttempts,
    })
  }

  const parsedBody = await readBoundedJson(request, 4 * 1024)
  if (!parsedBody.ok) return reply({ ok: false, error: parsedBody.error }, parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400)
  const body = parsedBody.value
  const paymentId = (typeof body.paymentId === "string" && body.paymentId.trim()) || intent.providerPaymentId || ""

  if (!paymentId) {
    return reply({ ok: false, error: "PAYMENT_ID_REQUIRED" }, 400)
  }

  // Verify the provider object BEFORE binding its ID to this durable intent.
  // Binding an unverified client-supplied ID first could permanently poison a
  // legitimate intent if the ID is mistyped or belongs to another Pi account.
  const lookup = await piGetPayment(paymentId)
  if (!lookup.ok || !lookup.payment) {
    return reply({ ok: false, error: lookup.error || "PI_LOOKUP_FAILED", retryable: true }, 502)
  }

  const payment = lookup.payment
  const expectedNetwork = resolvePiSandbox() ? "Pi Testnet" : "Pi Network"
  const payerUid = String(payment.user_uid || payment.from_uid || "").trim()
  const identity = await getByGhUserId(auth.userId)
  if (payment.identifier !== paymentId || payment.direction !== "user_to_app" || payment.network !== expectedNetwork) {
    return reply({ ok: false, error: "PI_PAYMENT_BINDING_MISMATCH", retryable: false }, 409)
  }
  if (!identity?.piAppUid || !payerUid || payerUid !== identity.piAppUid) {
    return reply({ ok: false, error: "PI_PAYMENT_PAYER_MISMATCH", retryable: false }, 403)
  }
  if (!amountsMatch(intent.amount, payment.amount)) {
    return reply({ ok: false, error: "PI_PAYMENT_AMOUNT_MISMATCH", retryable: false }, 409)
  }

  const st = payment.status || {}
  const providerTxid = String(payment.transaction?.txid || "").trim()
  if ((st.cancelled || st.user_cancelled) && (providerTxid || st.transaction_verified || payment.transaction?.verified)) {
    return reply({ ok: false, error: "PI_CANCELLED_WITH_TRANSACTION_CONFLICT", retryable: true }, 409)
  }

  const bound = await bindProviderPayment(intentId, paymentId, auth.userId)
  if (!bound) return reply({ ok: false, error: "PAYMENT_INTENT_BIND_UNAVAILABLE", retryable: true }, 503)

  if (st.cancelled || st.user_cancelled) {
    const cancelledIntent = await transitionIntent(intentId, "CANCELLED", {
      actor: "system",
      detail: "Pi provider confirmed cancellation without a transaction",
      providerPaymentId: paymentId,
    })
    if (!cancelledIntent || cancelledIntent.status !== "CANCELLED") {
      return reply({ ok: false, error: "PAYMENT_INTENT_DURABILITY_UNAVAILABLE", retryable: true }, 503)
    }
    return reply({ ok: true, intent: cancelledIntent, recovered: true })
  }

  if (st.developer_completed) {
    const verified = st.transaction_verified === true || payment.transaction?.verified === true
    if (!verified || !providerTxid) {
      return reply({ ok: false, error: "PI_PAYMENT_NOT_VERIFIED", retryable: true, message: "Pi reports completion, but transaction verification is not yet confirmed. Retry recovery; do not pay again." }, 409)
    }
    const txid = providerTxid || intent.txid || undefined
    const completedIntent = await transitionIntent(intentId, "COMPLETED", {
      actor: "system",
      detail: "Recovered completed from Pi",
      txid: txid || undefined,
      providerPaymentId: paymentId,
    })
    if (!completedIntent || completedIntent.status !== "COMPLETED") {
      return reply({ ok: false, error: "PAYMENT_INTENT_DURABILITY_UNAVAILABLE", retryable: true }, 503)
    }
    const recoveredIntent = completedIntent
    const membership = await ensureRecoveredMembership(auth.userId, recoveredIntent)
    const featureAttempts = describeFeatureAttempts(recoveredIntent)
    return reply({
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
        return reply({ ok: false, error: "PAYMENT_INTENT_DURABILITY_UNAVAILABLE", retryable: true }, 503)
      }
      intent = approvedIntent
    }
  }

  return reply({
    ok: true,
    intent: getPaymentIntent(intentId),
    payment,
    recovered: true,
  })
}
