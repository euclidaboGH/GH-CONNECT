/**
 * GH CONNECT production readiness (foundation gate).
 *
 * Informed by:
 * - Vercel production / deployment checks (real dependency probes, release gates)
 * - Health-check best practice: node runtime, no-store, 503 on not-ready (not only body flags)
 * - Meta/Facebook: explicit Development vs Live separation
 * - X/Twitter: separate env credentials; never mix prod keys into test traffic
 * - Pi Network: sandbox flag must match Testnet vs Mainnet API keys and portal app
 *
 * This module is the single source of truth for /api/health and release checklists.
 * It never returns secrets — only booleans, labels, and remediation text.
 */

import { resolvePiSandbox, getPiClientId } from "@/lib/pi-env"
import { isPiIdentityDurable } from "@/lib/server/identity/pi-identity-store"
import { isSessionStoreDurable } from "@/lib/server/identity/session-store"
import { isMessagingStoreDurable } from "@/lib/server/messaging/message-store"
import { readGhcServerEnv } from "@/lib/server/economy/env"

export type CheckStatus = "pass" | "fail" | "warn" | "info"
export type CheckSeverity = "critical" | "high" | "medium" | "low" | "info"

export type ReadinessCheck = {
  id: string
  label: string
  status: CheckStatus
  severity: CheckSeverity
  detail?: string
  remediation?: string
}

export type ReadinessLevel = "ready" | "degraded" | "not_ready"

export type ReadinessReport = {
  /** Process is up */
  ok: true
  /** Aggregated readiness for release / load decisions */
  ready: boolean
  status: ReadinessLevel
  service: "gh-connect"
  version: string
  environment: {
    nodeEnv: string
    vercelEnv: string
    isProduction: boolean
    piSandbox: boolean
    /** Human label for operators */
    networkLabel: "sandbox-testnet" | "mainnet" | "unknown"
  }
  checks: ReadinessCheck[]
  blockers: string[]
  warnings: string[]
  /** Documented env matrix for Pi (no secrets) */
  networkMatrix: {
    current: string
    sandbox: {
      piInitSandbox: true
      expectedPortalNetwork: "Testnet"
      expectedKeyType: "Testnet / Develop API key"
      localDevUrl: "http://localhost:3000"
    }
    mainnet: {
      piInitSandbox: false
      expectedPortalNetwork: "Mainnet"
      expectedKeyType: "Mainnet production API key"
      note: "Real π — irreversible payments"
    }
  }
  endpoints: {
    health: "/api/health"
    live: "/api/health/live"
    paymentsHealth: "/api/payments/health"
    staking: "/api/pi/staking"
    signInCallback: "/signin/callback"
  }
  /**
   * Configured credentials ≠ applied schema.
   * schemaProbe is lightweight (boolean flags from env/durable helpers only).
   * Full object probes belong to operator migration checklist.
   */
  schemaReadiness: {
    probe: "config_and_durable_flags"
    identity: "ready" | "configured_unverified" | "missing"
    sessions: "ready" | "configured_unverified" | "missing"
    messaging: "ready" | "configured_unverified" | "missing"
    payments: "configured_unverified" | "missing"
    economyLedger: "configured_unverified" | "missing"
    membership: "configured_unverified" | "missing"
    marketplace: "configured_unverified" | "missing"
    socialCommunity: "configured_unverified" | "missing"
  }
  ts: string
}

function envFlag(name: string): boolean {
  return Boolean((process.env[name] || "").trim())
}

/**
 * Evaluate foundation readiness. Safe to call from Node API routes only.
 */
export function evaluateReadiness(opts?: {
  hostname?: string | null
}): ReadinessReport {
  const ghcEnv = readGhcServerEnv()
  const isProduction = ghcEnv.isProduction
  const vercelEnv = (
    process.env.VERCEL_ENV ||
    process.env.NEXT_PUBLIC_VERCEL_ENV ||
    ""
  ).trim()
  const nodeEnv = (process.env.NODE_ENV || "").trim() || "undefined"
  const sandbox = resolvePiSandbox({
    hostname: opts?.hostname,
    vercelEnv,
  })
  const networkLabel = sandbox ? "sandbox-testnet" : "mainnet"

  const clientId = Boolean(getPiClientId())
  const piApiKey = envFlag("PI_API_KEY") || envFlag("PI_SERVER_API_KEY")
  const supabaseUrl =
    envFlag("SUPABASE_URL") || envFlag("NEXT_PUBLIC_SUPABASE_URL")
  const supabaseService = envFlag("SUPABASE_SERVICE_ROLE_KEY")

  let identityDurable = false
  let sessionDurable = false
  try {
    identityDurable = isPiIdentityDurable()
  } catch {
    /* */
  }
  try {
    sessionDurable = isSessionStoreDurable()
  } catch {
    /* */
  }

  // Messaging durability (required for cross-device chat when feature enabled)
  let messagingDurable = false
  try {
    messagingDurable = isMessagingStoreDurable()
  } catch {
    /* */
  }

  const allowDevAuth =
    process.env.GHC_ALLOW_DEV_AUTH === "1" ||
    process.env.GHC_ALLOW_DEV_AUTH === "true"
  const memoryFinancial =
    process.env.GHC_SERVER_MEMORY === "1" ||
    process.env.GHC_SERVER_MEMORY === "true"

  const checks: ReadinessCheck[] = []

  // --- Critical: Pi identity bridge credentials ---
  checks.push({
    id: "pi_client_id",
    label: "Pi Sign-In Client ID",
    status: clientId ? "pass" : "fail",
    severity: "critical",
    detail: clientId
      ? "NEXT_PUBLIC_PI_CLIENT_ID is set"
      : "Missing NEXT_PUBLIC_PI_CLIENT_ID — Pi Browser shows Sign-In Client ID not configured",
    remediation:
      "Developer Portal → Pi Sign-in → copy oAuth Client ID → Vercel env NEXT_PUBLIC_PI_CLIENT_ID (Production + Preview as needed)",
  })

  checks.push({
    id: "pi_api_key",
    label: "Pi Server API Key",
    status: piApiKey ? "pass" : "fail",
    severity: "critical",
    detail: piApiKey
      ? "PI_API_KEY configured (value not exposed)"
      : "Missing PI_API_KEY — payment approve returns 503 / wallet Payment Expired",
    remediation:
      "Developer Portal → App → API Key for the SAME network (Testnet vs Mainnet) → Vercel PI_API_KEY (server-only, never NEXT_PUBLIC_)",
  })

  // --- Critical in production: durable identity/session ---
  const durableOk = identityDurable && sessionDurable
  const supabaseConfigured = supabaseUrl && supabaseService
  checks.push({
    id: "identity_durable",
    label: "Durable Pi identity mapping",
    status: identityDurable ? "pass" : isProduction ? "fail" : "warn",
    severity: isProduction ? "critical" : "high",
    detail: identityDurable
      ? "gh_pi_identities backed by durable store"
      : "Identity mapping is memory-only — returning users may see onboarding again after cold start",
    remediation:
      "Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and apply migration gh_pi_identities",
  })

  checks.push({
    id: "session_durable",
    label: "Durable GH server sessions",
    status: sessionDurable ? "pass" : isProduction ? "fail" : "warn",
    severity: isProduction ? "critical" : "high",
    detail: sessionDurable
      ? "gh_sessions backed by durable store"
      : "Sessions are memory-only — multi-instance / redeploy drops auth state",
    remediation:
      "Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and apply migration gh_sessions",
  })

  checks.push({
    id: "supabase_config",
    label: "Supabase configuration",
    status: supabaseConfigured ? "pass" : isProduction ? "fail" : "warn",
    severity: isProduction ? "critical" : "high",
    detail: supabaseConfigured
      ? "URL + service role present"
      : "Supabase URL or service role missing",
    remediation:
      "Vercel: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY",
  })

  checks.push({
    id: "messaging_durable",
    label: "Durable messaging store",
    status: messagingDurable ? "pass" : isProduction ? "warn" : "info",
    severity: isProduction ? "high" : "medium",
    detail: messagingDurable
      ? "gh_conversations / gh_messages backed by durable store"
      : "Messaging store not durable — enable after applying 20260919_gh_messaging_durable migration",
    remediation:
      "Apply supabase/migrations/20260919_gh_messaging_durable.sql; set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY; optional NEXT_PUBLIC_MESSAGING_DURABLE=1",
  })

  checks.push({
    id: "profile_store_config",
    label: "Profile / progress store config",
    status: supabaseConfigured ? "pass" : isProduction ? "warn" : "info",
    severity: "high",
    detail: supabaseConfigured
      ? "Supabase configured for gh_user_profiles / achievements (apply 20260919_gh_user_profiles_and_progress)"
      : "Profile durability needs Supabase + migration 20260919_gh_user_profiles_and_progress",
    remediation:
      "Apply migration 20260919_gh_user_profiles_and_progress.sql after identity migrations",
  })

  // --- High: network consistency ---
  // Production + sandbox flag is a critical misconfiguration (Testnet π / keys on Mainnet host).
  const sandboxInProduction = Boolean(isProduction && sandbox)
  checks.push({
    id: "pi_network_mode",
    label: "Pi network mode (sandbox vs mainnet)",
    status: sandboxInProduction ? "fail" : "info",
    severity: sandboxInProduction ? "critical" : "info",
    detail: sandboxInProduction
      ? "NEXT_PUBLIC_PI_SANDBOX appears enabled while runtime is production — refuse treating this as Mainnet-ready"
      : sandbox
        ? "sandbox=true → expect Testnet portal app + Testnet API key"
        : "sandbox=false → expect Mainnet portal app + Mainnet API key (real π)",
    remediation: sandboxInProduction
      ? "On Vercel Production set NEXT_PUBLIC_PI_SANDBOX=false and use Mainnet Pi credentials + Mainnet Supabase"
      : "Align NEXT_PUBLIC_PI_SANDBOX, Developer Portal App Network, and PI_API_KEY network. Mixing causes approve failures and auth confusion.",
  })

  // --- Critical security: dev auth must not be on in production ---
  if (isProduction && allowDevAuth) {
    checks.push({
      id: "dev_auth_locked",
      label: "Dev authentication disabled in production",
      status: "fail",
      severity: "critical",
      detail: "GHC_ALLOW_DEV_AUTH is enabled while running as production",
      remediation: "Unset GHC_ALLOW_DEV_AUTH on Production Vercel environment",
    })
  } else {
    checks.push({
      id: "dev_auth_locked",
      label: "Dev authentication policy",
      status: "pass",
      severity: "high",
      detail: isProduction
        ? "Dev Bearer user:<id> blocked in production"
        : allowDevAuth
          ? "Dev auth allowed (non-production only)"
          : "Dev auth not enabled",
    })
  }

  // --- Critical: memory financial flag must not be set in production ---
  // allowMemoryServer() already returns false on Vercel/production; this flags misconfiguration.
  if (isProduction && memoryFinancial) {
    checks.push({
      id: "memory_finance",
      label: "Financial store durability",
      status: "fail",
      severity: "critical",
      detail:
        "GHC_SERVER_MEMORY is set in a production runtime — process memory must never be financial authority",
      remediation:
        "Unset GHC_SERVER_MEMORY on Production. Require SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY for ledger paths",
    })
  } else if (isProduction && !supabaseConfigured) {
    checks.push({
      id: "memory_finance",
      label: "Financial store durability",
      status: "fail",
      severity: "critical",
      detail:
        "Production runtime without privileged Supabase configuration — durable GHC ledger unavailable",
      remediation:
        "Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY on Production (never rely on process memory)",
    })
  } else {
    checks.push({
      id: "memory_finance",
      label: "Financial store durability",
      status: "pass",
      severity: "high",
      detail: isProduction
        ? "Production memory financial flag not set; durable DB path expected"
        : "Non-production: memory ledger allowed only when allowMemoryServer() permits",
    })
  }

  // Aggregate
  const warnings = checks
    .filter((c) => c.status === "warn")
    .map((c) => `${c.label}: ${c.detail || c.id}`)

  const criticalFails = checks.some(
    (c) => c.status === "fail" && c.severity === "critical"
  )
  const highFails = checks.some(
    (c) => c.status === "fail" && c.severity === "high"
  )

  // Production + critical fail → not_ready (HTTP 503).
  // Non-production critical fail → degraded (still HTTP 200 for local DX).
  let status: ReadinessLevel = "ready"
  if (criticalFails) {
    status = isProduction ? "not_ready" : "degraded"
  } else if (highFails || warnings.length > 0) {
    status = "degraded"
  }

  const strictlyReady = !criticalFails

  return {
    ok: true,
    /** True when no critical blockers (warnings may still exist → status degraded) */
    ready: strictlyReady,
    status,
    service: "gh-connect",
    version: process.env.npm_package_version || "0.59.4",
    environment: {
      nodeEnv,
      vercelEnv: vercelEnv || "local",
      isProduction,
      piSandbox: sandbox,
      networkLabel,
    },
    checks,
    blockers: checks
      .filter((c) => c.status === "fail" && c.severity === "critical")
      .map((c) => c.remediation || c.detail || c.id),
    warnings: warnings,
    networkMatrix: {
      current: networkLabel,
      sandbox: {
        piInitSandbox: true,
        expectedPortalNetwork: "Testnet",
        expectedKeyType: "Testnet / Develop API key",
        localDevUrl: "http://localhost:3000",
      },
      mainnet: {
        piInitSandbox: false,
        expectedPortalNetwork: "Mainnet",
        expectedKeyType: "Mainnet production API key",
        note: "Real π — irreversible payments",
      },
    },
    endpoints: {
      health: "/api/health",
      live: "/api/health/live",
      paymentsHealth: "/api/payments/health",
      staking: "/api/pi/staking",
      signInCallback: "/signin/callback",
    },
    schemaReadiness: {
      probe: "config_and_durable_flags" as const,
      identity: identityDurable
        ? ("ready" as const)
        : supabaseConfigured
          ? ("configured_unverified" as const)
          : ("missing" as const),
      sessions: sessionDurable
        ? ("ready" as const)
        : supabaseConfigured
          ? ("configured_unverified" as const)
          : ("missing" as const),
      messaging: messagingDurable
        ? ("ready" as const)
        : supabaseConfigured
          ? ("configured_unverified" as const)
          : ("missing" as const),
      payments: supabaseConfigured
        ? ("configured_unverified" as const)
        : ("missing" as const),
      economyLedger: supabaseConfigured
        ? ("configured_unverified" as const)
        : ("missing" as const),
      membership: supabaseConfigured
        ? ("configured_unverified" as const)
        : ("missing" as const),
      marketplace: supabaseConfigured
        ? ("configured_unverified" as const)
        : ("missing" as const),
      socialCommunity: supabaseConfigured
        ? ("configured_unverified" as const)
        : ("missing" as const),
    },
    ts: new Date().toISOString(),
  }
}

/** HTTP status for readiness: 503 only when production and not ready */
export function readinessHttpStatus(report: ReadinessReport): 200 | 503 {
  if (report.environment.isProduction && report.status === "not_ready") {
    return 503
  }
  return 200
}
