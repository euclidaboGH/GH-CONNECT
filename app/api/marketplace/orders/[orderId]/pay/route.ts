/**
 * POST /api/marketplace/orders/[orderId]/pay
 * Body: { method: "ghc" | "pi", intentId?, paymentId?, txid? }
 *
 * Buyer identity = authenticated session only.
 * Amount = durable order.totalAmount only (never client).
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  loadOrder,
  claimOrderForPayment,
  releaseOrderPaymentClaim,
  transitionOrder,
  saveOrder,
  marketplaceOrdersDurable,
} from "@/lib/server/marketplace/order-store"
import { loadPaymentIntent } from "@/lib/server/payments/intent-store"
import {
  executeAuthoritativeSpend,
  getProcessGhcStore,
} from "@/lib/server/economy/store"
import { allowMemoryServer, isDatabaseConfigured } from "@/lib/server/economy/http"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { splitMarketplaceCommission } from "@/lib/server/marketplace/commission"
import { appendVerifiedCompanyRevenueEvent } from "@/lib/server/revenue/revenue-event"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"


async function recordPlatformCommission(order: {
  id: string
  totalAmount: number
  currency: string
  paymentMethod: string
}) {
  try {
    const split = splitMarketplaceCommission({
      grossAmount: order.totalAmount,
      currency: order.currency,
    })
    if ("error" in split) return null
    const fee = split.platformFeeMinor
    if (!(fee > 0)) return split
    // Revenue journal only when fee is in PI (company revenue). GHC fees stay utility.
    if (String(order.currency).toUpperCase() === "PI" || order.paymentMethod === "pi") {
      await appendVerifiedCompanyRevenueEvent({
        idempotencyKey: `mkt_fee:${order.id}`,
        sourceProvider: "pi",
        sourceEventId: order.id,
        eventType: "marketplace_fee",
        currency: "PI",
        grossAmountMinor: Math.round(split.grossMinor * 1e7),
        companyRevenueMinor: Math.round(fee * 1e7),
        sourceReference: `order:${order.id}`,
        verifiedAt: new Date().toISOString(),
        metadata: { order_id: order.id },
      })
    }
    return split
  } catch {
    return null
  }
}

async function rpcGhcSpend(input: {
  userId: string
  amount: number
  referenceId: string
  reason: string
  sourceEvent: string
}): Promise<{ ok: boolean; idempotent?: boolean; tx?: unknown; error?: string }> {
  const env = readGhcServerEnv()
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
          p_source_event: input.sourceEvent,
        }),
      }
    )
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      const err =
        data && typeof data === "object" && "message" in data
          ? String((data as { message: string }).message)
          : "SPEND_FAILED"
      return { ok: false, error: err }
    }
    if (data && typeof data === "object" && (data as { ok?: boolean }).ok === false) {
      return {
        ok: false,
        error: String((data as { error?: string }).error || "SPEND_FAILED"),
      }
    }
    return {
      ok: true,
      idempotent: Boolean(data && (data as { idempotent?: boolean }).idempotent),
      tx: data,
    }
  } catch {
    return { ok: false, error: "SPEND_FAILED" }
  }
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ orderId: string }> }
) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const { orderId } = await ctx.params
  const order = await loadOrder(orderId)
  if (!order) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 })
  }
  if (order.buyerId !== auth.userId) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 })
  }

  // Idempotent recovery must run BEFORE the payable-status narrow.
  // After a successful pay, status is no longer created|payment_pending.
  if (
    order.paymentStatus === "verified" &&
    order.ghcSpendRef &&
    (order.status === "payment_verified" ||
      order.status === "confirmed" ||
      order.status === "fulfilling" ||
      order.status === "completed")
  ) {
    return NextResponse.json({ ok: true, order, idempotent: true, recovered: true })
  }

  if (order.status !== "payment_pending" && order.status !== "created") {
    return NextResponse.json(
      { ok: false, error: "NOT_PAYABLE", status: order.status },
      { status: 409 }
    )
  }

  const body = await request.json().catch(() => ({}))
  const method = String(body.method || "").toLowerCase()
  const orderCurrency = String(order.currency || "GHC").toUpperCase()
  if (!(["GHC", "PI"].includes(orderCurrency)) || method !== orderCurrency.toLowerCase()) {
    return NextResponse.json(
      { ok: false, error: "PAYMENT_CURRENCY_MISMATCH", expected: orderCurrency },
      { status: 409 }
    )
  }
  // Ignore client amount/balance claims
  void body.amount
  void body.balance
  void body.userId

  if (method === "ghc") {
    const amount = Number(order.totalAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: "INVALID_ORDER_AMOUNT" }, { status: 400 })
    }

    const referenceId = `market_order_${order.id}`
    const reason = `Marketplace order ${order.listingTitle || order.id}`

    // Atomically claim the live stock reservation before the ledger spend. This prevents
    // the expiry worker from releasing stock while payment is being processed.
    const claim = await claimOrderForPayment(order.id, auth.userId, "ghc")
    if (!claim.ok) {
      const status = claim.error === "NOT_FOUND" ? 404 :
        claim.error === "FORBIDDEN" ? 403 :
        claim.error === "PAYMENT_IN_PROGRESS" || claim.error === "NOT_PAYABLE" || claim.error === "RESERVATION_EXPIRED" ? 409 : 503
      return NextResponse.json({ ok: false, error: claim.error }, { status })
    }

    let spendOk = false
    let spendTx: unknown = null
    let spendError = "SPEND_FAILED"
    let idempotent = false

    if (isDatabaseConfigured()) {
      const rpc = await rpcGhcSpend({
        userId: auth.userId,
        amount,
        referenceId,
        reason,
        sourceEvent: "MARKETPLACE_PURCHASE",
      })
      spendOk = rpc.ok
      spendTx = rpc.tx
      spendError = rpc.error || "SPEND_FAILED"
      idempotent = Boolean(rpc.idempotent)
    } else if (allowMemoryServer()) {
      const spend = await executeAuthoritativeSpend(getProcessGhcStore(), {
        userId: auth.userId,
        amount,
        referenceId,
        reason,
        sourceEvent: "MARKETPLACE_PURCHASE",
      })
      if (spend.ok) {
        spendOk = true
        spendTx = spend.tx
        idempotent = Boolean(spend.idempotent)
      } else {
        spendError = spend.error || "SPEND_FAILED"
      }
    } else {
      return NextResponse.json(
        {
          ok: false,
          error: "SERVER_UNAVAILABLE",
          message: "Marketplace GHC spend requires database configuration",
        },
        { status: 503 }
      )
    }

    if (!spendOk) {
      // Release only on a definite insufficient-balance result. A transport/server error
      // may have happened after the ledger committed; keep the claim for idempotent recovery
      // rather than releasing stock while the payment outcome is ambiguous.
      if (spendError === "INSUFFICIENT_BALANCE") {
        await releaseOrderPaymentClaim(order.id, auth.userId, spendError)
      }
      const status = spendError === "INSUFFICIENT_BALANCE" ? 402 : 400
      return NextResponse.json({ ok: false, error: spendError }, { status })
    }

    order.paymentMethod = "ghc"
    order.paymentStatus = "verified"
    order.ghcSpendRef = referenceId
    order.updatedAt = Date.now()
    order.audit = [
      ...(order.audit || []),
      { at: Date.now(), action: "PAY_GHC", detail: referenceId },
    ]
    const saved = await saveOrder(order)
    if (!saved.ok) {
      return NextResponse.json(
        { ok: false, error: "ORDER_PERSIST_FAILED", detail: saved.error },
        { status: 503 }
      )
    }

    const v = await transitionOrder(order.id, "payment_verified", auth.userId, "ghc")
    if (!v.ok) {
      return NextResponse.json({ ok: false, error: v.error }, { status: 409 })
    }
    await transitionOrder(order.id, "confirmed", "system", "payment_auto_confirm")

    const commission = await recordPlatformCommission({
      id: order.id,
      totalAmount: order.totalAmount,
      currency: String(order.currency || "GHC"),
      paymentMethod: "ghc",
    })
    return NextResponse.json({
      ok: true,
      order: await loadOrder(order.id),
      spend: spendTx,
      idempotent,
      commission,
      durableOrders: marketplaceOrdersDurable(),
    })
  }

  if (method === "pi") {
    const intentId = String(body.intentId || "").trim()
    const paymentId = String(body.paymentId || "").trim()
    const txid = String(body.txid || "").trim()

    if (!intentId) {
      return NextResponse.json(
        { ok: false, error: "INTENT_REQUIRED", message: "Complete GH Pay intent first" },
        { status: 400 }
      )
    }

    const intent = (await loadPaymentIntent(intentId)) || null
    if (!intent || intent.userId !== auth.userId) {
      return NextResponse.json({ ok: false, error: "INTENT_NOT_FOUND" }, { status: 404 })
    }
    // A completed intent is not sufficient by itself: bind it to this marketplace
    // order so one same-user/same-amount intent cannot pay for multiple orders.
    if (
      intent.purpose !== "marketplace" ||
      ![order.id, `market_order_${order.id}`].includes(String(intent.referenceId || ""))
    ) {
      return NextResponse.json(
        { ok: false, error: "PAYMENT_INTENT_ORDER_MISMATCH" },
        { status: 409 }
      )
    }
    if (intent.status !== "COMPLETED" && intent.status !== "FULFILLED") {
      return NextResponse.json(
        { ok: false, error: "PAYMENT_NOT_COMPLETED", status: intent.status },
        { status: 409 }
      )
    }
    if (Math.abs(intent.amount - order.totalAmount) > 0.001 && order.currency === "PI") {
      return NextResponse.json(
        {
          ok: false,
          error: "amount_mismatch",
          expected: order.totalAmount,
          actual: intent.amount,
        },
        { status: 409 }
      )
    }

    // The Pi intent must already be completed and amount-matched before claiming the
    // reservation. Once claimed, the expiry worker cannot release this stock mid-fulfilment.
    const claim = await claimOrderForPayment(order.id, auth.userId, "pi")
    if (!claim.ok) {
      const status = claim.error === "NOT_FOUND" ? 404 :
        claim.error === "FORBIDDEN" ? 403 :
        claim.error === "PAYMENT_IN_PROGRESS" || claim.error === "NOT_PAYABLE" || claim.error === "RESERVATION_EXPIRED" ? 409 : 503
      return NextResponse.json({ ok: false, error: claim.error }, { status })
    }

    order.paymentMethod = "pi"
    order.paymentStatus = "verified"
    order.paymentIntentId = intentId
    order.paymentId = intent.providerPaymentId || paymentId
    order.txid = intent.txid || txid
    order.updatedAt = Date.now()
    order.audit = [
      ...(order.audit || []),
      { at: Date.now(), action: "PAY_PI", detail: intentId },
    ]
    const saved = await saveOrder(order)
    if (!saved.ok) {
      return NextResponse.json(
        { ok: false, error: "ORDER_PERSIST_FAILED", detail: saved.error },
        { status: 503 }
      )
    }

    await transitionOrder(order.id, "payment_verified", auth.userId, "pi")
    await transitionOrder(order.id, "confirmed", "system", "payment_auto_confirm")

    const commission = await recordPlatformCommission({
      id: order.id,
      totalAmount: order.totalAmount,
      currency: String(order.currency || "PI"),
      paymentMethod: "pi",
    })
    return NextResponse.json({
      ok: true,
      order: await loadOrder(order.id),
      commission,
      durableOrders: marketplaceOrdersDurable(),
    })
  }

  return NextResponse.json({ ok: false, error: "INVALID_METHOD" }, { status: 400 })
}
