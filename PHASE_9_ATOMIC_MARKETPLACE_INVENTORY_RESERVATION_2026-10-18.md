# Phase 9 — Atomic Marketplace Inventory Reservation

**Status:** hardened source candidate only; live migration and runtime behavior not verified.

## Implemented in source

- Added `202610180011_atomic_marketplace_inventory_reservation.sql`.
- Durable order creation locks the listing row, validates current status/stock, decrements stock and inserts the payment-pending order in one database transaction.
- Requires a buyer-scoped idempotency key. Replays return the same order; key reuse for a different listing/quantity fails.
- Creates a 15-minute stock hold. Expired unclaimed holds are cancelled and stock restored by a status-transition trigger when durable order reads or new reservation attempts invoke the expiry routine.
- Adds a durable payment claim before GHC ledger spend or recording a completed Pi intent. The expiry worker excludes claimed orders, and concurrent payment attempts are rejected. Definite GHC payment failures release the claim; ambiguous transport/server failures keep the reservation held for safe reconciliation rather than risking a paid-but-cancelled order.
- Cancelling an unpaid order restores its reservation exactly once. Verified payment commits the reserved stock.
- The order API no longer relies on a read-time availability check as its concurrency control.

## Required validation before enabling finite-stock production sales

1. Reconcile Testnet migration history and schema; confirm `gh_marketplace_listings` and `gh_marketplace_orders` match expected columns and constraints.
2. Run migration against a disposable database and validate PostgreSQL syntax/trigger behavior.
3. Simulate concurrent buyers competing for the final unit; only one reservation must succeed and availability must never become negative.
4. Replay the same buyer/idempotency key and verify exactly one order and one stock decrement. Reuse a key with different listing/quantity and verify rejection.
5. Expire a pending reservation and confirm exactly one stock restoration; verify the expired order cannot be paid.
6. Cancel an unpaid order, then repeat cancellation/retry; verify no double restoration. Verify payment confirmation commits stock and does not restore it.
7. Race payment-claim creation against expiry and concurrent payment requests; only one payment claim may succeed, claimed stock must not be released, and ambiguous outcomes must remain safely reserved pending reconciliation.
8. Test RPC permissions, RLS, seller isolation, payment retries, timeout-after-commit and order-cache freshness.
9. Run full typecheck, ESLint and Next.js production build.

## Remaining economy roadmap items (must not be dropped)

- Complete referral links for every registered user and the 5% qualifying VIP referral reward.
- Implement curation rewards as redistribution of upvoters' existing spendable GHC.
- Implement and test marketplace listing and community creation fees, with GHC and Pi payment options.
- Complete atomic inventory reservation validation before finite-stock production sales.
- Reconcile Supabase migration history and schema independently for Testnet and Mainnet.

No migration has been applied to any live environment, and no production deployment was performed. A claimed payment that returns an ambiguous result intentionally retains its stock reservation; add operator/automated reconciliation for these cases before rollout.


## Phase 9.1 follow-up — Pi intent binding

The payment route now requires the completed Pi intent to use purpose `marketplace` and reference the target order (`order.id` or `market_order_${order.id}`). Migration `202610180011_atomic_marketplace_inventory_reservation.sql` also adds a partial unique index on non-null `payment_intent_id`, preventing one Pi intent from being linked to multiple marketplace orders. This is source-only; inspect duplicate existing intent IDs and validate the migration on a disposable database before applying.
