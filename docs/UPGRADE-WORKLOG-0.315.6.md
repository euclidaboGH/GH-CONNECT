# Upgrade worklog — 0.315.6

**Date:** 2026-11-06  
**Baseline:** GH-CONNECT 0.315.5  
**Scope:** Phase 1 deep completion — curation policy/visibility, concurrency, audit integrity, community feed pagination and resilient board publishing.

## Implemented

- Added `20261106110001_phase1_curation_community_guard_reconciliation.sql`, held as `REVIEW_REQUIRED`.
- Aligned curation preflight with `gh_post_viewer_can_read`, including blocks, followers, mutuals and active community membership.
- Reconciled the historical self-curation guard/allowance conflict with one final policy: self-curation is denied consistently before the atomic write.
- Serialized the per-user daily curation quota before preflight so concurrent votes on separate posts cannot bypass the 120-action cap.
- Made curation activity audit persistence mandatory in the same transaction as the vote and GHPV state update; an audit failure rolls back the entire transaction.
- Preserved GHPV SET semantics, service-role-only RPC execution, reward policy and the separation between curation power, GHC and Pi.
- Made community post keyset ordering use the same millisecond/id keys in its filter and sort order.
- Changed community board refresh to preserve last-known-good canonical posts on transient failures and ignore stale in-flight results.
- Changed the community composer to await explicit publication success, prevent duplicate submissions and retain the draft on failure.
- Added 19 targeted Phase 1 deep-completion assertions and registered the gate in `prebuild` and `verify:static`.
- Synchronized package, lockfile, app release constant, project truth, build context, acceptance reports and migration inventory.

## Verification performed

- `npm run verify:static` — PASS (57/57 consolidated source contracts; all subsequent registered targeted checks completed).
- Phase 1 deep completion — 19/19.
- Phase 1 social foundation — 12/12.
- Curation intelligence refresh recovery — 10/10.
- Post/curation production contract — 12/12.
- Community global-standard contract — 11/11.
- Repository consistency — 6/6.
- Migration source manifest — PASS (184/184; classifications, verified manifest, checklist and Testnet guide synchronized).
- Clean migrations — PASS (184 unique 14-digit SQL migration identifiers).
- Migration release readiness — PASS (historical self-curation conflict is superseded by the final Phase 1 policy; no future-dated migration filenames).

## Environment limitations

The available runtime is Node.js 22.16.0; the project requires Node.js 24.15.0 / `^24.15.0`. This is source-only verification. No `node_modules` directory or PostgreSQL/Supabase CLI is available in this workspace. Therefore `npm ci --legacy-peer-deps`, TypeScript, ESLint, Next.js production build, disposable PostgreSQL execution, and live Supabase/Testnet checks were not run. Static checks are not runtime or production acceptance.

## Migration and operator gates

The following three Phase 1 migrations remain `REVIEW_REQUIRED` and unapplied:

- `20261106080001_gh_reputation_intelligence_refresh_recovery.sql`
- `20261106090001_gh_community_post_feed_canonical.sql`
- `20261106110001_phase1_curation_community_guard_reconciliation.sql`

Reconcile Testnet and Mainnet histories independently. Validate dependencies, function signatures, RLS/ACLs, transaction rollback, concurrency, query plans and cursor boundaries on disposable PostgreSQL. Then apply individually to Testnet only after approval and complete two-account tests for community membership, visibility, curation, vote changes/undo, reactions, saves, comments, sharing and cross-surface post hydration. No live database, wallet, GHC, Pi, payout or Mainnet operation was performed. **Production remains NOT APPROVED.**
