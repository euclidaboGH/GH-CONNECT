# Phase 7 — Financial operations and treasury visibility (0.190.0)

## Delivered
- Added `GET /api/admin/treasury/summary`, an operator-only read-only treasury snapshot.
- Defaults to the current UTC quarter; custom windows require both timestamps, valid ordering, and a maximum 93-day span.
- Combines the existing authoritative PI cashback period reconciliation with existing open A2U review and stuck-job queues.
- Reports `healthy`, `attention`, or `degraded`; a missing data source is unavailable, not zero.
- Explicitly separates PI from GHC and marks seller payables, general earnings reservations, bank settlements and GHC utility accounting as not included.
- Requires an operator key of at least 32 bytes and compares it using `timingSafeEqual`.
- Adds an 11-point source-contract check and wires it into static verification and `prebuild`.

## Safety boundaries
- GET-only and read-only. No payout execution, settlement, reservation release, ledger write, entitlement mutation or database migration.
- Existing A2U queue items are displayed as exceptions; this endpoint does not resolve them.
- Cashback figures are returned only from `gh_pi_cashback_reconcile_period`; the endpoint does not calculate them in application code.
- The report is not a complete treasury balance sheet. Seller payable totals, general earnings reservation totals, bank settlement totals, and GHC utility balances are deliberately excluded until each has a verified aggregate source and reconciliation contract.

## Operator usage
`GET /api/admin/treasury/summary` with `x-ghc-operator-key`. Optional query parameters: `startsAt`, `endsAt`, and `olderThanMinutes`. Both date parameters must be supplied together.

## Verification and release boundary
- `node scripts/check-phase7-treasury-operations.mjs` — 11 source-contract checks.
- `node scripts/verify-phase14-static.mjs` — full static regression suite.
- No PostgreSQL/Testnet database was available; no migration was applied. Node.js 24 typecheck/lint/production build and browser/operator E2E remain required.
