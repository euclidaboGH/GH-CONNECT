import { readFileSync } from 'node:fs'
const dashboard = readFileSync('components/ghc/unified-earnings-dashboard.tsx', 'utf8')
const sheet = readFileSync('components/ghc/pi-withdraw-sheet.tsx', 'utf8')
const route = readFileSync('app/api/economy/earnings/withdrawals/route.ts', 'utf8')
const checks = [
  ['dashboard withdraw focus always opens the dedicated sheet', /const runWithdraw = useCallback\(\(\) => \{[\s\S]*?openWithdrawSheet\(\)/.test(dashboard)],
  ['dashboard no longer submits withdrawal requests directly', !dashboard.includes('"/api/economy/earnings/withdrawals"')],
  ['sheet verifies PIN and obtains proof before request', sheet.includes('action: \"verify\"') && sheet.includes('bindKey: pinIntent.key') && sheet.includes('pinProof = String(vBody?.pinProof || \"\")')],
  ['sheet sends PIN proof with withdrawal request', /body: \{ amountAtomic, idempotencyKey: intent\.key, pinProof \}/.test(sheet)],
  ['server requires PIN proof before reserving', /checkPinProof\(auth\.userId, key, body\.pinProof\)/.test(route)],
  ['request creation remains fail-closed behind explicit Testnet flags', /PI_EARNINGS_PAYOUT_REQUESTS_ENABLED !== "true"/.test(route) && /PI_NETWORK !== "testnet"/.test(route) && /PI_EARNINGS_PAYOUT_EXECUTION_ENABLED !== "true"/.test(route) && /PI_A2U_TESTNET_ONLY !== "true"/.test(route)],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++ }
console.log(`Withdrawal single-entrypoint regression: ${checks.length - failed}/${checks.length}`)
if (failed) process.exitCode = 1
