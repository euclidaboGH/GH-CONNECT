import { NextResponse } from "next/server"

/** App Studio rewrites host paths under /tpa/<app-id>/ */
const KEY =
  process.env.DOMAIN_VALIDATION_KEY ||
  "54abde02d97ea6a7769a2d2dfb79332d231b3b4a7f688a0098e75f92d7338a6f70427d5069ebe3cabbf8d04c2b5559746cec7b74076ff32896bbb407cbd506bf"

export const dynamic = "force-dynamic"
export const runtime = "edge"

export async function GET() {
  return new NextResponse(KEY, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
