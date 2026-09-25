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
      headers: { "Cache-Control": "no-store" },
    }
  )
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  if (path === "/api/health/live" || path === "/api/health/live/") {
    return liveJson()
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/api/health/live", "/api/health/live/"],
}
