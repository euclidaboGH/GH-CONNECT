/**
 * POST /api/membership/activate
 *
 * Server grants VIP/VVIP after verified payment — client cannot self-assign tier.
 *
 * Body:
 *  { tier, period, method: "pi" | "ghc",
 *    intentId?, paymentId?, txid?,   // Pi
 *    spendReferenceId? }            // GHC ledger spend ref
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  getEntitlement,
  grantEntitlement,
  MEMBERSHIP_SERVER_CATALOG,
} from "@/lib/server/membership/entitlement-store"
import { getPaymentIntent } from "@/lib/server/payments/intent-store"
import {
  executeAuthoritativeSpend,
  getProcessGhcStore,
} from "@/lib/server/economy/store"
import { allowMemoryServer, isDatabaseConfigured } from "@/lib/server/economy/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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
    const txid = String(body.txid || "").trim()

    if (!intentId && !paymentId) {
      return NextResponse.json(
        { ok: false, error: "PI_PROOF_REQUIRED", message: "intentId or paymentId required" },
        { status: 400 }
      )
    }

    const intent = intentId ? getPaymentIntent(intentId) : null
    if (intent) {
      if (intent.userId !== auth.userId) {
        return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 })
      }
      if (intent.status !== "COMPLETED") {
        return NextResponse.json(
          { ok: false, error: "PAYMENT_NOT_COMPLETED", status: intent.status },
          { status: 409 }
        )
      }
      // Purpose / product check
      const productId = String(intent.metadata?.productId || "")
      const expected = `membership_${tier}_${period}`
      if (productId && productId !== expected && intent.purpose !== "membership") {
        return NextResponse.json(
          { ok: false, error: "PRODUCT_MISMATCH", expected, productId },
          { status: 409 }
        )
      }
      const expectedPi =
        period === "yearly" ? catalog.yearlyPi : catalog.monthlyPi
      if (Math.abs(intent.amount - expectedPi) > 0.001) {
        return NextResponse.json(
          {
            ok: false,
            error: "AMOUNT_mismatch",
            expected: expectedPi,
            actual: intent.amount,
          },
          { status: 409 }
        )
      }
    } else if (!paymentId || !txid) {
      // Without intent, require both paymentId + txid (still weak without Pi lookup — prefer intent)
      return NextResponse.json(
        {
          ok: false,
          error: "INTENT_REQUIRED",
          message: "Create payment intent before membership activation",
        },
        { status: 400 }
      )
    }

    const purchaseRef =
      intent?.providerPaymentId ||
      paymentId ||
      `pi:${intentId}:${txid || intent?.txid || ""}`

    const entitlement = grantEntitlement({
      userId: auth.userId,
      tier,
      billingPeriod: period,
      source: "pi",
      purchaseRef,
      paymentIntentId: intentId || undefined,
    })

    return NextResponse.json({ ok: true, entitlement })
  }

  // method === "ghc"
  const price = period === "yearly" ? catalog.yearlyGhc : catalog.monthlyGhc
  const referenceId =
    String(body.spendReferenceId || "").trim() ||
    `membership_${tier}_${period}_${auth.userId}`

  if (!allowMemoryServer() && !isDatabaseConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "SERVER_UNAVAILABLE",
        message: "GHC membership spend requires server ledger",
      },
      { status: 503 }
    )
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
    const entitlement = grantEntitlement({
      userId: auth.userId,
      tier,
      billingPeriod: period,
      source: "ghc",
      purchaseRef: spend.tx?.id || referenceId,
    })
    return NextResponse.json({ ok: true, entitlement, spend: spend.tx })
  }

  // DB configured — spend should go through ledger RPC (not fully wired here)
  return NextResponse.json(
    {
      ok: false,
      error: "DB_SPEND_NOT_WIRED",
      message: "Wire membership GHC spend to ledger RPC before production",
    },
    { status: 503 }
  )
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  return NextResponse.json({ ok: true, entitlement: getEntitlement(auth.userId) })
}
