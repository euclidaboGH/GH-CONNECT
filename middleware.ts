import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const KEY = (
  process.env.DOMAIN_VALIDATION_KEY ||
  "acfbabbcb8e33ace219dec9ab3d0aa1ff8d043e36c7ee50d2fce7b53bc5ff68c254f1cd4d44f44c6df20451b8e398fca3f81205b9fe638ca23547e5075d1fdf5"
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
