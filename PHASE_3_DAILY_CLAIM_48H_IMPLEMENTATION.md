# Phase 3 — Daily Claim 48-hour lock (implementation candidate)

Date: 2026-10-18
Project: GH-CONNECT 0.61.1

## Implemented in source

- Added `supabase/migrations/202610180008_daily_claim_48h_lock.sql`.
- Daily Claim now creates a `pending` ledger entitlement, not an immediately spendable `posted` user credit.
- Added a unique partial index to prevent duplicate pending daily-claim credits for a user/reference.
- Database redemption checks the database clock and rejects a Daily Claim redemption before `created_at + interval '48 hours'`.
- Successful redemption expires the pending entitlement and posts one wallet credit in the same database transaction.
- Retry with the pending row ID after a successful redemption resolves to the existing posted transaction.
- Legacy pending records from other sources retain their existing redemption behavior in this phase. New non-Daily-Claim issuance paths must be disabled/reconciled in Phase 3; this phase does not yet enforce the sole-mint policy globally.
- Daily Claim API returns `pending`, `holdId`, and `redeemableAt`; it fails closed if the deployed RPC does not implement the new contract.
- Early redemption returns HTTP 409 / `NOT_YET_REDEEMABLE`.
- Local development store mirrors the 48-hour Daily Claim lock.
- UI describes the reward as pending, displays the expected redeemable time, and refreshes wallet state without optimistically crediting the balance.
- Emission telemetry no longer reports pending Daily Claim value as an immediate circulating-balance change.

## Static checks run

- `node scripts/test-daily-claim-48h-lock.mjs` — 13/13 passed.
- `node scripts/test-daily-claim-wallet-pipeline.mjs` — 35/35 passed.
- `node scripts/test-economy-v12.mjs` — 173/173 passed.
- `node scripts/test-10-phase-baseline.mjs` — 8/8 passed.
- `node scripts/test-vercel-build-repair.mjs` — 9/9 passed.
- `node scripts/check-migration-release-readiness.mjs` — passed static checks; it warned that ten pre-existing migrations are dated after the audit date.
- `node scripts/check-release-hygiene.mjs` — 10/10 passed.
- `node scripts/test-ghc-curation-reward.mjs` — 24/24 + 7/7 passed.
- `node scripts/test-rewards-reliability.mjs` — 24/24 passed.

These are static/source regression checks, not live PostgreSQL verification. A dependency install attempt timed out before `tsc`/Next.js became available, so typecheck, lint and production build are unverified.

## Mandatory Testnet migration runbook

1. Create a fresh Testnet database backup/snapshot and confirm restore access.
2. Inspect actual Testnet migration history and compare the live schema with this repository. The presence of a SQL file does not mean it has been applied.
3. Review the future-dated migration files separately; do not blindly apply all pending migrations in filename order.
4. Check for duplicate pending Daily Claim references before creating `uq_ghc_daily_claim_pending_ref`. Resolve any duplicate according to ledger policy; never delete or rewrite posted ledger history to make a migration pass.
5. Apply only this reviewed migration to Testnet through the approved operator workflow. Do not apply to Mainnet.
6. Test claim at T0; confirm the user transaction is `pending`, wallet available balance does not increase, and `redeemableAt` is T0 + 48 hours.
7. Attempt redemption at T0 + 47:59:59; expect HTTP 409 and no ledger changes.
8. Attempt redemption at T0 + 48:00:00; expect exactly one posted credit and one expired pending row.
9. Retry redemption with both the pending-row ID and reference; expect idempotent success and no additional credit.
10. Run concurrent redemption requests and verify one wallet credit only.
11. Confirm wallet snapshot, transaction history and spend/transfer authorization agree after redemption.
12. Run typecheck, lint, full CI and a fresh Vercel Preview build before merging.

## Not done / no remote actions

- No live database migration or database query was performed.
- No GitHub push, Vercel deployment, or Mainnet operation was performed.
- The global sole-issuance restriction (Daily Claim as the only GHC creation source) remains a Phase 3 task. Curation, activity, administrative and purchase-related issuance paths require a full inventory and safe deactivation/reconciliation.
- GreenHaven ID peer transfers and cross-system shared-wallet verification remain subsequent work.
