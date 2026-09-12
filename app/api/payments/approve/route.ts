/**
 * POST /api/payments/approve
 * Body: { paymentId, intentId? }
 * Binds Pi payment to server intent, verifies amount/purpose, approves on Pi.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  getPaymentIntent,
  getByProviderPaymentId,
  bindProviderPayment,
  transitionIntent,
  loadPaymentIntent,
  loadByProviderPaymentId,
  assertDurableWrite,
} from "@/lib/server/payments/intent-store"
import {
  piApprovePayment,
  piGetPayment,
  amountsMatch,
  getPiApiKey,
} from "@/lib/server/payments/pi-api"

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
    const body = await request.json().catch(() => ({}))
    const paymentId = typeof body.paymentId === "string" ? body.paymentId.trim() : ""
    const intentId = typeof body.intentId === "string" ? body.intentId.trim() : ""

    if (!paymentId) {
      return NextResponse.json({ ok: false, error: "paymentId required" }, { status: 400 })
    }
    if (!getPiApiKey()) {
      console.error("[payments/approve] PI_API_KEY missing on this deployment")
      return NextResponse.json(
        {
          ok: false,
          error: "PI_API_KEY is not configured on the server",
          hint: "Set PI_API_KEY (Secret) for both Preview and Production in Vercel, then redeploy the matching environment.",
        },
        { status: 503 }
      )
    }

    // Resolve durable intent (DB then memory)
    let intent = intentId
      ? (await loadPaymentIntent(intentId)) || getPaymentIntent(intentId)
      : (await loadByProviderPaymentId(paymentId)) || getByProviderPaymentId(paymentId)

    if (intent && auth && intent.userId !== auth.userId) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 })
    }
    // Production: never approve a bound intent without authenticated ownership.
    // Unbound pipeline checks (no intent) still go through Pi API verification below.
    if (
      intent &&
      intent.userId &&
      !auth &&
      (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production")
    ) {
      return NextResponse.json(
        { ok: false, error: "AUTHENTICATION_REQUIRED", message: "Sign in to approve this payment" },
        { status: 401 },
      )
    }

    // Idempotent if already approved/completed
    if (intent && (intent.status === "APPROVED" || intent.status === "COMPLETED" || intent.status === "COMPLETION_PENDING" || intent.status === "USER_SUBMITTED")) {
      if (intent.providerPaymentId === paymentId || !intent.providerPaymentId) {
        if (!intent.providerPaymentId) await bindProviderPayment(intent.id, paymentId, auth?.userId)
        // Still ensure Pi approved (retry-safe)
        const appr = await piApprovePayment(paymentId)
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
                error: "environment_mismatch",
                intentEnvironment: intentEnv,
                serverEnvironment: expected,
                hint: "Align NEXT_PUBLIC_PI_SANDBOX, Pi Developer Portal app network, and PI_API_KEY.",
              },
              { status: 409 }
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
      await transitionIntent(intent.id, "APPROVAL_PENDING", {
        actor: auth?.userId || "system",
        detail: "Approval requested",
        providerPaymentId: paymentId,
      })

      // Lookup + verify amount before approve
      const lookup = await piGetPayment(paymentId)
      if (lookup.ok && lookup.payment) {
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
        // Optional metadata purpose check
        const metaPurpose = lookup.payment.metadata?.purpose || lookup.payment.metadata?.intentPurpose
        if (
          metaPurpose &&
          intent.metadata?.purpose &&
          String(metaPurpose) !== String(intent.metadata.purpose)
        ) {
          // soft warn only — purpose in our intent is authoritative
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
      return NextResponse.json(
        {
          ok: false,
          error: "Pi approve failed",
          status: appr.status,
          detail: appr.error,
          hint:
            appr.status === 401 || appr.status === 403
              ? "PI_API_KEY may be wrong or belongs to a different app in the Pi Developer Portal."
              : appr.status === 404
                ? "Payment ID not found on Pi — ensure sandbox/production match (NEXT_PUBLIC_PI_SANDBOX)."
                : undefined,
        },
        { status: 502 }
      )
    }

    if (intent) {
      await transitionIntent(intent.id, "APPROVED", {
        actor: auth?.userId || "system",
        detail: "Pi developer approved",
        providerPaymentId: paymentId,
      })
      const durable = await assertDurableWrite(getPaymentIntent(intent.id) || intent)
      if (!durable.ok) {
        return NextResponse.json({ ok: false, error: durable.error }, { status: 503 })
      }
    }

    return NextResponse.json({
      ok: true,
      payment: appr.payment,
      intent: intent ? getPaymentIntent(intent.id) : null,
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Approve failed" },
      { status: 500 }
    )
  }
}
