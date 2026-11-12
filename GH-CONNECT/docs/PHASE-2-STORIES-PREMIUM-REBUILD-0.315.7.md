# Phase 2 — Stories premium rebuild

**Release:** `0.315.7`  
**Baseline:** `0.315.6`  
**Scope:** Stories rail, creator sequence, composer/viewer behavior, durable engagement hydration, privacy and read-path performance.

## Product and experience upgrades

1. **Creator-first story rail:** one card per creator instead of one card per individual story.
2. **Chronological sequences:** stories within a creator's group play oldest-to-newest; groups are ordered by their newest active story.
3. **First-unseen entry:** opening a creator starts at their first unseen story, or the first story when all are seen.
4. **Sequence awareness:** creator tiles show the number of available stories without creating duplicate tiles.
5. **Clean active states:** archived, draft and expired records are excluded from the active tray.
6. **Playback controls:** image/text stories support pause and resume; automatic progression respects reduced-motion preferences.
7. **Video progression:** video stories advance when playback ends, while native controls remain available.
8. **Identity-isolated preferences:** local seen/highlight preferences are scoped by profile identity, not shared across accounts on the same browser.
9. **Durable seen-state hydration:** viewer state returned by the database is retained through the story type, sanitizer and GHC context; local seen state is written only after a durable view confirmation.
10. **Engagement hydration:** server reaction counts and the current viewer's reactions survive story hydration. The new SQL read projection aggregates counts for the bounded active-story set; a bounded compatibility fallback remains for databases that have not yet received the migration.
11. **Composer cleanup:** removed a duplicate close action. Existing camera, photo, video, text, mood-background, caption and audience flows remain integrated with durable media upload and server-owned publication.
12. **Clear audience language:** the Everyone option now explains that blocked accounts remain excluded. Private/matches-only stories remain owner-only until a canonical matches policy is available.

## Security and database changes

Migration: `20261106130001_gh_story_view_privacy_and_read_performance.sql`.

- Replaces the active-story list RPC with a side-effect-free read. Expired stories are filtered by `expires_at`; a story-list GET no longer updates the stories table as a side effect.
- Returns `viewerHasViewed`, `reactionCounts`, `viewerReactions` and `reactionCount` from the canonical SQL read.
- Adds a viewer/story index for seen-state lookups.
- Adds the versioned `gh_story_view_authorized_v2` RPC. It validates the story's active lifecycle, audience, follower/mutual-friend relationship and bidirectional block state before recording a view.
- Private and matches-only audiences fail closed for non-owners. Author self-views are not counted.
- View recording is idempotent through the existing `(story_id, viewer_id)` primary key.
- Revokes the legacy service-role `gh_story_view` execution grant. The API calls the new versioned RPC and therefore fails closed with an unavailable response until the migration is deployed.
- The migration uses `SECURITY DEFINER`, a fixed `search_path`, and service-role-only execution.

**Dependencies to validate:** `gh_stories`, `gh_story_views`, `gh_story_reactions`, `gh_follows`, and `ghc_user_blocks`.

## Verification evidence

- Phase 2 Stories source contract: **28/28 PASS**.
- Consolidated network/database-independent static suite: **57/57 PASS**.
- Stories rail regression: **9/9 PASS**.
- Story/profile media UX regression: **13/13 PASS**.
- Feed/composer/stories shell regression: **12/12 PASS**.
- Phase 3 public profile identity regression: **16/16 PASS**.
- Migration inventory: **185 canonical migrations**, **0 duplicate numeric prefixes**; 117 REQUIRED candidates, 1 REQUIRES_APPROVAL, 2 PROPOSAL, 65 REVIEW_REQUIRED.
- TypeScript transpile/syntax checks passed for the modified TS/TSX files.

## Limits and release gates

- The new migration is **REVIEW_REQUIRED**. The generated inventory is source-only and does not establish remote applied state.
- Reconcile Testnet and Mainnet migration histories independently. Validate the full audience matrix, both block directions, author self-view exclusion, idempotent duplicate views, viewer-state and reaction aggregates, query plans/index use, and service-role ACLs on disposable PostgreSQL before Testnet application.
- Node `22.16.0` was available; the project requires Node `24.15.0`. `npm ci --legacy-peer-deps` did not complete within the environment window. Dependencies are not installed.
- TypeScript project typecheck, ESLint, Next.js production build, browser/device E2E and live Supabase/Testnet checks remain unverified. A global `tsc` attempt without project dependencies is not a valid project typecheck.
- No migration was applied. No Pi, GHC, wallet, payout, or financial state was changed.
- Story highlights remain device-local and are explicitly described as such; they are not represented as a cross-device durable archive.

**Phase 2 source implementation is delivered; production acceptance remains open pending the gates above. Phase 3 Marketplace work remains on hold until those gates are reviewed.**
