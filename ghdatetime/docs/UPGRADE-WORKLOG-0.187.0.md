# Upgrade worklog — v0.187.0

## Scope
Phase 1–4 audit follow-up focused on the PI earnings execution safety boundary.

## Changes
- Added a fresh service-role lease heartbeat immediately before provider create, submit, complete, and settlement operations.
- Reworked heartbeat SQL to lock and validate the request lease and global A2U lane before extending either lease.
- Added review-required migration `20261030010006_pi_earnings_receipt_and_lease_fencing.sql` to validate the actual provider receipt inside PostgreSQL before settlement or reservation release.
- Settlement evidence binds payment ID, A2U direction, Testnet, recipient, exact net amount, GreenHaven provider/domain/request metadata, transaction ID, transaction verification and developer completion.
- Release evidence must match the provider cancellation flags and prove no transaction ID exists.
- Added 13 source-contract checks and wired them into prebuild/static verification.
- Updated release metadata and generated migration inventory.

## Verification and limitations

All results below are source-level checks, not live-system acceptance.
- `node scripts/check-phase4-receipt-fencing.mjs`: 13/13 passed.
- Initial `npm run verify:static` exposed stale v0.186.0 release references and a missing v0.187.0 worklog; documentation was synchronized. Re-run the full suite after this correction.
- The available runtime is Node.js 22.16.0; the project requires Node.js 24.15.0.
- No PostgreSQL server/psql/Docker or authenticated Pi Testnet execution was available. SQL has not been applied to Supabase.
- No real payment, balance, ledger, user, or production data was mutated. Mainnet remains disabled.
