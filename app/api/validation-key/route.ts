import { NextResponse } from "next/server"

/**
 * Pi domain ownership — plain text body only.
 * Source of truth: DOMAIN_VALIDATION_KEY (Vercel env per deployment domain).
 * Never embed the real key in source control.
 */
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const key = (process.env.DOMAIN_VALIDATION_KEY || "").trim()

  if (!key) {
    return new NextResponse(
      "DOMAIN_VALIDATION_KEY is not configured for this deployment",
      {
        status: 503,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "X-Content-Type-Options": "nosniff",
        },
      }
    )
  }

  return new NextResponse(key, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
