#!/usr/bin/env node
/**
 * Phase 5 — aggregate wallet PI claim/withdraw release gate (source-level).
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => readFileSync(join(root, f), 'utf8')

const nested = [
  'check-phase1-registration-topup.mjs',
  'check-phase2-dual-asset-wallet.mjs',
  'check-phase3-pi-claim-buttons.mjs',
  'check-phase4-pi-withdraw-kyc.mjs',
  'check-registration-bonus.mjs',
  'check-unified-wallet-card.mjs',
]

let failed = 0
for (const script of nested) {
  const r = spawnSync(process.execPath, [join(root, 'scripts', script)], {
    encoding: 'utf8',
    cwd: root,
  })
  const ok = r.status === 0
  console.log(`${ok ? 'PASS' : 'FAIL'} nested ${script.replace('.mjs', '')}`)
  if (!ok) {
    failed++
    if (r.stdout) process.stdout.write(r.stdout.split('\n').slice(-8).join('\n') + '\n')
  }
}

const env = existsSync(join(root, '.env.example')) ? read('.env.example') : ''
const pkg = JSON.parse(read('package.json'))
const checks = [
  ['phase5 doc present', existsSync(join(root, 'docs/PHASE5_WALLET_RELEASE_GATE.md'))],
  ['operator checklist present', existsSync(join(root, 'docs/OPERATOR_CHECKLIST_WALLET_PI_5PHASE.md'))],
  ['roadmap present', existsSync(join(root, 'docs/ROADMAP-WALLET-PI-CLAIM-WITHDRAW-5PHASE.md'))],
  ['registration migration present', existsSync(join(root, 'supabase/migrations/20261030010001_registration_bonus_v2_reconciliation.sql'))],
  ['bonus default off in env example', /GHC_REGISTRATION_BONUS_ENABLED=0/.test(env)],
  ['payout requests default off', /PI_EARNINGS_PAYOUT_REQUESTS_ENABLED=0/.test(env) || !/PI_EARNINGS_PAYOUT_REQUESTS_ENABLED=true/.test(env)],
  ['execution default off', /PI_EARNINGS_PAYOUT_EXECUTION_ENABLED=0/.test(env)],
  ['A2U default off', /PI_A2U_ENABLED=0/.test(env)],
  ['network default testnet', /PI_NETWORK=testnet/.test(env)],
  ['package scripts register phase1-5 checks',
    !!pkg.scripts?.['check:phase1-registration-topup'] &&
    !!pkg.scripts?.['check:phase2-dual-asset-wallet'] &&
    !!pkg.scripts?.['check:phase3-pi-claim-buttons'] &&
    !!pkg.scripts?.['check:phase4-pi-withdraw-kyc'] &&
    !!pkg.scripts?.['check:phase5-wallet-release-gate']],
  ['lockfile present', existsSync(join(root, 'package-lock.json'))],
]

for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failed++
}

console.log(`\nPhase 5 wallet release gate: ${nested.length + checks.length - failed}/${nested.length + checks.length} passed`)
process.exit(failed ? 1 : 0)
