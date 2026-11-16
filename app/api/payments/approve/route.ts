/**
 * POST /api/payments/approve
 * Body: { paymentId, intentId? }
 * Binds Pi payment to server intent, verifies amount/purpose, approves on Pi.
 */
import { NextResponse } from "next/server"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  getPaymentIntent,
  bindProviderPayment,
  transitionIntent,
  loadPaymentIntent,
  loadByProviderPaymentId,
} from "@/lib/server/payments/intent-store"
import {
  piApprovePayment,
  piGetPayment,
  amountsMatch,
  getPiApiKey,
} from "@/lib/server/payments/pi-api"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    // Auth is best-effort (ownership checks). Approval must still proceed for
    // unbound / pipeline-verification payments so the Pi wallet unlocks.
    let auth: Awaited<ReturnType<typeof resolveAuthenticatedUser>> = null
    try {
      auth = await resolveAuthenticatedUser(request.headers)
    } catch {
      auth = null
    }
    const rateKey = auth?.userId ? `payments-approve:user:${auth.userId}` : `payments-approve:ip:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"}`
    const rate = await checkDurableRateLimit(rateKey, 30, 60_000, { onUnavailable: "deny" })
    if (!rate.ok) {
      return NextResponse.json(
        { ok: false, error: durableRateLimitCode(rate), retryAfterSec: rate.retryAfterSec },
        { status: durableRateLimitStatus(rate), headers: { "Cache-Control": "no-store" } },
      )
    }

    const parsedBody = await readBoundedJson(request, 8 * 1024)
    if (!parsedBody.ok) {
      const tooLarge = parsedBody.error === "REQUEST_TOO_LARGE"
      return NextResponse.json(
        { ok: false, error: tooLarge ? "REQUEST_TOO_LARGE" : "INVALID_REQUEST_BODY" },
        { status: tooLarge ? 413 : 400, headers: { "Cache-Control": "no-store" } },
      )
    }
    const body = parsedBody.value
    const paymentId = typeof body.paymentId === "string" ? body.paymentId.trim() : ""
    const intentId = typeof body.intentId === "string" ? body.intentId.trim() : ""

    if (!paymentId) {
      return NextResponse.json({ ok: false, error: "paymentId required" }, { status: 400 })
    }
    if (!getPiApiKey()) {
      console.error("[payments/approve] PI_API_KEY missing on this deployment")
      return NextResponse.json(
        { ok: false, error: "PAYMENT_PROVIDER_UNAVAILABLE" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      )
    }

    // Resolve durable intent only; a failed durable read must not fall back to process memory
    let intent = intentId
      ? (await loadPaymentIntent(intentId))
      : (await loadByProviderPaymentId(paymentId))

    // Any server-owned intent is bound to a GH account in every environment.
    // Do not weaken ownership in Preview/Testnet: intent IDs and provider payment
    // IDs are identifiers, not bearer credentials. Unbound pipeline checks remain
    // a separate explicitly gated non-production path below.
    if (intent?.userId && !auth) {
      return NextResponse.json(
        { ok: false, error: "AUTHENTICATION_REQUIRED", message: "Sign in to approve this payment" },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      )
    }
    if (intent && auth && intent.userId !== auth.userId) {
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN" },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      )
    }

    // Idempotent if already approved/completed
    if (intent && (intent.status === "APPROVED" || intent.status === "COMPLETED" || intent.status === "FULFILLED" || intent.status === "COMPLETION_PENDING" || intent.status === "USER_SUBMITTED")) {
      if (intent.providerPaymentId === paymentId || !intent.providerPaymentId) {
        if (!intent.providerPaymentId) {
          const bound = await bindProviderPayment(intent.id, paymentId, auth?.userId)
          if (!bound) return NextResponse.json({ ok: false, error: "PAYMENT_INTENT_BIND_UNAVAILABLE", retryable: true }, { status: 503 })
          intent = bound
        }
        // Completed/fulfilled intents are already beyond approval; never re-submit an approve action.
        if (intent.status === "COMPLETED" || intent.status === "FULFILLED") {
          return NextResponse.json({ ok: true, idempotent: true, intent, paymentId })
        }
        // Still ensure Pi approved (retry-safe) only after durable binding.
        const appr = await piApprovePayment(paymentId)
        if (!appr.ok) {
          return NextResponse.json({ ok: false, error: "PI_APPROVE_FAILED", retryable: true }, { status: 502, headers: { "Cache-Control": "no-store" } })
        }
        return NextResponse.json({
          ok: true,
          idempotent: true,
          intent: getPaymentIntent(intent.id),
          payment: appr.payment,
        })
      }
    }

    if (intent) {
      // Cross-environment guard: intent stamped at create must match this server's network mode
      try {
        const { resolvePiSandbox } = await import("@/lib/pi-env")
        const serverSandbox = resolvePiSandbox()
        const intentEnv = String(intent.metadata?.environment || "")
        if (
          intentEnv === "sandbox" ||
          intentEnv === "mainnet"
        ) {
          const expected = serverSandbox ? "sandbox" : "mainnet"
          if (intentEnv !== expected) {
            await transitionIntent(intent.id, "FAILED", {
              actor: "system",
              detail: "Cross-environment payment blocked",
              error: `intent ${intentEnv} vs server ${expected}`,
            })
            return NextResponse.json(
              {
                ok: false,
                error: "ENVIRONMENT_MISMATCH",
              },
              { status: 409, headers: { "Cache-Control": "no-store" } },
            )
          }
        }
      } catch {
        /* resolver unavailable — amount + ownership checks still apply */
      }

      const bound = await bindProviderPayment(intent.id, paymentId, auth?.userId)
      if (!bound) {
        return NextResponse.json(
          { ok: false, error: "provider_payment_bind_conflict" },
          { status: 409 }
        )
      }
      const approvalPending = await transitionIntent(intent.id, "APPROVAL_PENDING", {
        actor: auth?.userId || "system",
        detail: "Approval requested",
        providerPaymentId: paymentId,
      })
      if (!approvalPending || approvalPending.status !== "APPROVAL_PENDING") {
        return NextResponse.json({ ok: false, error: "PAYMENT_INTENT_DURABILITY_UNAVAILABLE", retryable: true }, { status: 503 })
      }
      intent = approvalPending

      // Lookup + verify amount before approve
      const lookup = await piGetPayment(paymentId)
      if (!lookup.ok || !lookup.payment) {
        return NextResponse.json({ ok: false, error: "PI_PAYMENT_LOOKUP_UNAVAILABLE", retryable: true }, { status: 502 })
      }
      {
        if (!amountsMatch(intent.amount, lookup.payment.amount)) {
          await transitionIntent(intent.id, "FAILED", {
            actor: "system",
            detail: "Amount mismatch",
            error: `expected ${intent.amount} got ${lookup.payment.amount}`,
          })
          return NextResponse.json(
            {
              ok: false,
              error: "amount_mismatch",
              expected: intent.amount,
              actual: lookup.payment.amount,
            },
            { status: 409 }
          )
        }
        // Phase 2: purpose mismatch is a hard reject when both sides declare a purpose.
        const metaPurpose = lookup.payment.metadata?.purpose || lookup.payment.metadata?.intentPurpose
        if (
          metaPurpose &&
          intent.metadata?.purpose &&
          String(metaPurpose) !== String(intent.metadata.purpose)
        ) {
          await transitionIntent(intent.id, "FAILED", {
            actor: "system",
            detail: "Purpose mismatch",
            error: `expected ${intent.metadata.purpose} got ${metaPurpose}`,
          })
          return NextResponse.json(
            { ok: false, error: "PURPOSE_MISMATCH" },
            { status: 409, headers: { "Cache-Control": "no-store" } },
          )
        }
      }
    }

    // Unbound approve (no GreenHaven intent): only for explicit non-production pipeline checks.
    // Never grants GH benefits; still must not use PI_API_KEY as an open proxy in production.
    if (!intent) {
      const allowUnbound =
        process.env.PI_ALLOW_UNBOUND_APPROVE === "true" &&
        process.env.VERCEL_ENV !== "production"
      if (!allowUnbound) {
        return NextResponse.json(
          {
            ok: false,
            error: "INTENT_REQUIRED",
            message:
              "Approve requires a GreenHaven payment intent bound to this payment. Unbound approve is disabled in production.",
          },
          { status: 400 },
        )
      }
    }

    // Call Pi approve to unlock the wallet UI for payments with a verified intent
    // (or explicit non-production unbound pipeline when PI_ALLOW_UNBOUND_APPROVE=true).
    const appr = await piApprovePayment(paymentId)
    if (!appr.ok) {
      console.error("[payments/approve] Pi Platform reject", {
        paymentId,
        status: appr.status,
        error: appr.error,
        hasIntent: Boolean(intent),
      })
      if (intent) {
        await transitionIntent(intent.id, "FAILED", {
          actor: "system",
          detail: "Pi approve failed",
          error: appr.error,
        })
      }
      // Phase 2: do not leak provider status text, key configuration hints, or raw errors to the client.
      return NextResponse.json(
        {
          ok: false,
          error: "PI_APPROVE_FAILED",
          retryable: appr.status === 429 || (typeof appr.status === "number" && appr.status >= 500),
        },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      )
    }

    if (intent) {
      const approvedIntent = await transitionIntent(intent.id, "APPROVED", {
        actor: auth?.userId || "system",
        detail: "Pi developer approved",
        providerPaymentId: paymentId,
      })
      if (!approvedIntent) {
        return NextResponse.json({ ok: false, error: "PAYMENT_INTENT_DURABILITY_UNAVAILABLE" }, { status: 503 })
      }
      intent = approvedIntent
    }

    return NextResponse.json({
      ok: true,
      payment: appr.payment,
      intent: intent ? getPaymentIntent(intent.id) : null,
    })
  } catch (err) {
    console.error("[payments/approve] unhandled", err instanceof Error ? err.message : err)
    return NextResponse.json(
      { ok: false, error: "APPROVE_FAILED" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    )
  }
}
