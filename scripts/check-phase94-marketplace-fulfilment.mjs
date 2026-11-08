import { readFileSync, existsSync } from 'node:fs'
import assert from 'node:assert/strict'
const read = (p) => readFileSync(p, 'utf8')
const migration = read('supabase/migrations/20261107190001_marketplace_fulfilment_tracking_timeline.sql')
const store = read('lib/server/marketplace/order-store.ts')
const route = read('app/api/marketplace/orders/[orderId]/commerce/route.ts')
const timeline = read('app/api/marketplace/orders/[orderId]/timeline/route.ts')
const screen = read('components/ghc/marketplace-screen.tsx')
const domain = read('lib/domains/marketplace-domain.ts')
const parser = read('lib/marketplace/fulfilment.ts')
const checks = [
  ['adds fulfilment method and carrier metadata', /ADD COLUMN IF NOT EXISTS fulfilment_method/.test(migration) && /ADD COLUMN IF NOT EXISTS shipping_carrier/.test(migration)],
  ['tracking URL is HTTPS constrained at database layer', /tracking_url_https_check/.test(migration) && /tracking_url ~ '\^https:\/\/'/.test(migration)],
  ['creates append-only participant event storage and imports legacy audit safely', /gh_marketplace_order_events/.test(migration) && /ENABLE ROW LEVEL SECURITY/.test(migration) && /USING \(false\) WITH CHECK \(false\)/.test(migration) && /system:legacy-audit-import/.test(migration) && /legacyAudit',true/.test(migration) && /BEFORE UPDATE OR DELETE/.test(migration) && /FROM PUBLIC, anon, authenticated, service_role/.test(migration)],
  ['fulfilment update serializes on order row', /WHERE id=trim\(p_order_id\) FOR UPDATE/.test(migration)],
  ['requires payment verification before fulfilment', /r.payment_status<>'verified' OR r.status<>'confirmed'/.test(migration)],
  ['shipping requires carrier and tracking and other methods reject shipping metadata', /length\(v_carrier\)<2 OR length\(v_tracking\)<3/.test(migration) && /SHIPPING_METADATA_NOT_ALLOWED/.test(migration)],
  ['shipping dispatch is an explicit verified-payment state transition', /v_action='seller_dispatch'/.test(migration) && /r.payment_status<>'verified' THEN RETURN jsonb_build_object\('ok',false,'error','PAYMENT_REQUIRED'\)/.test(migration) && /delivery_status='shipped',dispatched_at=now\(\)/.test(migration)],
  ['shipping cannot be marked delivered before dispatch and all delivery is payment-gated', /DISPATCH_REQUIRED/.test(migration) && /r.payment_status<>'verified' THEN RETURN jsonb_build_object\('ok',false,'error','PAYMENT_REQUIRED'\)/.test(migration)],
  ['pre-Phase-9.4 orders retain a method-unknown legacy delivery path', /fulfilment_method IS NULL THEN/.test(migration) && /Complete legacy delivery/.test(screen)],
  ['digital delivery activates a service rather than claiming parcel delivery', /THEN 'service_active' ELSE 'delivered'/.test(migration)],
  ['buyer completion remains gated on verified payment and delivery', /r.payment_status<>'verified' OR r.status<>'fulfilling' OR r.delivery_status NOT IN \('delivered','service_active'\)/.test(migration)],
  ['order, payment and delivery milestones are journaled by database trigger', /CREATE TRIGGER gh_marketplace_order_event_capture/.test(migration) && /OLD.payment_status IS DISTINCT FROM NEW.payment_status/.test(migration) && /OLD.status IS DISTINCT FROM NEW.status/.test(migration) && /OLD.delivery_status IS DISTINCT FROM NEW.delivery_status/.test(migration)],
  ['state changes and event writes share the same transaction', /INSERT INTO public.gh_marketplace_order_events/.test(migration) && /set_config\('gh.marketplace_actor_id',p_actor_id,true\)/.test(migration)],
  ['replayed fulfilment actions return idempotently without duplicate events', /'idempotent',true/.test(migration) && /r.delivery_status='shipped'/.test(migration) && /r.buyer_confirmed_at IS NOT NULL/.test(migration)],
  ['timeline RPC enforces buyer/seller participant scope and bounded event reads', /r.buyer_id<>trim\(coalesce\(p_actor_id,''\)\) AND r.seller_id<>trim\(coalesce\(p_actor_id,''\)\)/.test(migration) && /LIMIT 200\) e/.test(migration)],
  ['timeline RPC is service-role only', /GRANT EXECUTE ON FUNCTION public.gh_marketplace_order_timeline\(text,text\) TO service_role/.test(migration)],
  ['order store uses dedicated durable fulfilment RPC', /gh_marketplace_order_fulfilment_update/.test(store) && /updateOrderFulfilment/.test(store)],
  ['order store exposes durable event timeline', /listOrderTimeline/.test(store) && /gh_marketplace_order_timeline/.test(store)],
  ['API authenticates and participant-scopes before mutation', /resolveAuthenticatedUser/.test(route) && /order.buyerId !== auth.userId && order.sellerId !== auth.userId/.test(route)],
  ['API validates bounded payload through pure parser', /readBoundedJson\(request, 8 \* 1024\)/.test(route) && /parseMarketplaceFulfilmentInput/.test(route)],
  ['timeline endpoint is authenticated and no-store', /resolveAuthenticatedUser/.test(timeline) && /Cache-Control.*no-store/.test(timeline)],
  ['order domain and mapper preserve shipment fields', /trackingNumber\?: string/.test(domain) && /trackingNumber: text\(/.test(read('lib/marketplace/record-mappers.ts'))],
  ['seller UI supports shipping, pickup and digital fulfilment', /Ship to buyer/.test(screen) && /Local pickup \/ meetup/.test(screen) && /Digital product \/ service/.test(screen)],
  ['seller UI exposes dispatch and service activation steps', /Mark dispatched/.test(screen) && /Activate service/.test(screen)],
  ['buyer UI displays tracking link and ETA', /Track shipment/.test(screen) && /Estimated delivery:/.test(screen)],
  ['buyer and seller can inspect order event timeline', /OrderTimelinePanel/.test(screen) && /View order activity/.test(screen)],
  ['parser rejects unsafe tracking URLs and bounds tracking URL input', /parsed\.protocol !== "https:"/.test(parser) && /boundedText\(row\.trackingUrl, 500\)/.test(parser)],
  ['timeline is lazy-loaded only when expanded', /if \(!open\) return/.test(screen) && /setOpen\(\(value\) => !value\)/.test(screen)],
]
for (const [name, ok] of checks) { assert.ok(ok, name); console.log(`PASS ${name}`) }
assert.ok(existsSync('app/api/marketplace/orders/[orderId]/timeline/route.ts'))
console.log(`\nPhase 9.4 fulfilment contracts: ${checks.length}/${checks.length} passed`)
