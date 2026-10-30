# Upgrade worklog — 0.179.0

## Scope
One-time **0.05 π registration bonus** for authenticated users (server ledger credit, claim UI on Wallet + Rewards).

## Source-only verification
- Network/DB independent static contracts only.
- Supported runtime: **Node.js 24.15.0**.

## Behaviour
- Amount and unique_ref derived server-side (`registration_bonus:v1:{userId}`).
- Credits unified earnings ledger as `available` / source_kind `system`.
- Idempotent; disable with `GHC_REGISTRATION_BONUS_ENABLED=0`.
- Does not invent balances when ledger is unavailable.

## Limits
Does not prove Testnet apply, funded A2U, or production readiness.


## Phase 2 — Registration-bonus reconciliation (working-copy update, 2026-10-29)

- Updated the server-side registration bonus policy from 0.05 PI to 3 PI (30,000,000 atomic units).
- Added a separate idempotency reference for the 2.95 PI top-up owed to users with a legacy `registration_bonus:v1:{userId}` entry.
- Added service-role-only database RPCs for direct status lookup and serialized claim/reconciliation; status no longer depends on the latest 50/100 statement entries.
- Added a client-side automatic reconciliation attempt for legacy claimants when the bonus card loads. New/unclaimed users retain an explicit 3 PI claim action.
- Added an additive migration and classified it `REVIEW_REQUIRED`. It does not bulk-credit users merely by applying the schema migration.
- Static registration-bonus contract: 15/15 checks passed; JSX safety scan: 855 files passed. Migration inventory docs regenerated. Full TypeScript/build and PostgreSQL/Testnet execution have not been run in this environment.
- Deployment gate: apply only to the intended Testnet project after reconciling remote migration history, then test legacy claimant, unclaimed user, new user, duplicate retry, and concurrent claim cases. Do not enable Mainnet withdrawals.
- Added `scripts/ops/phase2-registration-bonus-backfill-testnet.sql`: a separate, explicit Testnet-only operator backfill with a read-only preview, idempotent RPC calls, transaction-aborting error handling, and a post-check. It is intentionally not part of the schema migration so no credits are silently issued by migration application.
- Updated the registration-bonus contract suite to 17 checks; all 17 pass. Migration inventory and verified source manifest are synchronized.
