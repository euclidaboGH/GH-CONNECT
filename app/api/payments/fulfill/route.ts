/**
 * POST /api/payments/fulfill
 * Grant benefit only when durable intent is COMPLETED and owned by caller.
 * Client paymentId/txid alone is never sufficient.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  loadByProviderPaymentId,
  loadPaymentIntent,
  markIntentFulfilled,
  getPaymentIntent,
} from "@/lib/server/payments/intent-store"
import { piGetPayment, getPiApiKey } from "@/lib/server/payments/pi-api"
import { tryGrantMembershipFromCompletedIntent } from "@/lib/server/membership/entitlement-store"
import { getGhcPack, isGhcPackProductId } from "@/lib/server/economy/ghc-pack-catalog"
import { buyGhcWithPiEnabled } from "@/lib/server/economy/testnet-unlock"
import {
  allowMemoryServer,
  isDatabaseConfigured,
} from "@/lib/server/economy/http"
import {
  executeAuthoritativePackPurchase,
  getProcessGhcStore,
} from "@/lib/server/economy/store"
import { readGhcServerEnv } from "@/lib/server/economy/env"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const auth = await resolveAuthenticatedUser(request.headers)
    if (!auth) {
      return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const paymentId = typeof body.paymentId === "string" ? body.paymentId.trim() : ""
    const txid = typeof body.txid === "string" ? body.txid.trim() : ""
    const intentId = typeof body.intentId === "string" ? body.intentId.trim() : ""

    if (!paymentId && !intentId) {
      return NextResponse.json(
        { ok: false, error: "intentId or paymentId required" },
        { status: 400 }
      )
    }

    let intent =
      (intentId ? await loadPaymentIntent(intentId) : null) ||
      (paymentId ? await loadByProviderPaymentId(paymentId) : null)

    if (!intent) {
      return NextResponse.json(
        {
          ok: false,
          error: "INTENT_NOT_FOUND",
          message: "No durable completed payment intent — refuse fulfillment",
        },
        { status: 409 }
      )
    }

    if (intent.userId !== auth.userId) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 })
    }

    if (paymentId && intent.providerPaymentId && intent.providerPaymentId !== paymentId) {
      return NextResponse.json({ ok: false, error: "PAYMENT_MISMATCH" }, { status: 409 })
    }

    if (intent.status === "FULFILLED") {
      // Idempotent fulfill — still ensure membership entitlement exists
      let membershipGrant: {
        granted: boolean
        error?: string
        skipped?: boolean
        tier?: string
      } | null = null
      try {
        const result = await tryGrantMembershipFromCompletedIntent({
          userId: auth.userId,
          intent: {
            id: intent.id,
            userId: intent.userId,
            purpose: intent.purpose,
            status: intent.status,
            amount: intent.amount,
            currency: intent.currency,
            providerPaymentId: intent.providerPaymentId,
            metadata: intent.metadata,
          },
        })
        membershipGrant = {
          granted: result.granted,
          error: result.error,
          skipped: result.skipped,
          tier: result.entitlement?.tier,
        }
      } catch {
        /* */
      }
      return NextResponse.json({
        ok: true,
        idempotent: true,
        paymentId: intent.providerPaymentId,
        intent: getPaymentIntent(intent.id),
        message: "Already fulfilled",
        membership: membershipGrant,
      })
    }

    if (intent.status !== "COMPLETED") {
      return NextResponse.json(
        {
          ok: false,
          error: "PAYMENT_NOT_COMPLETED",
          status: intent.status,
          message: "Fulfillment requires COMPLETED durable intent",
        },
        { status: 409 }
      )
    }

    if (txid && intent.txid && intent.txid !== txid) {
      return NextResponse.json({ ok: false, error: "TXID_MISMATCH" }, { status: 409 })
    }

    if (getPiApiKey() && intent.providerPaymentId) {
      const lookup = await piGetPayment(intent.providerPaymentId)
      if (lookup.ok && lookup.payment) {
        const st = lookup.payment.status
        if (st?.cancelled || st?.user_cancelled) {
          return NextResponse.json(
            { ok: false, error: "payment_cancelled_on_pi" },
            { status: 409 }
          )
        }
      }
    }

    const fulfilled = await markIntentFulfilled(intent.id, auth.userId)
    const finalIntent = fulfilled || getPaymentIntent(intent.id) || intent

    // Membership: grant from verified COMPLETED→FULFILLED intent (idempotent).
    // Safety net when client never reaches /api/membership/activate.
    let membershipGrant: {
      granted: boolean
      error?: string
      skipped?: boolean
      tier?: string
    } | null = null
    try {
      const result = await tryGrantMembershipFromCompletedIntent({
        userId: auth.userId,
        intent: {
          id: finalIntent.id,
          userId: finalIntent.userId,
          purpose: finalIntent.purpose,
          status: finalIntent.status || "FULFILLED",
          amount: finalIntent.amount,
          currency: finalIntent.currency,
          providerPaymentId: finalIntent.providerPaymentId,
          metadata: finalIntent.metadata,
        },
      })
      membershipGrant = {
        granted: result.granted,
        error: result.error,
        skipped: result.skipped,
        tier: result.entitlement?.tier,
      }
      if (!result.granted && !result.skipped) {
        console.error(
          "[payments/fulfill] membership grant deferred",
          result.error,
          finalIntent.id
        )
      }
    } catch (e) {
      console.error(
        "[payments/fulfill] membership grant error",
        e instanceof Error ? e.message : e
      )
      membershipGrant = {
        granted: false,
        error: e instanceof Error ? e.message : "GRANT_FAILED",
      }
    }


    // Phase 3: governed GHC pack credit when product is a pack
    let ghcPackGrant: {
      granted: boolean
      alreadyCredited?: boolean
      ghcAmount?: number
      productId?: string
      error?: string
    } | null = null
    try {
      const metaProduct = String(finalIntent.metadata?.productId || "").trim()
      const ref = String(finalIntent.referenceId || "")
      const packId =
        (isGhcPackProductId(metaProduct) && metaProduct) ||
        (ref.startsWith("ghc_pack_") ? ref.split(":")[0] : "") ||
        (isGhcPackProductId(ref) ? ref : "")
      if (packId && buyGhcWithPiEnabled()) {
        const pack = getGhcPack(packId)
        if (pack && Number(finalIntent.amount) === pack.piAmount) {
          const referenceId = `pi_pack:${finalIntent.id}:${pack.productId}`
          const reason = `Pi pack ${pack.label}`
          if (isDatabaseConfigured()) {
            const env = readGhcServerEnv()
            const res = await fetch(
              `${env.supabaseUrl!.replace(/\/$/, "")}/rest/v1/rpc/ghc_credit_pack_purchase`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  apikey: env.supabaseServiceRoleKey!,
                  Authorization: `Bearer ${env.supabaseServiceRoleKey!}`,
                },
                body: JSON.stringify({
                  p_user_id: auth.userId,
                  p_amount: pack.ghcAmount,
                  p_reference_id: referenceId,
                  p_reason: reason,
                  p_product_id: pack.productId,
                  p_intent_id: finalIntent.id,
                }),
              }
            )
            const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
            if (res.ok && data && data.ok !== false) {
              ghcPackGrant = {
                granted: true,
                alreadyCredited: Boolean(data.alreadyCredited || data.idempotent),
                ghcAmount: pack.ghcAmount,
                productId: pack.productId,
              }
            } else {
              ghcPackGrant = {
                granted: false,
                error: String((data && data.error) || "CREDIT_FAILED"),
                productId: pack.productId,
              }
            }
          } else if (allowMemoryServer()) {
            const result = await executeAuthoritativePackPurchase(getProcessGhcStore(), {
              userId: auth.userId,
              amount: pack.ghcAmount,
              referenceId,
              reason,
              productId: pack.productId,
              intentId: finalIntent.id,
            })
            ghcPackGrant = result.ok
              ? {
                  granted: true,
                  alreadyCredited: Boolean(result.idempotent),
                  ghcAmount: pack.ghcAmount,
                  productId: pack.productId,
                }
              : { granted: false, error: result.error, productId: pack.productId }
          }
        }
      }
    } catch (e) {
      ghcPackGrant = {
        granted: false,
        error: e instanceof Error ? e.message : "PACK_GRANT_FAILED",
      }
    }

    return NextResponse.json({
      ok: true,
      paymentId: intent.providerPaymentId,
      txid: intent.txid || txid || null,
      intent: finalIntent,
      productId: intent.metadata?.productId || null,
      referenceId: intent.referenceId,
      membership: membershipGrant,
      ghcPack: ghcPackGrant,
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "fulfill_failed" },
      { status: 500 }
    )
  }
}
