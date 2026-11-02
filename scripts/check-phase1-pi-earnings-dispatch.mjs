#!/usr/bin/env node
import { readFileSync } from 'node:fs'
const read = (p) => readFileSync(p, 'utf8')
const request = read('app/api/economy/earnings/withdrawals/route.ts')
const execute = read('app/api/economy/earnings/withdrawals/execute/route.ts')
const dashboard = read('components/ghc/unified-earnings-dashboard.tsx')
const checks = [
  ['payout request remains durable and never claims transfer submitted', /transferSubmitted:\s*false/.test(request)],
  ['execution dispatch runs after response rather than delaying user request', /after\(async \(\) =>/.test(request)],
  ['automatic dispatch requires every explicit Testnet execution gate', /PI_EARNINGS_PAYOUT_EXECUTION_ENABLED === "true"/.test(request) && /PI_A2U_ENABLED === "true"/.test(request) && /PI_A2U_TESTNET_ONLY === "true"/.test(request) && /PI_NETWORK === "testnet"/.test(request) && /PI_ENV === "production"/.test(request) && /resolvePiSandbox\(\)/.test(request)],
  ['executor secret remains server-side and is not returned in response', /x-ghc-pi-earnings-key/.test(request) && !/executorKey/.test(request.split('return reply({')[1] || '')],
  ['dispatch failure logs recoverable reservation without claiming payment', /durable reservation remains recoverable/.test(request)],
  ['execute endpoint remains secret-gated', /if\(!serviceAuthorized\) return reply/.test(execute) && /timingSafeEqual/.test(execute)],
  ['server worker derives payout owner from durable request row', /const ownerId=String\(row\.user_id/.test(execute) && /p_user_id:ownerId/.test(execute)],
  ['signed-in execution cannot cross user boundary', /auth && ownerId!==auth\.userId/.test(execute)],
  ['wallet authorization is checked against durable owner and linked recipient', /assertPayoutWalletAuthorization\(\{ghUserId:ownerId,recipientUid:row\.recipient_pi_app_uid\}\)/.test(execute)],
  ['fee preview requires a separate first click before request submission', /await onPreviewFee\(\)\s*return/.test(dashboard)],
  ['ambiguous payout retry reuses same idempotency key for same amount', /payoutIdempotencyKey = useRef/.test(dashboard) && /const idempotencyKey = payoutIdempotencyKey\.current\.key/.test(dashboard) && /payoutIdempotencyKey\.current = null/.test(dashboard)],
  ['UI has an explicit preview-fee action', /Preview 3% fee/.test(dashboard)],
  ['UI shows explicit wallet-withdrawal action after quote', /Withdraw to Pi wallet/.test(dashboard)],
  ['quote card is accessible and titled', /aria-label="Withdrawal quote"/.test(dashboard) && />Withdrawal quote<\//.test(dashboard)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`\nPhase 1 Pi payout dispatch + quote UX: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
