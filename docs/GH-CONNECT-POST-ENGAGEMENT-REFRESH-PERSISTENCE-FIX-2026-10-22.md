# GH-CONNECT — Post vote/comment persistence and refresh repair

Date: 2026-10-22
Baseline: available GH-CONNECT 0.69.3 consolidated stabilization candidate. This is not a fresh checkout of the latest remote `testnet` branch.

## Reported symptom
Post upvotes/downvotes and comments appeared to disappear after a page refresh, in both feed cards and the profile timeline.

## Root causes found in the available source
1. Feed curation hydration only queried `gh_post_curations` when the feed RPC omitted count/choice fields. Older RPCs could return zero-valued counters, which were treated as authoritative, so durable vote rows were not read on refresh.
2. The profile timeline RPC did not return curation totals, viewer vote choice, or comment previews; the profile API and UI did not hydrate/map those fields consistently.
3. Profile timeline mapping explicitly replaced comments with an empty array even if the server supplied comment previews.
4. The comment-list route relied on staged RPCs and had no direct canonical-table recovery if an older RPC returned an empty payload despite persisted rows.
5. Opening a comment thread could reduce the known comment total to the number of comments in the loaded page.

## Changes made
- Feed hydration always reconciles curation from durable `gh_post_curations` rows; when that read succeeds, vote totals and the authenticated viewer's active choice are derived from those rows instead of stale zero-valued RPC fields.
- Feed comment totals never fall below the hydrated comment preview count or the existing durable count.
- Profile post API now batch-hydrates recent comments and curation rows for the authorized visible posts, exposing `comments`, `commentCount`, `upvoteCount`, `downvoteCount`, and `viewerCurationChoice`.
- Profile timeline now maps the server-returned comments instead of discarding them.
- Comment-list API falls back to a server-side read from `gh_post_comments` when the RPC fails or returns no comments. It marks the result durable only when a durable RPC or direct table read succeeds.
- Opening the comment thread no longer lowers the previously known comment total.
- Added `scripts/test-post-engagement-refresh-persistence.mjs`, wired to `package.json` and `ci:verify`. GitHub CI's existing regression-script loop also runs this new test automatically.
- No database migration or live database mutation is required by these source changes.

## Verification performed
- New post engagement refresh regression: 10/10 passed.
- Comment server-first regression: passed.
- Comment reaction-count contract: 5/5 passed.
- Social visibility: 14/14 passed.
- Social authorization: 39/39 passed.
- Canonical social visibility v3: 22/22 passed.
- Private social/media contracts: 17/17 passed.
- Project integrity audit: passed.
- Dependency lock coverage/root version consistency: passed.
- `package.json` JSON parse: passed.
- ZIP integrity check: performed on the packaged candidate.

## Important limitations
- Full `npm run typecheck`, `npm run lint`, `npm run build`, and live Testnet checks were not run in this environment. Do not treat this package as a confirmed green production release until GitHub Actions and Vercel pass.
- This archive is based on the latest candidate available in this conversation, not a fresh checkout of remote commit `540b980` or any later commit. Apply/reconcile these focused changes against the latest `testnet` branch; do not blindly overwrite the branch with the archive.
- Read paths can only display records that were actually persisted. If votes/comments are missing from the canonical `gh_post_curations` / `gh_post_comments` tables, the write path and Testnet RPC/migration state must be separately audited. These changes do not fabricate or recreate missing user engagement.
