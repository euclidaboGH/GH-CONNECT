/**
 * GET /api/economy/catalog — transparent GHC utility + membership prices.
 * Dual-rail π amounts are independent product prices, not FX.
 */
import { NextResponse } from "next/server"
import { listPublicSpendCatalog, listUtilitySinks } from "@/lib/server/economy/spend-catalog"
import { ASSET_POLICY } from "@/lib/asset-separation"
import {
  ACTIVITY_DAILY_CAP_GHC,
  ACTIVITY_WEEKLY_CAP_GHC,
  ECONOMY_VERSION,
} from "@/lib/server/economy/economic-config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const utilityOnly = url.searchParams.get("utility") === "1"

  const items = utilityOnly ? listUtilitySinks() : listPublicSpendCatalog()

  return NextResponse.json(
    {
      ok: true,
      economyVersion: ECONOMY_VERSION,
      dualRail: ASSET_POLICY.dualRailCopy,
      conversionEnabled: ASSET_POLICY.conversionEnabled,
      issuanceCaps: {
        activityDailyGhc: ACTIVITY_DAILY_CAP_GHC,
        activityWeeklyGhc: ACTIVITY_WEEKLY_CAP_GHC,
        note: "Daily claim and activity emissions are server-capped; catalog spends debit available balance only.",
      },
      items,
    },
    { headers: { "Cache-Control": "public, max-age=60" } }
  )
}
