import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const route = readFileSync('app/api/economy/earnings/withdrawals/status/route.ts', 'utf8')
const dashboard = readFileSync('components/ghc/unified-earnings-dashboard.tsx', 'utf8')
const requestRoute = readFileSync('app/api/economy/earnings/withdrawals/route.ts', 'utf8')
const worker = readFileSync('app/api/economy/earnings/withdrawals/execute/route.ts', 'utf8')
const checks = [
  ['status endpoint requires canonical authenticated user', route.includes('resolveAuthenticatedUser(request.headers)') && route.includes('AUTH_REQUIRED')],
  ['status query is scoped to the authenticated user on the server', route.includes('user_id: `eq.${auth.userId}`')],
  ['status response does not expose recipient Pi UID or provider payment IDs', !route.includes('recipient_pi_app_uid') && !route.includes('provider_payment_id')],
  ['status endpoint is read-only and cache-disabled', route.includes('Cache-Control') && route.includes('cache: "no-store"') && !/method:\s*"POST"/.test(route)],
  ['request, status and execution endpoints have safe outer error boundaries', readFileSync('app/api/economy/earnings/withdrawals/route.ts', 'utf8').includes('payout request endpoint failed safely') && route.includes('payout status endpoint failed safely') && worker.includes('execution endpoint failed safely')],
  ['status query has a bounded result set', route.includes('limit: "10"')],
  ['database and provider errors return a stable recoverable status error', route.includes('PAYOUT_STATUS_UNAVAILABLE') && route.includes('catch')],
  ['only verified paid requests expose transaction IDs', route.includes('row.status === "paid" && typeof row.provider_txid === "string"')],
  ['dashboard loads and manually refreshes durable withdrawal status', dashboard.includes('/api/economy/earnings/withdrawals/status') && dashboard.includes('refreshPayoutStatuses')],
  ['dashboard explains uncertain outcome and warns against duplicate withdrawal', dashboard.includes('provider outcome is not yet confirmed') && dashboard.includes('Do not submit a new withdrawal')],
  ['dashboard displays request ID, gross, fee, net, and state', dashboard.includes('item.requestId') && dashboard.includes('item.grossAtomic') && dashboard.includes('item.feeAtomic') && dashboard.includes('item.netAtomic')],
  ['client reuses idempotency key after ambiguous network failure', dashboard.includes('Reuse the same idempotency key after an ambiguous network failure') && dashboard.includes('payoutIdempotencyKey.current.key') && dashboard.includes('same idempotency key is retained')],
  ['client blocks overlapping reserved, processing, or uncertain withdrawals', dashboard.includes('["reserved", "processing", "uncertain"].includes(item.status)') && dashboard.includes('prevents duplicate or overlapping requests')],
  ['request intake remains Testnet-gated and does not claim transfer submission', requestRoute.includes('PI_EARNINGS_PAYOUT_REQUESTS_ENABLED') && requestRoute.includes('PI_NETWORK') && requestRoute.includes('transferSubmitted: false')],
  ['execution worker retains ambiguous reservations and requires independent provider receipt', worker.includes('reservationRetained:true') && worker.includes('INDEPENDENT_PROVIDER_RECEIPT_MISMATCH')],
  ['status UI preserves existing ledger history', dashboard.includes('Recent ledger') && dashboard.includes('entries.slice(0, compact ? 3 : 6)')],
]
let failures = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failures++ }
console.log(`\nPhase 3 PI withdrawal status/recovery checks: ${checks.length - failures}/${checks.length} passed`)
assert.equal(failures, 0)
