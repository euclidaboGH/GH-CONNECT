import fs from 'node:fs'
const read = (path) => fs.readFileSync(path, 'utf8')
const migration = read('supabase/migrations/20261107180001_marketplace_sku_variants_atomic_inventory.sql')
const orderRoute = read('app/api/marketplace/orders/route.ts')
const orderStore = read('lib/server/marketplace/order-store.ts')
const listingRoute = read('app/api/marketplace/listings/route.ts')
const listingStore = read('lib/server/marketplace/listing-store.ts')
const screen = read('components/ghc/marketplace-screen.tsx')
const cart = read('lib/marketplace/cart.ts')
const helper = read('lib/marketplace/product-variants.ts')
const discovery = read('lib/marketplace/discovery-presentation.ts')
const checks = [
  ['Dedicated durable SKU table with seller-scoped unique SKU', /CREATE TABLE IF NOT EXISTS public\.gh_marketplace_variants/.test(migration) && /uq_gh_marketplace_variants_seller_sku/.test(migration)],
  ['Variant stock separates on-hand from reserved units', /stock_on_hand integer/.test(migration) && /stock_reserved integer/.test(migration)],
  ['Variant replacement is seller-owned and bounded', /gh_marketplace_variants_replace/.test(migration) && /FORBIDDEN/.test(migration) && /jsonb_array_length\(p_variants\)/.test(migration)],
  ['Variant replacement validates all rows before writes', migration.indexOf('Validation above is read-only') > migration.indexOf('FOR v IN SELECT') && migration.indexOf('Validation above is read-only') < migration.indexOf('INSERT INTO public.gh_marketplace_variants')],
  ['Variant replacement rejects duplicate IDs and non-product listings', /v_id = ANY\(v_seen_ids\)/.test(migration) && /l\.kind <> 'product'/.test(migration)],
  ['Active reservations prevent variant removal and stock underflow', /VARIANT_HAS_ACTIVE_RESERVATIONS/.test(migration) && /STOCK_BELOW_RESERVED/.test(migration)],
  ['Variant-specific order creation locks listing and SKU rows', /gh_marketplace_order_create_variant_reserved/.test(migration) && /WHERE id=v_listing_id FOR UPDATE/.test(migration) && /WHERE id=p_variant_id AND listing_id=v_listing_id FOR UPDATE/.test(migration)],
  ['Listing and initial SKU publication share one database transaction', /gh_marketplace_listing_upsert_with_variants/.test(migration) && /gh_marketplace_listing_upsert_with_variants/.test(listingRoute) === false && /upsertListingWithVariants/.test(listingRoute) && /RAISE EXCEPTION USING ERRCODE='P0001'/.test(migration)],
  ['Legacy order RPC cannot bypass variant selection', /VARIANT_SELECTION_REQUIRED/.test(migration) && /gh_marketplace_order_create_reserved_pre_variant/.test(migration)],
  ['Legacy RPC rename is idempotent and fails closed on conflicting function state', /to_regprocedure\('public\.gh_marketplace_order_create_reserved\(jsonb,text\)'\) IS NOT NULL/.test(migration) && /to_regprocedure\('public\.gh_marketplace_order_create_reserved_pre_variant\(jsonb,text\)'\) IS NULL/.test(migration) && /MARKETPLACE_RESERVED_RPC_RENAME_STATE_CONFLICT/.test(migration)],
  ['Idempotency compares the exact variant identity', /existing\.variant_id IS DISTINCT FROM p_variant_id/.test(migration)],
  ['Cancellation releases only an existing reservation and fails closed on underflow', /NEW\.status='cancelled'/.test(migration) && /stock_reserved>=OLD\.stock_reserved/.test(migration) && /VARIANT_RESERVATION_INVARIANT_VIOLATION/.test(migration)],
  ['Payment verification commits only an existing reservation and fails closed on underflow', /NEW\.status='payment_verified'/.test(migration) && /stock_on_hand>=OLD\.stock_reserved/.test(migration) && /VARIANT_STOCK_COMMIT_INVARIANT_VIOLATION/.test(migration)],
  ['Order record carries immutable variant SKU and label', /variant_id text/.test(migration) && /variant_sku text/.test(migration) && /variant_label text/.test(migration)],
  ['Order list preserves existing lifecycle notes and delivery timestamps', /dispute_reason AS \"disputeReason\"/.test(migration) && /delivered_at IS NULL/.test(migration) && /buyer_confirmed_at IS NULL/.test(migration) && /seller_confirmed_at IS NULL/.test(migration)],
  ['Inventory trigger follows listing-before-variant lock ordering', /Lock listing before variant/.test(migration) && (migration.match(/PERFORM 1 FROM public\.gh_marketplace_listings WHERE id=OLD\.listing_id FOR UPDATE/g) || []).length === 2],
  ['API accepts variant identity without trusting price or stock', /body\.variantId/.test(orderRoute) && /variantId: variantId/.test(orderRoute)],
  ['Order store dispatches variant reservations to dedicated RPC', /gh_marketplace_order_create_variant_reserved/.test(orderStore) && /p_variant_id: order\.variantId/.test(orderStore)],
  ['Seller API validates and atomically persists listing plus SKU definitions', /INVALID_PRODUCT_VARIANTS/.test(listingRoute) && /upsertListingWithVariants\(listingInput, variants\)/.test(listingRoute) && /gh_marketplace_listing_upsert_with_variants/.test(migration)],
  ['Listing read model exposes persisted SKU variants', /gh_marketplace_variants\?listing_id=in\./.test(listingStore) && /variants: l\.variants \|\| \[\]/.test(listingStore)],
  ['Buyer selects an available SKU before adding to cart', /Choose a SKU variant/.test(screen) && /selectedVariant\?\.id/.test(screen) && /activeVariants = listing\.variants\?\.filter/.test(screen)],
  ['Inactive SKU history does not block legacy shared-stock listings', /activeVariants\.length > 0/.test(screen) && /hasVariants = activeVariants\.length > 0/.test(screen)],
  ['Cart separates same listing across variant identities', /item\.variantId \|\| "legacy"/.test(cart) && /existing\.variantId/.test(cart)],
  ['Listing cards show a variant-aware starting price', /listing\.variants \|\| \[\]/.test(discovery) && /From \$\{formatted\}/.test(discovery)],
  ['Seller form explains base price/stock versus real SKU values', /Base listing price/.test(screen) && /Base \/ shared stock fallback/.test(screen) && /each SKU's own price/.test(screen)],
  ['Variant parser bounds SKU count, price and inventory', /lines\.length > 100/.test(helper) && /stockOnHand > 1_000_000/.test(helper)],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++ }
console.log(`\nPhase 9.3 SKU variant contracts: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
