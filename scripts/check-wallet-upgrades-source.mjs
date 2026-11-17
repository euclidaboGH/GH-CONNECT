import { readFileSync } from 'node:fs'
const r = (p) => readFileSync(p, 'utf8')
const sheet = r('components/ghc/pi-withdraw-sheet.tsx')
const route = r('app/api/economy/earnings/withdrawals/route.ts')
const ghc = r('features/wallet/withdraw-ghc-panel.tsx')
const fmt = r('features/wallet/wallet-format.ts')
const bal = r('features/wallet/wallet-balance.tsx')
const pkg = JSON.parse(r('package.json'))
const checks = [
  ['PI sheet does not pre-fill the full balance', !/setAmountStr\(openingBalance/.test(sheet) && /setAmountStr\(""\)/.test(sheet)],
  ['PI sheet parses typed amounts exactly', /parsePiInput\(amountStr\)/.test(sheet)],
  ['PI sheet Max is floored and capped to available', /atomicToPiString\(floorToAtomic\(maxPi\)\)/.test(sheet)],
  ['PI request route refuses to reserve when execution is disabled', /PI_EARNINGS_PAYOUT_EXECUTION_ENABLED !== "true"/.test(route) && /PI_EARNINGS_PAYOUT_EXECUTION_DISABLED/.test(route)],
  ['PI sheet explains the execution-disabled response', /PI_EARNINGS_PAYOUT_EXECUTION_DISABLED/.test(sheet)],
  ['PI balance still fails closed', /setPiSnapshot\(null\)/.test(bal)],
  ['PI balance refreshes on visibility and reconnect', /visibilitychange/.test(bal) && /void refreshPi\(\)/.test(bal)],
  ['PI balance explains reserved amounts', /held for incomplete withdrawal requests/.test(bal) && /not spendable while those requests remain active/.test(bal)],
  ['GHC panel parses 4dp exactly and offers Max', /parseGhcInput\(ghcAmount\)/.test(ghc) && /Max ·/.test(ghc)],
  ['GHC panel validates Pi address shape before submit', /looksLikePiWalletAddress\(wallet\)/.test(ghc)],
  ['GHC panel blocks over-withdrawable amounts', /overWithdrawable/.test(ghc)],
  ['GHC formatter is negative-zero safe', /formatGhcSafe/.test(fmt)],
  ['wallet helper tests are registered', typeof pkg.scripts['check:wallet-amounts'] === 'string' && pkg.scripts['prebuild:checks'].includes('test-wallet-amount-helpers.mjs')],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed += 1 }
console.log(`Wallet upgrades source: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
