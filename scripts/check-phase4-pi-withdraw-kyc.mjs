#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => readFileSync(join(root, f), 'utf8')
const dash = read('components/ghc/unified-earnings-dashboard.tsx')
const withdrawals = read('app/api/economy/earnings/withdrawals/route.ts')
const quote = read('app/api/economy/earnings/quote/route.ts')
const execute = read('app/api/economy/earnings/withdrawals/execute/route.ts')
const checks = [
  ['quote API exists', existsSync(join(root, 'app/api/economy/earnings/quote/route.ts'))],
  ['withdrawals request API exists', existsSync(join(root, 'app/api/economy/earnings/withdrawals/route.ts'))],
  ['execute API exists', existsSync(join(root, 'app/api/economy/earnings/withdrawals/execute/route.ts'))],
  ['request gate on PAYOUT_REQUESTS_ENABLED + testnet', /PI_EARNINGS_PAYOUT_REQUESTS_ENABLED/.test(withdrawals) && /PI_NETWORK/.test(withdrawals)],
  ['request never marks transfer submitted', /transferSubmitted:\s*false/.test(withdrawals)],
  ['execute gated on execution flags', /PI_EARNINGS_PAYOUT_EXECUTION_ENABLED/.test(execute)],
  ['execute Testnet-only', /testnet|TESTNET/.test(execute)],
  ['dashboard Withdraw CTA', /Withdraw to Pi wallet/.test(dash)],
  ['dashboard Preview fee CTA', /Preview 3% fee/.test(dash)],
  ['structured quoteDetail card', /quoteDetail/.test(dash) && /Withdrawal quote/.test(dash)],
  ['3% fee copy', /3%/.test(dash)],
  ['linked wallet destination copy', /KYC/.test(dash) || /linked Pi wallet/.test(dash)],
  ['payout success refreshes wallet', /ghc:wallet-refresh/.test(dash) && /payout-request/.test(dash)],
  ['phase 4 doc present', existsSync(join(root, 'docs/PHASE4_PI_WITHDRAW_KYC.md'))],
]
let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failed++
}
console.log(`\nPhase 4 PI withdraw KYC: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
