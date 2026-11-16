# GreenHaven v0.303.0 — Phase 17 worklog

Date: 2026-11-04

## Source baseline

This increment starts from the uploaded GH-CONNECT 0.302.0 Phase 16 archive and advances the source package to 0.303.0. The uploaded archive remains the only source baseline; no earlier archive was merged into the working tree.

## Implemented

- Added stable-cursor comment pagination using the existing canonical `gh_comment_list_v3` RPC.
- Reduced comment page size to 40 and carried the composite timestamp/ID cursor through the social client, shared GHC context, and comment sheet.
- Added ID-based page reconciliation so loading older comments appends without duplicates and later server copies replace stale rows.
- Separated “show more already-loaded comments” from “load older comments from the server”.
- Added a dedicated loading state and accessible live feedback for older-page retrieval.
- Changed the discussion count label to prefer the known engagement total over the number of comments currently loaded.
- Improved post-detail comment recovery so failed comment reads are not shown as a genuine empty discussion and users can retry.
- Added author notifications for every active post reaction; toggle-off actions remain silent and self-notifications remain suppressed.
- Made the share sheet wait for durable server confirmation, broadcast the authoritative share count, and removed the duplicate fire-and-forget share write from the feed.
- Fixed an existing JSX sibling-root syntax error in `components/ghc/location-picker.tsx` by wrapping the conditional select/input pair in a fragment.

## Database and financial scope

No migration was added or changed. No GHC, Pi, wallet, reward, payment, or financial-ledger logic was modified.

## Verification

This is source-only verification; it does not establish deployed runtime or operator acceptance.

- Phase 17 social-engagement source contract: 19/19 passed.
- Phase 16 post-interaction regression contract: 12/12 passed.
- Project truth consistency: 10/10 passed.
- Migration source manifest: 175/175 synchronized.
- Relevant prior release checks for locale integration, creator media preview, feed experience, and social/story/profile media UX passed.
- Full `npm run prebuild` and `npm run verify:static` are not green in this audit container because the environment runs Node.js 22.16.0 while the project is pinned to Node.js 24.15.0. The static suite also surfaced existing release-report baseline references that were updated for 0.303.0; rerun the suite under Node.js 24.15.0.
- `tsc --noEmit` parsed the changed TS/TSX sources after the JSX fix, but could not complete because the interrupted dependency install left required type definitions incomplete. Do not treat typecheck, lint, Next.js build, browser E2E, or live Testnet verification as passed.

## Release status

Source changes only. This is not production or Mainnet certification. Before deployment, use Node.js 24.15.0, run a clean `npm ci --legacy-peer-deps`, typecheck, lint, build, browser journeys, and the two-user Testnet social matrix. No migration application is required for this phase.
