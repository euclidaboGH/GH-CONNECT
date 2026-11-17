# UPGRADE WORKLOG — 0.315.4

**Date:** 2026-11-06

## Curation intelligence refresh recovery

- Corrected `gh_reputation_intelligence_refresh` through an additive migration. The previous function attempted `RETURNING id` from a table whose primary key is `user_id` and has no `id` column.
- Changed reputation and curator-calibration reads to aggregate scalar reads so users without existing state/calibration rows receive explicit defaults instead of NULL values that violate the intelligence table's NOT NULL constraints.
- Preserved service-role-only execution, stored server-authoritative curation power, freshness checks, anti-abuse controls, atomic curation/reward/GHPV flow, and no-client-write policies.
- Added a source regression gate and registered it in `prebuild` and `verify:static`.
- Added migration `20261106080001_gh_reputation_intelligence_refresh_recovery.sql`, classified `REVIEW_REQUIRED` pending target-history reconciliation and disposable PostgreSQL/Testnet validation.
- Regenerated all migration inventories: 182 canonical migrations; 117 REQUIRED, 1 REQUIRES_APPROVAL, 2 PROPOSAL, 62 REVIEW_REQUIRED.

## Verification boundary

- Curation refresh regression: 10/10 PASS.
- Migration source manifest and generated apply guide: PASS (182/182).
- Phase 23 migration integrity: PASS (379 SECURITY DEFINER definitions checked).
- Phase 24 release review: PASS.
- Full `verify:static`: pending rerun after worklog synchronization.
- Node 22.16.0 is present, while Node 24.15.0 is required by the project (`^24.15.0`); TypeScript, ESLint and Next.js production build are not claimed.
- No Supabase database, migration history, Testnet account, Pi provider, wallet balance, or deployment environment was accessed or changed.

## Release posture

Source-level correction only. Do not apply the new migration until Testnet/Mainnet migration histories are reconciled independently and the function is validated on disposable PostgreSQL. Live voting/curation acceptance remains open until refresh, vote toggle, counts, viewer choice, curation roster, concurrency and two-account visibility are verified on Testnet.
