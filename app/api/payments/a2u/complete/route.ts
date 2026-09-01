/**
 * POST /api/payments/a2u/complete — mark A2U payment complete on Pi after chain txid known.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { updateOrderStatus, getOrder } from "@/lib/gh-pay/order-store"

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
    return NextResponse.json({ ok: false, error: "PI_API_KEY not configured" }, { status: 503 })
  }

  const body = await request.json().catch(() => ({}))
  const paymentId = String(body.paymentId || "").trim()
  const txid = String(body.txid || "").trim()
  const orderId = body.orderId != null ? String(body.orderId) : ""

  if (!paymentId || !txid) {
    return NextResponse.json(
      { ok: false, error: "paymentId and txid required" },
      { status: 400 }
    )
  }

  const res = await fetch(`${PI_API_BASE}/payments/${encodeURIComponent(paymentId)}/complete`, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ txid }),
  })

  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }

  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: "Pi complete failed", status: res.status, data },
      { status: 502 }
    )
  }

  if (orderId) {
    updateOrderStatus(orderId, "fulfilled", { paymentId, txid })
  }

  return NextResponse.json({ ok: true, payment: data, paymentId, txid })
}
