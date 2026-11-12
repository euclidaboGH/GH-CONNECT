# Upgrade worklog — 0.338.55 / Run #295

## Objective
Complete source hardening and readiness work for the six migrations previously held for validation, without applying database changes or changing the product version.

## Changes
- Hardened all six held migration sources and kept their canonical numeric filenames unchanged.
- Preserved the latest Run #291 Pi payout cancellation implementation inside the Phase 3 wallet/rewards migration; it continues to require absence of provider payment ID, txid, receipt, provider verification, execution start, lease token, lease expiry and execution attempts before self-service release.
- Replaced marketplace variant inventory counter clamping with fail-closed reservation and stock-commit invariant checks.
- Pinned SECURITY DEFINER search paths to `pg_catalog, public, pg_temp` and made RPC ACLs explicit.
- Added a focused source-contract test and registered it in static verification and prebuild checks.
- Updated marketplace inventory and wallet closeout regression tests to assert the stricter behavior.
- Regenerated migration source inventory artifacts and added the six-migration completion report.

## Verification
- Six-migration source readiness test: PASS.
- SQL lexical integrity: PASS, 221/221.
- Marketplace variant source contract: PASS, 26/26.
- Marketplace fulfilment source contract: PASS, 28/28.
- Marketplace fulfilment parser: PASS, 15/15.
- Phase 3 wallet/rewards/membership closeout: PASS, 43/43.
- Phase 3 membership/reward request guards: PASS, 10/10.
- Messaging full-history search: PASS, 10/10.
- Run #261 A2U qualification: PASS, 16/16.
- Run #291 payout release safety: PASS, 15/15.
- Run #257 marketplace/payment/fulfilment integration source contract: PASS, 15/15.
- Migration source manifest: PASS, 221/221.
- Complete `npm run verify:static`: PASS, including the new held-migration gate.

## Remaining release gates
- The six migrations remain `REVIEW_REQUIRED`.
- PostgreSQL clean-schema rehearsal and transactional/concurrency tests have not been run in this environment.
- Reconcile Testnet and Mainnet migration histories independently before any application.
- No live database DDL, migration history edits, GitHub push, or Vercel deployment was performed.
