/**
 * GET /api/public/portal-links
 * Absolute URLs for Pi Developer Portal configuration fields (no secrets).
 */
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function originFromEnv(request: Request): string {
  const configured = String(process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, "")
  if (configured) {
    return configured.startsWith("http") ? configured : `https://${configured}`
  }
  try {
    return new URL(request.url).origin
  } catch {
    return ""
  }
}

export async function GET(request: Request) {
  const origin = originFromEnv(request)
  const abs = (path: string) => (origin ? `${origin}${path}` : path)

  return NextResponse.json(
    {
      ok: true,
      appName: "GreenHaven",
      networkNote: "Register separate Testnet and Mainnet apps in the Pi Developer Portal.",
      developmentUrlHint: "Use your Vercel Preview URL or http://localhost:3000 for the Testnet app.",
      productionUrl: origin || null,
      privacyPolicyUrl: abs("/privacy"),
      termsUrl: abs("/terms"),
      domainValidationUrl: abs("/validation-key.txt"),
      supportUrl: abs("/support"),
      portalPaste: {
        privacyPolicyUrl: abs("/privacy"),
        productionUrl: origin || "(set NEXT_PUBLIC_APP_URL)",
        validationKeyPath: "/validation-key.txt",
      },
      domainClaim: {
        name: "greenhaven.pi",
        claimDeadlineHint: "2026-12-19",
        minUniqueKycPioneers: 5,
        note: "KYC status is measured by Pi, not by this API.",
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
