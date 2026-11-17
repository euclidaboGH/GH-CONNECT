# Phase 1 — Social posting, voting, curation and community

**Release:** `0.315.5`  
**Baseline:** `0.315.4`  
**Status:** Source changes implemented; database and runtime release gates remain open.

## Work completed

1. Added `gh_community_post_list`, a bounded, keyset-paginated canonical community post read RPC.
2. Enforced active membership in the database function rather than trusting client membership state.
3. Reused canonical post visibility and block policy for every returned post.
4. Returned authoritative upvote/downvote aggregates and the authenticated viewer's current curation choice.
5. Added the authenticated `/api/communities/[id]/posts` endpoint with strict community ID and cursor validation.
6. Added `socialListCommunityPosts` to the shared social client.
7. Hydrated the community hub with canonical social posts and refreshed the data on community refresh events.
8. Reused `EnhancedPostCard` for canonical community posts so Feed, Profile and Community share one interaction implementation.
9. Routed community-card reactions and saves through the existing durable social APIs; comments and sharing open the canonical post workflow.
10. Removed misleading vote/reaction controls from local-only legacy community posts. These remain visible as archived/read-only until their authors republish them into the canonical social ledger.
11. Added the Phase 1 regression gate to `prebuild` and `verify:static`.
12. Registered the new SQL migration as `REVIEW_REQUIRED` and regenerated all migration inventories.

## Database migration

`supabase/migrations/20261106090001_gh_community_post_feed_canonical.sql`

Dependencies:
- `public.gh_community_platform_role(text,text)`
- `public.gh_post_viewer_can_read(text,text)`
- canonical `gh_posts`, `gh_post_curations`, and `gh_post_reactions` tables

The migration is read-only at runtime. It does not create posts, alter curation votes, issue GHC, change reward rules, or mutate wallet balances.

## Verification evidence

- `npm run verify:static` — PASS.
- `scripts/check-phase1-social-foundation.mjs` — 12/12 PASS.
- `scripts/check-curation-intelligence-refresh-recovery.mjs` — 10/10 PASS.
- `scripts/check-phase-post-curation-production.mjs` — 12/12 PASS.
- `scripts/check-community-global-standard.mjs` — 11/11 PASS.
- Migration inventory — 183 canonical SQL files, synchronized.

## Open release gates

- Run Node `24.15.0` or compatible Node 24.
- Complete `npm ci --legacy-peer-deps`, `npm run typecheck`, `npm run lint`, and `npm run build`.
- Validate both new/recovery migrations on disposable PostgreSQL.
- Reconcile Testnet and Mainnet migration histories independently before applying anything.
- Test member/non-member access, blocked pairs, hidden/deleted posts, keyset pagination, viewer vote state, vote changes, vote undo, curation roster and two-user concurrency on Testnet.
- Verify the community composer writes a canonical `gh_posts` row and the new community feed hydrates it after refresh and a fresh session.

**Release status remains NOT APPROVED until the open gates pass.**
