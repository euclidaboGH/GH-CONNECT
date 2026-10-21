/**
 * POST /api/payments/complete
 * Body: { paymentId, txid, intentId? }
 * Verifies intent + Pi payment, completes on Pi, marks COMPLETED (idempotent).
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  getPaymentIntent,
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
import { readGhcServerEnv } from "@/lib/server/economy/env"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function settleVerifiedCreatorTip(intent: {
  id: string; userId: string; amount: number; currency: string; purpose: string;
  providerPaymentId?: string | null; txid?: string | null; metadata?: Record<string, unknown>;
}, paymentId: string, requestedTxid: string) {
  if (intent.purpose !== "creator_earning" || intent.metadata?.flow !== "creator_tip") {
    return { applicable: false as const }
  }
  const tipIntentId = String(intent.metadata?.tipIntentId || "").trim()
  if (!tipIntentId || intent.currency !== "PI" || !Number.isFinite(intent.amount) || intent.amount <= 0) {
    return { applicable: true as const, ok: false as const, error: "TIP_INTENT_BINDING_INVALID" }
  }
  // Re-query Pi even on retries. A locally completed intent alone is not enough evidence
  // to create a creator payable after an ambiguous provider response.
  const verification = await piGetPayment(paymentId)
  const payment = verification.payment
  const providerTxid = String(payment?.transaction?.txid || "").trim()
  const providerVerified = Boolean(payment?.status?.developer_completed) &&
    Boolean(payment?.status?.transaction_verified || payment?.transaction?.verified) &&
    amountsMatch(intent.amount, payment?.amount) &&
    Boolean(providerTxid) && providerTxid === requestedTxid
  if (!verification.ok || !payment || !providerVerified) {
    return { applicable: true as const, ok: false as const, error: "PI_TIP_COMPLETION_NOT_VERIFIED" }
  }
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { applicable: true as const, ok: false as const, error: "TIP_SETTLEMENT_UNAVAILABLE" }
  }
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/gh_tip_settle_verified`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      body: JSON.stringify({
        p_tip_intent_id: tipIntentId, p_tipper_id: intent.userId,
        p_payment_intent_id: intent.id, p_provider_payment_id: paymentId,
        p_txid: providerTxid, p_verified_amount: Number(payment.amount), p_provider_completed: true,
      }),
      cache: "no-store",
    })
    const result = await response.json().catch(() => null) as { ok?: boolean; error?: string; status?: string; creatorPaid?: boolean; settlementId?: string; idempotent?: boolean } | null
    if (!response.ok || result?.ok !== true) {
      return { applicable: true as const, ok: false as const, error: result?.error || "TIP_SETTLEMENT_FAILED" }
    }
    return { applicable: true as const, ok: true as const, result }
  } catch {
    return { applicable: true as const, ok: false as const, error: "TIP_SETTLEMENT_UNAVAILABLE" }
  }
}

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

    // Production-safe: never call Pi /complete without an authenticated owner + durable intent.
    if (!auth) {
      return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
    }

    let intent = intentId
      ? (await loadPaymentIntent(intentId))
      : (await loadByProviderPaymentId(paymentId))

    if (!intent) {
      return NextResponse.json(
        {
          ok: false,
          error: "INTENT_REQUIRED",
          detail: "No GreenHaven payment intent bound to this payment",
        },
        { status: 404 }
      )
    }

    if (intent.userId !== auth.userId) {
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
      const grantUserId = auth.userId
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
      const tipSettlement = await settleVerifiedCreatorTip(intent, paymentId, intent.txid || txid)
      if (tipSettlement.applicable && !tipSettlement.ok) {
        return NextResponse.json({ ok: false, error: tipSettlement.error, paymentCompleted: true, settlementPending: true, retryable: true, paymentId }, { status: 503 })
      }
      return NextResponse.json({
        ok: true,
        idempotent: true,
        intent,
        paymentId,
        txid: intent.txid || txid,
        membership: membershipGrant,
        tipSettlement: tipSettlement.applicable && tipSettlement.ok ? tipSettlement.result : undefined,
      })
    }

    if (intent) {
      const bound = await bindProviderPayment(intent.id, paymentId, auth?.userId)
      if (!bound) return NextResponse.json({ ok: false, error: "PAYMENT_INTENT_BIND_UNAVAILABLE", retryable: true }, { status: 503 })
      const pending = await transitionIntent(intent.id, "COMPLETION_PENDING", {
        actor: auth.userId,
        detail: "Completion requested",
        providerPaymentId: paymentId,
        txid,
      })
      if (!pending || pending.status !== "COMPLETION_PENDING") {
        return NextResponse.json({ ok: false, error: "PAYMENT_INTENT_DURABILITY_UNAVAILABLE", retryable: true }, { status: 503 })
      }
      intent = pending

      const lookup = await piGetPayment(paymentId)
      if (!lookup.ok || !lookup.payment) {
        return NextResponse.json({ ok: false, error: "PI_PAYMENT_LOOKUP_UNAVAILABLE", detail: lookup.error, retryable: true }, { status: 502 })
      }
      if (!amountsMatch(intent.amount, lookup.payment.amount)) {
        await transitionIntent(intent.id, "FAILED", {
          actor: "system",
          detail: "Amount mismatch on complete",
          error: `expected ${intent.amount} got ${lookup.payment.amount}`,
        })
        return NextResponse.json({ ok: false, error: "amount_mismatch" }, { status: 409 })
      }
      if (intent.purpose === "creator_earning" && intent.metadata?.flow === "creator_tip") {
        const observedTxid = String(lookup.payment.transaction?.txid || "").trim()
        if (
          (!lookup.payment.status?.transaction_verified && !lookup.payment.transaction?.verified) ||
          (observedTxid && observedTxid !== txid)
        ) {
          return NextResponse.json({ ok: false, error: "PI_TIP_PAYMENT_NOT_VERIFIED", retryable: true }, { status: 409 })
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
      const completedIntent = await transitionIntent(intent.id, "COMPLETED", {
        actor: auth.userId,
        detail: "Pi developer completed",
        providerPaymentId: paymentId,
        txid,
      })
      if (!completedIntent || completedIntent.status !== "COMPLETED") {
        return NextResponse.json({ ok: false, error: "PAYMENT_COMPLETED_RECONCILIATION_PENDING", paymentCompleted: true, settlementPending: true, retryable: true, paymentId }, { status: 503 })
      }
      intent = completedIntent
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
        ? (await loadPaymentIntent(intent.id))
        : null) ||
      (await loadByProviderPaymentId(paymentId))
    if (completedIntent) {
      const tipSettlement = await settleVerifiedCreatorTip(completedIntent, paymentId, completedIntent.txid || txid)
      if (tipSettlement.applicable && !tipSettlement.ok) {
        return NextResponse.json({ ok: false, error: tipSettlement.error, paymentCompleted: true, settlementPending: true, retryable: true, paymentId }, { status: 503 })
      }
    }
    const grantUserId = auth.userId
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
