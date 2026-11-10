# Feed reliability pass — 0.330.48

**Scope:** Core reliability, Feed batch 1. **Status:** Source implementation complete; external acceptance remains open.

## Verified defect

The canonical `gh_post_list_feed_v3` query orders records by `created_at DESC, id DESC` and its keyset predicate advances with `(created_at < cursor_time) OR (created_at = cursor_time AND id < cursor_id)`. The Feed screen selects the final locally sorted post as the next cursor. Before this pass, `reconcileFeedPosts` sorted equal-timestamp IDs ascending, contradicting the SQL order. This could select a cursor that was not the final row in the server's keyset order, re-requesting already-loaded records and making pagination progress unreliable when timestamps tie.

## Repair

- Changed the shared presentation-only reconciliation helper to sort equal timestamps by descending ID, matching the canonical SQL order.
- Added a runtime regression fixture with overlapping remote/local rows and four equal-timestamp IDs. It verifies the merged order and that the final item is the lowest ID, which is the correct next cursor under the SQL predicate.
- Added a dedicated source contract tying together the client comparator, SQL ordering/predicate and Feed screen cursor selection.
- Wired the new contract into `prebuild`; the existing Pass 40 runtime regression remains in the production prebuild chain.
- No database migration, RPC behavior, post visibility, engagement, moderation, wallet, rewards or financial authority was changed.

## Verification

- `scripts/test-pass40-feed-reconciliation.mjs`: 6/6 runtime assertions.
- `scripts/check-pass40-feed-reconciliation.mjs`: 12/12 source contracts.
- `scripts/check-feed-keyset-ordering-0.330.48.mjs`: 4/4 source contracts.
- Node 24.15.x dependency-backed typecheck, lint, Next.js production build, live database query-plan/concurrency checks and browser/mobile acceptance remain required. This source-only repair does not claim those external gates.

## Next Feed batch

Continue with cursor contract and duplicate-safe refresh under overlapping requests; then audit composer upload ownership/retry, post mutation permission parity, moderation/block/mute enforcement, and profile/community feed parity. Preserve server authority and avoid introducing parallel feed persistence.
