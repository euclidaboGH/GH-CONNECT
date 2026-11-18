# GreenHaven 0.338.49 — Run #285 Social and Messaging Upgrade

**Baseline:** 0.338.48 / Run #284 uploaded source archive  
**Scope:** Discovery, Matches, Connections/Follow, Direct Messages, messaging database contract, Supabase Testnet history, and Vercel build pipeline.

## Implemented

1. Added durable per-user message reactions backed by `gh_message_reactions`.
2. Added a strict emoji allowlist and server-side input validation.
3. Added an authenticated PATCH reaction path; actor identity comes from the verified session.
4. Added a membership-checked `gh_message_toggle_reaction` database function.
5. Serialized concurrent reaction toggles on the owning message row.
6. Added unique `(message_id, actor_id, emoji)` reaction semantics.
7. Added indexes for conversation/message aggregates and actor history.
8. Enabled RLS and denied all direct client table access; service-role RPC remains the only write boundary.
9. Returned aggregate reaction counts and viewer-only selected reactions; actor rosters are not exposed.
10. Connected the durable messaging domain to the new API; local-only reaction mutation is retained only for non-production development.
11. Added reload/history hydration for aggregate reaction counts and the authenticated viewer’s own selections without returning actor rosters.
11. Added a 12-assertion regression gate and registered it in static verification.
12. Updated the canonical migration source inventory and marked the new migration REVIEW_REQUIRED.
13. Bumped package, lockfile, in-app release identity, README and source-of-truth docs to 0.338.49.
14. Corrected the Vercel dashboard build command to run the existing stale Webpack cache cleanup before `npm run build`.

## Live connected-system audit

- Supabase Testnet project `tpckwgdsjlkzscjlxiwe` is active and healthy; Mainnet project `rrrtjowuldcpbjobbpic` is inactive and was not modified.
- Testnet reports 39 applied migration records. The supplied 0.338.48 archive contains exact source for only 10 of those 39 entries; 29 are missing or version-mismatched. The new Run #285 migration is therefore a candidate only and has not been applied.
- Security advisor reports 13 RLS-enabled tables with no policies. Existing ACL review indicates these are intentional deny-client/service-only tables; do not add generic client policies.
- Supabase logs show repeated successful `gh_messaging_unread_counts` RPC calls (HTTP 200) during the inspected 24-hour period. No inference of failed messaging operations is made from those success rows.
- GitHub `euclidaboGH/GH-CONNECT` `testnet` still reports package version 0.338.31, while the uploaded source baseline was 0.338.48. The GitHub branch was not overwritten or pushed.
- Latest Vercel build for the connected project failed with `out_of_memory` / Next.js worker `SIGKILL`. Build events show a 4,870 MB source input report, 756 MB node_modules, and restored Webpack cache packs exceeding 1 GB. The build log command omitted the repository's cache-cleanup script; the Vercel dashboard build command was updated to run `node scripts/prepare-vercel-build.mjs` before compilation.

## Migration gate — NOT APPLIED

`supabase/migrations/20261111131500_run285_durable_message_reactions.sql` is additive and marked REVIEW_REQUIRED. It has not been applied to Testnet. Restore exact historical migration sources, reconcile checksums and dependencies, rehearse the complete ordered migration chain against disposable PostgreSQL, and test RLS/grants plus concurrent reaction toggles before applying. Supabase CLI is not installed in this execution environment, so no claim is made that `supabase migration new`, local PostgreSQL rehearsal, or `supabase db advisors` on the candidate was run.

## Verification limitations

This release has source-only verification for the new database and messaging contracts; it is not a completed production acceptance run.

- Focused Run #285 reaction contract: 12/12 passed.
- Run #284 privacy and message-write regression gates: 9/9, 10/10, 5/5 and 6/6 passed.
- Project truth: 11/11; release hygiene: 15/15; migration source manifest: 221/221.
- Full static suite currently requires reconciliation of two stale hard-coded contracts (the 0.338.49 worklog filename and the database-source table count increased by this new migration). These are being updated as part of this run.
- Environment Node version is 22.16.0; project requires Node 24.15.0. No production Next build, TypeScript check, browser/device acceptance, GitHub push, or Vercel deployment is claimed.
- No financial records, user data, wallet balances, rewards, payouts, membership entitlements, or Mainnet state were changed.
