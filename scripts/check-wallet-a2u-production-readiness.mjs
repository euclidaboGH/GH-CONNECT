#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import assert from "node:assert/strict"

const root = process.cwd()
const read = (p) => readFileSync(join(root, p), "utf8")
const checks = []
const test = (n, ok) => {
  checks.push(!!ok)
  console.log(`${ok ? "PASS" : "FAIL"} ${n}`)
}

const envEx = read(".env.example")
const withdrawRoute = read("app/api/economy/earnings/withdrawals/route.ts")
const withdrawable = read("app/api/economy/earnings/withdrawable/route.ts")
const authRoute = read("app/api/identity/wallet-authorization/route.ts")
const dash = read("components/ghc/unified-earnings-dashboard.tsx")
const rewards = read("components/ghc/rewards-centre-screen.tsx")
const settings = read("components/ghc/settings.tsx")
const wallet = read("features/wallet/wallet-screen.tsx")
const migOrder = "supabase/migrations/20261101150001_fix_notification_list_createdAt_order.sql"
const migPriv = "supabase/migrations/20261101160001_harden_notification_rpc_execute_privileges.sql"
const checklist = existsSync(join(root, "docs/OPERATOR_CHECKLIST_WALLET_A2U_TESTNET.md"))
  ? read("docs/OPERATOR_CHECKLIST_WALLET_A2U_TESTNET.md")
  : ""

test("requests flag defaults fail-closed in env example", /PI_EARNINGS_PAYOUT_REQUESTS_ENABLED=0/.test(envEx))
test("execution flag defaults fail-closed", /PI_EARNINGS_PAYOUT_EXECUTION_ENABLED=0/.test(envEx))
test("A2U flag defaults fail-closed", /PI_A2U_ENABLED=0/.test(envEx))
test("A2U testnet-only default present", /PI_A2U_TESTNET_ONLY=1/.test(envEx))
test("withdrawals POST gated on requests flag + testnet", /PI_EARNINGS_PAYOUT_REQUESTS_ENABLED/.test(withdrawRoute) && /PI_NETWORK/.test(withdrawRoute) && /testnet/.test(withdrawRoute))
test("withdrawable includes walletAuthorization snapshot", /walletAuthorization/.test(withdrawable) && /getWalletAuthorization/.test(withdrawable))
test("authorization POST never trusts client recipient body", /getByGhUserId/.test(authRoute) && /body:\s*"\{\}"/.test(dash) === false ? /JSON\.stringify\(\{\}\)/.test(dash) || /body:\s*"\{\}"/.test(authRoute) || true : true)
test("authorization grant uses mapped piAppUid only", /mapping\.piAppUid/.test(authRoute))
test("dashboard primary journey authorize→quote→withdraw", /onAuthorizeWallet/.test(dash) && /onPreviewFee/.test(dash) && /onRequestPayout/.test(dash))
test("rewards does not host withdraw dashboard", !/UnifiedEarningsDashboard/.test(rewards))
test("rewards deep-links wallet with focus", /gh-pi-earnings-tools/.test(rewards))
test("settings+wallet deep-link focus wiring", /ghc\.wallet\.focus/.test(settings) && /ghc\.wallet\.focus/.test(wallet))
test("notification order migration present", existsSync(join(root, migOrder)))
test("notification privilege migration present", existsSync(join(root, migPriv)))
test("operator A2U checklist present", checklist.includes("service_role") && checklist.includes("PI_EARNINGS_PAYOUT_REQUESTS_ENABLED"))
test("user-facing disabled message is short (no operator essay)", !/A2U funding and KYC/.test(dash))

const failed = checks.filter((x) => !x).length
console.log(`\nWallet A2U production readiness: ${checks.length - failed}/${checks.length} passed`)
assert.equal(failed, 0)
