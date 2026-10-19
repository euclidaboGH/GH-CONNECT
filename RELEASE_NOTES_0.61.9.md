# GH-CONNECT v0.61.9 — Phase 19 release notes

- Hardened the shared GHC transfer RPC with canonical two-party balance locking, four-decimal precision enforcement, and idempotency conflict/incomplete-pair detection.
- Added atomic GHC creator-tip settlement using the existing dual-entry ledger. The `GHC_TIPS_ENABLED` feature flag remains `false` until Testnet concurrency verification passes.
- Added a funded creator reward pool with explicit database operator allowlisting, GHC ledger-based funding/distribution, idempotency records, and privileged no-store API routes.
- Hardened Pi A2U completion checks. A2U creation now fails closed rather than creating a provider-side payment that the application cannot submit to the blockchain and durably reconcile.
- Tightened media-ID resolution to owner-only and stable application facade URLs; no raw public Storage URLs are returned by that RPC.
- Added read-only migration-history/media-cutover preflight SQL, post-migration ACL/RLS assertions, Testnet concurrency test plan, and static media/financial regression checks.
- Updated package/app release version and regenerated the 102-file migration inventory.

## Verification status

- 123/123 repository `scripts/test-*.mjs` regression scripts passed in the local source workspace after the final edits.
- Phase 19 focused source checks, private-media source audit, release safety scan, JSX safety, migration inventory check, and 42 production-verification source suites passed.
- Full `npm ci`, TypeScript typecheck, ESLint, and Next production build are not verified: the environment's npm install did not complete and the available Node version is below the repository's declared minimum.
- No live Supabase migration was applied, no Storage bucket was changed, no Pi Testnet payment was initiated/completed, and no external payout rail was verified.
