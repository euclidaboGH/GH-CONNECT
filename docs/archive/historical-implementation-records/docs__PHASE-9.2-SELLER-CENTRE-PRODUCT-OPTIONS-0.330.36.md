# Phase 9.2 — Seller Centre and product option foundations

**Baseline:** 0.330.35  
**Release:** 0.330.36  
**Production status:** NOT APPROVED

## Research-derived engineering guardrails

The implementation follows the OWASP Business Logic Security guidance that prices, ownership and other security-sensitive values must be server-derived, state transitions must be validated server-side, check-then-act operations must be atomic, and retries must reuse idempotency keys. Supabase's Row Level Security guidance also requires grants and policies to be reviewed together. Product options therefore remain descriptive metadata only in this increment: they do not create a new price, stock pool, payment rail, or inventory authority.

## Delivered

- Seller Centre health indicators for active, paused, sold-out and draft listings, low stock (1–3 units), open orders, orders needing attention, completed orders and active listings missing core merchandising content. Counts are based on loaded listing/order records and do not estimate revenue from client-cached prices.
- Seller product-option authoring using one line per group (`Size: S, M, L`), capped at four groups and twelve values per group. Duplicate names/values, control characters, malformed lines and over-limit input are rejected by the form parser.
- Server-side normalization and validation for supplied option arrays. Omitted options on legacy edit clients preserve existing option metadata.
- Durable round-trip through the existing listing `metadata` JSON, record mapper and listing API projection. No schema migration is needed for this descriptive metadata.
- Buyer listing details display available options and clearly state that listed price and stock are shared; buyers can message the seller to confirm an option before purchase.
- New static contract and runtime tests are registered in `prebuild` and `verify:static`.

## Safety boundary

This increment deliberately does **not** claim full SKU/variant commerce. Options are not independently priced, do not have independent stock counts, and are not passed as a separate selection to the order reservation RPC. This avoids displaying a false stock promise or implying that a buyer's choice is bound to an order. Independent SKUs require a dedicated variant table, order-level variant identity, atomic reservation/release integration, idempotency conflict checks, payment/refund lifecycle integration, and PostgreSQL concurrency acceptance before the purchase UI can safely offer variant-specific availability.

## Verification

- `scripts/check-phase92-marketplace-seller-experience.mjs`
- `scripts/test-phase92-product-options.mjs`
- Existing Phase 9 Marketplace and repository static gates.

## Still required before production

- Node 24.15.0 dependency-backed typecheck, lint and Next.js production build.
- Browser/device accessibility and usability acceptance.
- Live Supabase RLS/grant and API contract acceptance.
- For future independent variants: disposable PostgreSQL concurrent reservation/expiry/cancel/paid-order tests and Testnet checkout acceptance.
