/**
 * GET /api/payments/health
 * Non-secret diagnostics for Pi U2A readiness (checklist / ops).
 */
import { NextResponse } from "next/server"
import { getPiApiKey } from "@/lib/server/payments/pi-api"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const key = getPiApiKey()
  const sandbox =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_PI_SANDBOX === "true"

  return NextResponse.json(
    {
      ok: true,
      service: "gh-pay",
      piApiKeyConfigured: Boolean(key),
      sandbox,
      endpoints: {
        approve: "/api/payments/approve",
        complete: "/api/payments/complete",
        intents: "/api/payments/intents",
        fulfill: "/api/payments/fulfill",
      },
      notes: [
        "Pi payments require the Pi Browser and a configured PI_API_KEY on the server.",
        "Set NEXT_PUBLIC_PI_SANDBOX=true only for Develop/testnet; false for production checklist.",
        "GHC is internal utility — never mixed 1:1 with π on these rails.",
      ],
      ts: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}
