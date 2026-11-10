#!/usr/bin/env node
/**
 * Source contract for GET /api/health/withdrawals — Testnet withdrawal infrastructure probe.
 */
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
const read = (p) => readFileSync(join(root, p), "utf8")
const checks = []
const test = (n, ok) => {
  checks.push(!!ok)
  console.log(`${ok ? "PASS" : "FAIL"} ${n}`)
}

const routePath = "app/api/health/withdrawals/route.ts"
const modPath = "lib/server/health/withdrawals-health.ts"

test("withdrawals health route exists", existsSync(join(root, routePath)))
test("withdrawals health module exists", existsSync(join(root, modPath)))

if (!existsSync(join(root, routePath)) || !existsSync(join(root, modPath))) {
  console.log(`\nWithdrawals health: ${checks.filter(Boolean).length}/${checks.length} passed`)
  process.exit(1)
}

const route = read(routePath)
const mod = read(modPath)

test("route is GET-only force-dynamic nodejs", /export async function GET/.test(route) && /force-dynamic/.test(route) && /runtime = "nodejs"/.test(route))
test("no-store cache headers", /no-store/.test(route))
test("uses evaluateWithdrawalsHealth", /evaluateWithdrawalsHealth/.test(route) && /evaluateWithdrawalsHealth/.test(mod))
test("scope marks infrastructure only", /userEligibilityEvaluated:\s*false/.test(mod) && /kind:\s*"infrastructure"/.test(mod))
test("probes database connectivity", /probeSupabaseConnectivity/.test(mod) || /SUPABASE_REACHABLE/.test(mod))
test("probes Pi Platform API without creating payouts", /probePiPlatformApi/.test(mod) && /No payout was attempted/.test(mod))
test("probes wallet authorization RPC and table", /gh_pi_wallet_authorization_get/.test(mod) && /gh_pi_wallet_authorizations/.test(mod))
test("does not expose service role key in responses", !/serviceRoleKey:/.test(mod) && !/PI_API_KEY\}/.test(mod))
test("AbortSignal timeouts on upstream probes", /AbortSignal\.timeout/.test(mod))
test("documents WALLET_AUTHORIZATION_REQUIRED enforcement", /WALLET_AUTHORIZATION_REQUIRED/.test(mod) || /assert_payout/.test(mod))
test("rollup statuses ready|degraded|not_ready", /"ready"/.test(mod) && /"degraded"/.test(mod) && /"not_ready"/.test(mod))
test("anonymous readiness uses report.ok rather than an invalid status comparison", route.includes("ok: report.ok") && !route.includes("report.status !== \"blocked\""))
test("does not call A2U create/complete", !/payments\/a2u\/create/.test(mod) && !/a2u\/complete/.test(mod) && !/createPayment/.test(mod))


test("detects PostgreSQL undefined_column 42703", /42703/.test(mod) && /SCHEMA_UNDEFINED_COLUMN/.test(mod))
test("does not call quote_withdrawal in health probes", !/name: "gh_earnings_quote_withdrawal"/.test(mod))
test("probes withdrawable and balances with correct args", /gh_earnings_withdrawable/.test(mod) && /gh_earnings_balances/.test(mod) && /p_asset:\s*"PI"/.test(mod))
test("auth table selects gh_user_id", /select=gh_user_id/.test(mod))
test("documents ledger service_role revoke", /service_role revoked on ledger/.test(mod))

const failed = checks.filter((x) => !x).length
console.log(`\nWithdrawals health: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
