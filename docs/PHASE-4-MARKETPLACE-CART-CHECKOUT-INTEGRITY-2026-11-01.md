# GH-CONNECT v0.274.3 — Phase 4: Marketplace cart and checkout integrity

**Status:** Source implementation complete; production release remains gated.

## Scope delivered

Phase 4 builds on the Phase 3 source archive without replacing the existing marketplace, order authority, inventory reservation, payment adapters, or seller/order workflow.

### Cart data resilience

- Normalizes persisted cart records at read time and discards malformed entries, invalid listing identifiers, duplicates, and unsupported shapes.
- Bounds the cart to 100 lines and quantities to the existing 1–99 order contract.
- Normalizes display price to finite non-negative values; the displayed price remains informational and never becomes checkout authority.
- Adds a stable per-line checkout key and persists normalized legacy carts so retries after refresh reuse the same idempotency key.
- Treats known zero inventory as zero rather than as an unknown-stock fallback. Unknown inventory can still be added as a hint, but the server remains the final authority.

### Checkout integrity

- Preflights every line against the durable listing endpoint before creating orders. The preflight fails closed if the listing cannot be read durably, is inactive, has unsupported currency, or has insufficient stock for the requested quantity.
- The order-create RPC still performs the final locked inventory/price validation. Preflight is not a reservation and cannot replace that server check.
- Uses stable `cart_<checkoutKey>` idempotency keys instead of generating a fresh key from `Date.now()` and randomness on every attempt.
- Routes settlement from the currency returned by the durable order, and verifies it agrees with the preflight currency; it does not route payment from the local cart's currency snapshot.
- Rejects carts with more than one server-verified Pi line before creating any orders, because the current Pi handoff opens one order at a time.
- Removes GHC lines only after the payment API reports success. When a Pi line remains, that line stays in the cart until the buyer completes the Pi handoff; paid GHC lines are removed independently.
- Prevents a known zero-stock listing from being added through the listing UI and shows a clear cart error when saved stock state is zero.

## Regression protection

Added `scripts/check-phase4-marketplace-checkout-integrity.mjs` and registered it in both `prebuild` and `verify:static`.

The check covers stable idempotency, local cart normalization, zero-stock handling, authoritative preflight, currency binding, one-Pi-order constraint, partial checkout cart retention, and server-authoritative order creation.

## Verification evidence

The following checks passed after Phase 4 changes:

- Phase 4 marketplace checkout integrity: **16/16**.
- Existing marketplace cart upgrade: **9/9**.
- Pass 41 marketplace resilience: **12/12**.
- Pass 42 marketplace domain boundary: **14/14**.
- Pass 42 record-mapper runtime assertions: **16**.
- Phase 18 marketplace payment binding: **17/17**.
- Phase 19 marketplace RPC transport: **12/12**.
- Phase 21 marketplace event journal: **9/9**.
- Phase 22 marketplace adjustments: **11/11**.
- Marketplace revenue reconciliation contract: **10/10**.

## Limitations and release gates

- The preflight is a read, not a stock reservation. The create-order RPC remains authoritative and may still reject a race after preflight.
- A timeout after the server commits an order can leave the buyer needing to check Orders. Stable cart idempotency keys are intended to make a safe retry resolve to the original order, subject to the deployed RPC's actual idempotency contract.
- The local cart is a convenience, not a durable server cart. Cross-device synchronization is not claimed.
- No new SQL migration was introduced by Phase 4; canonical migration inventory and consolidated bundle are unchanged.
- No live Supabase, Pi Testnet, GHC payment, or Vercel run was performed. No real payment was initiated by these checks.
- The source-only checks do not establish a Node 24 production build or production approval. Keep the release status **NOT APPROVED** until locked install, typecheck, lint, build, live database reconciliation, and payment-path evidence pass.
