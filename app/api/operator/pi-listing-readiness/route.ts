/**
 * GET /api/operator/pi-listing-readiness
 * Operator-facing readiness for Pi portal checklist + greenhaven.pi claim.
 * Optional: require GHC_ADMIN_API_KEY via x-ghc-admin-key when set.
 */
import { createHash, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { buildPiListingReadiness } from "@/lib/server/operator/pi-listing-readiness"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function operatorAuthorized(request: Request): boolean {
  const expectedRaw = String(process.env.GHC_ADMIN_API_KEY || "").trim()
  if (Buffer.byteLength(expectedRaw, "utf8") < 32) return false
  const expected = createHash("sha256").update(expectedRaw).digest()
  const suppliedValue = String(request.headers.get("x-ghc-admin-key") || "")
  const supplied = createHash("sha256").update(suppliedValue).digest()
  return timingSafeEqual(expected, supplied) && Boolean(suppliedValue)
}

export async function GET(request: Request) {
  if (!operatorAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "ADMIN_FORBIDDEN" }, { status: 403, headers: { "Cache-Control": "no-store" } })
  }

  const payload = await buildPiListingReadiness()
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } })
}
