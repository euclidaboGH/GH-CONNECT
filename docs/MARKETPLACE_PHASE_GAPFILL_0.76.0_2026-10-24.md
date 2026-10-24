# Marketplace gap-fill 0.76.0

Closes production gaps after 0.75.0 three-phase work.

## Phase gap-fill

### Checkout (Phase 2 completion)
- Dual-rail **Pay with ₲ GHC | π Pi** on listing detail (user choice, not only listing currency).
- **Server-first** order create: `POST /api/marketplace/orders` with Idempotency-Key.
- GHC pay: `POST /api/marketplace/orders/:id/pay`.
- Pi path: reserve order then `openPayForListing`.
- Own-listing hard block with clear copy.
- Orders list: **Pay now** for unpaid buyer orders.

### Listing mutations (Phase 1/3)
- Edit → durable `POST /api/marketplace/listings` upsert (media/location/category) + local domain mirror.
- Delist / Delete → server status `paused` / `removed` then local update + My listings refresh.

### Discovery & deep links (Phase 3)
- Opening a listing by id hydrates from `GET /api/marketplace/listings?id=` when not in local cache.
- `ghc:open-marketplace` event accepts `{ bucket, listingId }` (profile Sell CTA).

### Client helpers
- `socialCreateMarketplaceOrder`
- `socialPayMarketplaceOrder`
- `socialFetchListingFeeQuote`

## Unchanged env / Supabase
Same as 0.75.0 doc. No new migration required.

## Version
0.76.0
