/**
 * GET /api/operator/claim-readiness-report
 * Single JSON report for greenhaven.pi + Mainnet listing operator evidence.
 * Optional x-ghc-admin-key when GHC_ADMIN_API_KEY is set.
 */
import { createHash, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { buildPiListingReadiness } from "@/lib/server/operator/pi-listing-readiness"
import { buildListingCompliancePosture } from "@/lib/server/compliance/listing-posture"
import { buildPlatformCapabilities } from "@/lib/server/pi/platform-capabilities"
import { isPiOnlyCommerceEnabled } from "@/lib/server/economy/pi-only-commerce"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function operatorAuthorized(request: Request): boolean {
  const expectedRaw = String(process.env.GHC_ADMIN_API_KEY || "").trim()
  // Sensitive operator reports must fail closed when the secret is missing or weak.
  if (Buffer.byteLength(expectedRaw, "utf8") < 32) return false
  const expected = createHash("sha256").update(expectedRaw).digest()
  const supplied = createHash("sha256").update(String(request.headers.get("x-ghc-admin-key") || "")).digest()
  return timingSafeEqual(expected, supplied) && Boolean(request.headers.get("x-ghc-admin-key"))
}

export async function GET(request: Request) {
  if (!operatorAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "ADMIN_FORBIDDEN" }, { status: 403, headers: { "Cache-Control": "no-store" } })
  }

  const listing = await buildPiListingReadiness()
  const compliance = buildListingCompliancePosture()
  const capabilities = buildPlatformCapabilities()

  const checklistReady = listing.checklist.filter((c) => c.status === "ready").length
  const checklistTotal = listing.checklist.length
  const compliancePass = compliance.items.filter((i) => i.status === "pass").length

  return NextResponse.json(
    {
      ok: true,
      product: "GreenHaven",
      domainTarget: "greenhaven.pi",
      claimDeadlineHint: listing.claimDeadlineHint,
      piOnlyCommerce: isPiOnlyCommerceEnabled(),
      scores: {
        portalChecklistReady: checklistReady,
        portalChecklistTotal: checklistTotal,
        compliancePass,
        complianceTotal: compliance.items.length,
        uniqueVerifiedPioneers: listing.uniqueVerifiedPioneers,
        domainThreshold: listing.domainThreshold,
        domainThresholdMet: listing.domainThresholdMet,
      },
      listing,
      compliance,
      capabilities,
      operatorNextSteps: [
        "Finish remaining portal App Configuration steps (wallet, URLs, domain verify).",
        "Complete developer KYC.",
        "Collect live Testnet π fee evidence, then Mainnet project with production keys.",
        "Invite KYC’d Pioneers until portal shows ≥5 engaged users.",
        "Submit Mainnet listing only after evidence pack is complete.",
      ],
      ts: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
