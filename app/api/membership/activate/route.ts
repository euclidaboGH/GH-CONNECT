/**
 * POST /api/membership/activate
 * Server grants VIP/VVIP only after verified Pi intent COMPLETED or GHC catalog spend.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  getEntitlement,
  getEntitlementAuthoritative,
  grantEntitlement,
  MEMBERSHIP_SERVER_CATALOG,
} from "@/lib/server/membership/entitlement-store"
import {
  getPaymentIntent,
  loadPaymentIntent,
  loadByProviderPaymentId,
} from "@/lib/server/payments/intent-store"
import {
  executeAuthoritativeSpend,
  getProcessGhcStore,
} from "@/lib/server/economy/store"
import { allowMemoryServer, isDatabaseConfigured } from "@/lib/server/economy/http"
import { readGhcServerEnv as readEnv } from "@/lib/server/economy/env"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function rpcSpend(input: {
  userId: string
  amount: number
  referenceId: string
  reason: string
}): Promise<{ ok: boolean; error?: string; tx?: unknown; idempotent?: boolean }> {
  const env = readEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { ok: false, error: "SERVER_UNAVAILABLE" }
  }
  try {
    const res = await fetch(
      `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/ghc_execute_spend`,
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
          p_source_event: "PREMIUM_PURCHASE",
        }),
      }
    )
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok) {
      return { ok: false, error: String(data?.error || "SPEND_FAILED") }
    }
    return { ok: true, idempotent: Boolean(data.idempotent), tx: data.tx }
  } catch {
    return { ok: false, error: "SPEND_RPC_FAILED" }
  }
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const tier = String(body.tier || "").toLowerCase()
  const period = String(body.period || body.billingPeriod || "monthly").toLowerCase()
  const method = String(body.method || "").toLowerCase()

  if (tier !== "vip" && tier !== "vvip") {
    return NextResponse.json({ ok: false, error: "INVALID_TIER" }, { status: 400 })
  }
  if (period !== "monthly" && period !== "yearly") {
    return NextResponse.json({ ok: false, error: "INVALID_PERIOD" }, { status: 400 })
  }
  if (method !== "pi" && method !== "ghc") {
    return NextResponse.json({ ok: false, error: "INVALID_METHOD" }, { status: 400 })
  }

  const catalog = MEMBERSHIP_SERVER_CATALOG[tier as "vip" | "vvip"]

  if (method === "pi") {
    const intentId = String(body.intentId || "").trim()
    const paymentId = String(body.paymentId || "").trim()

    let intent =
      (intentId ? await loadPaymentIntent(intentId) : null) ||
      (paymentId ? await loadByProviderPaymentId(paymentId) : null) ||
      (intentId ? getPaymentIntent(intentId) : null)

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

    const expectedPi = period === "yearly" ? catalog.yearlyPi : catalog.monthlyPi
    if (Math.abs(Number(intent.amount) - expectedPi) > 0.001) {
      return NextResponse.json(
        { ok: false, error: "amount_mismatch", expected: expectedPi, actual: intent.amount },
        { status: 409 }
      )
    }

    const productId = String(intent.metadata?.productId || "")
    const expected = `membership_${tier}_${period}`
    if (productId && productId !== expected && intent.purpose !== "membership") {
      return NextResponse.json(
        { ok: false, error: "PRODUCT_MISMATCH", expected, productId },
        { status: 409 }
      )
    }

    const purchaseRef =
      intent.providerPaymentId || paymentId || `pi:${intent.id}`

    const entitlement = await grantEntitlement({
      userId: auth.userId,
      tier,
      billingPeriod: period,
      source: "pi",
      purchaseRef,
      paymentIntentId: intent.id,
    })

    return NextResponse.json({ ok: true, entitlement })
  }

  // method === "ghc"
  const price = period === "yearly" ? catalog.yearlyGhc : catalog.monthlyGhc
  const referenceId =
    String(body.spendReferenceId || "").trim() ||
    `membership_${tier}_${period}_${auth.userId}`

  if (isDatabaseConfigured()) {
    const spend = await rpcSpend({
      userId: auth.userId,
      amount: price,
      referenceId,
      reason: `Membership ${tier} ${period}`,
    })
    if (!spend.ok) {
      const status = spend.error === "INSUFFICIENT_BALANCE" ? 402 : 503
      return NextResponse.json({ ok: false, error: spend.error || "SPEND_FAILED" }, { status })
    }
    const entitlement = await grantEntitlement({
      userId: auth.userId,
      tier,
      billingPeriod: period,
      source: "ghc",
      purchaseRef: referenceId,
    })
    return NextResponse.json({ ok: true, entitlement, spend: spend.tx, idempotent: spend.idempotent })
  }

  if (allowMemoryServer()) {
    const spend = await executeAuthoritativeSpend(getProcessGhcStore(), {
      userId: auth.userId,
      amount: price,
      referenceId,
      reason: `Membership ${tier} ${period}`,
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
  return NextResponse.json({ ok: true, entitlement: await getEntitlementAuthoritative(auth.userId) })
}
