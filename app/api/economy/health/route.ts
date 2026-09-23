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

  // Credentials present does NOT prove ledger/membership/marketplace migrations are applied.
  // Operators must treat schema readiness separately from "Supabase is configured".
  return jsonOk({
    service: "ghc-economy",
    databaseConfigured,
    /** True only when privileged Supabase credentials exist — not a schema probe */
    supabaseCredentialsPresent: databaseConfigured,
    /** Schema objects (ghc_transactions, RPCs) are NOT verified here — apply migrations separately */
    notificationEventsConfigured: false,
    transferRpcConfigured: false,
    requestRpcConfigured: false,
    economyLedgerAssumedReady: false,
    membershipEntitlementsAssumedReady: false,
    marketplaceAssumedReady: false,
    schemaProbe: "not_performed",
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
      ? "Privileged DB credentials detected. Economy/membership/marketplace remain unavailable until ledger migrations (ghc_transactions, spend/claim RPCs, ghc_membership_entitlements, gh_marketplace_*) are applied. Payment intents may already exist independently."
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
