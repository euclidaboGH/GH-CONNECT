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

function requestCorrelationId(request: NextRequest): string {
  // Accept only canonical UUIDs from a trusted upstream; otherwise mint a fresh ID.
  // This prevents arbitrary attacker-controlled strings from entering logs/headers.
  const supplied = request.headers.get("x-request-id") || ""
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(supplied)
    ? supplied
    : crypto.randomUUID()
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const requestId = requestCorrelationId(request)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-request-id", requestId)

  if (path === "/api/health/live" || path === "/api/health/live/") {
    const response = liveJson()
    response.headers.set("X-Request-ID", requestId)
    return response
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
            { ok: false, error: "CROSS_ORIGIN_MUTATION_BLOCKED", requestId },
            { status: 403, headers: { "Cache-Control": "no-store", "Vary": "Origin", "X-Request-ID": requestId } }
          )
        }
      } catch {
        return NextResponse.json(
          { ok: false, error: "INVALID_ORIGIN", requestId },
          { status: 403, headers: { "Cache-Control": "no-store", "Vary": "Origin", "X-Request-ID": requestId } }
        )
      }
    }
    if (fetchSite === "cross-site") {
      return NextResponse.json(
        { ok: false, error: "CROSS_ORIGIN_MUTATION_BLOCKED", requestId },
        { status: 403, headers: { "Cache-Control": "no-store", "Vary": "Origin", "X-Request-ID": requestId } }
      )
    }
  }
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set("X-Request-ID", requestId)
  return response
}

export const config = {
  matcher: ["/api/:path*"],
}
