# Phase 10 — Release Engineering & Independent Final Acceptance

**Date:** 2026-11-09  
**Source baseline:** `gh-connect@0.338.13`  
**Status:** Source-level release controls implemented; external acceptance remains open.  
**Production:** **NOT APPROVED**

## Objective

Make release acceptance reproducible and consistent across local verification, prebuild and GitHub Actions. Keep source verification, supported-runtime build evidence, live service evidence and operator approval as separate decisions.

## Implemented in this increment

1. Added `scripts/check-phase10-release-closure.mjs`. It verifies package/lock/app version agreement, the Node 24.15.0 pin, CI's dependency-lock check ordering, complete static suite registration, explicit typecheck/lint/build gates, release-truth checks, migration review gate wiring, and the absence of automatic database push from CI.
2. Registered the release-closure contract, release-hygiene check and project-truth check at the start of both `prebuild` and `verify:static`.
3. Updated GitHub Actions to run the complete `npm run verify:static` suite after the lockfile-safe install and before typecheck/lint. The production build remains a separate job dependent on the static job.
4. Preserved the exact Node 24.15.0 CI pin, package engine constraint, dependency-lock integrity check before `npm ci`, read-only CI permissions and explicit production NOT APPROVED boundary.
5. Kept migration classification/review checks in the release chain. CI does not run `supabase db push`, and this phase does not apply migrations or mutate live services.

## Verification performed against the uploaded Phase 9 archive

| Check | Result |
|---|---:|
| Complete `npm run verify:static` before Phase 10 edits | PASS (exit 0; all registered source/runtime-contract checks completed) |
| Release hygiene | 11/11 |
| Project truth consistency | 10/10 |
| Dependency lock integrity | PASS |
| Migration structure inventory | 199 SQL files inventoried; no SQL executed |
| Security headers regression | 7/7 |
| Global accessibility source gate | 12/12 |
| Phase 10 platform acceptance source gate | 24/24 |
| ZIP integrity/path/secret-file scan | PASS; no duplicate names, unsafe paths, symlinks or local secret env files |

After the Phase 10 edits, the new release-closure contract passed 16/16, release hygiene passed 11/11, project truth passed 10/10, documentation hygiene passed, and the complete `npm run verify:static` suite completed with exit code 0. The environment has Node.js 22.16.0, whereas the project requires Node.js 24.15.0; dependencies are not installed. Therefore the supported-runtime `npm ci`, TypeScript, ESLint and Next.js production build cannot be claimed from this environment.

## Independent acceptance still required

- Run the workflow on GitHub Actions with Node 24.15.0; retain actual `npm ci`, typecheck, lint and production build logs.
- Run browser/device acceptance on desktop, Android low-memory devices and Pi Browser, including keyboard and screen-reader flows, offline/reconnect and network-throttling scenarios.
- Reconcile the 199 migration files against the actual Testnet and Mainnet migration histories; review each `REVIEW_REQUIRED`, `REQUIRES_APPROVAL` and `PROPOSAL` item. The structural inventory is not a migration approval.
- Execute approved migration rehearsals and PostgreSQL concurrency/failure-injection tests on disposable databases before any Testnet application.
- Verify Pi Testnet payment/recovery and financial reconciliation with authenticated operator evidence. No Mainnet or production financial execution is authorized by this report.
- Obtain explicit release-owner approval after the above evidence is reviewed.

## Release decision

**Phase 10 source and CI release contracts are implemented and the complete static suite passes. Phase 10 is not verified complete until supported-runtime CI/build and external acceptance evidence are reviewed. Production remains NOT APPROVED.** Static checks cannot establish deployed configuration, provider behavior, live database integrity, actual browser/device usability or financial settlement correctness.
