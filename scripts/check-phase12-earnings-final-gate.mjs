#!/usr/bin/env node
/**
 * Phase 12 — Final source gate for the Pi earnings / A2U / cashback track (phases 1–11).
 * Network-independent. Does NOT prove: remote migrations, funded Testnet A2U, Mainnet, production approval.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const checks = []
const test = (n, ok) => {
  checks.push(!!ok)
  console.log(`${ok ? 'PASS' : 'FAIL'} ${n}`)
}

const pkg = JSON.parse(read('package.json'))
const release = read('lib/app-release.ts')
const lock = existsSync(join(root, 'package-lock.json'))
  ? JSON.parse(read('package-lock.json'))
  : null

test('package version is 0.169.0', pkg.version === '0.169.0')
test('app-release version matches package', release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`))
if (lock) {
  test('package-lock root version matches', lock.version === pkg.version)
  test('package-lock packages[""] version matches', lock.packages?.['']?.version === pkg.version)
}

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
const migs = readdirSync(join(root, 'supabase/migrations')).filter((f) => f.endsWith('.sql'))
for (const m of requiredMigrations) {
  test(`Migration on disk: ${m}`, migs.includes(m))
}

const phaseDocs = [
  'docs/PHASE1_A2U_RECOVERY_0.157.28.md',
  'docs/PHASE2_WALLET_AUTHORIZATION_0.158.0.md',
  'docs/PHASE3_UNIFIED_EARNINGS_LEDGER_0.159.0.md',
  'docs/PHASE4_REWARD_ADAPTERS_0.160.0.md',
  'docs/PHASE5_CASHBACK_ATTRIBUTION_0.161.0.md',
  'docs/PHASE6_AVAILABLE_BALANCES_0.163.0.md',
  'docs/PHASE6_WITHDRAWAL_FEE_3PCT_0.164.0.md',
  'docs/PHASE7_A2U_ORCHESTRATION_0.162.0.md',
  'docs/PHASE8_EARNINGS_DASHBOARD_0.165.0.md',
  'docs/PHASE9_CHARITY_UTILITY_ACCOUNTING_0.166.0.md',
  'docs/PHASE10_TESTNET_RELEASE_GATE_0.167.0.md',
  'docs/PHASE11_CROSS_FEATURE_RECONCILE_0.168.0.md',
  'docs/PHASE12_EARNINGS_FINAL_RELEASE_0.169.0.md',
]
for (const d of phaseDocs) {
  test(`Doc present: ${d}`, existsSync(join(root, d)))
}

const criticalPaths = [
  'app/api/economy/rewards/pi-cashback/claim/route.ts',
  'lib/server/payments/a2u-orchestration.ts',
  'lib/server/payments/a2u-receipt.ts',
  'lib/server/earnings/unified-ledger.ts',
  'lib/server/earnings/platform-utility.ts',
  'lib/server/economy/cross-feature-reconcile.ts',
  'components/ghc/unified-earnings-dashboard.tsx',
  'scripts/operator-live-e2e-pi-earnings.mjs',
]
for (const p of criticalPaths) {
  test(`Critical path exists: ${p}`, existsSync(join(root, p)))
}

const claim = read('app/api/economy/rewards/pi-cashback/claim/route.ts')
test('Claim uses receipt verification before paid response', /verifyA2uReceipt/.test(claim) && /publicReceiptView/.test(claim))
test('Mainnet not enabled in claim path (Testnet network checks remain)', /Pi Testnet/.test(claim))

const finalDoc = existsSync(join(root, 'docs/PHASE12_EARNINGS_FINAL_RELEASE_0.169.0.md'))
  ? read('docs/PHASE12_EARNINGS_FINAL_RELEASE_0.169.0.md')
  : ''
test('Final doc states NOT APPROVED for production', /NOT APPROVED/.test(finalDoc))
test('Final doc requires funded Testnet receipt', /funded/i.test(finalDoc) && /Testnet/i.test(finalDoc))
test('Final doc requires migration reconcile', /migration/i.test(finalDoc) && /reconcil/i.test(finalDoc))

const failed = checks.filter((x) => !x).length
console.log(`\nPhase 12 earnings final static: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)

const children = [
  'scripts/check-pi-cashback-a2u.mjs',
  'scripts/check-phase2-wallet-authorization.mjs',
  'scripts/check-phase3-unified-earnings-ledger.mjs',
  'scripts/check-phase4-reward-adapters.mjs',
  'scripts/check-phase5-cashback-attribution.mjs',
  'scripts/check-phase6-available-balances.mjs',
  'scripts/check-phase6-withdrawal-fee.mjs',
  'scripts/check-phase7-a2u-orchestration.mjs',
  'scripts/check-phase8-earnings-dashboard.mjs',
  'scripts/check-phase9-charity-utility.mjs',
  'scripts/check-phase10-testnet-release-gate.mjs',
  'scripts/check-phase11-cross-feature-reconcile.mjs',
]
let childFail = 0
for (const c of children) {
  if (!existsSync(join(root, c))) {
    console.error(`CHILD MISS ${c}`)
    childFail++
    continue
  }
  const r = spawnSync(process.execPath, [c], { cwd: root, encoding: 'utf8', env: process.env })
  // phase10 runs children itself — ok
  if (r.status !== 0) {
    childFail++
    console.error(`CHILD FAIL ${c}`)
    if (r.stdout) console.error(r.stdout.slice(-400))
  } else {
    console.log(`CHILD PASS ${c}`)
  }
}
console.log(`\nPhase 12 child track suites: ${children.length - childFail}/${children.length} passed`)
if (childFail) process.exit(1)

console.log('\nBOUNDARY: Source gate only. Production remains NOT APPROVED until operator Testnet receipt + migration apply + runtime build.')
process.exit(0)
