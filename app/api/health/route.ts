import { NextResponse } from "next/server"
import { resolvePiSandbox, getPiClientId } from "@/lib/pi-env"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const piKey = Boolean(
    (process.env.PI_API_KEY || process.env.PI_SERVER_API_KEY || "").trim()
  )
  const sandbox = resolvePiSandbox()
  const clientIdConfigured = Boolean(getPiClientId())

  return NextResponse.json(
    {
      ok: true,
      service: "gh-connect",
      version: "0.54.0",
      pi: {
        apiKeyConfigured: piKey,
        clientIdConfigured,
        sandbox,
        validationPath: "/validation-key.txt",
        signInCallback: "/signin/callback",
      },
      ts: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}
