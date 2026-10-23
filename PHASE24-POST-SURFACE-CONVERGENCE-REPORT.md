# GreenHaven Phase 24 — Post Surface Convergence

## Scope
Feed, Profile Content Library, Search/Discovery and post lifecycle synchronization.

## Implemented
- Added versioned `ghc:post-sync` contract for edit/archive/restore/delete/upsert/engagement UI coherence.
- Profile Content Library consumes lifecycle mutations without a redundant network refresh.
- Global Search removes archived/deleted results and patches edited results while open.
- Social client coalesces identical concurrent GET requests and retains no response cache.
- Post edit/archive/restore/delete operations emit canonical synchronization events only after the corresponding operation reaches its intended local/durable state.
- Preserved stable `(before,beforeId)` feed pagination and snapshot-based refresh callback stability.
- Removed a duplicate liked-post ID mapping operation in feed reconciliation.

## Authority boundary
The synchronization bus is not a database and never creates rewards, balances, votes, comments, or durable post state. Server APIs remain authoritative. GET coalescing exists only while an identical request is in flight.

## Verification
- Phase 24: 15/15 PASS
- Phase 23 correlation envelope: 13/13 PASS
- Phase 22 unified activity center: 17/17 PASS
- Phase 21 activity/wallet attribution: 12/12 PASS
- Phase 18 community/notification convergence: 13/13 PASS
- Phase 16 cross-surface integrity: 13/13 PASS

One unrelated Phase 23 Pi screen-review test was not runnable because its expected root review document is not present in this packaged source. This is not reported as a pass.
No Next.js production build/typecheck claim is made without installed dependencies/runtime evidence.
