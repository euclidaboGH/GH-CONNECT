#!/usr/bin/env node
/** Phase 5: marketplace route resilience and bounded pagination contracts. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const orders = readFileSync('app/api/marketplace/orders/route.ts', 'utf8')
const listings = readFileSync('app/api/marketplace/listings/route.ts', 'utf8')
const checks = [
  ['order creation catches unexpected durable-store exceptions', /try\s*\{\s*created = await createReservedOrder\(order, idempotencyKey\)\s*\}\s*catch/.test(orders)],
  ['order creation failure is explicit and retryable', /ORDER_SERVICE_UNAVAILABLE[\s\S]*?retryable: true[\s\S]*?status: 503/.test(orders)],
  ['order creation failure is not reported as success', /ORDER_SERVICE_UNAVAILABLE/.test(orders) && /created\.order/.test(orders)],
  ['order history catches durable-store exceptions', /try\s*\{\s*const orders = await listOrdersForUserDurable\(auth\.userId\)[\s\S]*?catch\s*\{[\s\S]*?ORDER_HISTORY_UNAVAILABLE/.test(orders)],
  ['order history failure distinguishes unavailable from empty', /ORDER_HISTORY_UNAVAILABLE[\s\S]*?retryable: true[\s\S]*?status: 503/.test(orders)],
  ['order failures use no-store and retry guidance', (orders.match(/Retry-After/g) || []).length >= 2 && (orders.match(/Cache-Control.*no-store/g) || []).length >= 2],
  ['client financial fields remain untrusted', /Ignore client price\/seller\/title\/currency/.test(orders) && /createReservedOrder\(order, idempotencyKey\)/.test(orders)],
  ['listing upsert catches unexpected exceptions', /saved = await upsertListing\([\s\S]*?catch\s*\{[\s\S]*?LISTING_SERVICE_UNAVAILABLE/.test(listings)],
  ['listing service errors are retryable and non-cacheable', /LISTING_SERVICE_UNAVAILABLE[\s\S]*?retryable: true[\s\S]*?status: 503/.test(listings) && /Retry-After/.test(listings)],
  ['listing ID read catches backend exceptions', /listing = await getListing\(id\)[\s\S]*?catch\s*\{[\s\S]*?LISTING_SERVICE_UNAVAILABLE/.test(listings)],
  ['seller listing read catches backend exceptions', /listSellerListings\(auth\.userId, limit\)[\s\S]*?catch\s*\{[\s\S]*?LISTING_SERVICE_UNAVAILABLE/.test(listings)],
  ['public listing read catches backend exceptions', /listActiveListings\(limit\)[\s\S]*?catch\s*\{[\s\S]*?LISTING_SERVICE_UNAVAILABLE/.test(listings)],
  ['pagination rejects malformed and fractional limits by using a safe default', /Number\.isSafeInteger\(parsedLimit\)[\s\S]*?: 50/.test(listings)],
  ['pagination remains capped at 100 rows', /Math\.min\(Math\.max\(parsedLimit, 1\), 100\)/.test(listings)],
  ['order creation idempotency and quantity checks remain active', /IDEMPOTENCY_KEY_REQUIRED/.test(orders) && /INVALID_QUANTITY/.test(orders)],
]
let failed = 0
for (const [label, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`)
  if (!pass) failed++
}
console.log(`\nPhase 5 marketplace commerce resilience: ${checks.length - failed}/${checks.length} passed`)
assert.equal(failed, 0, 'Marketplace commerce resilience checks failed')
