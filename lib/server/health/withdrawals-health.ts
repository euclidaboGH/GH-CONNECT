/**
 * Read-only Testnet withdrawal infrastructure diagnostics.
 * Never initiates payouts, never mutates ledger state, never exposes secrets.
 * Infrastructure health ≠ per-user withdrawal eligibility.
 */
import { readGhcServerEnv, hasPrivilegedDatabase } from "@/lib/server/economy/env"
import { getPiApiKey } from "@/lib/server/payments/pi-api"
import { resolvePiSandbox, getPiClientId } from "@/lib/pi-env"

export type ComponentStatus = "ok" | "degraded" | "unavailable" | "not_configured" | "skipped"

export type WithdrawalsHealthComponent = {
  id: string
  status: ComponentStatus
  /** Machine-safe code for operators (no secrets). */
  code?: string
  detail: string
  checkedAt: string
  latencyMs?: number
}

export type WithdrawalsPayoutGate = {
  variable: string
  /** What the code requires, e.g. exactly "true" or a minimum length. Secrets show a rule, never a value. */
  required: string
  ok: boolean
  state: "ok" | "missing" | "empty" | "wrong_value" | "wrong_format"
  hint: string
}

export type WithdrawalsHealthReport = {
  ok: boolean
  service: "ghc-withdrawals-health"
  /** Overall infrastructure posture for A2U earnings withdrawals. */
  status: "ready" | "degraded" | "not_ready"
  checkedAt: string
  environment: {
    vercelEnv: string | null
    nodeEnv: string | null
    isPreview: boolean
    isProduction: boolean
    piSandboxResolved: boolean
    hostname: string | null
  }
  /**
   * Explicit boundary: this report never asserts that a given user can withdraw.
   * User eligibility requires auth, linked Pi identity, active wallet authorization,
   * positive withdrawable balance, and server policy checks.
   */
  scope: {
    kind: "infrastructure"
    userEligibilityEvaluated: false
    note: "Per-user withdrawable balance and authorization must be checked via authenticated /api/economy/earnings/withdrawable after Pi wallet authorization."
  }
  components: WithdrawalsHealthComponent[]
  /** Exact per-variable result of the gates the withdrawal request + payout worker enforce. Values are never exposed. */
  payoutGates: WithdrawalsPayoutGate[]
  /** First gate that will block a withdrawal right now, or null when all pass. */
  firstBlockingGate: string | null
  flags: Record<string, boolean>
  configPresence: Record<string, boolean>
}

function nowIso(): string {
  return new Date().toISOString()
}

function envTruthy(name: string): boolean {
  const v = String(process.env[name] ?? "").trim().toLowerCase()
  return v === "1" || v === "true" || v === "yes" || v === "on"
}

function envPresent(name: string): boolean {
  return Boolean(String(process.env[name] ?? "").trim())
}

async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; latencyMs: number }> {
  const started = Date.now()
  const result = await fn()
  return { result, latencyMs: Date.now() - started }
}

function parsePostgrestError(bodyText: string, httpStatus: number): {
  undefinedColumn?: string
  code?: string
  message?: string
} {
  const text = String(bodyText || "")
  let parsed: Record<string, unknown> | null = null
  try {
    parsed = JSON.parse(text) as Record<string, unknown>
  } catch {
    parsed = null
  }
  const code = String(parsed?.code || parsed?.hint || "")
  const message = String(parsed?.message || parsed?.error || text || "")
  // PostgreSQL SQLSTATE 42703
  const colMatch =
    message.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+does not exist/i) ||
    message.match(/undefined_column[^a-zA-Z0-9_]+([a-zA-Z0-9_]+)/i)
  if (code === "42703" || /undefined_column/i.test(message) || colMatch) {
    return {
      undefinedColumn: colMatch?.[1],
      code: "42703",
      message: message.slice(0, 240),
    }
  }
  if (httpStatus >= 400 && parsed) {
    return { code: code || `HTTP_${httpStatus}`, message: message.slice(0, 240) }
  }
  return { message: message.slice(0, 240) || undefined }
}


async function probeSupabaseConnectivity(): Promise<WithdrawalsHealthComponent> {
  const checkedAt = nowIso()
  const env = readGhcServerEnv()
  if (!hasPrivilegedDatabase() || !env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return {
      id: "database",
      status: "not_configured",
      code: "SUPABASE_CREDENTIALS_MISSING",
      detail:
        "Privileged Supabase URL/service role not configured. Withdrawal ledger RPCs cannot run on this deployment.",
      checkedAt,
    }
  }
  const base = env.supabaseUrl.replace(/\/$/, "")
  try {
    const { result, latencyMs } = await timed(async () => {
      // Minimal PostgREST root probe — does not return table data.
      const res = await fetch(`${base}/rest/v1/`, {
        method: "GET",
        headers: {
          apikey: env.supabaseServiceRoleKey!,
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
          Accept: "application/openapi+json, application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      })
      return { ok: res.ok || res.status === 200 || res.status === 404, status: res.status }
    })
    if (!result.ok && result.status >= 500) {
      return {
        id: "database",
        status: "unavailable",
        code: `SUPABASE_HTTP_${result.status}`,
        detail: "Supabase REST responded with a server error during connectivity probe.",
        checkedAt,
        latencyMs,
      }
    }
    return {
      id: "database",
      status: "ok",
      code: "SUPABASE_REACHABLE",
      detail: "Supabase REST endpoint accepted the service-role probe.",
      checkedAt,
      latencyMs,
    }
  } catch (error) {
    const code =
      error instanceof Error && error.name === "TimeoutError"
        ? "SUPABASE_TIMEOUT"
        : "SUPABASE_NETWORK_ERROR"
    return {
      id: "database",
      status: "unavailable",
      code,
      detail: "Could not reach Supabase REST within the probe timeout.",
      checkedAt,
    }
  }
}

async function probeWalletAuthorizationRpc(): Promise<WithdrawalsHealthComponent> {
  const checkedAt = nowIso()
  const env = readGhcServerEnv()
  if (!hasPrivilegedDatabase() || !env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return {
      id: "wallet_authorization_rpc",
      status: "not_configured",
      code: "SUPABASE_CREDENTIALS_MISSING",
      detail: "Cannot probe gh_pi_wallet_authorization_* RPCs without privileged database credentials.",
      checkedAt,
    }
  }
  const base = env.supabaseUrl.replace(/\/$/, "")
  // Synthetic UUID — never a real user; expects structured application error, not transport failure.
  const syntheticUserId = "00000000-0000-4000-8000-000000000000"
  try {
    const { result, latencyMs } = await timed(async () => {
      const res = await fetch(`${base}/rest/v1/rpc/gh_pi_wallet_authorization_get`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.supabaseServiceRoleKey!,
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
          Accept: "application/json",
        },
        body: JSON.stringify({ p_user_id: syntheticUserId }),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      })
      const body = (await res.json().catch(() => null)) as Record<string, unknown> | null
      return { status: res.status, body, ok: res.ok }
    })

    // Missing function → PostgREST often 404 / PGRST202
    const errText = JSON.stringify(result.body || {})
    if (result.status === 404 || /PGRST202|Could not find the function/i.test(errText)) {
      return {
        id: "wallet_authorization_rpc",
        status: "unavailable",
        code: "RPC_NOT_APPLIED",
        detail:
          "gh_pi_wallet_authorization_get is not available. Apply Pi wallet authorization migrations before Testnet withdrawals.",
        checkedAt,
        latencyMs,
      }
    }

    const bodyText = typeof result.body === "string" ? result.body : JSON.stringify(result.body ?? "")
    const pgErr = parsePostgrestError(bodyText, result.status)
    if (pgErr.code === "42703" || pgErr.undefinedColumn) {
      return {
        id: "wallet_authorization_rpc",
        status: "unavailable",
        code: "SCHEMA_UNDEFINED_COLUMN",
        detail:
          `PostgreSQL 42703 in gh_pi_wallet_authorization_get` +
          (pgErr.undefinedColumn ? ` (column: ${pgErr.undefinedColumn})` : "") +
          ". Expected columns on gh_pi_wallet_authorizations: id, gh_user_id, pi_app_uid, status, consented_at, last_verified_at; on gh_pi_identities: gh_user_id, pi_app_uid, pi_username.",
        checkedAt,
        latencyMs,
      }
    }

    // Function exists: response may be ok:false for unknown user — that still proves RPC path.
    if (result.body && typeof result.body === "object") {
      return {
        id: "wallet_authorization_rpc",
        status: "ok",
        code: "RPC_REACHABLE",
        detail:
          "gh_pi_wallet_authorization_get responded. Active authorization is still required per user before payouts.",
        checkedAt,
        latencyMs,
      }
    }

    if (result.status >= 500) {
      return {
        id: "wallet_authorization_rpc",
        status: "unavailable",
        code: `RPC_HTTP_${result.status}`,
        detail: "Wallet authorization RPC returned a server error.",
        checkedAt,
        latencyMs,
      }
    }

    return {
      id: "wallet_authorization_rpc",
      status: "degraded",
      code: `RPC_HTTP_${result.status}`,
      detail: "Unexpected response shape from wallet authorization RPC.",
      checkedAt,
      latencyMs,
    }
  } catch {
    return {
      id: "wallet_authorization_rpc",
      status: "unavailable",
      code: "RPC_NETWORK_ERROR",
      detail: "Network/timeout while probing wallet authorization RPC.",
      checkedAt,
    }
  }
}

async function probeWalletAuthorizationTable(): Promise<WithdrawalsHealthComponent> {
  const checkedAt = nowIso()
  const env = readGhcServerEnv()
  if (!hasPrivilegedDatabase() || !env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return {
      id: "wallet_authorization_table",
      status: "not_configured",
      code: "SUPABASE_CREDENTIALS_MISSING",
      detail: "Cannot probe gh_pi_wallet_authorizations without privileged database credentials.",
      checkedAt,
    }
  }
  const base = env.supabaseUrl.replace(/\/$/, "")
  try {
    const { result, latencyMs } = await timed(async () => {
      const res = await fetch(`${base}/rest/v1/gh_pi_wallet_authorizations?select=gh_user_id&limit=0`, {
        method: "GET",
        headers: {
          apikey: env.supabaseServiceRoleKey!,
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
          Accept: "application/json",
          Prefer: "count=exact",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      })
      const text = await res.text().catch(() => "")
      return { status: res.status, text }
    })
    if (result.status === 200 || result.status === 206) {
      return {
        id: "wallet_authorization_table",
        status: "ok",
        code: "TABLE_REACHABLE",
        detail:
          "gh_pi_wallet_authorizations is reachable. Rows are not enumerated; active consent is still enforced per payout.",
        checkedAt,
        latencyMs,
      }
    }
    if (result.status === 404 || /PGRST205|relation|does not exist/i.test(result.text)) {
      return {
        id: "wallet_authorization_table",
        status: "unavailable",
        code: "TABLE_NOT_APPLIED",
        detail: "gh_pi_wallet_authorizations table is missing. Apply wallet authorization migrations.",
        checkedAt,
        latencyMs,
      }
    }
    const pgErr = parsePostgrestError(result.text, result.status)
    if (pgErr.code === "42703" || pgErr.undefinedColumn) {
      return {
        id: "wallet_authorization_table",
        status: "unavailable",
        code: "SCHEMA_UNDEFINED_COLUMN",
        detail:
          `PostgreSQL 42703 on gh_pi_wallet_authorizations select` +
          (pgErr.undefinedColumn ? ` (column: ${pgErr.undefinedColumn})` : "") +
          ". Canonical columns include gh_user_id, pi_app_uid, status, id (migration 20261029010005).",
        checkedAt,
        latencyMs,
      }
    }
    return {
      id: "wallet_authorization_table",
      status: "degraded",
      code: `TABLE_HTTP_${result.status}`,
      detail: "Unexpected status probing wallet authorization table.",
      checkedAt,
      latencyMs,
    }
  } catch {
    return {
      id: "wallet_authorization_table",
      status: "unavailable",
      code: "TABLE_NETWORK_ERROR",
      detail: "Network/timeout while probing wallet authorization table.",
      checkedAt,
    }
  }
}

async function probeEarningsWithdrawableRpc(): Promise<WithdrawalsHealthComponent> {
  const checkedAt = nowIso()
  const env = readGhcServerEnv()
  if (!hasPrivilegedDatabase() || !env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return {
      id: "earnings_withdrawable_rpc",
      status: "not_configured",
      code: "SUPABASE_CREDENTIALS_MISSING",
      detail: "Cannot probe withdrawable balance RPC without privileged database credentials.",
      checkedAt,
    }
  }
  const base = env.supabaseUrl.replace(/\/$/, "")
  const syntheticUserId = "00000000-0000-4000-8000-000000000000"

  // Only call RPCs with signatures that match migrations.
  // Do NOT call gh_earnings_quote_withdrawal without p_gross_atomic (requires text, numeric).
  const probes: Array<{ name: string; body: Record<string, unknown> }> = [
    { name: "gh_earnings_withdrawable", body: { p_user_id: syntheticUserId } },
    { name: "gh_earnings_balances", body: { p_user_id: syntheticUserId, p_asset: "PI" } },
  ]

  try {
    let lastLatency = 0
    let sawUndefinedColumn: { column?: string; fn: string; message?: string } | null = null
    let reachedOk = false
    let reachedName: string | null = null

    for (const probe of probes) {
      const { result, latencyMs } = await timed(async () => {
        const res = await fetch(`${base}/rest/v1/rpc/${probe.name}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: env.supabaseServiceRoleKey!,
            Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
            Accept: "application/json",
          },
          body: JSON.stringify(probe.body),
          cache: "no-store",
          signal: AbortSignal.timeout(8_000),
        })
        const body = await res.text().catch(() => "")
        return { status: res.status, body }
      })
      lastLatency = latencyMs

      if (result.status === 404 || /PGRST202|Could not find the function/i.test(result.body)) {
        continue
      }

      const err = parsePostgrestError(result.body, result.status)
      if (err.code === "42703" || err.undefinedColumn) {
        sawUndefinedColumn = {
          column: err.undefinedColumn,
          fn: probe.name,
          message: err.message,
        }
        // Continue to see if balances works when withdrawable is broken
        continue
      }

      // JSON body with ok true/false both prove the function executed
      try {
        const json = JSON.parse(result.body) as { ok?: boolean; error?: string }
        if (typeof json === "object" && json !== null) {
          reachedOk = true
          reachedName = probe.name
          break
        }
      } catch {
        /* non-json */
      }

      if (result.status >= 200 && result.status < 300) {
        reachedOk = true
        reachedName = probe.name
        break
      }

      if (result.status >= 500) {
        return {
          id: "earnings_withdrawable_rpc",
          status: "unavailable",
          code: `RPC_HTTP_${result.status}`,
          detail: `Earnings RPC ${probe.name} returned HTTP ${result.status}. ${err.message || ""}`.trim(),
          checkedAt,
          latencyMs,
        }
      }
    }

    if (sawUndefinedColumn && !reachedOk) {
      const col = sawUndefinedColumn.column || "unknown"
      return {
        id: "earnings_withdrawable_rpc",
        status: "unavailable",
        code: "SCHEMA_UNDEFINED_COLUMN",
        detail:
          `PostgreSQL 42703 undefined_column while executing ${sawUndefinedColumn.fn}` +
          (col !== "unknown" ? ` (column: ${col})` : "") +
          ". Compare applied migrations to function body; fee-aware withdrawable requires gh_earnings_payout_policy.fee_bps from 20261029010011.",
        checkedAt,
        latencyMs: lastLatency,
      }
    }

    if (reachedOk) {
      return {
        id: "earnings_withdrawable_rpc",
        status: "ok",
        code: "WITHDRAWABLE_RPC_REACHABLE",
        detail: `Reached earnings RPC (${reachedName}). User eligibility is not computed here.`,
        checkedAt,
        latencyMs: lastLatency,
      }
    }

    // Ledger table: service_role is revoked in migration — do not treat REST select as authority.
    // Existence is confirmed only via SECURITY DEFINER RPCs above.
    return {
      id: "earnings_withdrawable_rpc",
      status: "unavailable",
      code: "EARNINGS_RPC_UNREACHABLE",
      detail:
        "gh_earnings_withdrawable / gh_earnings_balances were not reachable. Apply unified earnings + phase 6 migrations. Direct table select is not used (service_role revoked on ledger).",
      checkedAt,
    }
  } catch {
    return {
      id: "earnings_withdrawable_rpc",
      status: "unavailable",
      code: "EARNINGS_PROBE_ERROR",
      detail: "Network/timeout while probing earnings withdrawable path.",
      checkedAt,
    }
  }
}

async function probePiPlatformApi(): Promise<WithdrawalsHealthComponent> {
  const checkedAt = nowIso()
  const apiKey = getPiApiKey()
  if (!apiKey) {
    return {
      id: "pi_platform_api",
      status: "not_configured",
      code: "PI_API_KEY_MISSING",
      detail: "PI_API_KEY is not configured. A2U approve/complete cannot run.",
      checkedAt,
    }
  }
  const env = readGhcServerEnv()
  const base = (env.piPlatformApiUrl || "https://api.minepi.com").replace(/\/$/, "")
  // Probe a non-existent payment id — distinguishes auth vs connectivity without creating payouts.
  const probeId = "00000000-0000-4000-8000-000000000000"
  try {
    const { result, latencyMs } = await timed(async () => {
      const res = await fetch(`${base}/v2/payments/${probeId}`, {
        method: "GET",
        headers: {
          Authorization: `Key ${apiKey}`,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      })
      return { status: res.status }
    })
    // 401/403 → key rejected; 404 → API reachable with accepted auth shape; 5xx → platform issue
    if (result.status === 401 || result.status === 403) {
      return {
        id: "pi_platform_api",
        status: "unavailable",
        code: "PI_API_UNAUTHORIZED",
        detail:
          "Pi Platform rejected the server API key (wrong network or invalid key). No payout was attempted.",
        checkedAt,
        latencyMs,
      }
    }
    if (result.status === 404 || result.status === 400 || result.status === 200) {
      return {
        id: "pi_platform_api",
        status: "ok",
        code: "PI_API_REACHABLE",
        detail:
          "Pi Platform API accepted the authenticated probe. Testnet vs Mainnet must still match NEXT_PUBLIC_PI_SANDBOX.",
        checkedAt,
        latencyMs,
      }
    }
    if (result.status >= 500) {
      return {
        id: "pi_platform_api",
        status: "degraded",
        code: `PI_API_HTTP_${result.status}`,
        detail: "Pi Platform API returned a server error during the read-only probe.",
        checkedAt,
        latencyMs,
      }
    }
    return {
      id: "pi_platform_api",
      status: "degraded",
      code: `PI_API_HTTP_${result.status}`,
      detail: "Unexpected Pi Platform status during read-only probe.",
      checkedAt,
      latencyMs,
    }
  } catch {
    return {
      id: "pi_platform_api",
      status: "unavailable",
      code: "PI_API_NETWORK_ERROR",
      detail: "Network/timeout contacting Pi Platform API. No payout was attempted.",
      checkedAt,
    }
  }
}

function assessFlags(hostname: string | null): {
  flags: Record<string, boolean>
  configPresence: Record<string, boolean>
  components: WithdrawalsHealthComponent[]
} {
  const checkedAt = nowIso()
  const sandbox = resolvePiSandbox({ hostname })
  const flags = {
    piSandboxResolved: sandbox,
    nextPublicPiSandboxExplicitTrue: String(process.env.NEXT_PUBLIC_PI_SANDBOX || "").trim() === "true",
    nextPublicPiSandboxExplicitFalse: String(process.env.NEXT_PUBLIC_PI_SANDBOX || "").trim() === "false",
    ghcTestnetUnlock: envTruthy("GHC_TESTNET_UNLOCK") || envTruthy("NEXT_PUBLIC_GHC_TESTNET_UNLOCK"),
    piA2uTestnetOnly: envTruthy("PI_A2U_TESTNET_ONLY"),
    ghcWithdrawalsEnabled: envTruthy("GHC_WITHDRAWALS_ENABLED"),
  }
  const configPresence = {
    PI_API_KEY: Boolean(getPiApiKey()),
    NEXT_PUBLIC_PI_CLIENT_ID: Boolean(getPiClientId()),
    SUPABASE_URL: Boolean(readGhcServerEnv().supabaseUrl),
    SUPABASE_SERVICE_ROLE_KEY: hasPrivilegedDatabase(),
    PI_EARNINGS_EXECUTOR_KEY: envPresent("PI_EARNINGS_EXECUTOR_KEY"),
    GHC_A2U_ADMIN_KEY: envPresent("GHC_A2U_ADMIN_KEY"),
    PI_PLATFORM_API_URL: envPresent("PI_PLATFORM_API_URL") || envPresent("PI_API_URL"),
  }

  const components: WithdrawalsHealthComponent[] = [
    {
      id: "feature_flags",
      status: sandbox ? "ok" : "degraded",
      code: sandbox ? "TESTNET_SANDBOX_RESOLVED" : "SANDBOX_FALSE",
      detail: sandbox
        ? "Pi sandbox/Testnet resolved true for this host (Preview-safe)."
        : "Pi sandbox resolved false — Mainnet path. Earnings A2U workers remain Testnet-gated in application code.",
      checkedAt,
    },
    {
      id: "a2u_executor_config",
      status:
        configPresence.PI_EARNINGS_EXECUTOR_KEY || configPresence.GHC_A2U_ADMIN_KEY
          ? "ok"
          : "not_configured",
      code:
        configPresence.PI_EARNINGS_EXECUTOR_KEY || configPresence.GHC_A2U_ADMIN_KEY
          ? "EXECUTOR_KEY_PRESENT"
          : "EXECUTOR_KEY_MISSING",
      detail:
        configPresence.PI_EARNINGS_EXECUTOR_KEY || configPresence.GHC_A2U_ADMIN_KEY
          ? "Earnings A2U executor secret is configured (value not exposed). Worker routes remain protected."
          : "PI_EARNINGS_EXECUTOR_KEY / GHC_A2U_ADMIN_KEY missing — automated earnings execution worker cannot authenticate.",
      checkedAt,
    },
    {
      id: "wallet_authorization_enforcement",
      status: "ok",
      code: "ENFORCEMENT_REQUIRED",
      detail:
        "Payout paths must call gh_pi_wallet_authorization_assert_payout. Missing active consent returns WALLET_AUTHORIZATION_REQUIRED. This health check does not grant consent.",
      checkedAt,
    },
  ]

  return { flags, configPresence, components }
}

function rollupStatus(components: WithdrawalsHealthComponent[]): "ready" | "degraded" | "not_ready" {
  const criticalIds = new Set([
    "database",
    "wallet_authorization_rpc",
    "wallet_authorization_table",
    "pi_platform_api",
    "earnings_withdrawable_rpc",
  ])
  const critical = components.filter((c) => criticalIds.has(c.id))
  if (critical.some((c) => c.status === "unavailable" || c.status === "not_configured")) {
    return "not_ready"
  }
  if (components.some((c) => c.status === "degraded" || c.status === "unavailable" || c.status === "not_configured")) {
    return "degraded"
  }
  return "ready"
}

function flagGate(variable: string, expected: string): WithdrawalsPayoutGate {
  const raw = process.env[variable]
  if (raw === undefined) {
    return { variable, required: `exactly "${expected}"`, ok: false, state: "missing", hint: `Not set in this deployment. Add ${variable}=${expected} for this environment (Preview), then redeploy.` }
  }
  if (raw.trim() === "") {
    return { variable, required: `exactly "${expected}"`, ok: false, state: "empty", hint: `Set but empty. Enter the value ${expected}.` }
  }
  if (raw === expected) return { variable, required: `exactly "${expected}"`, ok: true, state: "ok", hint: "OK" }
  const cleaned = raw.trim().replace(/^["']|["']$/g, "").toLowerCase()
  return {
    variable,
    required: `exactly "${expected}"`,
    ok: false,
    state: "wrong_value",
    hint:
      cleaned === expected
        ? `Looks like "${expected}" but has different case, spaces or quote marks. Retype it as plain ${expected}.`
        : `Set, but the value is not "${expected}" (the code compares the exact text).`,
  }
}

function secretGate(variable: string, minLen: number, ...alts: string[]): WithdrawalsPayoutGate {
  const names = [variable, ...alts]
  const best = names.map((n) => String(process.env[n] ?? "").trim()).sort((a, b) => b.length - a.length)[0] ?? ""
  if (!names.some((n) => process.env[n] !== undefined)) {
    return { variable, required: `secret, ${minLen}+ characters`, ok: false, state: "missing", hint: `Not set in this deployment. Create a random secret of ${minLen}+ characters.` }
  }
  if (best.length === 0) return { variable, required: `secret, ${minLen}+ characters`, ok: false, state: "empty", hint: "Set but empty." }
  if (best.length < minLen) return { variable, required: `secret, ${minLen}+ characters`, ok: false, state: "wrong_format", hint: `Too short (needs ${minLen}+ characters).` }
  return { variable, required: `secret, ${minLen}+ characters`, ok: true, state: "ok", hint: "OK" }
}

function evaluatePayoutGates(): WithdrawalsPayoutGate[] {
  const seed = String(process.env.PI_WALLET_PRIVATE_SEED ?? "").trim()
  const seedGate: WithdrawalsPayoutGate = process.env.PI_WALLET_PRIVATE_SEED === undefined
    ? { variable: "PI_WALLET_PRIVATE_SEED", required: "S + 55 chars (A-Z, 2-7)", ok: false, state: "missing", hint: "Not set. Needed by the payout worker (testnet wallet secret)." }
    : /^S[A-Z2-7]{55}$/.test(seed)
      ? { variable: "PI_WALLET_PRIVATE_SEED", required: "S + 55 chars (A-Z, 2-7)", ok: true, state: "ok", hint: "OK" }
      : { variable: "PI_WALLET_PRIVATE_SEED", required: "S + 55 chars (A-Z, 2-7)", ok: false, state: "wrong_format", hint: "Set but not a valid secret seed format (check for spaces, lowercase or a truncated paste)." }
  const apiKeyOk = Boolean(String(process.env.PI_API_KEY || process.env.PI_SERVER_API_KEY || "").trim())
  return [
    flagGate("PI_NETWORK", "testnet"),
    flagGate("PI_EARNINGS_PAYOUT_REQUESTS_ENABLED", "true"),
    flagGate("PI_EARNINGS_PAYOUT_EXECUTION_ENABLED", "true"),
    flagGate("PI_A2U_ENABLED", "true"),
    flagGate("PI_A2U_TESTNET_ONLY", "true"),
    flagGate("PI_ENV", "production"),
    secretGate("GH_PIN_PROOF_SECRET", 32),
    secretGate("PI_EARNINGS_EXECUTOR_KEY", 16, "GHC_A2U_ADMIN_KEY"),
    { variable: "PI_API_KEY", required: "present", ok: apiKeyOk, state: apiKeyOk ? "ok" : "missing", hint: apiKeyOk ? "OK" : "Not set." },
    seedGate,
  ]
}

export async function evaluateWithdrawalsHealth(opts?: {
  hostname?: string | null
}): Promise<WithdrawalsHealthReport> {
  const checkedAt = nowIso()
  const hostname = opts?.hostname ?? null
  const vercelEnv = process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV || null
  const nodeEnv = process.env.NODE_ENV || null
  const isPreview = vercelEnv === "preview"
  const isProduction = vercelEnv === "production" || nodeEnv === "production"

  const staticAssessment = assessFlags(hostname)

  const [database, walletRpc, walletTable, earningsRpc, piApi] = await Promise.all([
    probeSupabaseConnectivity(),
    probeWalletAuthorizationRpc(),
    probeWalletAuthorizationTable(),
    probeEarningsWithdrawableRpc(),
    probePiPlatformApi(),
  ])

  const components = [
    database,
    piApi,
    ...staticAssessment.components,
    walletRpc,
    walletTable,
    earningsRpc,
  ]

  const status = rollupStatus(components)
  const payoutGates = evaluatePayoutGates()

  return {
    ok: status !== "not_ready",
    service: "ghc-withdrawals-health",
    status,
    checkedAt,
    environment: {
      vercelEnv,
      nodeEnv,
      isPreview,
      isProduction,
      piSandboxResolved: resolvePiSandbox({ hostname }),
      hostname,
    },
    scope: {
      kind: "infrastructure",
      userEligibilityEvaluated: false,
      note: "Per-user withdrawable balance and authorization must be checked via authenticated /api/economy/earnings/withdrawable after Pi wallet authorization.",
    },
    components,
    payoutGates,
    firstBlockingGate: payoutGates.find((g) => !g.ok)?.variable ?? null,
    flags: staticAssessment.flags,
    configPresence: staticAssessment.configPresence,
  }
}

export function withdrawalsHealthHttpStatus(report: WithdrawalsHealthReport): number {
  // Preview/Testnet diagnostics remain HTTP 200 when degraded so operators can read JSON;
  // Production hard-fails when infrastructure is not_ready.
  if (report.status === "not_ready" && report.environment.isProduction) return 503
  return 200
}
