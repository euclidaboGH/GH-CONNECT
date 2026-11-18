/**
 * GET /api/economy/supply — network-level GHC supply snapshot (no private user data).
 */
import { isDatabaseConfigured, jsonOk } from "@/lib/server/economy/http"
import { rpcEconomicPopulationStats } from "@/lib/server/economy/db"
import {
  ACTIVITY_DAILY_CAP_GHC,
  ACTIVITY_WEEKLY_CAP_GHC,
  ECONOMY_VERSION,
} from "@/lib/server/economy/economic-config"
import { aggregateTelemetry } from "@/lib/server/economy/telemetry"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
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
    economyVersion: ECONOMY_VERSION,
    durable: Boolean(population),
    population: population
      ? {
          eligibleUsers: population.eligibleEconomicUsers,
          activeClaimers: population.activeEconomicUsers,
          suspendedUsers: population.suspendedUsers,
        }
      : null,
    caps: {
      activityDailyGhc: ACTIVITY_DAILY_CAP_GHC,
      activityWeeklyGhc: ACTIVITY_WEEKLY_CAP_GHC,
    },
    processTelemetry: telemetry
      ? {
          userIssuance: telemetry.userIssuance,
          sinks: telemetry.sinks,
          grossIssuance: telemetry.grossIssuance,
          netCirculatingChange: telemetry.netCirculatingChange,
          eventCount: telemetry.count,
          note: "Process-local telemetry — not a global ledger total across instances.",
        }
      : null,
    principles: [
      "Issuance is server-capped (daily claim + activity windows).",
      "Catalog spends and marketplace/membership debits are sinks.",
      "Outstanding supply is posted credits minus posted debits on the ledger.",
      "GHC is utility only — not an investment or Pi redemption promise.",
    ],
  })
}
