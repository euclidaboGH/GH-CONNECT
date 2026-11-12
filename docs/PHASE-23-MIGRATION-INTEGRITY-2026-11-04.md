# Phase 23 — Migration Integrity and Marketplace Lock-Scope Hardening

**Release:** 0.309.0  
**Date:** 2026-11-04  
**Migration:** `20261104170001_marketplace_order_read_cleanup_separation.sql`

## Findings and correction

The Phase 22 canonical order-read RPC ran the global expired-reservation cleanup before returning an order snapshot. The atomic transition and commerce RPCs also called that read function while holding a specific order row lock. That meant a single transition could sweep and lock unrelated expired orders while retaining its own row lock, increasing cross-order lock contention and deadlock exposure under concurrent traffic.

Phase 23 makes `gh_marketplace_order_get` a side-effect-free snapshot read. Ordinary application `loadOrder` calls explicitly run `gh_marketplace_release_expired_reservations` first and fail closed if the cleanup RPC does not confirm success. The transition and commerce RPCs can now return the canonical snapshot without running a global cleanup sweep inside their row-locked transaction.

## Migration-wide audit

- 177 canonical SQL migration files; unique 14-digit versions and non-empty SQL files.
- All parsed `SECURITY DEFINER` function definitions in the source migration set declare a fixed `search_path = public`.
- Source manifest and generated migration inventory are synchronized.
- Proposal, approval-required and review-required classifications remain explicit; the new Phase 23 migration is `REVIEW_REQUIRED`.
- No migration was applied, and no Testnet/Mainnet migration history was accessed.

## Financial and security boundaries

No GHC issuance, wallet balance, ledger, Pi settlement, refund, escrow release, seller payout or treasury mutation was introduced. RPC execution remains restricted to `service_role`. The application order read fails closed when reservation cleanup cannot be confirmed.

## Required validation before deployment

1. Apply the complete migration sequence to a disposable PostgreSQL database and validate function signatures, dependencies, grants and trigger behavior.
2. Test concurrent reservation expiry and order transitions, including cancellation versus payment claim, across multiple orders.
3. Reconcile the target Supabase migration history independently for Testnet and Mainnet before considering this migration.
4. Run supported Node 24.15.0 dependency install, typecheck, lint and production build; then run two-account browser/Testnet acceptance.

This source upgrade is not production approval.
