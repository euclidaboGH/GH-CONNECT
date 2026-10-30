# Upgrade worklog — 0.184.0

## Phase 4 PI earnings payout backend progression

- Added `20261030010003_pi_earnings_payout_settlement_recovery.sql` as an additive REVIEW_REQUIRED migration.
- Settlement RPC checks request state, Testnet network, canonical recipient, exact net PI amount, transaction verification and Pi developer completion before calling the gross ledger settlement and marking the request paid in the same database transaction.
- Paid retries are idempotent only for the same provider payment ID and transaction ID; mismatched receipts are rejected.
- Reservation release requires an authoritative cancelled/user-cancelled provider state and an explicit no-transaction assertion. Uncertain outcomes remain reserved.
- Both privileged RPCs revoke PUBLIC/anon/authenticated and grant execute only to service_role.
- Added 15 static settlement/recovery contract checks and wired them into prebuild.

The work completed here is source-level implementation and source-only verification. The required Node.js 24.15.0 runtime is not present in this environment.

## Verification boundary

- Static settlement/recovery contracts: 15/15 passed.
- PostgreSQL execution, concurrency and injected transaction rollback tests: NOT RUN (no disposable PostgreSQL service/client in this environment).
- Pi A2U provider worker and live receipt reconciliation: NOT IMPLEMENTED in this candidate.
- Node 24 production build and Pi Testnet lifecycle: NOT RUN; current runtime is Node 22.16.0 and no authenticated/funded Testnet operator environment is available here.
- Mainnet remains disabled. Do not apply either payout migration to a live database until ordered schema/ACL review and disposable PostgreSQL tests pass.
