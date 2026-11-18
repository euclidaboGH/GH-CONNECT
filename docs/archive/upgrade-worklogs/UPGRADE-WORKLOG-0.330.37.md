# Upgrade worklog — 0.330.37
This worklog records source-only evidence and the external runtime limitations; it is not a production approval.

**Scope:** Priority 9.3 Marketplace — true SKU-level variants and atomic per-variant inventory.

## Changes

- Added `lib/marketplace/product-variants.ts` with bounded SKU normalization, seller text parser and editor serialization.
- Added `supabase/migrations/20261107180001_marketplace_sku_variants_atomic_inventory.sql` for durable SKU records, seller replacement, buyer reservation, legacy RPC bypass prevention, variant-aware stock commit/release and order SKU snapshots. Classification is REVIEW_REQUIRED.
- Updated seller listing API/store to persist and hydrate variant rows, buyer listing detail to select a concrete SKU, cart lines to distinguish variants, and order creation to send the selected variant ID only.
- Updated durable order mapping and order display with SKU identity.
- Added 16 parser/runtime assertions and 25 source contracts; registered both in prebuild and static verification.
- Updated migration inventory, source truth, current build context, product roadmap, system acceptance and Phase 12 release readiness.

## Checks

- Phase 9.3 parser/runtime helper: 16/16.
- Phase 9.3 source contracts: 25/25.

## Explicitly not verified

- PostgreSQL migration parse/application, schema compatibility, RLS/ACL runtime, trigger execution, concurrent oversell tests, expiry/payment/cancellation races and rollback behavior.
- Node.js 24.15.0 dependency installation, TypeScript, ESLint, Next.js production build, browser/device/screen-reader acceptance.
- Live Supabase Testnet/Mainnet migration reconciliation, GHC ledger payment, Pi provider payment, refund, seller payout and operator sign-off.

No database migration was applied. No production data, order, stock, GHC/Pi balance, payment, refund or payout was changed. Production remains NOT APPROVED.
