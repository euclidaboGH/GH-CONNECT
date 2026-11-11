# Phase 9 — Marketplace transformation, increment 0.330.35

**Baseline:** 0.330.34  
**Release:** 0.330.35  
**Scope:** commerce correctness, stock management, durable listing delivery information and checkout authority. This is an incremental foundation for the broader Marketplace product transformation, not a claim that every Phase 9 feature is complete.

## Baseline audit

The 0.330.34 source already contains substantial Marketplace foundations:

- Durable listing and order APIs backed by Supabase RPCs.
- Atomic inventory reservation and expiring reservations.
- Idempotent order creation and payment claims.
- Separate GHC and Pi payment rails with server-side currency/amount verification.
- Seller Centre, listing create/edit/pause/remove, saved listings and reporting.
- Browse filters for kind/category/delivery mode and currency-safe price sorting.
- Cart bounds, cache normalization, cross-tab synchronization and selective cleanup.
- Buyer/seller order roles, delivery states, lifecycle actions, order conversations, reviews and dispute/refund operational primitives.
- Durable proceeds, commission, append-only event journal and adjustment/payout fencing.

Existing source gates were executed in the supplied Node 22 environment. Phase 3 static: 25/25; Phase 4 cart static: 10/10; Marketplace cart contract: 9/9; Phase C trust: 13/13; Pass 41 resilience: 12/12; Pass 42 domain boundary: 14/14; Phase 18 payment binding: 17/17; Phase 19 RPC transport: 12/12; Phase 20 proceeds: 11/11; Phase 21 event journal: 9/9; Phase 22 adjustments and atomic transitions passed; Phase 23 migration integrity passed (193 canonical migrations). Runtime scripts importing TypeScript could not be run under Node 22 without the required Node 24.15.0 execution flags/runtime.

## Audit findings corrected

1. **Payment rail used stale client currency.** Both single-item and cart checkout previously selected the payment path from listing/cart presentation data. The listing may change between display and order reservation. Checkout now reads currency from the server-created durable order and only routes to GHC or Pi when the server response explicitly supplies a supported value. Single-item purchase intents now use a fresh per-attempt idempotency key, retained across uncertain order creation and payment retries, then cleared after confirmed GHC settlement; a Pi handoff retains the same order key to avoid creating a second reservation while the provider flow is pending. This replaces the minute-bucket key that could collide across distinct purchases.
2. **Missing listing inventory defaulted to one.** The shared record mapper and remote listing hydration could convert missing or explicit-zero stock into an apparent unit. Missing stock now fails closed to zero and explicit zero is preserved.
3. **Seller stock was not manageable and edits reset it.** The seller form had no stock field and edit/create paths hard-coded availability to one. Seller Centre now has a bounded whole-number stock control (0–9,999), loads current stock when editing and submits the selected amount.
4. **Server availability coercion converted zero to one.** The listing route used `Number(value) || 1`. It now uses a strict stock parser, accepts explicit zero, rejects strings/fractions/out-of-range values, and preserves existing stock if an edit omits the field.
5. **Delivery instructions did not round-trip durably.** The listing metadata mapper did not persist `shippingInfo`, even though the UI collected it and filters depended on it. Delivery instructions now persist in the existing listing `metadata` JSON and are projected back to the client.

## Changes

- `lib/marketplace/checkout-contract.ts` centralizes supported order currency and strict inventory parsing contracts.
- `components/ghc/marketplace-screen.tsx` uses server order currency for payment routing, adds seller stock management, and preserves zero stock during remote hydration.
- `lib/marketplace/record-mappers.ts` fails closed for missing inventory.
- `app/api/marketplace/listings/route.ts` validates stock without coercion and preserves existing stock on omitted edits.
- `lib/server/marketplace/listing-store.ts` persists and returns delivery instructions through existing metadata.
- Added dedicated static and runtime contract gates; registered them in `prebuild` and `verify:static`.

## Financial, inventory and database boundaries preserved

- GHC and Pi remain distinct currencies and payment rails; no conversion is inferred.
- The server-created order is the source of truth for currency, price, seller, total and stock reservation.
- No client balance or payment status is trusted.
- Existing atomic stock reservation, idempotency, payment claim, order transition and payment recovery RPCs remain unchanged.
- No wallet mint/spend authority, Pi settlement, refund, escrow release, seller payout or revenue journal authority was changed.
- No SQL migration was added or applied. Existing migration history and REVIEW_REQUIRED classifications remain untouched.

## Verification

- `scripts/check-phase9-marketplace-transformation.mjs`
- `scripts/test-phase9-marketplace-contracts.mjs`
- Existing Phase 3, Phase 4, trust, resilience, mapping, payment binding, RPC transport, proceeds, event journal, adjustments, atomic transition and migration integrity gates.

Static/source checks do not prove SQL execution, live RLS/grants, database concurrency, Pi provider settlement, browser/device behavior, Node 24 typecheck/lint/build or Testnet/Mainnet acceptance.

## Remaining Phase 9 programme

This increment does not claim completion of the entire Marketplace roadmap. Further work remains for product variations/SKUs, seller fulfilment operations, buyer order tracking UX, multi-order Pi checkout orchestration, delivery evidence, refund/dispute operator experience, seller analytics, accessibility/device acceptance and end-to-end commerce testing. Finite-stock sales must remain gated on actual atomic reservation acceptance in disposable PostgreSQL/Testnet and target migration-history reconciliation.

**Production status: NOT APPROVED.**
