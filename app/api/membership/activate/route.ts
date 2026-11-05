/**
 * POST /api/membership/activate
 * Server grants VIP/VVIP only after verified Pi intent COMPLETED or GHC catalog spend.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  getEntitlement,
  tryGetEntitlementAuthoritative,
  grantEntitlement,
} from "@/lib/server/membership/entitlement-store"
import {
  loadPaymentIntent,
  loadByProviderPaymentId,
} from "@/lib/server/payments/intent-store"
import {
  executeAuthoritativeSpend,
  getProcessGhcStore,
} from "@/lib/server/economy/store"
import { allowMemoryServer, isDatabaseConfigured } from "@/lib/server/economy/http"
import { readGhcServerEnv as readEnv } from "@/lib/server/economy/env"
import { getRequestContext } from "@/lib/server/foundation/request-context"
import { z } from "zod"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { addCalendarMonths, getMembershipGhcPrice, getMembershipPiPrice, membershipPeriodForPaidMonths, paidMonthsForMembershipPeriod, type PaidMembershipMonths } from "@/lib/membership-pricing"
import { queueReferralReward } from "@/lib/server/referral/referral-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function rpcPurchaseMembership(input: {
  userId: string
  amount: number
  referenceId: string
  reason: string
  row: Record<string, unknown>
}): Promise<{ ok: boolean; error?: string; spend?: unknown; idempotent?: boolean }> {
  const env = readEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { ok: false, error: "SERVER_UNAVAILABLE" }
  }
  try {
    const res = await fetch(
      `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/ghc_purchase_membership`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.supabaseServiceRoleKey,
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        },
        body: JSON.stringify({
          p_user_id: input.userId,
          p_amount: input.amount,
          p_reference_id: input.referenceId,
          p_reason: input.reason,
          p_row: input.row,
        }),
      }
    )
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok) {
      return { ok: false, error: String(data?.error || "MEMBERSHIP_PURCHASE_FAILED") }
    }
    return { ok: true, idempotent: Boolean(data.idempotent), spend: data.spend }
  } catch {
    return { ok: false, error: "MEMBERSHIP_PURCHASE_RPC_FAILED" }
  }
}

export async function POST(request: Request) {
  const reqCtx = getRequestContext(request.headers)
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: { "x-request-id": reqCtx.requestId } })
  }

  const boundedBody = await readBoundedJson(request, 8 * 1024)
  if (!boundedBody.ok) {
    return NextResponse.json({ ok: false, error: boundedBody.error }, { status: boundedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400, headers: { "x-request-id": reqCtx.requestId, "Cache-Control": "no-store" } })
  }
  const raw = boundedBody.value
  const schema = z.object({
    tier: z.enum(["vip", "vvip"]),
    period: z.enum(["monthly", "four_months", "eight_months", "yearly"]).optional(),
    billingPeriod: z.enum(["monthly", "four_months", "eight_months", "yearly"]).optional(),
    paidMonths: z.union([z.literal(1), z.literal(4), z.literal(8), z.literal(12)]).optional(),
    method: z.enum(["pi", "ghc"]),
    intentId: z.string().max(120).optional(),
    paymentId: z.string().max(120).optional(),
    spendReferenceId: z.string().max(160).optional(),
  })
  const parsed = schema.safeParse({
    ...raw,
    tier: String((raw as { tier?: string }).tier || "").toLowerCase(),
    period: String((raw as { period?: string }).period || "").toLowerCase() || undefined,
    billingPeriod: String((raw as { billingPeriod?: string }).billingPeriod || "").toLowerCase() || undefined,
    method: String((raw as { method?: string }).method || "").toLowerCase(),
  })
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "INVALID_BODY", details: parsed.error.flatten() },
      { status: 400, headers: { "x-request-id": reqCtx.requestId } }
    )
  }
  const tier = parsed.data.tier
  const requestedPeriod = parsed.data.period || parsed.data.billingPeriod
  const requestedMonths = parsed.data.paidMonths || (requestedPeriod ? paidMonthsForMembershipPeriod(requestedPeriod) : 1)
  if (!requestedMonths) {
    return NextResponse.json({ ok: false, error: "UNSUPPORTED_MEMBERSHIP_DURATION" }, { status: 400 })
  }
  const paidMonths = requestedMonths as PaidMembershipMonths
  const period = membershipPeriodForPaidMonths(paidMonths)
  const method = parsed.data.method
  const body = { ...raw, ...parsed.data, period, paidMonths, tier, method }


  // Idempotent / already-active: same tier still valid — do not charge again.
  // In database mode an unreadable entitlement store must fail closed before any debit.
  try {
    const existingResult = await tryGetEntitlementAuthoritative(auth.userId)
    if (!existingResult.ok && isDatabaseConfigured()) {
      return NextResponse.json(
        { ok: false, error: "MEMBERSHIP_STORE_UNAVAILABLE", message: "Membership status could not be verified. No payment was taken." },
        { status: 503 }
      )
    }
    if (
      existingResult.ok &&
      existingResult.entitlement.tier === tier &&
      existingResult.entitlement.active !== false &&
      (!existingResult.entitlement.expiresAt ||
        existingResult.entitlement.expiresAt > Date.now() + 60_000)
    ) {
      return NextResponse.json(
        {
          ok: true,
          entitlement: existingResult.entitlement,
          alreadyActive: true,
          message: "Membership already active for this tier",
        },
        { status: 200 }
      )
    }
  } catch {
    if (isDatabaseConfigured()) {
      return NextResponse.json(
        { ok: false, error: "MEMBERSHIP_STORE_UNAVAILABLE", message: "Membership status could not be verified. No payment was taken." },
        { status: 503 }
      )
    }
  }

  if (method === "pi") {
    const intentId = String(body.intentId || "").trim()
    const paymentId = String(body.paymentId || "").trim()

    let intent =
      (intentId ? await loadPaymentIntent(intentId) : null) ||
      (paymentId ? await loadByProviderPaymentId(paymentId) : null)

    if (!intent) {
      return NextResponse.json(
        {
          ok: false,
          error: "INTENT_REQUIRED",
          message: "Durable COMPLETED payment intent required — client paymentId/txid is not enough",
        },
        { status: 409 }
      )
    }

    if (intent.userId !== auth.userId) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 })
    }

    if (intent.status !== "COMPLETED" && intent.status !== "FULFILLED") {
      return NextResponse.json(
        { ok: false, error: "PAYMENT_NOT_COMPLETED", status: intent.status },
        { status: 409 }
      )
    }

    if (intent.currency && intent.currency !== "PI") {
      return NextResponse.json({ ok: false, error: "CURRENCY_MISMATCH" }, { status: 409 })
    }

    const expectedPi = getMembershipPiPrice(tier, paidMonths).chargePi
    if (Math.abs(Number(intent.amount) - expectedPi) > 0.001) {
      return NextResponse.json(
        { ok: false, error: "amount_mismatch", expected: expectedPi, actual: intent.amount },
        { status: 409 }
      )
    }

    // Durable intent must name the exact catalog product (tier+period). Do not
    // accept a bare purpose "membership" alone — that would let a VIP payment
    // activate VVIP (or vice versa) when amounts are not checked strictly enough.
    const productId = String(intent.metadata?.productId || "")
    const expected = `membership_${tier}_${period}`
    if (!productId || productId !== expected) {
      return NextResponse.json(
        { ok: false, error: "PRODUCT_MISMATCH", expected, productId: productId || null },
        { status: 409 }
      )
    }

    const purchaseRef =
      intent.providerPaymentId || paymentId || `pi:${intent.id}`

    // Payment intent is durable; entitlement table may still be missing in production.
    // Never report ok:true unless grantEntitlement persisted (or Studio memory path).
    try {
      const entitlement = await grantEntitlement({
        userId: auth.userId,
        tier,
        billingPeriod: period,
        source: "pi",
        purchaseRef,
        paymentIntentId: intent.id,
      })
      return NextResponse.json({ ok: true, entitlement })
    } catch (e) {
      const msg = e instanceof Error ? e.message : "MEMBERSHIP_DURABLE_WRITE_FAILED"
      const code =
        msg.includes("MEMBERSHIP_STORE_UNAVAILABLE") || msg.includes("MEMBERSHIP_DURABLE")
          ? msg.includes("STORE")
            ? "MEMBERSHIP_STORE_UNAVAILABLE"
            : "MEMBERSHIP_DURABLE_WRITE_FAILED"
          : "MEMBERSHIP_DURABLE_WRITE_FAILED"
      console.error("[membership/activate] grant after Pi payment failed", code)
      return NextResponse.json(
        {
          ok: false,
          error: code,
          message:
            "Payment was recorded, but membership entitlement could not be stored durably. Retry activation after ghc_membership_entitlements is available.",
          paymentIntentId: intent.id,
          purchaseRef,
        },
        { status: 503 }
      )
    }
  }

  // method === "ghc"
  const price = getMembershipGhcPrice(tier, paidMonths).chargeGhc
  const referenceId =
    String(body.spendReferenceId || "").trim() ||
    `membership_${tier}_${period}_${auth.userId}`

  if (isDatabaseConfigured()) {
    const now = Date.now()
    const accessMonths = paidMonths + 1
    const expiresAt = addCalendarMonths(now, accessMonths)
    const purchase = await rpcPurchaseMembership({
      userId: auth.userId,
      amount: price,
      referenceId,
      reason: `Membership ${tier} ${paidMonths}-month plan with one bonus month`,
      row: {
        user_id: auth.userId,
        tier,
        active: true,
        started_at: new Date(now).toISOString(),
        expires_at: new Date(expiresAt).toISOString(),
        billing_period: period,
        source: "ghc",
        purchase_ref: referenceId,
        payment_intent_id: null,
      },
    })
    if (!purchase.ok) {
      const status = purchase.error === "INSUFFICIENT_BALANCE" ? 402 : 503
      return NextResponse.json(
        {
          ok: false,
          error: purchase.error || "MEMBERSHIP_PURCHASE_FAILED",
          message:
            purchase.error === "INSUFFICIENT_BALANCE"
              ? "Insufficient GHC balance for this membership plan"
              : "Could not atomically complete GHC spend and membership entitlement",
        },
        { status }
      )
    }
    const loaded = await tryGetEntitlementAuthoritative(auth.userId)
    if (!loaded.ok) {
      return NextResponse.json(
        { ok: false, error: "MEMBERSHIP_DURABLE_WRITE_FAILED", message: "Purchase was committed but the entitlement read is temporarily unavailable. Refresh membership status; do not purchase again." },
        { status: 503 }
      )
    }
    void queueReferralReward({
      referredUserId: auth.userId,
      membershipReferenceId: referenceId,
      chargedGhc: price,
    }).catch(() => undefined)
    return NextResponse.json({ ok: true, entitlement: loaded.entitlement, spend: purchase.spend, idempotent: purchase.idempotent })
  }

  if (allowMemoryServer()) {
    const spend = await executeAuthoritativeSpend(getProcessGhcStore(), {
      userId: auth.userId,
      amount: price,
      referenceId,
      reason: `Membership ${tier} ${paidMonths}-month plan with one bonus month`,
      sourceEvent: "PREMIUM_PURCHASE",
    })
    if (!spend.ok) {
      return NextResponse.json(
        { ok: false, error: spend.error || "SPEND_FAILED" },
        { status: 400 }
      )
    }
    const entitlement = await grantEntitlement({
      userId: auth.userId,
      tier,
      billingPeriod: period,
      source: "ghc",
      purchaseRef: spend.tx?.id || referenceId,
    })
    void queueReferralReward({
      referredUserId: auth.userId,
      membershipReferenceId: String(spend.tx?.id || referenceId),
      chargedGhc: price,
    }).catch(() => undefined)
    return NextResponse.json({ ok: true, entitlement, spend: spend.tx })
  }

  return NextResponse.json(
    {
      ok: false,
      error: "SERVER_UNAVAILABLE",
      message: "GHC membership spend requires database or GHC_SERVER_MEMORY=1",
    },
    { status: 503 }
  )
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const result = await tryGetEntitlementAuthoritative(auth.userId)
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: "MEMBERSHIP_STORE_UNAVAILABLE" },
      { status: 503 }
    )
  }
  return NextResponse.json({
    ok: true,
    entitlement: result.entitlement,
    source: result.source,
  })
}
