/**
 * GET /api/payments/health
 *
 * Pi U2A payment rail readiness (subset of foundation gate).
 * Aligns with /api/health network matrix — same sandbox/mainnet rules.
 */

import { NextResponse } from "next/server"
import { getPiApiKey } from "@/lib/server/payments/pi-api"
import { evaluateReadiness } from "@/lib/server/readiness"
import { getPiClientId } from "@/lib/pi-env"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  let hostname: string | null = null
  try {
    hostname = new URL(request.url).hostname
  } catch {
    /* */
  }

  const foundation = evaluateReadiness({ hostname })
  const key = getPiApiKey()
  const clientId = Boolean(getPiClientId())
  const sandbox = foundation.environment.piSandbox

  const paymentBlockers: string[] = []
  if (!key) {
    paymentBlockers.push(
      "PI_API_KEY missing — approve will fail; wallet shows Payment Expired"
    )
  }
  if (!clientId) {
    paymentBlockers.push(
      "NEXT_PUBLIC_PI_CLIENT_ID missing — Pi Sign-In not configured"
    )
  }

  const paymentReady = paymentBlockers.length === 0
  const status =
    foundation.environment.isProduction &&
    (!paymentReady || foundation.status === "not_ready")
      ? 503
      : 200

  const readinessLabel = !paymentReady
    ? foundation.environment.isProduction
      ? "not_ready"
      : "degraded"
    : foundation.status

  return NextResponse.json(
    {
      ok: true,
      ready: paymentReady && foundation.status !== "not_ready",
      status: readinessLabel,
      service: "gh-pay",
      piApiKeyConfigured: Boolean(key),
      clientIdConfigured: clientId,
      sandbox,
      networkLabel: foundation.environment.networkLabel,
      networkMatrix: foundation.networkMatrix,
      endpoints: {
        approve: "/api/payments/approve",
        complete: "/api/payments/complete",
        intents: "/api/payments/intents",
        fulfill: "/api/payments/fulfill",
        incomplete: "/api/payments/incomplete",
        health: "/api/payments/health",
      },
      hardening: {
        approveRetries: "lib/pi-u2a-payment.ts approveWithRetry",
        incompleteHandler: "lib/pi-incomplete-payment.ts",
        intentBinding: "preferred via intentId metadata",
      },
      blockers: paymentBlockers,
      foundationBlockers: foundation.blockers,
      productionReadyHints: [...paymentBlockers, ...foundation.blockers],
      notes: [
        "Pi payments require Pi Browser + PI_API_KEY matching sandbox/mainnet.",
        "sandbox=true only for Testnet/Develop; false for Mainnet production.",
        "GHC is internal utility — never mixed 1:1 with π on these rails.",
        "See docs/FOUNDATION_READINESS.md for the full matrix.",
      ],
      ts: new Date().toISOString(),
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-GH-Readiness": readinessLabel,
      },
    }
  )
}
