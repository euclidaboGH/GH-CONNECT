import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const piKey = Boolean(
    (process.env.PI_API_KEY || process.env.PI_SERVER_API_KEY || "").trim()
  )
  const sandbox = process.env.NEXT_PUBLIC_PI_SANDBOX === "true"

  return NextResponse.json(
    {
      ok: true,
      service: "gh-connect",
      version: "0.53.0",
      pi: {
        apiKeyConfigured: piKey,
        sandbox,
        validationPath: "/validation-key.txt",
      },
      ts: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}
