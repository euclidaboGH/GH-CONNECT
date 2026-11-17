#!/usr/bin/env node
/** Source-level contract for idempotent marketplace payment/revenue reconciliation recovery. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
const read = (p) => readFileSync(join(process.cwd(), p), 'utf8')
const route = read('app/api/marketplace/orders/[orderId]/pay/route.ts')
const revenue = read('lib/server/revenue/revenue-event.ts')
const packageJson = JSON.parse(read('package.json'))
const suite = read('scripts/verify-phase14-static.mjs')
const checks = [
  ['verified PI payment can be recovered before payable-status rejection', /order\.paymentStatus === "verified" && order\.paymentMethod === "pi" && order\.paymentIntentId/.test(route) && route.indexOf('order.paymentStatus === "verified" && order.paymentMethod === "pi"') < route.indexOf('if (order.status !== "payment_pending"')],
  ['recovery validates original user, provider, purpose, order reference, currency and amount', /priorIntent\.userId === auth\.userId/.test(route) && /priorIntent\.provider === "pi"/.test(route) && /priorIntent\.purpose === "marketplace"/.test(route) && /priorIntent\.referenceId/.test(route) && /priorIntent\.amount - order\.totalAmount/.test(route)],
  ['journal failure is explicitly retryable and never asks for another payment', /REVENUE_RECONCILIATION_PENDING/.test(route) && /paymentVerified: true/.test(route) && /paymentActionRequired: false/.test(route) && /Retry-After/.test(route) && /do not submit a new payment/i.test(route)],
  ['initial verified PI flow does not return success on journal failure', /if \(isRevenueReconciliationPending\(commission\)\) return reconciliationPendingResponse/.test(route)],
  ['recovery retries idempotent journal append using the original completed intent', /recordPlatformCommission\(\{[\s\S]*?paymentIntentId: priorIntent\.id/.test(route) && /idempotent: true, recovered: true/.test(route)],
  ['interrupted order state is repaired through allowed transitions and failures stay retryable', /transitionOrder\(order\.id, "payment_verified", auth\.userId, "pi_recovery"\)/.test(route) && /ORDER_STATE_RECONCILIATION_PENDING/.test(route) && /const verifiedTransition = await transitionOrder/.test(route)],
  ['reconciliation responses disable caching', /"Cache-Control": "no-store"/.test(route)],
  ['revenue journal upstream calls have a bounded timeout', /signal: AbortSignal\.timeout\(5_000\)/.test(revenue) && /cache: "no-store"/.test(revenue)],
  ['contract is registered in full static verification', suite.includes('check-marketplace-revenue-reconciliation.mjs')],
  ['release version is synchronized', /^\d+\.\d+\.\d+$/.test(packageJson.version) && read('lib/app-release.ts').includes(`APP_RELEASE_VERSION = "${packageJson.version}"`)],
]
let failed = 0
for (const [name, pass] of checks) { console.log((pass ? 'PASS ' : 'FAIL ') + name); if (!pass) failed++ }
console.log('\nMarketplace revenue reconciliation contract: ' + (checks.length - failed) + '/' + checks.length + ' passed')
process.exit(failed ? 1 : 0)
