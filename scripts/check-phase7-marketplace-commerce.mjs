#!/usr/bin/env node
/** Phase 7 Marketplace buyer/seller/orders/payment source contracts. */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const checks = []
const test = (name, ok) => {
  checks.push(Boolean(ok))
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
}

const integrity = read('lib/server/marketplace/marketplace-integrity.ts')
const orders = read('app/api/marketplace/orders/route.ts')
const orderStore = read('lib/server/marketplace/order-store.ts')
const cart = read('lib/marketplace/cart.ts')
const lifecycle = read('lib/marketplace/order-lifecycle.ts')
const pay = read('app/api/marketplace/orders/[orderId]/pay/route.ts')
const listings = read('app/api/marketplace/listings/route.ts')
const pkg = JSON.parse(read('package.json'))
const release = read('lib/app-release.ts')

test('order errors are humanized for own-buy and stock', /CANNOT_BUY_OWN/.test(integrity) && /INSUFFICIENT_STOCK/.test(integrity))
test('own-listing detector is explicit', /isOwnListingSeller/.test(integrity))
test('order create ignores client price seller currency totals', /void body\.unitPrice/.test(orders) && /void body\.sellerId/.test(orders))
test('order create requires stable idempotency key', /IDEMPOTENCY_KEY/.test(orders))
test('order create uses durable fail-closed per-buyer throttling', /enforceUserMutationRateLimit\(auth\.userId, \"marketplace\/orders:POST\"/.test(orders) && /failClosed: true/.test(orders))
test('order create returns humanized message on failure', /humanizeMarketplaceOrderError/.test(orders))
test('durable reservation is required for order create', /createReservedOrder/.test(orderStore) && /DURABLE_RESERVATION_REQUIRED/.test(orderStore))
test('payment claim and release RPCs exist for stock fencing', /claimOrderForPayment/.test(orderStore) && /releaseOrderPaymentClaim/.test(orderStore))
test('pay route claims inventory before spend', /claimOrderForPayment|gh_marketplace_order_claim_payment/.test(pay))
test('cart can strip the viewer own-seller lines before checkout', /removeOwnSellerCartItems/.test(cart))
test('order lifecycle exposes buyer and seller next-action hints', /orderNextActionHint/.test(lifecycle) && /orderRoleForViewer/.test(lifecycle))
test('listings do not coerce explicit zero stock to one', /Never coerce zero to one|explicit zero stays zero/.test(listings) || /stockOnHand/.test(listings))
test('package and app release versions agree', release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`))
test('phase 7 checker is registered in prebuild', Boolean(pkg.scripts?.['prebuild:checks']?.includes('check-phase7-marketplace-commerce.mjs')))
test('phase 7 programme doc exists', existsSync(join(root, 'docs/PHASE-7-MARKETPLACE-COMMERCE-2026-11-08.md')))

const failed = checks.filter((x) => !x).length
console.log(`\nPhase 7 marketplace commerce: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
