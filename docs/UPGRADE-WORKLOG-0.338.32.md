# GREENHAVEN 0.338.32 — Run #271 worklog

## Source baseline

Run #270 / `0.338.31`, archive folder `GREENHAVEN-0.338.31-RUN270-COMMUNITY-30-POINT-UPGRADE/`.

## Implementation

- Fixed post API validation for first-party durable media facade URLs produced by the composer.
- Added exact facade validation for images, video and PDF; recovered media IDs from all three; deduplicated image refs; bounded image and media-ID counts; retained owner/readiness checks via `gh_post_media_attach`; preserved cleanup of incomplete posts after attachment failure.
- Expanded account-scoped post drafts to preserve images, video, PDF, audience, community target and publish retry identity. Removed composer use of unscoped legacy draft keys. Added latest-draft restore, close-time save, saved timestamp, and stable compact request signatures/IDs.
- Passed the stable post request ID through composer, context and PostDomain.
- Filtered community publishing targets to actual community conversations rather than all group DMs.
- Aligned document upload size cap to the durable direct-upload ceiling (50 MiB).
- Made story IDs stable across retries of the same payload; server derives profile identity; story media accepts only first-party durable facade or small inline image and must be owned/ready; audience and text limits are strict.
- Added story endpoint ID validation, story creator/viewer focus traps, Escape behavior, actual video pause/resume, and safe-area spacing.
- Added Run #271 static regression contract and registered it in both `prebuild:checks` and `verify:static`.

## Supabase Testnet

Applied only to active GH Connect Testnet:

- `20261110185525_story_idempotent_create_and_owned_media_guard` — generated history version `20261110185525`.
- `20261110185528_story_read_path_and_viewer_roster_indexes` — generated history version `20261110185528`.
- `20261110190531_post_create_idempotent_owner_and_payload_guard` — generated history version `20261110190531`; exact-payload same-owner retries succeed, cross-owner/changed-payload collisions and retired IDs are rejected.

Synthetic SQL smoke test passed for first create, same-owner duplicate retry, cross-owner collision rejection and arbitrary external media rejection. Test rows were removed in the same test block. Story count remained 3. All five inspected story RPCs use `search_path=pg_catalog, public`, deny anon/authenticated and allow service_role. Both indexes exist.

No Mainnet access/change; no production Vercel settings; no story/view/reaction/post/media/ledger/payment/membership/payout data cleanup.

## Live logs and advisors

- Supabase edge logs: no 4xx/5xx rows for post/story/media paths in the inspected window.
- Supabase security advisor: 13 intentional RLS-enabled/no-policy INFO findings; no generic policies added.
- Supabase health advisor: 0 lints.
- Supabase performance advisor: 113 unused-index candidates on low-traffic Testnet; no indexes dropped.
- Vercel seven-day runtime error aggregation still shows older curation (8+8), Marketplace order-list (3), payout 403 (3), payout Buffer deprecation (3), uncertain Pi payout (2), and PIN-recovery 404/PGRST202 (1) clusters. These remain separate work items.
- Latest two Vercel preview builds still fail on older commits `14112a3a...` and `ed1d595d...`; latest successful inspected preview is older commit `8c3393d...`. Run #271 has not been pushed or deployed.

## Verification

Run #271 verification is source-only; it does not substitute for a dependency-backed production build. The required Node 24.15.0 runtime is not available in this container.

- Run #271 social publishing integrity contract: 42/42.
- Changed TypeScript/TSX syntax-only transpilation: 11/11; no semantic typecheck is claimed.
- Full `npm run verify:static`: **PASS (57/57)**.
- Prebuild runner dry-run: **297 checks discovered**; no execution under unsupported Node 22.16.0.
- Migration inventory: 215 canonical migrations, classifications 119 REQUIRED / 1 REQUIRES_APPROVAL / 2 PROPOSAL / 93 REVIEW_REQUIRED.
- Testnet remote migration history: 18 generated records vs 215 canonical source files. Do not bulk push, repair or replay.
- Local Node: 22.16.0; required Node: 24.15.0; dependencies absent. Do not claim dependency-backed typecheck/lint/Next build.

## Production status

**NOT APPROVED.** Requires GitHub source push, Node 24.15.0 build, Vercel preview validation, browser/mobile/two-account acceptance, complete migration reconciliation and existing financial/provider release gates.
