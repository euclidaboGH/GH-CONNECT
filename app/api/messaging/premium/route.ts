/**
 * POST /api/messaging/premium
 * Purchase optional messaging utility with GHC (server ledger).
 * Never required for basic sendMessage.
 *
 * Body: { productId, referenceId?, metadata? }
 *
 * Spend path:
 * - Production / DB configured → durable ghc_execute_spend RPC
 * - Local/dev memory allowed → process store
 * Never invents success without a ledger write.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  getMessagingPremiumProduct,
  MESSAGING_FREE_GUARANTEE,
} from "@/lib/domains/messaging-premium"
import {
  executeAuthoritativeSpend,
  executeDurableGhcSpend,
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

  const spendInput = {
    userId: auth.userId,
    amount: product.priceGhc,
    referenceId,
    reason: product.title,
    sourceEvent: "MESSAGING_PREMIUM",
  }

  if (isDatabaseConfigured()) {
    const spend = await executeDurableGhcSpend(spendInput)
    if (!spend.ok) {
      const status =
        spend.error === "SERVER_UNAVAILABLE" || spend.error === "INSUFFICIENT_BALANCE"
          ? spend.error === "INSUFFICIENT_BALANCE"
            ? 400
            : 503
          : 400
      return NextResponse.json(
        {
          ok: false,
          error: spend.error || "SPEND_FAILED",
          guarantee: MESSAGING_FREE_GUARANTEE,
        },
        { status }
      )
    }
    return NextResponse.json({
      ok: true,
      productId: product.id,
      amountGhc: product.priceGhc,
      referenceId,
      transaction: spend.tx || null,
      idempotent: spend.idempotent,
      durable: true,
      entitlement: {
        productId: product.id,
        userId: auth.userId,
        grantedAt: Date.now(),
        metadata: body.metadata || {},
      },
      guarantee: MESSAGING_FREE_GUARANTEE,
    })
  }

  if (!allowMemoryServer()) {
    return NextResponse.json(
      {
        ok: false,
        error: "SERVER_UNAVAILABLE",
        message: "Messaging premium spend requires durable ledger configuration.",
        guarantee: MESSAGING_FREE_GUARANTEE,
      },
      { status: 503 }
    )
  }

  const spend = await executeAuthoritativeSpend(getProcessGhcStore(), spendInput)
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
    durable: false,
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
