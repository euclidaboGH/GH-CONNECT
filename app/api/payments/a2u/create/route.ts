/**
 * POST /api/payments/a2u/create — App-to-User payment intent via Pi Platform API.
 * Creates payment on Pi servers; blockchain submit requires app wallet seed (separate step).
 *
 * Body: { amount, memo, uid (recipient Pi uid), metadata?, productId? }
 * Auth: server PI_API_KEY + authenticated admin/system caller preferred.
 *
 * A2U is available per Pi docs (testnet historically); production requires wallet seed
 * for chain submit — set PI_WALLET_PRIVATE_SEED only on server, never client.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { genOrderId, saveOrder } from "@/lib/gh-pay/order-store"
import type { GhPayOrder } from "@/lib/gh-pay/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const PI_API_BASE = "https://api.minepi.com/v2"

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const apiKey = (process.env.PI_API_KEY || process.env.PI_SERVER_API_KEY || "").trim()
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "PI_API_KEY not configured" },
      { status: 503 }
    )
  }

  const body = await request.json().catch(() => ({}))
  const amount = Number(body.amount)
  const memo = String(body.memo || "GreenHaven payout").slice(0, 128)
  const uid = String(body.uid || body.recipientUid || "").trim()
  const metadata =
    typeof body.metadata === "object" && body.metadata ? body.metadata : {}

  if (!uid) {
    return NextResponse.json({ ok: false, error: "recipient uid required" }, { status: 400 })
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000) {
    return NextResponse.json({ ok: false, error: "Invalid amount" }, { status: 400 })
  }

  // Create A2U payment on Pi Platform
  // Some API versions wrap as { payment: {...} }
  const payloads = [
    { amount, memo, metadata: { ...metadata, engine: "gh_pay", direction: "a2u" }, uid },
    {
      payment: {
        amount,
        memo,
        metadata: { ...metadata, engine: "gh_pay", direction: "a2u" },
        uid,
      },
    },
  ]

  let paymentData: Record<string, unknown> | null = null
  let lastErr = ""
  for (const payload of payloads) {
    try {
      const res = await fetch(`${PI_API_BASE}/payments`, {
        method: "POST",
        headers: {
          Authorization: `Key ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
      const text = await res.text()
      let data: Record<string, unknown> = {}
      try {
        data = text ? JSON.parse(text) : {}
      } catch {
        data = { raw: text }
      }
      if (res.ok) {
        paymentData = data
        break
      }
      lastErr = typeof data === "object" ? JSON.stringify(data).slice(0, 200) : text
    } catch (e) {
      lastErr = e instanceof Error ? e.message : "network"
    }
  }

  if (!paymentData) {
    return NextResponse.json(
      {
        ok: false,
        error: "Pi A2U create failed",
        detail: lastErr,
        hint: "Confirm API key, recipient uid, and network (A2U may be testnet-only depending on Pi status)",
      },
      { status: 502 }
    )
  }

  const paymentId = String(
    paymentData.identifier ||
      paymentData.paymentId ||
      (paymentData.payment as { identifier?: string })?.identifier ||
      ""
  )

  const orderId = genOrderId()
  const order: GhPayOrder = {
    orderId,
    direction: "a2u",
    productId: String(body.productId || "a2u_seller_payout"),
    category: "seller_payout",
    amountPi: amount,
    memo,
    userId: auth.userId,
    recipientUid: uid,
    status: "awaiting_completion",
    paymentId: paymentId || undefined,
    fulfillment: { type: "payout", reason: String(body.reason || "payout") },
    metadata: { ...metadata, piResponse: paymentData },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  saveOrder(order)

  return NextResponse.json({
    ok: true,
    order,
    payment: paymentData,
    paymentId,
    /**
     * Next steps for full A2U:
     * 1. Submit blockchain tx with app wallet (PI_WALLET_PRIVATE_SEED) — use official pi-nodejs SDK
     * 2. POST /api/payments/a2u/complete with { paymentId, txid }
     */
    next: "submit_blockchain_then_complete",
    walletSeedConfigured: Boolean(process.env.PI_WALLET_PRIVATE_SEED),
  })
}
