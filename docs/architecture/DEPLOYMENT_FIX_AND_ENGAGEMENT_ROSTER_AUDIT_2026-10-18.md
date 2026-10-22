# GH-CONNECT deployment repair and engagement-roster audit — 2026-10-18

## Immediate Vercel build blocker

`components/ghc/enhanced-post-card.tsx` had an `EngagementRosterSheet` JSX element placed after the closing JSX tree of `VisibilityReasonTooltip`. The roster element referenced state owned by `EnhancedPostCardInner`, so it was both syntactically misplaced and in the wrong component scope. The element is now rendered inside `EnhancedPostCardInner`'s post-card tree, where `rosterOpen`, `rosterKind`, and `post.id` are in scope.

## Security hardening

The reaction-roster RPC previously accepted an authenticated actor ID but did not enforce the target post's visibility or block relationships before returning reactor identities. The RPC now:

- rejects an empty actor identity;
- verifies that the post exists and is not soft-deleted;
- denies requests when either party has blocked the other;
- permits public posts and the post owner;
- permits follower-only posts only when the actor follows the author;
- denies all other visibility levels, matching the current feed visibility policy;
- remains executable only by `service_role`.

The existing migration was corrected for fresh database setup, and the additive forward migration `20261022010103_gh_post_reaction_roster_visibility_guard.sql` carries the fix to databases where the original roster migration has already been applied. Apply it to Testnet first after reviewing the SQL; verify the RPC and route behavior before applying it to Mainnet.

## Regression and inventory improvements

- Added `scripts/test-engagement-roster-security.mjs` and `npm run test:engagement-rosters`.
- Added that regression check to `ci:verify`.
- Updated the social-experience static test to validate the app's current shared copy rather than obsolete literal strings.
- Reconciled `VERIFIED_MANIFEST.txt` and `docs/MIGRATION_CHECKLIST.md` with the 77 SQL migration files currently on disk. Inventory is not proof that any migration has been applied.

## Checks completed in this packaging environment

- JSX/TSX parser scan: 640 files, zero syntax diagnostics.
- JSX safety scan: passed.
- Production safety scan: 21/21 passed.
- Social-experience static checks: 30/30 passed.
- Social authorization static checks: 37/37 passed.
- IDOR static checks: 132 passed across 120 routes.
- Engagement-roster security regression checks: 10/10 passed.
- Production verification pack: 30 automated suites passed; operator gates remain required.

## Checks not completed here

A complete `npm ci`, TypeScript typecheck, ESLint run, and Next.js production build could not be run in this environment because npm registry downloads failed with DNS `EAI_AGAIN`. Therefore, this package should **not** be described as a locally verified production build yet. Vercel must run the full install and build after the changes are committed. If the build advances past the original syntax failure, address any newly exposed TypeScript/build errors before promoting the deployment.

The build log's `npm audit` count (14 vulnerabilities) also needs a fresh `npm audit` report in a network-enabled environment. Do not run `npm audit fix --force` blindly; review the dependency tree and upgrade compatible packages in a separate tested change.


## Stories creator upgrade — 2026-10-18

- Replaced the inline, minimal moment composer with a full-screen mobile-first story creator: live rear-camera photo capture where supported, gallery photo/video selection, text-only stories with preset backgrounds, captions, audience controls, upload state, and clear publishing feedback.
- Added a dedicated global creator entry point so the feed and create hub no longer open the legacy story form.
- Upgraded story viewing with immersive media/text layouts, progress, swipe/keyboard navigation, private replies/reactions, and the existing owner-only viewer roster.
- Corrected own-story detection for both the local `current-user` placeholder and the authenticated profile ID.
- Added `background` to the story model and sanitizer, allowlisted presets at the API boundary, and added `20261022010104_gh_story_creator_upgrade.sql` for durable theme storage and server-side story audience filtering.
- Audience rules in the migration: `everyone` is public; `followers` requires a follow edge from viewer to owner; `friends` requires reciprocal follow edges; `private` is owner-only. `matches-only` is intentionally owner-only until a canonical server-side match relation is available.
- Story reactions are sent as private messages rather than displayed as a local-only fake reaction. Viewer names load from the owner-gated server endpoint.
- Upload ceiling remains bounded by the existing `/api/media` proxy (4 MB per uploaded blob). Images are optimized before upload; videos above 4 MB are rejected with a clear message. A resumable/direct-to-storage video pipeline is a separate infrastructure upgrade.
- Static regression checks pass. Full Next.js build/typecheck/lint and live two-account Testnet verification still need to run after dependencies are installed and the migration is applied to Testnet.
