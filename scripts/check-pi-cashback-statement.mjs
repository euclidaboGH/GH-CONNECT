#!/usr/bin/env node
/** Static contract for the authenticated read-only Pi cashback statement. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
const read = (p) => readFileSync(join(process.cwd(), p), 'utf8')
const sql = read('supabase/migrations/20261029010002_pi_cashback_user_statement_rpc.sql')
const route = read('app/api/economy/rewards/pi-cashback/route.ts')
const card = read('components/ghc/pi-cashback-summary.tsx')
const rewards = read('components/ghc/rewards-centre-screen.tsx')
const wallet = read('features/wallet/wallet-screen.tsx')
const inventory = read('scripts/generate-migration-inventory.mjs')
const checks = [
  ['statement RPC returns only rows for the supplied canonical user ID', /WHERE e\.user_id = v_user_id/.test(sql) && /WHERE user_id = v_user_id/.test(sql)],
  ['statement RPC has a bounded limit', /LEAST\(50, GREATEST\(1, COALESCE\(p_limit, 12\)\)\)/.test(sql)],
  ['statement RPC is server-only and table access remains unavailable', /REVOKE ALL ON FUNCTION public\.gh_pi_cashback_user_statement\(text,integer\) FROM PUBLIC, anon, authenticated/.test(sql) && /TO service_role/.test(sql)],
  ['statement labels calculated entitlements as not withdrawable', /calculated_not_withdrawable/.test(sql) && /'withdrawalEnabled', false/.test(sql)],
  ['API uses authenticated server identity rather than caller-supplied user ID', /resolveAuthenticatedUser\(request\.headers\)/.test(route) && /p_user_id: auth\.userId/.test(route) && !/searchParams\.get\(['"]userId/.test(route)],
  ['API is private/no-store and has a bounded upstream timeout', /Cache-Control/.test(route) && /cache: "no-store"/.test(route) && /AbortSignal\.timeout\(8_000\)/.test(route)],
  ['API fails closed when migration or privileged database configuration is missing', /CASHBACK_STATEMENT_UNAVAILABLE/.test(route) && /CASHBACK_SERVICE_UNAVAILABLE/.test(route)],
  ['atomic amounts are rendered without floating-point conversion', /BigInt\(value\)/.test(card) && !/Number\(value\).*10_000_000/.test(card)],
  ['UI only enables payout when server flags permit Testnet and keeps Mainnet disabled', /payload\?\.withdrawalEnabled/.test(card) && /Testnet only/.test(card) && /Mainnet payouts are not enabled/.test(card)],
  ['UI is embedded inside Rewards Center and Wallet, not a new top-level section', /<PiCashbackSummary \/>/.test(rewards) && /<PiCashbackSummary \/>/.test(wallet)],
  ['migration is marked for review and not auto-applied', /20261029010002_pi_cashback_user_statement_rpc\.sql/.test(inventory) && /REVIEW_REQUIRED/.test(inventory) && /disposable PostgreSQL/.test(inventory)],
]
let failed = 0
for (const [name, pass] of checks) { console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`); if (!pass) failed++ }
console.log(`\nPi cashback statement contract: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
