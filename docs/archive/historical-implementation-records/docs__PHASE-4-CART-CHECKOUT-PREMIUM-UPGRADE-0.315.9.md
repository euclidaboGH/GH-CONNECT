# Phase 4 — Cart and Checkout Premium Upgrade (0.315.9)

**Date:** 6 November 2026  
**Baseline:** complete GH-CONNECT 0.315.8 repository  
**Scope:** client cart integrity, cross-tab consistency, checkout concurrency and recovery-safe cart cleanup.

## Implemented

- Added strict normalization for local cart cache records. Invalid identifiers, titles, seller references, currencies, prices, quantities, and unsafe text are discarded before reaching UI consumers.
- Bounded the convenience cache to 100 unique listing lines and 99 units per line. Duplicate listing IDs are consolidated and quantities remain bounded by known positive availability.
- Repaired malformed/legacy cache content on read. The local cache remains a display convenience only; it is not an inventory, pricing, seller, order, or payment authority.
- Added cross-tab cart synchronization through the browser `storage` event in addition to the existing in-tab event.
- Prevented cart quantity/removal/clear controls from changing the visible checkout snapshot while checkout is active.
- Changed successful checkout cleanup from clearing the entire local cart to removing only listing lines whose orders were successfully reserved. Unrelated cart entries are preserved; own listings remain visible for the user to remove.
- Preserved stable idempotency keys across failed/uncertain retries, server-side order reservation, GHC payment authority, and Pi provider handoff. No client-side balance, payment, inventory, or settlement authority was introduced.

## Verification

- `scripts/check-phase4-marketplace-cart.mjs`: 10/10 source-contract checks.
- `scripts/test-phase4-marketplace-cart.mjs`: 8/8 runtime assertions covering malformed cache repair, duplicate consolidation, stock/quantity caps, unit counts, selective cleanup, and maximum cart size.
- Existing `scripts/check-marketplace-cart-upgrade.mjs`: 9/9 PASS.

## Explicit limitations

- Cart prices, titles, media and availability are cached display snapshots. The order API/database remains authoritative and must revalidate the listing and stock at reservation time.
- No live checkout, payment provider, Testnet, PostgreSQL, browser-device or concurrent multi-tab E2E test was run in this source-only phase.
- No SQL migration was added or applied. No wallet, GHC, Pi, inventory, escrow, payout, refund or settlement state was changed.
- Production approval remains blocked on the outstanding Node 24.15.0 install/typecheck/lint/build gates and prior database/operator/runtime acceptance gates.
