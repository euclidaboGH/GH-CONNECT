#!/usr/bin/env node
/** Phase 10 marketplace/order lifecycle source contracts; no DB writes or payment calls. */
import fs from 'node:fs'
import path from 'node:path'
const read = p => fs.readFileSync(path.join(process.cwd(), p), 'utf8')
const store = read('lib/server/marketplace/order-store.ts')
const create = read('app/api/marketplace/orders/route.ts')
const transition = read('app/api/marketplace/orders/[orderId]/transition/route.ts')
const detail = read('app/api/marketplace/orders/[orderId]/route.ts')
const pay = read('app/api/marketplace/orders/[orderId]/pay/route.ts')
const commerce = read('app/api/marketplace/orders/[orderId]/commerce/route.ts')
const migration = read('supabase/migrations/20261028160000_marketplace_buyer_confirmation_delivery_gate.sql')
const marketplaceUi = read('components/ghc/marketplace-screen.tsx')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const release = read('lib/app-release.ts')
const checks = [
 ['package, lock and app release versions agree', pkg.version === lock.version && lock.packages?.['']?.version === pkg.version && release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
 ['order creation uses streaming bounded JSON parsing', /readBoundedJson\(request, 16 \* 1024\)/.test(create) && !/request\.json\(\)/.test(create)],
 ['order quantity rejects coercion and out-of-range values', /Number\.isSafeInteger\(quantity\)/.test(create) && /quantity < 1 \|\| quantity > 99/.test(create)],
 ['listing identifiers are bounded and reject control characters', /listingId\.length > 160/.test(create) && /\\u0000-\\u001f/.test(create)],
 ['transition, payment and commerce bodies have streaming byte limits', /readBoundedJson\(request, 8 \* 1024\)/.test(transition) && /readBoundedJson\(request, 8 \* 1024\)/.test(pay) && /readBoundedJson\(request,8\*1024\)/.test(commerce)],
 ['commerce actions and notes are type-checked without coercion', /typeof body\.action==="string"/.test(commerce) && /typeof body\.note==="string"/.test(commerce)],
 ['mutation responses use no-store caching policy', /Cache-Control/.test(create) && /Cache-Control/.test(transition) && /Cache-Control/.test(pay) && /Cache-Control/.test(commerce)],
 ['phase 10 documentation exists', fs.existsSync(path.join(process.cwd(), 'docs/PHASE-10-MARKETPLACE-ORDER-FULFILMENT-INTEGRITY.md'))],
 ['durable order reads are authoritative when DB is configured', /dbConfigured\(\) \? await loadOrder\(orderId\)/.test(store)],
 ['timestamp mapper accepts ISO and epoch values', /function timestampMs\(/.test(store) && /Date\.parse\(value\)/.test(store) && /value > 0 && value < 100_000_000_000/.test(store)],
 ['missing durable timestamps are not fabricated as current time', /createdAt: timestampMs\(data\.createdAt, 0\)/.test(store) && /updatedAt: timestampMs\(data\.updatedAt, 0\)/.test(store)],
 ['order cache is updated only after successful durable write', store.indexOf('const res = await rpcJson("gh_marketplace_order_upsert"') < store.indexOf('map().set(order.id, order)', store.indexOf('const res = await rpcJson("gh_marketplace_order_upsert"'))],
 ['order creation requires scoped idempotency key', /Idempotency-Key/.test(create) && /IDEMPOTENCY_KEY_REQUIRED/.test(create)],
 ['price, seller and currency are server-derived', /Ignore client price\/seller\/title\/currency/.test(create) && /gh_marketplace_order_create_reserved/.test(store)],
 ['inventory reservation is durable and atomic', /gh_marketplace_order_create_reserved/.test(store) && /DURABLE_RESERVATION_REQUIRED/.test(store)],
 ['payment verified cannot be set by public transition', /PAYMENT_TRANSITION_FORBIDDEN/.test(transition) && /payment_verified is established only by POST/.test(transition)],
 ['paid order cancellation cannot bypass refund authority', /PAID_ORDER_CANCEL_REQUIRES_REFUND/.test(transition)],
 ['fulfilment transitions require verified payment', /REQUIRES_VERIFIED_PAYMENT/.test(transition) && /paymentStatus === "verified"/.test(transition)],
 ['order detail is buyer/seller scoped', /order\.buyerId !== auth\.userId && order\.sellerId !== auth\.userId/.test(detail)],
 ['payment route exists and requires authenticated order authority', /resolveAuthenticatedUser/.test(pay) && /loadOrder/.test(pay)],
 ['commerce mutations use durable transactional RPC', /gh_marketplace_order_commerce_update/.test(store) && /DATABASE_REQUIRED/.test(store)],
 ['stale payment claims require explicit operator action', /forceReleaseStalePaymentClaim/.test(store) && /p_operator_note/.test(store)],
 ['no memory fallback in production durable order writes', /if \(isProd\(\)\)/.test(store) && /DURABLE_WRITE_FAILED/.test(store)],
 ['generic order transition rejects malformed target types without coercion', /typeof body\.to === \"string\"/.test(transition) && /INVALID_TRANSITION/.test(transition)],
 ['public generic transition cannot mark orders refunded', /REFUND_TRANSITION_FORBIDDEN/.test(transition) && /to === \"refunded\"/.test(transition)],
 ['commerce lifecycle states require authorized commerce actions', /COMMERCE_TRANSITION_REQUIRED/.test(transition) && /fulfilling.*completed.*disputed/.test(transition)],
 ['buyer confirmation database RPC requires delivery or service activation', /r\.status<>'fulfilling' OR r\.delivery_status NOT IN \('delivered','service_active'\)/.test(migration) && /DELIVERY_NOT_CONFIRMED/.test(migration)],
 ['marketplace order UI hydrates authoritative delivery status', /deliveryStatus: typeof o\.deliveryStatus === \"string\"/.test(marketplaceUi)],
 ['buyer confirmation button only appears after confirmed delivery/service activation', /status === \"fulfilling\" && \[\"delivered\",\"service_active\"\]\.includes/.test(marketplaceUi)],
]
let failed=0
for (const [label, ok] of checks) { console.log(`${ok?'PASS':'FAIL'} ${label}`); if(!ok) failed++ }
console.log(`\nPhase 10 marketplace integrity: ${checks.length-failed}/${checks.length} passed`)
if(failed) process.exit(1)
