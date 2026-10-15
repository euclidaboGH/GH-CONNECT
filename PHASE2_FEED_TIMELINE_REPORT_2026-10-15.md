# GreenHaven Phase 2 — Feed & Timeline

## Scope
Production hardening of durable feed/timeline pagination and client/server feed reconciliation. No wallet, reward, membership, Pi-payment, or economy mutation logic changed.

## Fixed
1. Added stable feed cursor semantics using `(createdAt, postId)` so posts sharing the same timestamp are not silently skipped between pages.
2. Added additive `gh_post_list_feed_v2` migration; legacy RPC remains intact for staged deployment safety.
3. Feed API validates complete cursors and rejects malformed/half cursors.
4. Feed API attempts V2 first and safely falls back to the legacy RPC until the migration is applied.
5. Feed API now returns `nextCursor` and `stableCursor` metadata.
6. Social client accepts/forwards `beforeId` and exposes cursor metadata.
7. Canonical `refreshFeed` accepts the composite cursor.
8. Infinite-scroll load-more now sends both timestamp and post ID and uses deterministic timestamp+ID ordering.
9. Existing server-side auth, visibility, block enforcement and mute filtering were preserved.
10. Profile timeline already used `(before,beforeId)` pagination; Phase 2 aligns the main feed with that same durable pagination standard.

## Deployment requirement
Apply `supabase/migrations/202610150001_gh_post_list_feed_stable_cursor.sql` on Testnet. Before it is applied the API intentionally falls back to the legacy feed RPC and reports `stableCursor: false`.

## Verification
- `node scripts/check-jsx-safety.mjs`: PASS — 613 files scanned.
- Full Next build: NOT EXECUTED in this extracted artifact because dependencies/node_modules are not bundled (`next: not found`). This is an environment/dependency absence, not a suppressed build result.

## Preserved boundaries
No changes to wallet balances, GHC settlement, reward amounts, membership entitlements, Pi payments, escrow, or marketplace economics.
