# GREENHAVEN 0.338.31 — Run #270 Community and chat integrity upgrade

**Baseline:** Run #269 / `0.338.30`  
**Target:** Community directory, groups, chat membership, community posts, governance APIs, Supabase Testnet and Vercel preview pipeline.  
**Production:** NOT APPROVED.

## Completed

1. Audited current Community directory, `PremiumCommunityHub`, group-card UI, chat routes, post routes, platform governance routes, relevant SQL functions and current migration inventory.
2. Inspected Testnet migration history, current community-related table/column/index/policy contracts, RPC definitions/ACLs and Supabase security/performance/health advisor results.
3. Confirmed that `gh_community_leave` and `gh_community_member_remove` did not revoke the separate `gh_conversation_members` row.
4. Found one active community-chat membership without a matching active community membership.
5. Found the UI fallback that treated ordinary community membership as sufficient for chat access.
6. Applied `20261110182120_community_chat_membership_revocation_and_reconciliation.sql` to active Testnet under generated history version `20261110182120`.
7. The migration serializes community join/leave/removal transitions on the community row; leave/removal revoke chat membership and update chat requests in the same transaction; chat-state requires active community membership; and existing stale chat grants are reconciled without deleting conversations or messages.
8. Postflight confirms stale active community-chat memberships = 0, valid active chat memberships = 1, 8 conversation-member rows and 14 messages; message history was preserved.
9. Reworked `GroupCard` as a semantic article with a dedicated open button and independent join/invitation controls; removed per-card minute timers; made activity dates locale-aware; bounded counts; added focus visibility.
10. Chat UI now requires joined community + enabled chat + server-confirmed chat membership; state clears on revalidation/failure and stale responses are fenced.
11. Replaced the shared collapsing header's nested banner landmark with a native header; verified hidden duplicate controls are inert and the global bottom navigation keeps safe-area, active-page and scroll hide/reveal behavior.
12. Chat GET/POST now sanitizes IDs, validates action names and requires explicit boolean review decisions; responses are private/no-store.
13. Community post reads use the shared ID sanitizer and private/no-store responses.
14. Community platform API now validates announcements, event order/categories/RSVPs, credential-free HTTPS event links and safe HTTPS/relative resource links, resource bounds, reports/resolution and member-removal identifiers.
15. Added `scripts/check-run270-community-integrity.mjs` with 53 assertions and registered it in prebuild/static verification.
16. Added a 30-point audit register, Run #270 source-of-truth/worklog updates, and migration inventory classification for the Testnet-only patch.
17. Applied the additive public-community search migration to Testnet under generated history version `20261110183004`; the server-side RPC now returns bounded public-only pagination and matching search indexes.
18. Advanced package/lockfile/app release metadata to `0.338.31`.

## Verification

All Run #270 source-level checks are regression evidence, not runtime or production acceptance. The current environment is Node.js 22.16.0, below the required Node 24.15.0 runtime; no dependency-backed TypeScript/lint/Next.js production build is claimed.

- Run #270 community integrity source gate: 53/53.
- Migration inventory: 212 files; 119 REQUIRED, 1 REQUIRES_APPROVAL, 2 PROPOSAL, 90 REVIEW_REQUIRED.
- Migration inventory `--check`: PASS. Public search smoke query: one public result, no-match query returns zero, server-side pagination confirmed.
- Live Testnet migration history: 15 generated records; this is not reconciled to the 212 canonical source files.
- Supabase security advisor: one INFO lint group with 13 intentional RLS-enabled/no-policy findings; performance advisor: 113 unused-index candidates (the two new search indexes have not yet accrued workload; none removed); health advisor: zero lints.
- Full `npm run verify:static`: PASS (exit 0). Run #270 community integrity gate: 53/53. Prebuild dry-run: 296 checks discovered. Migration inventory `--check`: PASS. Public search smoke query: one public result, no-match query returns zero, server-side pagination confirmed.
- Vercel runtime-error aggregation showed seven Testnet preview error groups: stale curation migration/column failures, Marketplace order-list RPC failures, PIN-recovery RPC 404, payout Supabase 403, Pi provider uncertainty and a legacy `Buffer()` deprecation warning. Production runtime-error aggregation returned none in the same seven-day window. The latest preview and production-named Vercel projects both failed on old commit `14112a3a9a16ee345f42750de3dcf2fe9f1769c3` at prebuild check 42/294; Run #270 is not deployed.
- Node 24.15.0 dependency-backed typecheck/lint/build, disposable PostgreSQL concurrency tests, two-account chat revocation/rejoin tests, browser/mobile/screen-reader acceptance and a new Vercel preview deployment remain to be completed.

## Remaining issues and blockers

- The original `20261108120001_gh_community_server_filter_search.sql` remains a historical REVIEW_REQUIRED source entry; equivalent public-search RPC/index logic is now installed through Run #270 migration `20261110183004` on Testnet. Its canonical/remote history relationship still needs reconciliation.
- Testnet generated migration history has 15 records against 212 canonical source files. Do not run `supabase db push`, migration repair or bulk replay until every historical object and migration is reconciled.
- Latest Vercel Testnet preview still builds old branch commit `14112a3a9a16ee345f42750de3dcf2fe9f1769c3` / package `0.338.29` and fails at a stale visual-cohesion assertion. Run #270 has not been pushed or deployed; GitHub integration write access was previously denied (403).
- Mainnet remains inactive and untouched. Vercel production project remains associated with inactive Mainnet; no production settings or aliases changed.
- Three uncertain Pi earnings payout requests and two APPROVED-but-unfulfilled membership payment intents remain held for provider reconciliation. No wallet, ledger, payout or entitlement data was changed.
