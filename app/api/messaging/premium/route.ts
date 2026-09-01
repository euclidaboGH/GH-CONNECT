/**
 * POST /api/messaging/premium
 * Purchase optional messaging utility with GHC (server ledger).
 * Never required for basic sendMessage.
 *
 * Body: { productId, referenceId?, metadata? }
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  getMessagingPremiumProduct,
  MESSAGING_FREE_GUARANTEE,
} from "@/lib/domains/messaging-premium"
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
  const productId = String(body.productId || "").trim()
  const product = getMessagingPremiumProduct(productId)
  if (!product) {
    return NextResponse.json({ ok: false, error: "UNKNOWN_PRODUCT" }, { status: 400 })
  }

  if (product.priceGhc <= 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "MEMBERSHIP_ONLY",
        message: "This feature is unlocked by membership, not a direct GHC charge",
        guarantee: MESSAGING_FREE_GUARANTEE,
      },
      { status: 400 }
    )
  }

  const referenceId =
    String(body.referenceId || "").trim() ||
    `msg_premium_${productId}_${auth.userId}_${Date.now()}`

  if (!allowMemoryServer()) {
    return NextResponse.json(
      {
        ok: false,
        error: isDatabaseConfigured() ? "DB_SPEND_NOT_WIRED" : "SERVER_UNAVAILABLE",
        guarantee: MESSAGING_FREE_GUARANTEE,
      },
      { status: 503 }
    )
  }

  const spend = await executeAuthoritativeSpend(getProcessGhcStore(), {
    userId: auth.userId,
    amount: product.priceGhc,
    referenceId,
    reason: product.title,
    sourceEvent: "MESSAGING_PREMIUM",
  })

  if (!spend.ok) {
    return NextResponse.json(
      { ok: false, error: spend.error || "SPEND_FAILED", guarantee: MESSAGING_FREE_GUARANTEE },
      { status: 400 }
    )
  }

  return NextResponse.json({
    ok: true,
    productId: product.id,
    amountGhc: product.priceGhc,
    referenceId,
    transaction: spend.tx,
    entitlement: {
      productId: product.id,
      userId: auth.userId,
      grantedAt: Date.now(),
      metadata: body.metadata || {},
    },
    guarantee: MESSAGING_FREE_GUARANTEE,
  })
}

export async function GET() {
  const { listMessagingPremiumProducts, MESSAGING_FREE_GUARANTEE } = await import(
    "@/lib/domains/messaging-premium"
  )
  return NextResponse.json({
    ok: true,
    guarantee: MESSAGING_FREE_GUARANTEE,
    products: listMessagingPremiumProducts(),
  })
}
