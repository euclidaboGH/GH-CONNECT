# Upgrade worklog — 0.330.38

## Priority 9 — Phase 9.4 seller fulfilment and buyer tracking

- Added durable fulfilment method, carrier, tracking number, HTTPS tracking URL, estimated delivery and dispatch timestamps to marketplace order records.
- Added separate shipping, pickup/meetup and digital-service flows. Shipping cannot be marked delivered before dispatch; digital delivery becomes `service_active`; buyer completion remains gated on verified payment and delivery/service activation. Legacy in-flight orders retain a compatibility completion path without inventing delivery method.
- Added a database-enforced append-only trigger journal for order creation, payment status, order status and delivery status. Phase 9.4 fulfilment events carry authenticated buyer/seller identity; older service-RPC state changes without actor context are explicitly system-attributed.
- Added a participant-scoped, lazy-loaded buyer/seller order timeline and bounded fulfilment input parsing.
- Source-level verification passed 15/15 parser assertions and 28/28 source contracts.
- Added migration `20261107190001_marketplace_fulfilment_tracking_timeline.sql`, classified REVIEW_REQUIRED and unapplied.
- No payment, inventory, escrow, refund, payout, Supabase, carrier or production data was changed.
- PostgreSQL execution, multi-instance concurrency, Node.js 24.15.0 dependency-backed typecheck/lint/build, browser/device and Pi/GHC Testnet acceptance remain open.
