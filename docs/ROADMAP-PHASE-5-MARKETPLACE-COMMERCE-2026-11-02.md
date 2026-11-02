# GH-CONNECT Roadmap Phase 5 — Marketplace & Commerce

Date: 2026-11-02

## Defects addressed

- Unexpected order-store exceptions now return a stable `503` JSON response with `retryable: true`, `Cache-Control: no-store`, and `Retry-After`. Order success is never fabricated. Clients can retry with the same stable `Idempotency-Key`.
- Order-history storage exceptions now return a distinct retryable service-unavailable response rather than looking like an empty order history or bubbling into a framework error page.
- Unexpected listing-upsert and listing-read failures are handled with stable retryable service responses for public listing reads, seller listing reads, and ID lookups.
- Listing pagination input now uses a safe integer default for malformed, fractional, or unsafe numeric limits and remains capped at 100.
- Added `scripts/check-roadmap-phase5-marketplace-commerce.mjs` and registered it in `prebuild` and `verify:static`.

## Invariants preserved

- Server-side listing/order records remain authoritative; client-supplied seller identity, price, currency, title, and total are not trusted for order totals.
- Existing stable idempotency keys, inventory reservation RPC authority, payment verification, listing fee settlement, ownership checks, and payment rails are unchanged.
- No speculative database RPC, schema migration, local fake success, permission bypass, dependency change, or financial-rule change was introduced.

## Verification limits

The phase checker is static contract regression coverage, not a live checkout test. Run the full typecheck, lint, build, and authenticated Supabase/Pi Browser end-to-end tests under the repository's supported Node 24.15.0 runtime before deployment. Confirm the client displays retryable API errors clearly and reuses the same idempotency key on an uncertain order-create retry.
