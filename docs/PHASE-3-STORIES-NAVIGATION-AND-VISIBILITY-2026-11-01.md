# GH-CONNECT v0.274.3 — Phase 3: Stories, navigation, and visibility integrity

**Status:** Source implementation complete; production release remains gated.

## Scope delivered

Phase 3 continues from the Phase 2 post/curation archive and preserves the prior changes. It focuses on story audience correctness, story-view authorization, story navigation, and the story-rail presentation.

### 1. Fixed a server/client audience mismatch

The story creator already offered `matches-only`, but the active-story RPC deliberately returned those stories only to their owners, and the reaction RPC also denied matches-only reactions. The client could filter match stories locally, but it could not receive the server-hidden rows. Phase 3 adds `supabase/migrations/20261101170001_gh_story_match_audience_support.sql`, which consistently defines a match as a reciprocal durable `like`/`superlike` in `public.ghc_match_signals` and applies that rule to story listing, viewing, and reactions.

The new migration also ensures a known story ID cannot bypass audience checks through the story-view RPC. Block relationships are denied before public-audience access is granted. Existing follower-only and mutual-follow friends policies are preserved. The migration revokes `PUBLIC` execution and grants the three story RPCs to `service_role` only.

**Migration status:** `REVIEW_REQUIRED`. It has not been applied. Validate the function signatures, schema, RPC grants, audience matrix, blocks, and reciprocal signal transitions on disposable PostgreSQL and two-account Testnet before applying it to any project.

### 2. Corrected client-side privacy filtering

- Followers-only stories now require an actual follow; a friend relation alone no longer expands the audience.
- Matches-only stories use the canonical matched user's `userId`/`matchedUserId`; the generic match-record `id` is no longer mistaken for a person ID.
- Matches is available as an explicit story audience choice.
- Own and other story cards open through the same handler, consistently recording local seen state and requesting the durable server view.
- Optional local story preferences validate that parsed storage values are arrays of strings before use.

### 3. Modernized the story rail and navigation behavior

- Replaced small square story tiles with taller 100 × 124 px portrait cards and updated content-visibility sizing.
- Added a muted ring treatment for viewed stories while preserving the gradient for unviewed stories.
- Story audience labels in the viewer are human-readable rather than raw enum values.
- Video stories advance when playback completes; existing swipe and keyboard navigation remain wired through the canonical navigation handler.
- Existing reaction success continues to require durable server confirmation; local-only publication is not presented as live.

### 4. Kept the migration source of truth in one document

The current canonical count is **176 individual migration files**. The one-document review bundle `supabase/GH-CONNECT-CANONICAL-MIGRATION-BUNDLE-0.274.3.sql`, the CSV source manifest, `VERIFIED_MANIFEST.txt`, and `docs/MIGRATION_CHECKLIST.md` were regenerated/synchronized.

| Classification | Count |
|---|---:|
| REQUIRED | 115 |
| REQUIRES_APPROVAL | 1 |
| PROPOSAL | 2 |
| REVIEW_REQUIRED | 58 |
| **Total canonical migrations** | **176** |

The repository has 189 `.sql` files in total: 176 canonical migrations, 12 operator/validation/install/reset assets, and the one consolidated review bundle. The legacy installer still represents only 132 migrations and is stale. Do not run the consolidated bundle as a script or bulk-apply the canonical migration directory. Reconcile the actual Testnet and Mainnet migration histories separately.

## Verification evidence

- `npm run verify:static`: **passed** after Phase 3 changes.
- `node scripts/check-phase3-story-experience-integrity.mjs`: **20/20 passed**.
- `node scripts/check-phase7-social-experience.mjs`: **24/24 passed**.
- `node scripts/check-phase-e-ecosystem-polish.mjs`: **10/10 passed**.
- `node scripts/check-phase-post-curation-production.mjs`: **12/12 passed**.
- `node scripts/check-clean-migrations.mjs`: **176 unique 14-digit migrations**.
- `node scripts/check-migration-source-manifest.mjs`: **176/176 synchronized**.
- `node scripts/check-migration-master-bundle.mjs`: **176/176 byte-for-byte synchronized**.
- `node scripts/generate-migration-inventory.mjs --check`: **passed**.
- `node scripts/check-release-hygiene.mjs`: **11/11 passed**.
- `node scripts/check-doc-hygiene.mjs`: **passed**.
- `node scripts/check-dependency-lock-integrity.mjs`: **passed**.

## Not claimed / release blockers

The available runtime is Node `22.16.0`; the project specifies Node `24.15.0`. Dependencies are not installed in this environment, so TypeScript, ESLint, and a production Next.js build have not been verified. No live PostgreSQL execution, Supabase migration application, or Pi Testnet test was performed. The source checks above do not establish that a migration is applied or that the UI works against deployed data. Production approval remains blocked until supported-runtime build and database/Testnet checks pass.
