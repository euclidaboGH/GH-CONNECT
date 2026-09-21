import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const KEY = (
  process.env.DOMAIN_VALIDATION_KEY ||
  "54abde02d97ea6a7769a2d2dfb79332d231b3b4a7f688a0098e75f92d7338a6f70427d5069ebe3cabbf8d04c2b5559746cec7b74076ff32896bbb407cbd506bf"
).trim()

function plainKey() {
  return new NextResponse(KEY, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  })
}

/** Edge-safe liveness when Node route handlers fail. */
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
  if (
    path === "/validation-key.txt" ||
    path === "/validation-key.txt/" ||
    path === "/api/validation-key" ||
    path === "/api/validation-key/"
  ) {
    return plainKey()
  }
  return NextResponse.next()
}

export const config = {
  matcher: [
    "/validation-key.txt",
    "/validation-key.txt/",
    "/api/validation-key",
    "/api/validation-key/",
    "/api/health/live",
    "/api/health/live/",
  ],
}
