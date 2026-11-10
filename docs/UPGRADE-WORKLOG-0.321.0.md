# Upgrade Worklog — 0.321.0

## Product milestones

- Phase 7 Wallet source implementation is closed. External release acceptance remains open for Node 24.15.x typecheck/lint/build, browser/device testing, live Pi Testnet reconciliation and independent operator approval.
- Phase 8 Rewards is now active. This release is its first integrity and experience increment.

## Engineering changes

- Bumped package, lockfile and app release metadata to 0.321.0.
- Hardened Rewards Centre economy snapshot hydration with cancellation, an eight-second timeout, authenticated no-store reads, account-change clearing, strict amount parsing and response identity checks.
- Added explicit server snapshot freshness/unavailable messaging.
- Rewards Journey balance now displays only a ready, server-origin wallet snapshot; it no longer converts null or local-session fallback data into a visible zero.
- Hardened daily claim response amount parsing; missing/invalid server amounts are not replaced with client-side estimates.
- Removed a false claimed flash on failed daily claims.
- Added `scripts/check-phase8-rewards-entry.mjs` to `prebuild` and `verify:static`.
- Updated the approved product roadmap and source-truth documentation.

## Verification performed

- Phase 8 Rewards entry contract: 18/18 passed.
- Phase 7 Wallet source entry contract: 14/14 passed.
- Consolidated `npm run verify:static`: 57/57 passed; the remaining registered source contracts in the suite also completed successfully.
- Repository consistency: 6/6 passed.
- Project truth: 10/10 passed.
- Documentation hygiene: passed.
- Migration inventory: 186 files synchronized (117 REQUIRED, 66 REVIEW_REQUIRED, 1 REQUIRES_APPROVAL, 2 PROPOSAL).

## Verification limits

- The available runtime is Node 22.16.0; the project requires Node 24.15.0 or compatible Node 24. Therefore the supported-runtime TypeScript, ESLint and Next.js production build cannot be certified in this environment. A direct global `tsc` attempt was not a valid project typecheck because `node_modules` and React/Next type declarations are absent; it reported dependency/JSX-type failures across the repository.
- `node_modules` is not present, so dependency-backed build/lint/typecheck were not run.
- No live Supabase, Pi Testnet, Mainnet, Vercel or financial execution was performed.
- No migration was added, modified or applied.
- No reward issuance, claim endpoint, ledger, maturity, Pi cashback, wallet or settlement authority was changed.

## Release posture

Source-level Phase 8 checks can pass independently; this is not production approval. Mainnet financial execution remains gated.
