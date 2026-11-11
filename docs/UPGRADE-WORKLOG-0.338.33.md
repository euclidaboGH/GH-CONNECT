# GreenHaven Run #272 worklog — 0.338.33

## Baseline and release

- Baseline: `GREENHAVEN-0.338.32-RUN271-POST-COMPOSER-STORIES-30-POINT-UPGRADE`.
- New release: `0.338.33`, Run #272.
- Focus: Feed, Profile, shared post cards, comments/replies, account-safe UI state, Testnet RPC hardening and Vercel build memory.

## Implemented

- Account-scoped feed filters, lane/bias/focus preferences, hidden posts, muted topics and not-interested state; canonical identity subscriptions and hydration fences prevent stale cross-account writes.
- Saved-post and draft state resets/rehydration, late-response identity checks and duplicate-save locks.
- Reduced-data-aware media prefetch and online/visible-only periodic feed refresh.
- Profile timeline owner fencing, sign-out clearing, abortable requests, pagination locking/deduplication and safe error messages. The shared GHC context aborts old-owner feed work and clears feed/like snapshots on identity changes.
- Profile photo/cover upload and removal now require/await the durable profile update seam before reporting success.
- Blocked comment authors and descendant replies are removed before tree construction; malformed cycles and timestamps are deterministic.
- Added `scripts/check-run272-feed-profile-integrity.mjs`, `scripts/test-run272-comment-thread-utils.mjs` and `scripts/test-run272-vercel-build-prep.mjs`.
- Added `scripts/prepare-vercel-build.mjs`, a pre-build Vercel cache cleanup, and production Webpack cache disablement.
- Added exact-version npm script approvals for `sodium-native@3.4.1` and `unrs-resolver@1.12.2`.
- Applied Testnet migration `20261110193134_social_feed_profile_rpc_search_path_hardening`; mirrored the exact generated version in the canonical migration source tree and regenerated the migration inventory.

## Supabase

- Project: active Testnet `tpckwgdsjlkzscjlxiwe` only.
- Applied migration: `20261110193134`.
- Postflight confirmed both affected RPCs use `search_path=pg_catalog, public, pg_temp` and preserve service-role-only execution.
- No data/index/financial mutations. Mainnet untouched.
- Remote history: 19 generated records; source inventory: 216 SQL files. Reconciliation remains required; no bulk push/repair/replay.

## Vercel

- Latest inspected build `dpl_3iemE4b7Zd83RSqAe4roUuJ1gkLY` / commit `9a1e970a0e307430f24f6358c3b2229295ccb870` is pre-Run #272 and failed from an OOM/SIGKILL during Next.js production compilation.
- Restored Webpack cache packs were multi-gigabyte; Run #272 removes stale Webpack cache and disables persistent production Webpack caching.
- No Vercel settings, env vars, aliases, protection or build-machine billing tier changed.
- A new Vercel build cannot be verified until Run #272 is pushed/deployed.

## Verification constraints

- `npm run verify:static`: PASS, 57/57 after updating prior feed/profile regression assertions for the new account-scoped contracts.
- Prebuild manifest dry-run: 300 checks discovered; not executed because this environment is Node 22.16.0 and the project requires Node 24.15.0.
- Run #272 focused contracts: 48/48 static, 8/8 comment-tree runtime, 4/4 cache-cleanup runtime.
- Changed TypeScript/TSX modules: syntax transpilation 5/5; duplicate/initialization semantic diagnostics 0.

- Runtime in this container: Node 22.16.0; required: Node 24.15.0.
- `node_modules` absent; npm registry unavailable. No full typecheck/lint/Next build claim.
- Source-level syntax checks and focused contracts are recorded in the audit; browser/device acceptance remains open.
- Production remains NOT APPROVED.
