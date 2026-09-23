/**
 * POST /api/economy/ledger/spend
 * Server-authoritative GHC debit (membership, boosts, catalog spends).
 * Amount from spend-catalog — client amount cannot inflate charge.
 */
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  allowMemoryServer,
  isDatabaseConfigured,
  jsonErr,
  jsonOk,
} from "@/lib/server/economy/http"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { checkRateLimit, pruneRateLimitBuckets } from "@/lib/server/economy/rate-limit"
import { resolveSpendAmount } from "@/lib/server/economy/spend-catalog"
import {
  executeAuthoritativeSpend,
  getProcessGhcStore,
} from "@/lib/server/economy/store"
import { requireRecentStepUp } from "@/lib/server/identity/step-up-store"
import { loadOrder } from "@/lib/server/marketplace/order-store"

async function rpcSpend(input: {
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
    if (!res.ok || !data) {
      return { ok: false, error: "SPEND_RPC_FAILED" }
    }
    if (data.ok === false) {
      return { ok: false, error: String(data.error || "SPEND_FAILED") }
    }
    return {
      ok: true,
      idempotent: Boolean(data.idempotent),
      tx: data.tx || { id: data.transactionId, referenceId: data.referenceId },
    }
  } catch {
    return { ok: false, error: "SPEND_RPC_FAILED" }
  }
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return jsonErr("AUTH_REQUIRED", "Authentication required", 401)

  // Phase 4: server-verifiable step-up required for GHC spends
  const stepUpErr = await requireRecentStepUp(auth)
  if (stepUpErr) {
    return jsonErr(stepUpErr.code, stepUpErr.message, stepUpErr.status)
  }

  pruneRateLimitBuckets()
  const rl = checkRateLimit(`spend:${auth.userId}`, 20, 60_000)
  if (!rl.ok) {
    return jsonErr("RATE_LIMITED", `Too many spend attempts; retry in ${rl.retryAfterSec}s`, 429)
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonErr("INVALID_INPUT", "Invalid JSON body", 400)
  }

  // Buyer is ONLY auth.userId — ignore client identity/balance/price claims
  void body.userId
  void body.senderId
  void body.balance
  void body.price
  void body.unitPrice
  void body.totalAmount

  const purposeRaw = String(body.purpose || body.sourceEvent || "").trim()
  const purpose = purposeRaw.toLowerCase()
  const clientAmount = Number(body.amount)
  const kind = (body.kind as "spent" | "purchased" | undefined) || "spent"

  /**
   * Marketplace GHC spend must bind to a durable order total.
   * Preferred path remains POST /api/marketplace/orders/[orderId]/pay.
   * This branch exists only so ledger/spend cannot underpay via client amount.
   */
  if (purpose === "marketplace") {
    const orderId = String(body.orderId || body.listingOrderId || "").trim()
    if (!orderId) {
      return jsonErr(
        "ORDER_REQUIRED",
        "Marketplace GHC spend requires orderId. Create an order (POST /api/marketplace/orders) then pay via /api/marketplace/orders/[orderId]/pay or pass orderId here.",
        400
      )
    }
    const order = await loadOrder(orderId)
    if (!order) {
      return jsonErr("ORDER_NOT_FOUND", "Marketplace order not found", 404)
    }
    if (order.buyerId !== auth.userId) {
      return jsonErr("FORBIDDEN", "You can only pay for your own marketplace order", 403)
    }
    if (String(order.currency || "GHC").toUpperCase() !== "GHC") {
      return jsonErr(
        "CURRENCY_MISMATCH",
        "This order is not priced in GHC; use the order Pi pay path",
        409
      )
    }
    const payable =
      order.status === "created" ||
      order.status === "payment_pending" ||
      (order.paymentStatus === "pending" && order.status !== "cancelled")
    if (!payable && order.paymentStatus !== "verified") {
      return jsonErr(
        "ORDER_NOT_PAYABLE",
        `Order status ${order.status}/${order.paymentStatus} is not payable`,
        409
      )
    }
    const amount = Number(order.totalAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      return jsonErr("INVALID_ORDER_AMOUNT", "Order total is invalid", 400)
    }
    // Stable idempotency key — same as order pay route
    const referenceId = `market_order_${order.id}`
    const reason = `Marketplace order ${order.listingTitle || order.id}`

    if (isDatabaseConfigured()) {
      const rpc = await rpcSpend({
        userId: auth.userId,
        amount,
        referenceId,
        reason,
        sourceEvent: "MARKETPLACE_PURCHASE",
      })
      if (!rpc.ok) {
        const status = rpc.error === "INSUFFICIENT_BALANCE" ? 402 : 503
        return jsonErr(rpc.error || "SPEND_FAILED", rpc.error || "Spend failed", status)
      }
      return jsonOk({
        ok: true,
        idempotent: rpc.idempotent,
        transaction: rpc.tx,
        amount,
        purpose: "marketplace",
        orderId: order.id,
        referenceId,
      })
    }

    if (!allowMemoryServer()) {
      return jsonErr(
        "SERVER_UNAVAILABLE",
        "Authoritative GHC spend requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. In-memory spend is disabled on this deployment.",
        503
      )
    }

    const result = await executeAuthoritativeSpend(getProcessGhcStore(), {
      userId: auth.userId,
      amount,
      referenceId,
      reason,
      sourceEvent: "MARKETPLACE_PURCHASE",
      kind,
    })
    if (!result.ok) {
      const status = result.error === "INSUFFICIENT_BALANCE" ? 402 : 400
      return jsonErr(result.error, result.error, status)
    }
    return jsonOk({
      ok: true,
      idempotent: result.idempotent,
      transaction: result.tx,
      amount,
      purpose: "marketplace",
      orderId: order.id,
      referenceId,
    })
  }

  const referenceId = String(body.referenceId || "").trim()
  const reason = String(body.reason || "Purchase").trim()

  if (!referenceId) return jsonErr("INVALID_INPUT", "referenceId required", 400)

  // Catalog resolves authoritative price for fixed purposes (client amount ignored/mismatched)
  const resolved = resolveSpendAmount(purposeRaw, clientAmount)
  if (!resolved.ok) {
    return jsonErr(resolved.error, resolved.error, 400)
  }

  if (isDatabaseConfigured()) {
    const rpc = await rpcSpend({
      userId: auth.userId,
      amount: resolved.amount,
      referenceId,
      reason: reason || resolved.entry.description,
      sourceEvent: resolved.entry.purpose,
    })
    if (!rpc.ok) {
      const status = rpc.error === "INSUFFICIENT_BALANCE" ? 402 : 503
      return jsonErr(rpc.error || "SPEND_FAILED", rpc.error || "Spend failed", status)
    }
    return jsonOk({
      ok: true,
      idempotent: rpc.idempotent,
      transaction: rpc.tx,
      amount: resolved.amount,
      purpose: resolved.entry.purpose,
      baseGhc: resolved.entry.baseGhc,
      feeGhc: resolved.entry.feeGhc,
    })
  }

  if (!allowMemoryServer()) {
    return jsonErr(
      "SERVER_UNAVAILABLE",
      "Authoritative GHC spend requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. In-memory spend is disabled on this deployment.",
      503
    )
  }

  const result = await executeAuthoritativeSpend(getProcessGhcStore(), {
    userId: auth.userId,
    amount: resolved.amount,
    referenceId,
    reason: reason || resolved.entry.description,
    sourceEvent: resolved.entry.purpose,
    kind,
  })
  if (!result.ok) {
    const status = result.error === "INSUFFICIENT_BALANCE" ? 402 : 400
    return jsonErr(result.error, result.error, status)
  }

  return jsonOk({
    ok: true,
    idempotent: result.idempotent,
    transaction: result.tx,
    amount: resolved.amount,
    purpose: resolved.entry.purpose,
    baseGhc: resolved.entry.baseGhc,
    feeGhc: resolved.entry.feeGhc,
  })
}
