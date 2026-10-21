import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Edge-safe helpers only.
 * Domain validation key is served solely by /api/validation-key
 * (rewritten from /validation-key.txt) using DOMAIN_VALIDATION_KEY.
 * Do not embed keys here — Edge and Node must share one env source of truth.
 */
function liveJson() {
  return NextResponse.json(
    {
      ok: true,
      live: true,
      service: "gh-connect",
      via: "middleware",
      ts: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
    }
  )
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])
const WEBHOOK_PATHS = new Set(["/api/webhooks/paystack"])

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  if (path === "/api/health/live" || path === "/api/health/live/") {
    return liveJson()
  }

  // Same-origin defense-in-depth for browser mutations. Pi Browser embeds may
  // use SameSite=None cookies; reject cross-site writes even when cookies are
  // sent. Webhooks are server-to-server and authenticated independently.
  if (path.startsWith("/api/") && !SAFE_METHODS.has(request.method.toUpperCase()) && !WEBHOOK_PATHS.has(path)) {
    const origin = request.headers.get("origin")
    const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase()
    if (origin) {
      try {
        if (new URL(origin).origin !== request.nextUrl.origin) {
          return NextResponse.json(
            { ok: false, error: "CROSS_ORIGIN_MUTATION_BLOCKED" },
            { status: 403, headers: { "Cache-Control": "no-store", "Vary": "Origin" } }
          )
        }
      } catch {
        return NextResponse.json(
          { ok: false, error: "INVALID_ORIGIN" },
          { status: 403, headers: { "Cache-Control": "no-store", "Vary": "Origin" } }
        )
      }
    }
    if (fetchSite === "cross-site") {
      return NextResponse.json(
        { ok: false, error: "CROSS_ORIGIN_MUTATION_BLOCKED" },
        { status: 403, headers: { "Cache-Control": "no-store", "Vary": "Origin" } }
      )
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/api/:path*"],
}
