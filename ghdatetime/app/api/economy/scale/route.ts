/**
 * GET /api/economy/scale — Phase 4 monitoring snapshot (issuance, sinks, commerce policy).
 * Authenticated users see public policy + caps; no private balances of others.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { isDatabaseConfigured, jsonOk } from "@/lib/server/economy/http"
import { rpcEconomicPopulationStats } from "@/lib/server/economy/db"
import {
  ACTIVITY_DAILY_CAP_GHC,
  ACTIVITY_WEEKLY_CAP_GHC,
  ECONOMY_VERSION,
} from "@/lib/server/economy/economic-config"
import { aggregateTelemetry } from "@/lib/server/economy/telemetry"
import { listUtilitySinks } from "@/lib/server/economy/spend-catalog"
import { packPurchaseLimits, listGhcPacks } from "@/lib/server/economy/ghc-pack-catalog"
import { commissionPolicyPublic } from "@/lib/server/marketplace/commission"
import { payoutPolicyPublic } from "@/lib/server/payouts/eligibility"
import { buyGhcWithPiEnabled } from "@/lib/server/economy/testnet-unlock"
import { ASSET_POLICY } from "@/lib/asset-separation"


const __ghNoStore = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
} as const

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  // Allow unauthenticated read of non-sensitive policy for operator health boards
  void auth

  let population: Awaited<ReturnType<typeof rpcEconomicPopulationStats>> | null = null
  if (isDatabaseConfigured()) {
    try {
      population = await rpcEconomicPopulationStats()
    } catch {
      population = null
    }
  }

  let telemetry: ReturnType<typeof aggregateTelemetry> | null = null
  try {
    telemetry = aggregateTelemetry()
  } catch {
    telemetry = null
  }

  return jsonOk({
    phase: 4,
    economyVersion: ECONOMY_VERSION,
    dualRail: ASSET_POLICY.dualRailCopy,
    conversionEnabled: ASSET_POLICY.conversionEnabled,
    packAcquisitionEnabled: buyGhcWithPiEnabled(),
    issuance: {
      activityDailyCapGhc: ACTIVITY_DAILY_CAP_GHC,
      activityWeeklyCapGhc: ACTIVITY_WEEKLY_CAP_GHC,
      population: population
        ? {
            eligibleUsers: population.eligibleEconomicUsers,
            eligibleEconomicUsers: population.eligibleEconomicUsers,
            activeClaimers: population.activeEconomicUsers,
            activeEconomicUsers: population.activeEconomicUsers,
            suspendedUsers: population.suspendedUsers,
            registeredUsers: population.registeredUsers,
            source: population.source,
          }
        : null,
      processTelemetry: telemetry
        ? {
            userIssuance: telemetry.userIssuance,
            sinks: telemetry.sinks,
            grossIssuance: telemetry.grossIssuance,
            netCirculatingChange: telemetry.netCirculatingChange,
            eventCount: telemetry.count,
          }
        : null,
    },
    sinks: {
      utilityCatalogCount: listUtilitySinks().length,
      utilityPurposes: listUtilitySinks().map((s) => s.purpose),
    },
    acquisition: {
      packCount: listGhcPacks().length,
      limits: packPurchaseLimits(),
    },
    marketplace: commissionPolicyPublic(),
    payouts: payoutPolicyPublic(),
    monitoringNotes: [
      "Process telemetry is instance-local until mirrored to a durable table.",
      "Company revenue uses gh_company_revenue_event_append — separate from GHC utility ledger.",
      "A2U seller payouts require admin key + eligibility hold + Pi identity.",
    ],
  })
}
