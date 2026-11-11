# Upgrade worklog — 0.315.7

## Phase 2 — Stories premium rebuild

Detailed scope and release boundaries: `docs/PHASE-2-STORIES-PREMIUM-REBUILD-0.315.7.md`.

### Source changes
- Grouped active stories into one tray card per creator; each creator's stories are queued chronologically, and opening a creator starts at the first unseen story.
- Excluded archived, draft and expired stories from active trays.
- Scoped local seen/highlight preferences by authenticated profile identity. Server-confirmed view state is persisted locally only after the durable view API confirms success.
- Preserved server-projected `viewerHasViewed`, reaction counts and viewer reactions during story hydration and sanitization.
- Successful durable empty story responses now clear stale local story data. Non-durable responses do not erase cached content.
- Added pause/resume to image/text story playback, respects reduced-motion settings, and advances video stories on playback completion.
- Removed a duplicate story-composer close control.
- Rate-limited durable story-view writes.
- Added additive migration `20261106130001_gh_story_view_privacy_and_read_performance.sql`: direct story views now enforce audience and bidirectional block checks; private/matches-only remain owner-only; author views are not counted; the active-story list RPC is read-only and projects viewer seen state and reaction aggregates; added viewer/story lookup index. The app now calls a new versioned `gh_story_view_authorized_v2` RPC and revokes the legacy service-role view RPC so the API fails closed until the privacy migration is applied. A bounded REST reaction fallback remains only for databases still on the pre-projection schema.

### Verification actually run

All checks listed below are source-only verification and do not establish live database or production behavior.
- `check-phase2-stories-premium-upgrade.mjs`: 28/28 PASS.
- `check-stories-rail-v2.mjs`: 9/9 PASS.
- `check-social-story-profile-media-ux.mjs`: 13/13 PASS.
- `check-phase4-feed-composer-stories-shell-2026-11-04.mjs`: 12/12 PASS.
- `check-migration-source-manifest.mjs`: PASS (185/185 synchronized; 117 REQUIRED, 1 REQUIRES_APPROVAL, 2 PROPOSAL, 65 REVIEW_REQUIRED).
- `npm run verify:static`: PASS (57/57).
- `check-clean-migrations.mjs`: PASS (185 unique migrations; no duplicate version prefixes).
- `check-repository-consistency.mjs`: 6/6 PASS.
- `check-release-hygiene.mjs`: 11/11 PASS.

### Outstanding gates
- `npm run verify:static` exposed pre-existing release-documentation fixture drift and a missing 0.315.7 worklog reference during this work; release metadata has been synchronized and the suite must be rerun.
- Node 22.16.0 is available; project requires Node 24.15.0. No installed dependencies, TypeScript, ESLint, production build, browser E2E, disposable PostgreSQL or live Supabase/Testnet verification are claimed.
- New migration is REVIEW_REQUIRED. Reconcile Testnet/Mainnet remote histories independently and validate audience matrix, block matrix, idempotent views, query plan/index use, and service-role ACL on disposable PostgreSQL before approval.
- No migrations were applied and no wallet, GHC, Pi, payout or financial state was changed.
