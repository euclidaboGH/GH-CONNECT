# GREENHAVEN Run #271 — Post Composer, Stories and Publishing Integrity Audit

**Release:** `0.338.32`  
**Scope:** post composer, Feed publishing, stories, media upload/delivery, drafts, community publishing targets, UI accessibility, Supabase Testnet and Vercel evidence.  
**Source baseline:** `GREENHAVEN-0.338.31-RUN270-COMMUNITY-30-POINT-UPGRADE.zip` (Run #270).  
**Target database:** GH Connect Testnet (`tpckwgdsjlkzscjlxiwe`, eu-west-1). Mainnet was not accessed or modified.  
**Release status:** source maintenance increment; **NOT APPROVED** for production.

## Executive result

Run #271 closes a concrete post-publishing defect and two high-risk reliability/privacy gaps. The composer uploads media as first-party `/api/media/<media-id>/content` facade references, while the post API previously accepted only `data:image/*` and HTTPS URLs. That mismatch rejected normal uploaded media at publish time. PDF facade references were also not being attached to the durable post-media authorization relation. The API now accepts the exact facade path, extracts image/video/PDF asset IDs, and commits them through the existing media attachment RPC, which validates ownership/readiness. Failed attachment still soft-deletes the incomplete post rather than leaving a half-published record.

The composer previously used an unscoped legacy quick-save key in addition to the account-scoped draft library. Run #271 removes that device-wide read/write path and persists the complete draft under the authenticated identity namespace, including durable images/video/PDF, visibility, community target and stable post request ID/signature. Closing the composer synchronously saves dirty state. Stable request IDs survive ambiguous retries so a lost response does not force a second post ID.

Story creation now uses a stable request ID, derives owner name/photo from the server profile, rejects arbitrary external or short-lived signed media URLs, checks the media asset is ready and owned by the session user, validates the audience and enforces the 500-character product limit. The database RPC independently validates those contracts and is idempotent by story ID. Story viewer/creator dialogs gain focus trapping, Escape behavior, mobile safe-area layout and a pause control that actually pauses/resumes video.

## 30 upgrades and improvements

### Post composer and durable media

1. **First-party image URL support:** the post API now accepts the exact GreenHaven media facade path produced by the upload client instead of rejecting it as an invalid image.
2. **First-party video URL support:** the same strict facade contract is accepted for uploaded video.
3. **Durable PDF reference support:** PDF attachments accept owned media-facade references and bounded inline PDF fallback data; `blob:` URLs remain rejected.
4. **Complete attachment ID recovery:** media IDs are recovered from image, video and PDF references, not only the optional `mediaIds` field.
5. **Owner/readiness enforcement:** recovered IDs flow through the existing `gh_post_media_attach` RPC; server-side ownership and ready-state checks remain authoritative.
6. **Partial-failure safety:** if durable media attachment fails after post creation, the route soft-deletes the incomplete post and returns failure rather than leaving a post with broken private media.
7. **Image count enforcement:** more than ten images are rejected explicitly instead of silently truncating the user's selection.
8. **Explicit media-ID bounds:** direct media ID lists are capped at twenty and oversized requests are rejected.
9. **Duplicate media normalization:** duplicate image references are removed before persistence and relation attachment.
10. **Attachment-specific validation:** PDFs are checked before ID extraction; unsupported `blob:` and oversized inline references fail closed.

### Drafts and retry reliability

11. **Account isolation:** composer no longer reads or writes the old unscoped `ghc-post-draft-v1` / Pi-local `post-draft-v1` key.
12. **Owner-scoped persistence:** drafts remain under `ghc.post-drafts.v2:<authenticated-user-id>`.
13. **Complete draft payload:** draft records preserve durable images, video, PDF, PDF filename, visibility and community target.
14. **Automatic restoration:** opening the composer restores the latest draft belonging to the current identity, or the explicitly requested draft ID.
15. **Synchronous close save:** Escape, tab-change, close-compose and explicit close now persist dirty draft state before clearing the UI.
16. **Accurate saved state:** the composer exposes a saved timestamp/status and keeps the draft until publish or explicit discard.
17. **Stable post request identity:** a publish request ID and compact payload signature are retained with the draft.
18. **Retry-safe post IDs:** identical retries reuse the same `post_...` ID; a changed payload produces a new request identity.
19. **Domain/context wiring:** the request ID is passed through `UnifiedCompose` → GHC context → PostDomain → `/api/social/posts`, rather than being generated only at the last step.
20. **Safer target selection:** the community-board picker excludes ordinary group DMs and only offers conversations explicitly marked as a community.

### Stories and viewer experience

21. **Stable story request IDs:** the story creator keeps the same ID when retrying an unchanged payload after an ambiguous network response.
22. **Cross-owner collision guard:** the database RPC returns `ID_CONFLICT` if another owner already holds the supplied story ID.
23. **Server-derived identity:** story owner name/photo now come from the server profile, not client-supplied identity fields.
24. **Owned media authorization:** story media must resolve to a ready `gh_media_assets` row owned by the authenticated user; media type must match.
25. **No arbitrary external media:** new stories accept only the first-party media facade or a small inline image; short-lived signed URLs and arbitrary external HTTPS URLs are rejected.
26. **Strict audience validation:** invalid audience values return `INVALID_AUDIENCE` rather than silently becoming public.
27. **Story text contract:** API and database both enforce the 500-character story limit.
28. **Story endpoint ID validation:** view, reaction and viewer-roster routes reject malformed/non-story IDs before privileged RPC calls.
29. **Accessible creator/viewer dialogs:** focus is trapped while open and Escape closes the creator when no publish/upload is active; viewer keyboard navigation remains available.
30. **Playback and mobile layout:** the story pause control now controls the video element, and creator/viewer surfaces respect top/bottom safe areas.

## Supabase Testnet changes

Three narrow migrations were applied to Testnet only:

| Generated history version | Migration name | Effect |
|---|---|---|
| `20261110185525` | `story_idempotent_create_and_owned_media_guard` | Replaces `gh_story_create` with stable-ID idempotency, owner collision checks, text/audience/media validation and database-level media owner/readiness checks. Pins story security-definer function search paths and preserves service-role-only execution. |
| `20261110185528` | `story_read_path_and_viewer_roster_indexes` | Adds newest-first active story ordering and story-viewer roster indexes. No rows are modified. |
| `20261110190531` | `post_create_idempotent_owner_and_payload_guard` | Replaces `gh_post_create` with exact-payload same-owner idempotency, cross-owner collision rejection, retired-ID rejection, fixed search path and service-role-only execution. |

A synthetic SQL smoke test verified:

- first create returns `ok=true`, `duplicate=false`;
- same-owner retry returns `ok=true`, `duplicate=true`;
- a different owner reusing the same ID returns `ID_CONFLICT`;
- arbitrary external media returns `INVALID_MEDIA_URL`;
- synthetic test rows were removed in the same test block.

Postflight confirmed:

- 5 inspected story RPCs plus `gh_post_create` (`gh_story_create`, `gh_story_list_active`, `gh_story_view_authorized_v2`, `gh_story_reaction_toggle`, `gh_list_story_viewers`) all use `search_path=pg_catalog, public`;
- all five deny `anon` and `authenticated` and allow `service_role`;
- both new indexes exist;
- story table remained at 3 rows (0 currently active at the query snapshot);
- Supabase health advisor: 0 lints;
- security advisor: 13 intentional RLS-enabled/no-policy INFO findings remain; these are deny-client tables and must not be given generic client policies;
- performance advisor: 113 unused-index candidates on low-traffic Testnet; none were removed.

The existing Run #269 ACL hardening remains intact: all 140 public tables retain RLS; no anon/authenticated table write/DDL-adjacent grants remain; all 9 public sequences deny client privileges. No story, view, reaction, post, media, ledger, wallet, payment, membership or payout rows were bulk-modified.

**Migration-history blocker:** Testnet has 18 generated history records against 215 canonical source migration files. This remains unreconciled. Do not run `supabase db push`, repair history, hand-edit migration history or bulk replay historical files. Mainnet remains inactive/untouched.

## Vercel and logs review

- Testnet Vercel preview latest two builds remain failed on older GitHub `testnet` commits `14112a3a9a16ee345f42750de3dcf2fe9f1769c3` and `ed1d595d9273e5487a09d9c89c4bbbd1cf0caa91`; the most recent successful preview in the inspected window is still an older commit `8c3393d122a43a971c700768dfd0bf67fe099aa4`. These deployments predate Run #271. They are preview deployments (`target=null`), not production promotions.
- Seven-day Vercel runtime aggregation still reports older clusters: curation authoritative-weight/snapshot failures (8), curation refresh `SQLSTATE_42703` (8), Marketplace order-list RPC failures (3), Supabase HTTP 403 on payout processing (3), `Buffer()` deprecation warnings in payout processing (3), uncertain Pi payout outcomes (2), and PIN-recovery RPC 404/PGRST202 (1). These are outside the social publishing change and were not altered here.
- Supabase edge-log query for 4xx/5xx post, story and media requests returned no rows in the available log window. This is not proof of no client-side failures; the source-level composer/API mismatch above was found independently.
- No Vercel environment variable, project protection, alias, domain, build setting or production target was changed. No deployment was triggered because the GitHub source was not updated and repository write access remains unavailable.

## Verification and limitations

- Run #271 source contract: **42/42 assertions**.
- Changed TypeScript/TSX files passed syntax-only transpilation: **11/11**; this is not a semantic typecheck.
- Prebuild manifest: **297 checks discovered**; dry-run only because local Node 22.16.0 is below the required Node 24.15.0.
- `npm run verify:static`: **PASS (57/57)**; Run #271 publishing contract **42/42**.
- Migration inventory: **215** canonical files; generated manifest/checklist/apply order synchronized.
- Testnet migration history: **18** generated records; not reconciled with all 215 source files.
- Environment runtime: Node `22.16.0`; project requires Node `24.15.0`; `node_modules` is absent. Full dependency-backed TypeScript, ESLint and Next production build are therefore not claimed.
- Browser/device/two-account tests for photo/video/PDF publish, retry-after-lost-response, cross-account draft isolation, story audience, signed-media authorization and video playback remain required before production approval.

## Release blockers

1. Push Run #271 source to GitHub after repository Contents/branch/PR permissions are granted.
2. Run Node 24.15.0 `npm ci --legacy-peer-deps`, typecheck, lint and production build.
3. Inspect the new Vercel preview logs and confirm the prebuild checks pass; then complete browser/mobile/two-account publishing tests.
4. Reconcile all canonical migration files with Testnet and Mainnet independently; never bulk replay.
5. Keep Mainnet and production NOT APPROVED until all existing financial/provider and operational release gates are separately cleared.
