/**
 * GET /api/operator/pi-listing-readiness
 * Operator-facing readiness for Pi portal checklist + greenhaven.pi claim.
 * Optional: require GHC_ADMIN_API_KEY via x-ghc-admin-key when set.
 */
import { NextResponse } from "next/server"
import { buildPiListingReadiness } from "@/lib/server/operator/pi-listing-readiness"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const adminKey = String(process.env.GHC_ADMIN_API_KEY || "").trim()
  if (adminKey) {
    const provided = request.headers.get("x-ghc-admin-key") || ""
    if (provided !== adminKey) {
      return NextResponse.json(
        { ok: false, error: "ADMIN_KEY_REQUIRED" },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      )
    }
  }

  const payload = await buildPiListingReadiness()
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } })
}
