# GreenHaven 0.330.2 — Cache-safe CI and release hygiene

Date: 2026-11-06  
Baseline: `GH-CONNECT-0.330.1-CI214-REVIEWED-REPAIR.zip`

## Problem

The supplied Phase 26 wallet-ledger resilience report showed 16/17 checks, with the cache-release contract failing. The original check required the root `tsconfig.tsbuildinfo` file not to exist. TypeScript incremental compilation can legitimately create build-info metadata before later CI steps, so file existence alone is not evidence that a cache is tracked or included in a source release.

## Changes

- Directed TypeScript incremental metadata to `.cache/tsconfig.tsbuildinfo`.
- Added `.cache/` to `.gitignore`; retained the broad `*.tsbuildinfo` ignore rule and existing framework/build output exclusions.
- Hardened the Phase 26 gate to recursively find TypeScript build-info artifacts, validate that generated files are ignored by Git and are not tracked, and reject the legacy root-level `tsconfig.tsbuildinfo` path.
- Kept the check fail-closed when a build-info artifact exists outside a Git-verifiable checkout.
- Synchronized package, lockfile, app release, README, current build context, project truth, release-readiness document and verified migration manifest to `0.330.2`.

## Preserved boundaries

No wallet ledger, balance, payment, Pi, GHC, payout, entitlement, migration, RLS, service-role, or production-approval authority was changed. Existing wallet timeout/cancellation and server-confirmed balance semantics remain intact. No migration was applied.

## Verification

The baseline archive integrity check passed. The Phase 26 checker passed 17/17 in the clean extracted source tree before repair; the reported CI failure is therefore treated as an environment/order-sensitive cache-policy defect, not as evidence that the wallet implementation failed. Post-repair checks were rerun against the updated source: Git-backed generated-cache and tracked-cache scenarios behaved correctly; Phase 24 release review passed; the complete consolidated static verification runner passed. The prebuild runtime guard correctly stopped this container because it provides Node.js 22.16.0 rather than the required Node.js 24.15.0, so dependency-backed typecheck, lint and production build remain unrun.

## Release status

Source/CI repair only. Production remains **NOT APPROVED** until Node 24.15.x typecheck, lint, production build, disposable PostgreSQL migration validation, Pi Testnet reconciliation, browser/device acceptance and operator gates pass.
