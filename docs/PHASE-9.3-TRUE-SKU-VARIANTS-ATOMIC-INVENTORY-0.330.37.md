# Phase 9.3 — True SKU variants and atomic inventory

**Release:** 0.330.37  
**Priority:** 9 — Marketplace  
**Source baseline:** 0.330.36  
**Status:** Source implementation increment complete; database/provider/runtime acceptance remains open. **NOT APPROVED for production.**

## Delivered

- Added a bounded SKU-variant domain contract and seller authoring format: `SKU | label | unit price | on-hand stock`, up to 100 rows. SKU uniqueness is case-insensitive within a seller; price precision is capped at eight decimal places; stock is a whole number.
- Added durable `gh_marketplace_variants` records with stable IDs, listing/seller ownership, SKU, label, independent GHC/Pi price, on-hand stock, reserved stock and active state. Seller SKU uniqueness is enforced by a database unique index.
- Added a single seller-only RPC that publishes the listing and its complete initial SKU set in one transaction, preventing a legacy-checkout window during first publication. Added transactional variant replacement. All incoming rows are validated before writes; existing reserved stock cannot be undercut; a variant with an active reservation cannot be removed; omitted variants are soft-deactivated rather than deleted.
- Added buyer SKU selection, variant-specific price/availability display, variant-aware starting-price display on listing cards, variant-aware cart-line identity and order submission. Cart values remain display-only; order price and stock are derived by the database RPC.
- Added variant-bound order creation. It locks the listing and variant, validates ownership/status/currency/availability, increments `stock_reserved`, and writes the order with immutable SKU/label snapshots and server-derived unit price/total.
- Added variant-aware order transition handling: cancellation/expiry releases the reserved quantity; verified payment commits it by reducing both on-hand and reserved quantities. The trigger locks listing before variant to align with the reservation lock order.
- Blocked the legacy listing-level reservation RPC from creating new orders against listings with active variants. Idempotency replay checks exact variant identity.
- Preserved legacy non-variant listing checkout and the existing GHC/Pi payment and seller proceeds/refund/payout authorities.

## Migration

`supabase/migrations/20261107180001_marketplace_sku_variants_atomic_inventory.sql`

Classification: **REVIEW_REQUIRED**. This migration has not been applied. It adds a new RLS-denied client table, seller-only/service-role RPCs, an additive order FK/snapshot, variant-aware stock trigger behavior and overrides the existing listing/order read/create RPCs. It must be reconciled against each target's actual migration history and exact schema before any execution.

## Verification performed

- `scripts/test-phase93-product-variants.mjs`: **16/16 assertions passed**.
- `scripts/check-phase93-marketplace-variants.mjs`: **25/25 source contracts passed**.
- The tests cover parser bounds, decimal format, duplicate SKU rejection, currency, stock validation, unique identity and source contracts for atomic reservation/release/commit, legacy bypass rejection, order snapshots and buyer/seller wiring.

These are source/runtime helper and static contract checks. They are not PostgreSQL execution tests and do not prove concurrency behavior.

## Mandatory acceptance still open

1. Run the migration against a disposable PostgreSQL instance matching the target major version; inspect function owners, grants, RLS and all dependency signatures.
2. Test two or more buyers concurrently reserving the final unit of the same SKU; exactly one may succeed. Repeat across different SKUs in the same listing and across multiple app instances.
3. Exercise reservation expiry, explicit cancellation, payment claim, definite payment failure/release, successful GHC payment, successful Pi provider verification, duplicate callbacks and timeout recovery. Prove every inventory quantity is conserved and no unit is released or committed twice.
4. Test seller edits while orders are reserved, including attempts to lower stock below reserved, remove a reserved SKU, change a SKU, change price, pause/delist a listing, and retry after uncertain API responses.
5. Verify legacy listing orders remain valid and active-variant listings cannot be purchased through the old listing-level reservation RPC.
6. Reconcile Testnet and Mainnet migration histories independently. Do not apply this migration or enable finite-stock variant sales until explicit review and operator approval.
7. Run Node 24.15.x locked install, TypeScript, ESLint, Next.js production build, browser/mobile/Pi Browser tests and authenticated GHC/Pi Testnet checkout.

## Known limitations

- Variant labels are buyer-facing labels; this increment does not build a combinatorial option matrix or variant attributes editor. Sellers define each concrete SKU explicitly.
- The existing listing-level price and stock remain as the legacy/default display fields. Variant order totals are server-derived from the selected SKU.
- The new migration and its RPCs have not been executed in PostgreSQL. The application source can fail closed until the migration is applied, but the feature must not be represented as production-ready.
- No live Supabase project, financial ledger, Pi provider, GHC balance, payment, refund or payout was changed by this source work.
