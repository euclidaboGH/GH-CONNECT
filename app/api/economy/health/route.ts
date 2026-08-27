/**
 * GET /api/economy/health — deployment readiness (no secrets leaked).
 * D7: production safety flags only as booleans / labels.
 */
import { jsonOk } from "@/lib/server/economy/http"
import { hasPrivilegedDatabase, readGhcServerEnv, requiredEnvChecklist } from "@/lib/server/economy/env"

export async function GET() {
  const env = readGhcServerEnv()
  const checklist = requiredEnvChecklist()
  const databaseConfigured = hasPrivilegedDatabase(env)
  const memoryExplicit = process.env.GHC_SERVER_MEMORY === "1"
  const memoryModeAllowed = memoryExplicit && !databaseConfigured && !env.isProduction
  const devAuthEnabled = env.allowDevAuth
  const productionDevAuthRisk = env.isProduction && process.env.GHC_ALLOW_DEV_AUTH === "1"
  const productionMemoryRisk = env.isProduction && memoryExplicit
  const piAuthReady = Boolean(env.piPlatformApiUrl)
  const jwtAuthReady = Boolean(env.authJwtSecret)
  /** Production-grade auth means Pi and/or JWT secret — not dev tokens */
  const authConfigured = piAuthReady || jwtAuthReady

  return jsonOk({
    service: "ghc-economy",
    databaseConfigured,
    notificationEventsConfigured: databaseConfigured,
    transferRpcConfigured: databaseConfigured,
    requestRpcConfigured: databaseConfigured,
    realtimeConfigured: process.env.GHC_REALTIME_CONFIGURED === "1",
    authConfigured,
    piAuthReady,
    jwtAuthReady,
    memoryModeAllowed,
    production: env.isProduction,
    productionDevAuthRisk,
    productionMemoryRisk,
    securityOk: !productionDevAuthRisk && !productionMemoryRisk,
    envChecklist: checklist.map(({ name, present, privileged }) => ({
      name,
      present,
      privileged,
    })),
    rpc: [
      "ghc_execute_transfer",
      "ghc_create_transfer_request",
      "ghc_accept_transfer_request",
      "ghc_decline_transfer_request",
      "ghc_cancel_transfer_request",
      "ghc_record_notification_event",
      "ghc_ensure_public_id",
      "ghc_resolve_public_id",
    ],
    migrations: [
      "supabase/migrations/20260821_ghc_economy_ledger.sql",
      "supabase/migrations/20260822_ghc_public_identities.sql",
      "supabase/migrations/20260822_ghc_notification_events.sql",
      "supabase/migrations/20260822_ghc_economy_events_rls.sql",
      "supabase/migrations/20260822_ghc_transfer_request_rpcs.sql",
      "supabase/migrations/20260822_ghc_account_and_claim.sql",
      "supabase/migrations/20260822_ghc_rls_tighten_events.sql",
    ],
    note: databaseConfigured
      ? "Privileged DB credentials detected. Apply all migrations before relying on transfers/notifications."
      : "No privileged DB credentials. LOCAL/STUDIO only unless GHC_SERVER_MEMORY=1 (non-production).",
    statusLabel: productionDevAuthRisk || productionMemoryRisk
      ? "SECURITY_RISK"
      : databaseConfigured
        ? "SERVER_CONFIGURED"
        : memoryModeAllowed
          ? "LOCAL_STUDIO"
          : "UNCONFIGURED",
  })
}
