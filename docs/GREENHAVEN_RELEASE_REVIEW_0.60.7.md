# GreenHaven integrity upgrade — release 0.60.7

## Changes

- Added `202610180004_curation_self_vote_guard.sql`: the authoritative database curation RPC rejects author self-upvotes/self-downvotes, retains SET/toggle behavior, and keeps service-role-only execution.
- Updated the curation API to return HTTP 403 for `SELF_CURATION_FORBIDDEN`.
- Expanded the reputation/curation policy: verified idempotent activities advance account reputation; raw votes do not; settled calibration affects curation influence; wallet balance is not curation power; financial ledger history remains immutable.
- Bumped package and app release metadata to `0.60.7`.

## Policy boundary

No raw vote directly increases/decreases account reputation. This is intentional anti-gaming behavior. Curation accuracy affects calibration and influence through the existing settled judgment engine. A future reputation bridge requires sufficient confidence, a minimum distinct-reviewer threshold, author/self exclusion, idempotency, bounded effects, and a correction/appeal mechanism.

Percentage changes affect the active curation weight but do not rewrite already-credited GHC. No new financial formula or retroactive clawback was introduced.

## Validation and rollout

Run `node scripts/test-reputation-curation-integrity.mjs`, `node scripts/test-ghc-curation-reward.mjs`, `node scripts/test-like-curation-separation.mjs`, `node scripts/test-ghpv-economic-safety.mjs`, `node scripts/scan-production-safety.mjs`, and `node scripts/check-jsx-safety.mjs`.

This is source/static validation only. Apply migrations to testnet only after checking migration prerequisites. Run multi-account SQL/integration tests before considering mainnet. No migration, push, or deployment is performed by this package generation.
