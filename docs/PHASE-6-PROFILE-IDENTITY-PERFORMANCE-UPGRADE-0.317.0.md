# Phase 6 — Profile and Identity Performance Upgrade

**Release:** 0.317.0  
**Status:** Source implementation complete; supported-runtime and production acceptance pending.

## Changes

- Added a per-ProfileDomain relationship-index cache derived exclusively from canonical social-graph arrays.
- Rebuilds the prepared indexes when immutable source-array references change; unchanged arrays reuse the same prepared sets.
- Added `getRelationshipStates()` for deduplicated batch hydration using one relationship-index snapshot per batch.
- Wired Discovery people lists to batch-hydrate relationship state once and pass precomputed entries through profile cards into relationship controls.
- Normalizes IDs and ignores empty, malformed and duplicate identifiers in batch results.
- Preserves the block-first relationship decision before deriving follow, connection, match or message actions.
- Keeps the cache scoped to a ProfileDomain instance, avoiding cross-instance/account cache reuse.
- Keeps financial data outside the relationship index and public profile relationship view.

## Boundaries

No database migration, identity authority, authentication/session contract, wallet, GHC balance, Pi payment, ledger, payout, checkout or settlement behavior is changed. This is a derived in-memory performance index, not a second profile or social-graph store.

## Verification

- Dedicated runtime assertions cover index construction, deduplication, cache reuse and immutable-array invalidation.
- Dedicated source checks cover batch snapshot reuse, all canonical relationship arrays, block-first ordering, release metadata and financial-data exclusion.
- Node 24.15.x typecheck, lint, production build, browser/device checks and live provider/database acceptance remain required before production approval.
