# GreenHaven upgrade worklog — v0.194.0

## Scope

Phase 17 improves CI governance and regression visibility across commerce, wallet reconciliation, and API request boundaries. It does not change payment authority, financial calculations, Pi authentication, database schema, or user-facing business rules.

## Implementation

- Added `scripts/check-phase17-ci-governance.mjs` with checks for Node 24.15.0, lockfile integrity before `npm ci`, required security/commerce regression steps, least-privilege repository permissions, concurrency cancellation, expected workflow triggers, and separate typecheck/lint/build gates.
- Registered `check:phase17-ci-governance` in `package.json`.
- Added explicit CI steps for marketplace integrity, cross-feature wallet reconciliation, and the Phase 1–12 request-boundary follow-up contract. These contracts were already in the consolidated static runner; explicit workflow steps make failures easier to identify.
- Synchronized package, lockfile, app release, README, project truth, acceptance reports, and verified manifest version to `0.194.0`.

## Verification status

Source-only checks are run in the authoring environment and recorded in the delivery response. The project requires Node.js 24.15.0 or later; if the active environment is older, do not treat a blocked typecheck/build as a pass. No live Supabase migration was applied, no Pi provider call was made, and no GitHub push or Vercel deployment was performed.

## Release gates still required

1. Run `npm ci --legacy-peer-deps` with Node 24.15.0 or later.
2. Run `npm run typecheck`, `npm run lint`, and `npm run build`.
3. Validate migration `20261030010008_phase7_treasury_reporting_and_case_history.sql` on a disposable PostgreSQL instance, including grants, RLS, aggregates, idempotency, and concurrent case updates.
4. Verify authoritative seller commission/net-payable source data before reporting seller liabilities as reconciled.
5. Run authenticated Pi Testnet and GHC payment E2E for marketplace and community flows; verify timeout, duplicate, refund, and recovery paths.

This release is a source-code increment, not a production or Testnet acceptance declaration.
