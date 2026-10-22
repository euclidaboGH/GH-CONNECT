# GH-CONNECT Social Write-Persistence Repair — 2026-10-22

## Purpose

Repair the social engagement write/read pipeline so post votes, reactions, comments/replies, comment reactions, comment edits/deletes/pins, saves and shares are confirmed by Supabase and remain consistent after refresh in both Feed and Profile.

## Key fixes

- Reworked `gh_post_curation_set` to serialize curation mutations per post and reconcile upvote/downvote counters from canonical `gh_post_curations` rows.
- Reworked `gh_reaction_toggle` to lock the post row, toggle only durable rows, and derive `like_count` from canonical `gh_post_reactions`; route and RPC both enforce canonical post visibility.
- Hardened `gh_comment_create`: repeated IDs count as idempotent success only if they match the same author, post, text, parent and media. Conflicting IDs return `COMMENT_ID_CONFLICT`, not a false success. Returns the authoritative comment count.
- Replaced non-atomic comment deletion with `gh_comment_delete`, which enforces ownership/post-owner moderation, updates `deleted_at` and the post comment counter in one transaction, and returns the authoritative count.
- Added durable comment edit and post-owner pin/unpin RPCs and fields (`is_edited`, `edited_at`, `is_pinned`, `pinned_at`, `pinned_by`).
- Replaced comment-reaction toggling with row-locked mutation and aggregate counts. API read paths return aggregate emoji counts and the current viewer's emoji selections without exposing the full user roster.
- Hydrated post reactions, viewer curation choice, comment reaction counts, viewer comment reactions, edit/pin state and comment media in Feed, Profile and the full comment thread.
- Fixed Profile UI mapping that was explicitly replacing hydrated reaction state with empty objects.
- Removed the second local-only comment-reaction toggle after a successful server write. Reaction removal now uses the same durable server toggle.
- Added stable client comment IDs retained across failed retries, preventing duplicate comments when the server committed a write but the response was lost.
- Corrected comment read durability so an HTTP-successful RPC envelope with an error payload is not falsely reported as durable. REST fallback is counted as durable only when the table read actually succeeds.
- Routed comment edit/delete/pin actions through authenticated server endpoints. Comment deletion preserves other users' replies rather than hiding them locally.
- Hardened save/share/edit routes with visibility checks and persistence confirmation. Added rate limits for comment edit/delete.
- Added a focused static regression suite to `ci:verify` and synchronized migration inventory/project-truth documents.

## Verification performed

All of the following source/static suites passed in this environment:

- Social write-persistence: **27/27**
- Post engagement refresh persistence: **10/10**
- Comment server-first and idempotent retry contract: **13/13**
- Comment reaction-count contract: **5/5**
- Social authorization static scan: **39/39**
- Social visibility: **14/14**
- Canonical social visibility v3: **22/22**
- Private social/media contracts: **17/17**
- Like/curation separation: **12/12**
- Engagement roster security: **10/10**
- Social experience regression: **35/35**
- Latest CI regressions: **16/16**
- Project-truth: **14/14**
- Release hygiene: **11/11**
- Project integrity: **36 checks, 0 errors, 0 warnings**
- Dependency lock coverage/root version consistent
- JSX safety: **730 files scanned**
- Migration checklist and diagnostic manifest synchronized

## Not verified / release blockers

- A full `npm ci`, TypeScript check, ESLint run and Next.js production build were **not completed** here. Dependency installation timed out in the available environment; no green Vercel deployment is claimed.
- No PostgreSQL engine was available, so the new SQL migration was not executed or concurrency-tested against a database.
- Normal migration inventory validation remains **blocked** by existing duplicate migration prefixes `202610210001` and `202610210002`. The new migration is `REVIEW_REQUIRED`; do not apply it until Testnet/Mainnet migration histories and dependencies are reconciled. It calls `gh_post_viewer_can_read` introduced by `202610220001_gh_social_canonical_visibility.sql`.
- Source-level tests do not prove live Supabase persistence. After migration review and application on a disposable database/Testnet, run two-account create/vote/react/comment/reply/edit/delete/pin/save/share and refresh tests before production promotion.
- This repair does not reconstruct votes/comments that were never inserted into Supabase. The migration only reconciles cached aggregate counters from rows that actually exist; it does not fabricate missing engagement.

## Safe rollout sequence

1. Pull the latest `testnet` branch and compare this candidate/patch; do not replace a newer remote checkout wholesale.
2. Resolve duplicate migration versions through a history-aware review. Do not rename already-applied migrations blindly.
3. Test `202610220002_gh_social_engagement_write_integrity.sql` on disposable PostgreSQL and confirm prerequisite `202610220001` is applied.
4. Apply the migration to Testnet only after review; capture migration output and verify table/function privileges.
5. On supported Node.js 24.15.0 or newer in the project's Node 24 line, run `npm ci --legacy-peer-deps`, `npm run typecheck`, `npm run lint`, the focused social tests, and `npm run build`.
6. Run two-account tests: vote and reaction from account B on account A's post; comment/reply/react/edit/delete; pin as post owner; refresh Feed and Profile; confirm counts and viewer state. Also verify private/blocked posts are denied and failed writes never display success.
7. Promote only after GitHub Actions and Vercel are green and live Testnet evidence is recorded.
