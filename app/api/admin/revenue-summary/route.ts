/**
 * GET /api/admin/revenue-summary
 * Operator-only commerce summary. Requires x-ghc-admin-key matching GHC_ADMIN_API_KEY
 * (or GHC_A2U_ADMIN_KEY as fallback). Does not expose user PII.
 */
import { createHash, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { commissionPolicyPublic } from "@/lib/server/marketplace/commission"
import { payoutPolicyPublic } from "@/lib/server/payouts/eligibility"
import { packPurchaseLimits, listGhcPacks } from "@/lib/server/economy/ghc-pack-catalog"
import { buyGhcWithPiEnabled } from "@/lib/server/economy/testnet-unlock"
import { ASSET_POLICY } from "@/lib/asset-separation"
import { listPublicSpendCatalog } from "@/lib/server/economy/spend-catalog"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function adminAuthorized(request: Request): boolean {
  const expectedRaw =
    String(process.env.GHC_ADMIN_API_KEY || process.env.GHC_A2U_ADMIN_KEY || "").trim()
  if (!expectedRaw) return false
  const expected = Buffer.from(expectedRaw, "utf8")
  const supplied = Buffer.from(String(request.headers.get("x-ghc-admin-key") || "").trim(), "utf8")
  if (expected.length === 0 || expected.length !== supplied.length) return false
  try {
    return timingSafeEqual(expected, supplied)
  } catch {
    return false
  }
}

export async function GET(request: Request) {
  if (!adminAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "ADMIN_FORBIDDEN" }, { status: 403 })
  }

  const packs = listGhcPacks()
  const catalog = listPublicSpendCatalog()

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    policy: {
      conversionEnabled: ASSET_POLICY.conversionEnabled,
      dualRail: ASSET_POLICY.dualRailCopy,
      packAcquisitionEnabled: buyGhcWithPiEnabled(),
    },
    marketplace: commissionPolicyPublic(),
    payouts: payoutPolicyPublic(),
    acquisition: {
      packs: packs.map((p) => ({
        productId: p.productId,
        piAmount: p.piAmount,
        ghcAmount: p.ghcAmount,
      })),
      limits: packPurchaseLimits(),
    },
    utilitySinks: catalog
      .filter((c) => c.category === "boost" || c.category === "tools" || c.category === "membership")
      .map((c) => ({ purpose: c.purpose, amountGhc: c.amountGhc, amountPi: c.amountPi })),
    revenueJournal: {
      note: "Durable company revenue is written via appendVerifiedCompanyRevenueEvent after provider verification.",
      eventTypes: [
        "marketplace_fee",
        "membership_revenue",
        "promotion_revenue",
        "digital_service_revenue",
        "refund",
        "chargeback",
        "adjustment",
      ],
    },
    fingerprint: createHash("sha256")
      .update(JSON.stringify({ packs: packs.length, sinks: catalog.length }))
      .digest("hex")
      .slice(0, 16),
  })
}
