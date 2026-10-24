# GreenHaven Marketplace — Production upgrade 0.75.0 (3 phases)

## Audit summary (pre-upgrade)

Existing strengths:

- Durable tables: `gh_marketplace_listings`, `gh_marketplace_orders`, saves, inventory reservation, stale-claim recovery
- Listing fee settlement (GHC pilot + Pi intent verify)
- Order pay (GHC/Pi), commission split, payout routes
- Domain dual-write + local cache
- UI: browse/sell/orders/saved, message-first detail, LazyImage on cards

Gaps closed in 0.75.0:

| Gap | Fix |
|-----|-----|
| Server listings dropped media/location/category | Stored in `metadata` jsonb; list/get select + map |
| POST create ignored media/location/category | Accepted and persisted |
| No seller “My listings” surface | Marketplace **My listings** bucket + profile **Listings** tab |
| Fee CTA not server-backed | `GET /api/marketplace/listing-fee` |
| Profile Listings was a dead end | Hydrates `scope=mine` with thumbnails + deep link to listing |

---

## Phase 1 — Durable catalog authority

- `ServerMarketListing` + `listing-store`: media, location, category, condition, tags via metadata
- `listActiveListings` / `listSellerListings` / `getListing` return full client shape
- `POST/GET /api/marketplace/listings` pass-through
- `socialCreateMarketplaceListing` accepts media/location/category
- `socialFetchMarketplaceListing(id)` for single fetch

## Phase 2 — Commerce & fee UX

- Sell form posts media + location + category to durable API
- Edit / delist / delete (status paused|removed) owner tools (from 0.74)
- Dual-rail fee display + non-refundable copy
- `GET /api/marketplace/listing-fee?mode=create|edit` for honest quotes
- Existing order pay/transition/commerce routes unchanged (already production-shaped)

## Phase 3 — Cross-feature wiring

- Marketplace tabs: Browse · Sell · **My listings** · Orders · Saved
- Profile **Listings** tab: durable mine catalog, open listing / sell CTA
- Hydrate public catalog on marketplace open (existing Phase 9 merge, now with media)

---

## Supabase

**No new migration required** if these already applied:

- `20261022010025_marketplace_listings_and_list_rpc.sql` (table + upsert + metadata jsonb)
- `20261022010024_marketplace_orders_durable.sql`
- `20261022130001_marketplace_commerce_v2.sql`
- `20261022120001_gh_marketplace_saved_listings.sql`
- `20261022010079_atomic_marketplace_inventory_reservation.sql`
- `20261022010081_marketplace_stale_payment_claim_recovery.sql`

Confirm RPCs exist and are **service_role** only:

- `gh_marketplace_listing_upsert`, `gh_marketplace_listing_get`
- `gh_marketplace_release_expired_reservations`
- Order get/list/transition RPCs from commerce v2

Optional (not required): GIN index on `metadata` for media search later.

---

## Vercel environment variables

### Required (private)

| Variable | Notes |
|----------|--------|
| `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server RPC + listing upsert |
| `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client auth |

### Economy / marketplace (private unless noted)

| Variable | Suggested testnet | Privacy |
|----------|-------------------|---------|
| `GHC_TESTNET_UNLOCK` | `1` | Private |
| `GHC_BUY_WITH_PI_ENABLED` | `true` | Private |
| `GHC_MARKETPLACE_LISTING_FEE_GHC` | `1` | Private |
| `GHC_MARKETPLACE_LISTING_FEE_PI` | `0.05` | Private |
| `GHC_MARKETPLACE_PLATFORM_FEE_BPS` | `500` (5%) | Private |
| `GHC_SELLER_PAYOUT_HOLD_DAYS` | `3` | Private |
| `NEXT_PUBLIC_GHC_MARKETPLACE_LISTING_FEE_GHC` | `1` | **Public** (UI CTA) |
| `NEXT_PUBLIC_GHC_MARKETPLACE_LISTING_FEE_PI` | `0.05` | **Public** (UI CTA) |
| `NEXT_PUBLIC_GHC_BUY_WITH_PI` | `true` | Public (optional) |
| `PI_ENV` | `sandbox` | Private |
| `NEXT_PUBLIC_PI_SANDBOX` | `true` | Public |
| `GHC_WITHDRAWALS_ENABLED` | `false` | Private |
| `PI_A2U_ENABLED` | `false` | Private |
| `PAYSTACK_TRANSFERS_ENABLED` | `false` | Private |

### Optional admin / payouts

| Variable | Privacy |
|----------|---------|
| `GHC_ADMIN_API_KEY` | Private |
| `GHC_A2U_ADMIN_KEY` | Private |
| `GHC_A2U_MAX_SINGLE_PI` | Private |

Do **not** expose service role or admin keys as `NEXT_PUBLIC_*`.

---

## Manual verification checklist

1. Publish listing with 1–2 photos → appears in Browse with images  
2. My listings shows the same listing  
3. Profile → Listings shows cards; tap opens detail  
4. Edit listing → half fee copy; media updates  
5. Delist → paused; Delete → removed (hidden from public)  
6. Buy with GHC / Pi on another account (not own listing)  
7. Orders tab transitions (fulfill / complete) when paid  

Version: **0.75.0**
