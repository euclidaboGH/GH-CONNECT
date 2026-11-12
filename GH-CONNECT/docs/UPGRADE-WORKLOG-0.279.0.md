# GreenHaven 0.279.0 — Phase 2 Commerce & Cart Integrity

Date: 2026-11-03

## Scope

Marketplace cart and orders honesty after Preview audit: own-listing checkout path, timeouts, seller labels, order empty states, badge quantity.

## Changes

### Cart (`lib/marketplace/cart.ts`)
- Optional `sellerName` on cart lines
- `getMarketplaceCartUnitCount` for badge math
- `removeMarketplaceCartItemsBySeller` helper

### Marketplace screen
- Add-to-cart captures seller display name when present
- Cart estimates exclude own listings
- "Remove my listings from cart" CTA
- Checkout hard-timeout 45s with human message (no stuck "Securing…")
- Seller line prefers name over truncated id
- Orders fetch 15s abort; loading always clears
- Role-aware empty states: No purchases / No sales / No orders

### App shell
- Bottom-nav cart badge continues to sum quantities (verified)

## Verification

`node scripts/check-phase2-commerce-cart.mjs` — 13/13 PASS  
Also retains Phase 1 truth check.

## Not claimed

- Live multi-user purchase on Testnet
- Server-side cart service (still local cache + server order authority)
