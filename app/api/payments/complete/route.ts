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
import { tryGrantMembershipFromCompletedIntent } from "@/lib/server/membership/entitlement-store"

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

    // Idempotent complete — still attempt membership grant (idempotent via purchaseRef)
    if (intent?.status === "COMPLETED" || intent?.status === "FULFILLED") {
      let membershipGrant: {
        granted: boolean
        error?: string
        skipped?: boolean
        tier?: string
      } | null = null
      const grantUserId = auth?.userId || intent.userId
      if (grantUserId && intent.userId === grantUserId) {
        try {
          const result = await tryGrantMembershipFromCompletedIntent({
            userId: grantUserId,
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
          membershipGrant = {
            granted: result.granted,
            error: result.error,
            skipped: result.skipped,
            tier: result.entitlement?.tier,
          }
        } catch {
          /* grant is best-effort on idempotent path; client recovery remains */
        }
      }
      return NextResponse.json({
        ok: true,
        idempotent: true,
        intent,
        paymentId,
        txid: intent.txid || txid,
        membership: membershipGrant,
      })
    }

    if (intent) {
      await bindProviderPayment(intent.id, paymentId, auth?.userId)
      await transitionIntent(intent.id, "COMPLETION_PENDING", {
        actor: auth?.userId || "system",
        detail: "Completion requested",
        providerPaymentId: paymentId,
        txid,
      })

      const lookup = await piGetPayment(paymentId)
      if (lookup.ok && lookup.payment) {
        if (!amountsMatch(intent.amount, lookup.payment.amount)) {
          await transitionIntent(intent.id, "FAILED", {
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
        await transitionIntent(intent.id, "COMPLETION_PENDING", {
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
      await transitionIntent(intent.id, "COMPLETED", {
        actor: auth?.userId || "system",
        detail: "Pi developer completed",
        providerPaymentId: paymentId,
        txid,
      })
    }

    // Membership entitlement: grant on verified COMPLETED intent (server-authoritative).
    // Does not depend on the client later calling /api/membership/activate.
    let membershipGrant: {
      granted: boolean
      error?: string
      skipped?: boolean
      tier?: string
    } | null = null
    const completedIntent =
      (intent
        ? (await loadPaymentIntent(intent.id)) || getPaymentIntent(intent.id)
        : null) ||
      (await loadByProviderPaymentId(paymentId)) ||
      getByProviderPaymentId(paymentId)
    const grantUserId = auth?.userId || completedIntent?.userId
    if (completedIntent && grantUserId && completedIntent.userId === grantUserId) {
      try {
        const result = await tryGrantMembershipFromCompletedIntent({
          userId: grantUserId,
          intent: {
            id: completedIntent.id,
            userId: completedIntent.userId,
            purpose: completedIntent.purpose,
            status: completedIntent.status,
            amount: completedIntent.amount,
            currency: completedIntent.currency,
            providerPaymentId: completedIntent.providerPaymentId,
            metadata: completedIntent.metadata,
          },
        })
        membershipGrant = {
          granted: result.granted,
          error: result.error,
          skipped: result.skipped,
          tier: result.entitlement?.tier,
        }
        if (!result.granted && !result.skipped) {
          console.error(
            "[payments/complete] membership grant deferred",
            result.error,
            completedIntent.id
          )
        }
      } catch (e) {
        console.error(
          "[payments/complete] membership grant error",
          e instanceof Error ? e.message : e
        )
        membershipGrant = {
          granted: false,
          error: e instanceof Error ? e.message : "GRANT_FAILED",
        }
      }
    }

    return NextResponse.json({
      ok: true,
      payment: done.payment,
      intent: completedIntent || (intent ? getPaymentIntent(intent.id) : null),
      paymentId,
      txid,
      membership: membershipGrant,
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Complete failed" },
      { status: 500 }
    )
  }
}
