# Upgrade worklog — 0.315.5

**Date:** 2026-11-06  
**Baseline:** GH-CONNECT 0.315.4  
**Scope:** Phase 1 social posting, voting, curation and community-post consistency.

## Implemented

- Added a read-only, service-role-only community post feed RPC with active-member authorization, canonical visibility checks, viewer-specific curation/reaction/save state, vote aggregates and keyset pagination.
- Added the authenticated community posts API route and shared client helper.
- Connected the community hub to canonical server-hydrated community posts.
- Reused `EnhancedPostCard` in the community surface, aligning canonical community cards with Feed/Profile interactions.
- Wired community-card reactions and saves to existing durable APIs; comments and sharing route to the canonical post workflow.
- Removed misleading vote/reaction controls from local-only legacy rows; these are now explicitly read-only until republished by their authors.
- Added a Phase 1 regression script and registered it in `prebuild` and `verify:static`.
- Added one additive migration, classified `REVIEW_REQUIRED`, and synchronized the migration inventory.
- Preserved curation's server-authoritative weighting, atomic vote/reward/GHPV boundary, service-role permissions, and separation from wallet/GHC balances.

## Source-level verification

- `npm run verify:static` — passed before the release metadata bump; after the bump, rerun is required.
- `node scripts/check-phase1-social-foundation.mjs` — 12/12 passed.
- `node scripts/check-curation-intelligence-refresh-recovery.mjs` — 10/10 passed.
- `node scripts/check-phase-post-curation-production.mjs` — 12/12 passed.
- `node scripts/check-community-global-standard.mjs` — 11/11 passed.
- `node scripts/check-project-truth.mjs` — 10/10 passed.
- `node scripts/check-release-hygiene.mjs` — 11/11 passed.
- Migration inventory: 183 files, synchronized; 63 `REVIEW_REQUIRED`.

## Environment limitation

This environment runs Node.js 22.16.0. The project requires Node.js 24.15.0 or compatible Node 24. A locked dependency install could not complete in the available execution window; therefore TypeScript, ESLint, and production build were not run. This is source-level verification, not full application acceptance.

## Database and operational gates

The new migration `20261106090001_gh_community_post_feed_canonical.sql` depends on `gh_community_platform_role` and `gh_post_viewer_can_read`. It is `REVIEW_REQUIRED` and has not been applied. The earlier curation intelligence recovery migration remains `REVIEW_REQUIRED` as well. Reconcile Testnet and Mainnet migration histories independently, validate both migrations on disposable PostgreSQL, then test active-member/non-member access, blocked users, deleted posts, pagination boundaries, curation state, vote changes, and two-user concurrency on Testnet.

No live Supabase, Pi, Vercel, wallet, reward, marketplace or Mainnet operation was performed. **Production remains NOT APPROVED.**
