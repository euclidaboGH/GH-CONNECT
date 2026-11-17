# Phase 22 — Marketplace atomic order transitions

**Release:** 0.308.0  
**Date:** 2026-11-04  
**Status:** source implementation complete; migration review and live acceptance pending.

## Changes

- Added `gh_marketplace_order_transition`, a service-role-only PostgreSQL RPC.
- The RPC locks the order row with `FOR UPDATE`, validates the canonical status graph while holding the lock, writes one audit event, and returns the refreshed order. Generic and commerce cancellation both reject an active `payment_claimed_at`; payment verification and confirmation require persisted verified payment status.
- Durable application transitions now call the RPC directly. They do not use a database-backed read/modify/upsert sequence.
- RPC outage, malformed response, or missing order response fails closed. No process-local fallback is used when Supabase is configured.
- Expanded `gh_marketplace_order_get` to return the commerce/delivery metadata already present in the order schema.
- Added a static gate and registered it in `prebuild` and `verify:static`.

## Financial and authority boundaries

This RPC changes order lifecycle state only. It does not verify an external payment by itself, create GHC or Pi value, issue refunds, release escrow, pay sellers, or write wallet/financial ledger entries. Existing payment routes remain responsible for authoritative settlement checks before requesting `payment_verified`. The existing inventory trigger remains responsible for stock reservation release/commit when status changes.

## Migration handling

`20261101160002_marketplace_atomic_order_transitions.sql` is classified `REVIEW_REQUIRED`. It has **not** been applied. Reconcile remote migration history and validate the migration on disposable PostgreSQL/Testnet, including concurrent payment-versus-cancellation requests, trigger interaction, RPC ACLs, and all supported transition paths before applying it to any live project.

## Verification boundary

The Phase 22 source gate validates the application RPC path, row lock, state graph presence, service-role-only grants, fail-closed handling, canonical response, absence of financial mutation, pipeline registration, package/lockfile parity and migration-prefix uniqueness. It is not a substitute for PostgreSQL execution, concurrency tests, supported Node 24 typecheck/lint/build, browser/device acceptance, live Supabase/Pi provider tests or operator approval. Production remains **NOT APPROVED**.
