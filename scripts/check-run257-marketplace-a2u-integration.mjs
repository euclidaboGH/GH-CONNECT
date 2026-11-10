#!/usr/bin/env node
/** Run #257: source contract for end-to-end marketplace reservation/payment/fulfilment boundaries. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = (p) => readFileSync(p, 'utf8')
const orderRoute = read('app/api/marketplace/orders/route.ts')
const orderStore = read('lib/server/marketplace/order-store.ts')
const payRoute = read('app/api/marketplace/orders/[orderId]/pay/route.ts')
const fulfilmentMigration = read('supabase/migrations/20261107190001_marketplace_fulfilment_tracking_timeline.sql')
const variantsMigration = read('supabase/migrations/20261107180001_marketplace_sku_variants_atomic_inventory.sql')
const timelineRoute = read('app/api/marketplace/orders/[orderId]/timeline/route.ts')
const timelineStore = orderStore
const checks = [
  ['order creation requires authenticated buyer and bounded JSON', /resolveAuthenticatedUser/.test(orderRoute) && /readBoundedJson\(request, 16 \* 1024\)/.test(orderRoute)],
  ['client price, seller, title, currency and total are ignored', ['body.unitPrice','body.sellerId','body.listingTitle','body.currency','body.totalAmount'].every(x => orderRoute.includes(`void ${x}`))],
  ['variant selection routes to the atomic variant reservation RPC', /order\.variantId\s*\?\s*await rpcJson\("gh_marketplace_order_create_variant_reserved"/.test(orderStore)],
  ['legacy reservation path is blocked for listings with active variants', /VARIANT_SELECTION_REQUIRED/.test(variantsMigration) && /gh_marketplace_order_create_reserved_pre_variant/.test(variantsMigration)],
  ['variant reservation locks listing and selected SKU before stock hold', /WHERE id=v_listing_id FOR UPDATE/.test(variantsMigration) && /WHERE id=p_variant_id AND listing_id=v_listing_id FOR UPDATE/.test(variantsMigration)],
  ['variant reservation binds idempotency key, quantity, SKU and order snapshot', /IDEMPOTENCY_CONFLICT/.test(variantsMigration) && /variant_sku,variant_label/.test(variantsMigration)],
  ['cancellation releases reserved stock while verified payment commits variant stock', /NEW\.status='cancelled'/.test(variantsMigration) && /NEW\.status='payment_verified'/.test(variantsMigration) && /stock_on_hand=greatest\(0,stock_on_hand-OLD\.stock_reserved\)/.test(variantsMigration)],
  ['GHC checkout uses server order amount and atomic payment claim before spend', /claimOrderForPayment\(order\.id, auth\.userId, "ghc"\)/.test(payRoute) && /const amount = Number\(order\.totalAmount\)/.test(payRoute) && /rpcGhcSpend\(/.test(payRoute)],
  ['Pi checkout binds completed user-owned intent to exact order and amount', /intent\.userId !== auth\.userId/.test(payRoute) && /intent\.purpose !== "marketplace"/.test(payRoute) && /PAYMENT_INTENT_ORDER_MISMATCH/.test(payRoute) && /Math\.abs\(intent\.amount - order\.totalAmount\)/.test(payRoute)],
  ['ambiguous payment outcomes retain claim for idempotent reconciliation', /may have happened after the ledger committed/.test(payRoute) && /retryable: status === 503/.test(payRoute)],
  ['fulfilment migration reuses Phase 21 immutable event journal', /gh_marketplace_order_events/.test(fulfilmentMigration) && /actor_source,before_state,after_state/.test(fulfilmentMigration) && !/CREATE TABLE IF NOT EXISTS public\.gh_marketplace_order_events/.test(fulfilmentMigration)],
  ['shipping cannot be marked delivered before dispatch', /DISPATCH_REQUIRED/.test(fulfilmentMigration) && /delivery_status<>'shipped'/.test(fulfilmentMigration)],
  ['buyer confirmation requires verified payment and delivered/service-active state', /r\.payment_status<>'verified' OR r\.status<>'fulfilling' OR r\.delivery_status NOT IN \('delivered','service_active'\)/.test(fulfilmentMigration)],
  ['order timeline is participant-scoped and no-store authenticated', /resolveAuthenticatedUser/.test(timelineRoute) && /listOrderTimeline\(orderId, auth\.userId\)/.test(timelineRoute) && /r\.buyer_id<>trim\(coalesce\(p_actor_id,''\)\) AND r\.seller_id<>trim\(coalesce\(p_actor_id,''\)\)/.test(fulfilmentMigration) && /Cache-Control.*no-store/i.test(timelineRoute)],
  ['source keeps variant and fulfilment migrations held for validation', /REVIEW_REQUIRED/.test(read('docs/MIGRATION_CHECKLIST.md')) && /do not enable finite-stock variant sales/.test(read('docs/MIGRATION_CHECKLIST.md'))],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++ }
console.log(`\nRun #257 marketplace/payment/fulfilment source contract: ${checks.length - failed}/${checks.length} passed`)
assert.equal(failed, 0)
