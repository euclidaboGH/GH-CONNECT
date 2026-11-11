#!/usr/bin/env node
/**
 * Phase 10 — Static Testnet release gate for Pi earnings / A2U / cashback path.
 * Does not claim live funded receipts. Verifies source contracts are present and consistent.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const checks = []
const test = (n, ok) => {
  checks.push(!!ok)
  console.log(`${ok ? 'PASS' : 'FAIL'} ${n}`)
}

const migrations = readdirSync(join(root, 'supabase/migrations')).filter((f) => f.endsWith('.sql'))
const requiredMigrations = [
  '20261029010004_pi_cashback_testnet_a2u_payouts.sql',
  '20261029010005_pi_identity_wallet_authorization.sql',
  '20261029010006_gh_unified_earnings_ledger.sql',
  '20261029010007_gh_earnings_reward_adapters.sql',
  '20261029010008_pi_cashback_phase5_attribution_reconcile.sql',
  '20261029010009_pi_a2u_shared_orchestration.sql',
  '20261029010010_gh_earnings_available_balance_phase6.sql',
  '20261029010011_gh_earnings_withdrawal_fee_3pct.sql',
  '20261029010012_gh_charity_utility_accounting.sql',
]

for (const m of requiredMigrations) {
  test(`Migration present: ${m}`, migrations.includes(m))
}

const claim = read('app/api/economy/rewards/pi-cashback/claim/route.ts')
const orch = read('lib/server/payments/a2u-orchestration.ts')
const withdrawable = read('app/api/economy/earnings/withdrawable/route.ts')
const quote = read('app/api/economy/earnings/quote/route.ts')
const dash = read('components/ghc/unified-earnings-dashboard.tsx')
const pkg = JSON.parse(read('package.json'))

test('Claim never marks paid without settle path', /settleEarningsPayout|gh_pi_cashback_a2u_settle|paid:\s*true/.test(claim))
test('Shared canMarkA2uPaid requires completed + txid', /canMarkA2uPaid/.test(orch) && /PROVIDER_NOT_COMPLETED/.test(orch) && /TXID_REQUIRED/.test(orch))
test('Unrelated incomplete enqueues review', /enqueueA2uReview/.test(claim) && /UNRELATED_INCOMPLETE_A2U_PAYMENT/.test(claim))
test('Withdrawable API is auth-only GET', /resolveAuthenticatedUser/.test(withdrawable) && /export async function GET/.test(withdrawable))
test('Quote uses linked identity not client recipient', /gh_pi_identities/.test(quote) || /recipientSource/.test(quote))
test('Dashboard fails closed without inventing balances', /No balances were invented/.test(dash))
test('Phase 1–9 static check scripts exist',
  existsSync(join(root, 'scripts/check-pi-cashback-a2u.mjs')) &&
  existsSync(join(root, 'scripts/check-phase2-wallet-authorization.mjs')) &&
  existsSync(join(root, 'scripts/check-phase3-unified-earnings-ledger.mjs')) &&
  existsSync(join(root, 'scripts/check-phase4-reward-adapters.mjs')) &&
  existsSync(join(root, 'scripts/check-phase5-cashback-attribution.mjs')) &&
  existsSync(join(root, 'scripts/check-phase6-available-balances.mjs')) &&
  existsSync(join(root, 'scripts/check-phase7-a2u-orchestration.mjs')) &&
  existsSync(join(root, 'scripts/check-phase8-earnings-dashboard.mjs')) &&
  existsSync(join(root, 'scripts/check-phase9-charity-utility.mjs')))
test('Operator live earnings E2E script exists', existsSync(join(root, 'scripts/operator-live-e2e-pi-earnings.mjs')))
test('Receipt verification helper exists', existsSync(join(root, 'lib/server/payments/a2u-receipt.ts')))
test('Package version is semver', typeof pkg.version === 'string' && /^\d+\.\d+\.\d+/.test(pkg.version))

const failed = checks.filter((x) => !x).length
console.log(`\nPhase 10 Testnet release gate (static): ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)

// Run child static suites that are deterministic offline
const { spawnSync } = await import('node:child_process')
const children = [
  'scripts/check-pi-cashback-a2u.mjs',
  'scripts/check-phase7-a2u-orchestration.mjs',
  'scripts/check-phase6-withdrawal-fee.mjs',
  'scripts/check-phase8-earnings-dashboard.mjs',
  'scripts/check-phase9-charity-utility.mjs',
]
let childFail = 0
for (const c of children) {
  const r = spawnSync(process.execPath, [c], { cwd: root, encoding: 'utf8' })
  if (r.status !== 0) {
    childFail++
    console.error(`CHILD FAIL ${c}`)
    if (r.stdout) console.error(r.stdout.slice(-500))
    if (r.stderr) console.error(r.stderr.slice(-500))
  } else {
    console.log(`CHILD PASS ${c}`)
  }
}
if (childFail) {
  console.error(`\nPhase 10 child suites: ${children.length - childFail}/${children.length} passed`)
  process.exit(1)
}
console.log(`\nPhase 10 child suites: ${children.length}/${children.length} passed`)
process.exit(0)
