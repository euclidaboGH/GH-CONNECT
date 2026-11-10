# GREENHAVEN Run #270 — Community, Groups, Chat and Platform Maintenance

**Release:** `0.338.31`  
**Scope:** Community directory, group cards, community hub/board, community chat access, moderation and event/resource APIs, Supabase Testnet, migration integrity and Vercel pipeline review.  
**Baseline:** Run #269 / `0.338.30`; no branding, wallet, ledger, payout or Mainnet changes.

## Executive result

Run #270 addresses a real authorization defect in the active Testnet community-chat boundary and improves the community client/API contracts. A live read-only audit found one active community-conversation membership without a matching active community membership. The Testnet-only migration `20261110182120_community_chat_membership_revocation_and_reconciliation.sql` revoked that stale access grant, preserved all conversation/message history, and changed future community join/leave/removal paths so chat access is revoked transactionally. A defensive chat-state RPC now reports chat membership only when the user is also an active community member.

The UI previously allowed ordinary community membership (`canChat={joined}`) to make chat appear available even when the viewer had not opted into the separate chat channel. It now requires the authoritative chat membership state. The directory card is now semantic and keyboard accessible without nesting invitation/join buttons inside a clickable `div role="button"`. Platform write routes now validate payload sizes, enums, date ordering and HTTPS URLs before calling the privileged RPCs.

The source migration inventory and live generated migration history remain unreconciled. The new patch was applied narrowly to active Testnet after exact function/table/constraint preflight; this does not authorize `supabase db push`, migration repair, replay or Mainnet changes.

## Thirty upgrades

| # | Upgrade | Result |
|---:|---|---|
| 1 | Replaced the clickable `div role="button"` group-card wrapper with a semantic `<article>`. | Implemented |
| 2 | Added one explicit, keyboard-operable community-open button with a visible focus ring. | Implemented |
| 3 | Kept Join, Accept invitation and Decline invitation as independent controls outside the open button. | Implemented |
| 4 | Removed one `setInterval` timer per directory card; activity labels no longer create per-card background work. | Implemented |
| 5 | Made older activity dates use the viewer's locale rather than hard-coded `en-US`. | Implemented |
| 6 | Clamped member and unread counters to finite, non-negative display values. | Implemented |
| 7 | Preserved distinct Board and Chat unread indicators. | Implemented |
| 8 | Installed server-authoritative public community full-text search with bounded offset pagination and deterministic ordering; added matching category and GIN search indexes. | Applied to Testnet |
| 9 | Improved shared header semantics by replacing a nested banner landmark with a native header; verified collapsed duplicate controls are inert and the bottom navigation retains safe-area, active-page and scroll hide/reveal behavior. | Implemented / verified |
| 10 | Preserved independent invitation accept/decline busy state and result handling. | Verified |
| 11 | Removed the UI shortcut that treated community membership alone as chat membership. | Implemented |
| 12 | Chat is now available only when the community is joined, chat is enabled and the server confirms active chat membership. | Implemented |
| 13 | Chat state is cleared while a fresh server authorization snapshot is loading or fails. | Implemented |
| 14 | Added request-generation fencing so stale chat-state responses cannot overwrite newer state. | Implemented |
| 15 | Chat-state fetch explicitly includes the session credentials and remains non-cacheable. | Implemented |
| 16 | Sanitized and length-bounded community IDs on the chat GET route. | Implemented |
| 17 | Chat POST now allow-lists `create`, `join` and `review`; unknown actions no longer fall through to Join. | Implemented |
| 18 | Chat review now requires an explicit boolean approval/decline decision. | Implemented |
| 19 | Chat API responses are private, non-cacheable and vary by authorization credentials. | Implemented |
| 20 | Community post reads now use the shared community-ID sanitizer and the same 160-character route contract. | Implemented |
| 21 | Community post responses now use private no-store headers. | Implemented |
| 22 | Community platform reads and writes now use private no-store response headers. | Implemented |
| 23 | Announcement title/content lengths and announcement types are validated before RPC dispatch. | Implemented |
| 24 | Event creation rejects invalid dates and end-times that are not after start-times. | Implemented |
| 25 | Event category, RSVP status and event identifiers are allow-listed/bounded. | Implemented |
| 26 | Event virtual links require credential-free HTTPS; resource URLs accept safe same-origin relative paths or credential-free HTTPS and reject protocol-relative URLs, embedded credentials and unsafe schemes. | Implemented |
| 27 | Resource title, description, content, type and sort-order values are bounded and validated. | Implemented |
| 28 | Report target types, reasons, notes, resolution states and resolution notes are validated. | Implemented |
| 29 | Moderator member-removal targets are bounded and reject control characters before privileged RPC calls. | Implemented |
| 30 | Community join, leave and moderator removal now serialize on the community row; leave/removal atomically revoke the separate chat membership, update chat requests, preserve history and record the moderation action. | Applied to Testnet |

## Live Supabase Testnet findings and remediation

Target: active GH Connect Testnet project `tpckwgdsjlkzscjlxiwe` (eu-west-1). Mainnet was not accessed.

### Before the patch

- `gh_community_leave` changed only `gh_community_members.status`; it did not set `gh_conversation_members.left_at`.
- `gh_community_member_remove` changed community membership and wrote the moderation log, but did not revoke the separate conversation membership.
- `gh_community_chat_state` could return `chatMember=true` based on the conversation row even if community membership was no longer active.
- Live Testnet contained **1 active community-chat membership without a matching active community membership**.
- The live chat review function already had the prior membership-before-approval fix and a fixed `pg_catalog, public` search path; this was preserved.

### Migration applied

`20261110182120_community_chat_membership_revocation_and_reconciliation.sql` was applied to Testnet through the connected Supabase migration operation and recorded as generated history version `20261110182120`.

The migration:

- locks the community row during membership join/leave/removal transitions, aligning their lock order with chat join/review;
- revokes the matching `gh_conversation_members` row in the same transaction when a user leaves or is removed/banned;
- cancels pending/approved chat requests on leave and declines them on moderator removal;
- keeps chat opt-in separate: rejoining the community does not reactivate the chat conversation membership;
- makes `gh_community_chat_state` require both active community membership and active conversation membership;
- reconciles existing stale community-chat grants and stale pending/approved chat requests without deleting messages or conversations;
- retains service-role-only execution and pins `search_path` to `pg_catalog, public` for all four replaced functions.

### Postflight

- Stale active community-chat memberships: **0** (was 1).
- Valid active community-chat memberships: 1.
- Stale pending/approved chat requests without an active community member: 0; active conversation memberships on deleted communities: 0.
- Public community search smoke test: all_count=1; no-match query_count=0; `filtering=server-side`; `hasMore=false`.
- Community rows: 1; community member rows: 1; conversation member rows: 8; message rows: 14 (message history unchanged).
- `gh_community_join`, `gh_community_leave`, `gh_community_member_remove` and `gh_community_chat_state` all retain `SECURITY DEFINER`, fixed `search_path`, and `service_role`-only execution.
- Security advisor: one INFO lint group containing 13 intentional RLS-enabled/no-policy tables; no new client policy was added. Performance advisor: one INFO group containing 113 unused-index candidates (the two new search indexes have not yet accrued workload); no index was removed without workload evidence. Health advisor: zero lints.

## Directory search and migration-history finding

The application calls `gh_community_search_public` for server-authoritative filtering/pagination. The original source migration `20261108120001_gh_community_server_filter_search.sql` was absent from Testnet history and its RPC was missing. After verifying all referenced columns, indexes and service-role ACL requirements, the equivalent additive function/index migration `20261110183004_community_server_filter_search_reconciliation.sql` was applied to Testnet under generated history version `20261110183004`. A smoke query returned one public community, zero rows for a no-match query, `hasMore=false`, and `filtering=server-side`. The original source migration remains REVIEW_REQUIRED/superseded until full source/remote history reconciliation; the Run #270 reconciliation migration is the recorded Testnet mirror.

Live Testnet has **15 generated migration-history records** after Run #270, while the repository has **212 canonical source migration files**. The remote history includes generated timestamps and duplicate submissions and is not equivalent to the canonical file sequence. Do not run `supabase db push`, repair history or bulk-replay historical migrations.

## Supabase and Vercel observations

- Community-related Testnet edge logs in the observed window contained successful `200` responses for the sampled membership/list RPCs; no community/messaging `4xx`/`5xx` rows were returned by the filtered edge-log query. The observed sampled volume included 239 social-notification unread-count calls, 221 messaging unread-count calls, 182 social-notification list calls, 143 community-membership table reads, 32 community-membership RPC calls and 31 public-community list calls. The sampled average origin times ranged from about 150–247 ms, with occasional longer outliers. This is a monitoring baseline, not a load test.
- Vercel runtime-error aggregation for the Testnet project over seven days returned seven clusters: curation authoritative-weight failures (8; last 2026-11-05, `CURATION_SNAPSHOT_MISSING_OR_UNREADABLE`), curation refresh `SQLSTATE_42703` (8; last 2026-11-05), Marketplace order-list RPC failures (3; last 2026-11-10 07:57 UTC), legacy `Buffer()` deprecation warnings in the payout route (3; last 12:42 UTC), Supabase HTTP 403 errors on payout processing (3; last 05:26 UTC), uncertain Pi payout outcomes (2; last 12:42 UTC), and PIN-recovery RPC 404/PGRST202 (1; 07:54 UTC). These logs are from older preview deployments; they are not evidence that the current Run #270 source has been deployed. No runtime-error clusters were returned for the production Vercel project in the same window.
- Vercel Testnet preview project `gh-connect-5p3o` is configured for Node `24.x` but has neither password nor SSO deployment protection. The production-named project `gh-connect` has SSO protection for non-custom deployment domains; its latest deployment was also a failed preview (`target=null`) from the `testnet` branch. Both latest projects' builds failed on the same old commit `14112a3a9a16ee345f42750de3dcf2fe9f1769c3` / package `0.338.29` at prebuild check 42/294. The old assertion expected `gap-y-1.5`; current source uses `gap-y-2`. Run #270 source adds a further prebuild check (296 checks total) but has not been pushed. The latest deployments are not production promotions; no Vercel protection, environment values, domain, alias or production setting was changed. GitHub integration write access remains unavailable: the prior branch-creation attempt returned HTTP 403, so no source commit, PR or new Vercel build was triggered. Mainnet remains inactive and production remains NOT APPROVED.

## Verification and limits

Run #270 adds a dedicated 53-assertion community integrity gate. The complete `npm run verify:static` suite exits 0; migration inventory `--check` passes; the prebuild runner dry-run discovers 296 checks. Full Node 24.15.0 dependency-backed TypeScript, lint and production build, real two-account chat revocation/rejoin tests, browser/mobile/screen-reader acceptance, disposable PostgreSQL concurrency rehearsal, and successful Vercel preview deployment remain release gates. Both Run #270 migrations have been applied to Testnet, not Mainnet.

No Pi payout, membership payment intent, wallet balance, GHC/Pi ledger, marketplace order, or fulfilment record was changed. No Mainnet data or Vercel production configuration was changed. Production remains **NOT APPROVED**.
