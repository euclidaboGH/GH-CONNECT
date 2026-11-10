# GreenHaven 0.330.2 upgrade worklog — cache-safe CI

Date: 2026-11-06
Baseline: `GH-CONNECT-0.330.1-CI214-REVIEWED-REPAIR.zip`

## Scope

This source-level upgrade resolves the Phase 26 CI failure where the incremental TypeScript build cache check treated a generated root `tsconfig.tsbuildinfo` file as a release artifact even when the file was ignored. The release preserves all existing user-facing functionality and server-side financial authority.

## Implementation

- TypeScript incremental metadata is now written to `.cache/tsconfig.tsbuildinfo`.
- `.cache/` is ignored, while `*.tsbuildinfo` remains a broad exclusion for caches in other locations.
- Phase 26 recursively checks build-info artifacts. In Git workspaces, each cache must be ignored and absent from the tracked index. The root-level legacy cache path is rejected.
- The checker fails closed if it finds a cache in a workspace where Git cannot verify ignore/tracked status.
- Package, lockfile, application release metadata, roadmap, README, project truth, acceptance report, release readiness and migration inventory are synchronized to `0.330.2`.

## Verification performed

- Phase 26 wallet-ledger resilience: 17/17.
- Generated ignored cache scenario: PASS.
- Deliberately tracked cache scenario: correctly rejected.
- Phase 24 final release review: PASS.
- Project truth: 10/10.
- Dependency lock integrity: PASS.
- Phase 9 membership release gate: 16/16 after synchronizing the active Phase 10 roadmap marker.
- Phase 9 membership session safety: 15/15 after retaining the required session-integrity phrase in release metadata.
- Consolidated static verification: PASS (the complete `npm run verify:static` runner exited 0 after release-document synchronization).
- `npm run prebuild` reached the explicit runtime guard and stopped because this execution container provides Node.js 22.16.0, while the repository requires Node.js `^24.15.0`; dependency-backed typecheck, lint and production build were not run.

## Boundaries and outstanding acceptance

No database migration was added or applied. No Pi payment, GHC issuance/transfer, wallet balance, payout, settlement, membership entitlement or production authority was changed. Source-level verification is not a production build or live acceptance. Node.js 24.15.0 dependency-backed typecheck, ESLint, Next.js production build, disposable PostgreSQL validation, Pi Testnet reconciliation, Android/Pi Browser device acceptance and operator review remain required. Production remains NOT APPROVED.
