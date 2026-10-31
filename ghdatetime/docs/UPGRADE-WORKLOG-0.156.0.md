# GreenHaven v0.156.0 — Phase 1 platform foundation

## Implemented

- Added `scripts/check-phase1-platform-foundation.mjs` with ten source-level checks covering version/runtime consistency, runtime preflight, CI runtime and locked install, strict TypeScript, deployment security headers, placeholder-only environment configuration, API/migration inventory discovery, and static-suite registration.
- Registered the Phase 1 foundation check in `scripts/verify-phase14-static.mjs` and added the `check:phase1-platform-foundation` npm script.
- Added `docs/PHASE-01-PLATFORM-FOUNDATION.md` to document scope and explicit acceptance boundaries.
- Synchronized the release version to `0.156.0` in package metadata, lockfile root, app release metadata, manifest, and current-release regression assertions.

## Verification boundary

The new Phase 1 check and static source suite are intended to run without network or database access. They do not establish runtime, build, database, provider, or production acceptance. The project's required runtime is Node.js `^24.15.0`; if the available runtime is older, TypeScript, lint, and build must remain marked blocked until run under a supported runtime with locked dependencies installed.

No production database, balances, payments, orders, entitlements, migrations, or Pi network state was changed.
