# GreenHaven upgrade worklog — 0.307.0

**Date:** 2026-11-04  
**Baseline:** 0.306.0 Phase 20  
**Scope:** private messaging, private media, account privacy, repository integrity

## Delivered

- Replaced process-local rate limits across ten private messaging, media and account privacy API boundaries with awaited database-backed limits.
- Standardized fail-closed 503 behavior when durable rate-limit enforcement is unavailable, while retaining 429 for exhausted quotas.
- Added a repository-integrity gate for those ten boundaries, pipeline registration, package/lockfile parity, migration-prefix uniqueness, and exact migration manifest filename/byte-count synchronization.
- Registered the new gate in `prebuild` and `verify:static`.
- Synchronized package and lockfile version to 0.307.0 and updated project-truth documentation.

## Preserved

No new migration, no schema change, no financial-ledger change, no GHC issuance change, no Pi payment change, no destructive account deletion, and no change to conversation membership or private-media authorization.

## Verification

The Phase 21 source-only gate, documentation hygiene, migration-manifest verification and consolidated static suite are required. The available runtime is Node 22.16.0 while the project requires Node 24.15.0; dependencies are not installed. Therefore supported-runtime TypeScript, lint and production build remain unverified. Live Supabase RPC, provider, browser/device, Testnet and deployment acceptance remain outstanding.
