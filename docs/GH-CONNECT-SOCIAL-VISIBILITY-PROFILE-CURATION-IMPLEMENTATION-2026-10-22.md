# GH-CONNECT — Social Visibility, Profile Timeline and Curation Clarity Implementation

**Source baseline:** GH-CONNECT 0.69.3 archive supplied in this conversation  
**Status:** Source changes implemented; database rollout and full production build remain blocked/unverified.

## Implemented in source

### 1. Canonical server-side visibility RPCs

Added `supabase/migrations/202610220001_gh_social_canonical_visibility.sql` with:

- `gh_post_viewer_can_read(viewer, post)` as the canonical SQL policy for active posts.
- `gh_post_list_feed_v3` using stable `(createdAt, id)` keyset pagination and applying authorization before returning post bodies.
- `gh_comment_list_v3` applying the same visibility policy inside the comment-list RPC, in addition to the existing API-level authorization check.
- Explicit blocks in both directions, public/follower/mutual-follow/private rules, active membership for community-bound posts, and denial for deleted/archived posts.
- Service-role-only execution for the helper and new list RPCs.
- Supporting indexes for feed/comment cursors, follows, blocks and community membership.

The feed route now tries V3 first, then the existing stable V2 RPC, then the legacy RPC for staged rollout. The comment route follows the same fallback pattern and retains the route-level fail-closed post visibility check. The server's canonical visibility filter remains as a second check before feed data reaches the client.

### 2. Profile timeline is no longer derived only from the loaded home feed

`components/ghc/profile-screen.tsx` now fetches the owner timeline from `/api/social/profile/:userId/posts`, maintains a stable cursor, supports loading older posts, and exposes retry/error/loading states. It uses the home-feed subset only while the independent request is loading or if the independent timeline is unavailable; in the latter case the UI explicitly warns that displayed posts may be only a subset.

The profile content-library migration was tightened so community-bound posts require active membership (or are being viewed by their author). Its mutuals policy now consistently means reciprocal follows, matching the feed policy, instead of treating accepted connection requests as an alternate mutuals definition.

### 3. Curation vote versus GHC credit is explicit

The post-card curation result now differentiates:

- **Actual credit:** “Vote saved and X GHC credited” only when the server response says a positive credit was durably issued.
- **No credit:** “Vote saved. No GHC was credited for this vote.”
- **Reward issuance disabled:** a specific message when the server reason identifies disabled/daily-claim-only curation rewards.

A saved curation vote is not presented as a wallet credit. This preserves the current Daily-Claim-only issuance policy and does not create a new reward source.

### 4. Cursor input validation

Feed and comment routes now reject malformed/non-numeric limits, incomplete cursors, invalid timestamps, control characters, and cursors with only one of the `(before, beforeId)` pair. This prevents invalid values from silently falling back to first-page requests or confusing the cursor RPC.

### 5. Release inventory and regression coverage

- Added `scripts/test-social-canonical-visibility-v3.mjs` (18 static contract assertions).
- Registered the test in `package.json` and `ci:verify`.
- Updated the migration inventory, manifest and Testnet gate counts. The manifest remains marked blocked/diagnostic because two pre-existing migration version prefixes are duplicated.

## Verification performed

The following source-level checks passed in the extracted project:

- Social canonical visibility V3 contract: 22/22.
- Social visibility regression suite: 14/14.
- Comment server-first contract: all checks passed.
- Comment reaction counts: 5/5.
- GHC curation reward engine: 24/24.
- Atomic curation pipeline: 7/7.
- Like/curation separation: 12/12.
- Daily Claim 48-hour lock: 14/14.
- Private social/media contracts: 17/17.
- Phase 7 product experience: 26/26.
- Phase 8 architecture quality: 23/23.
- Phase 9 operations/resilience: 19/19.
- Phase 10 Testnet beta gates: 18/18.
- Project truth: 14/14.
- Project integrity: 36 checks, 0 errors, 0 warnings.
- TypeScript transpile/syntax check passed for the four modified TS/TSX route/UI files.

## Remaining blockers and limitations

1. **Do not apply the new migration yet.** Existing duplicate Supabase migration version prefixes `202610210001` and `202610210002` still block reliable migration inventory reconciliation. The new migration is additive but is not proven applied to Testnet or Mainnet.
2. The full TypeScript project check, ESLint, Next.js production build, and database-level SQL validation were not run. Dependencies are not installed in this working directory, Node is 22.16.0 while the project pins Node 24.15.0, and no local PostgreSQL client/server is available.
3. The route-level legacy fallback remains for staged compatibility. Until the V3 migration is applied and verified, existing V2/legacy SQL RPCs do not independently enforce the same full canonical visibility policy; route-level `canViewSocialPost` and `filterVisibleSocialPosts` remain critical protections.
4. Live two-account Testnet checks are still required for public/followers/mutuals/private posts, block in both directions, community membership changes, deletion/archive, comment cursor boundaries, and profile pagination under concurrent new posts.
5. No production data was deleted, rewritten, or migrated. No financial/reward issuance policy was loosened.

## Safe next rollout sequence

1. Compare Testnet and Mainnet `supabase_migrations.schema_migrations` with the repository; resolve duplicate version IDs with evidence, not blind renames.
2. Apply the approved migrations to a disposable PostgreSQL instance and verify the new SQL functions and indexes.
3. Apply only the reviewed visibility migration to Testnet; verify grants, function definitions, and query plans.
4. Run two-account visibility tests, including blocked and non-member community viewers; verify that unauthorized post bodies/comments never reach the browser.
5. Confirm profile timeline pagination returns no duplicate/skip across identical timestamps and concurrent insertions.
6. Run the project under Node 24.15.0 with a clean dependency install, then typecheck, lint, production build and the full CI verification suite.
7. Keep Mainnet rollout gated on recorded Testnet evidence and independent approval.
