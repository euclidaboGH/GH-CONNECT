#!/usr/bin/env node
/**
 * Phase F — Production proof source gate (network-independent).
 * Consolidates product phases A–E + critical financial safety markers.
 * Does NOT prove: remote migrations applied, funded Testnet A2U, Mainnet, production approval.
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
test('package version is 0.176.0', pkg.version === '0.176.0')
test('app-release matches package', release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`))

const phaseScripts = [
  'scripts/check-phase-a-daily-claim-ux.mjs',
  'scripts/check-phase-b-marketplace-commerce.mjs',
  'scripts/check-phase-c-marketplace-trust.mjs',
  'scripts/check-phase-d-communities-product.mjs',
  'scripts/check-phase-e-ecosystem-polish.mjs',
]
for (const s of phaseScripts) {
  test(`Phase script present: ${s}`, existsSync(join(root, s)))
}

const docs = [
  'docs/PHASE_A_DAILY_CLAIM_UX_0.171.0.md',
  'docs/PHASE_B_MARKETPLACE_COMMERCE_0.172.0.md',
  'docs/PHASE_C_MARKETPLACE_TRUST_0.174.0.md',
  'docs/PHASE_D_COMMUNITIES_PRODUCT_0.173.0.md',
  'docs/PHASE_E_ECOSYSTEM_POLISH_0.175.0.md',
  'docs/PHASE_F_PRODUCTION_PROOF_0.176.0.md',
]
for (const d of docs) {
  test(`Doc present: ${d}`, existsSync(join(root, d)))
}

const critical = [
  'components/ghc/daily-reward-experience.tsx',
  'components/ghc/marketplace-screen.tsx',
  'components/ghc/premium-community-hub.tsx',
  'components/ghc/app.tsx',
  'lib/marketplace/order-lifecycle.ts',
  'lib/marketplace/trust.ts',
  'lib/community/discovery.ts',
  'lib/server/payments/a2u-receipt.ts',
  'scripts/operator-live-e2e-pi-earnings.mjs',
  'scripts/operator-live-e2e-product.mjs',
]
for (const c of critical) {
  test(`Critical path: ${c}`, existsSync(join(root, c)))
}

const migs = readdirSync(join(root, 'supabase/migrations')).filter((f) => f.endsWith('.sql'))
test('Cashback quarterly migration on disk', migs.some((m) => m.includes('20261029010013')))
test('A2U / earnings migrations present', migs.some((m) => m.includes('20261029010004')))

const finalDoc = existsSync(join(root, 'docs/PHASE_F_PRODUCTION_PROOF_0.176.0.md'))
  ? read('docs/PHASE_F_PRODUCTION_PROOF_0.176.0.md')
  : ''
test('Phase F states NOT APPROVED for production', /NOT APPROVED/.test(finalDoc))
test('Phase F requires funded Testnet evidence', /funded/i.test(finalDoc) && /Testnet/i.test(finalDoc))
test('Phase F requires operator live probes', /operator:live-e2e/i.test(finalDoc))

const app = read('components/ghc/app.tsx')
test('Toast host above nav (z-220)', /z-\[220\]/.test(app))
test('No free-client GHC mint path in claim card', /postDailyClaim/.test(read('components/ghc/daily-reward-experience.tsx')))

const failed = checks.filter((x) => !x).length
console.log(`\nPhase F production proof static: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)

const children = phaseScripts
let childFail = 0
for (const c of children) {
  const r = spawnSync(process.execPath, [c], { cwd: root, encoding: 'utf8' })
  if (r.status !== 0) {
    childFail++
    console.error(`CHILD FAIL ${c}`)
    if (r.stdout) console.error(r.stdout.slice(-300))
  } else {
    console.log(`CHILD PASS ${c}`)
  }
}
console.log(`\nPhase F product child suites: ${children.length - childFail}/${children.length} passed`)
if (childFail) process.exit(1)

console.log('\nBOUNDARY: Source gate only. Production remains NOT APPROVED until operator Testnet evidence + migration apply + runtime build.')
process.exit(0)
