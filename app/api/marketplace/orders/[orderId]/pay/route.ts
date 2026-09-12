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

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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

    return NextResponse.json({
      ok: true,
      order: await loadOrder(order.id),
      spend: spendTx,
      idempotent,
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

    return NextResponse.json({
      ok: true,
      order: await loadOrder(order.id),
      durableOrders: marketplaceOrdersDurable(),
    })
  }

  return NextResponse.json({ ok: false, error: "INVALID_METHOD" }, { status: 400 })
}
