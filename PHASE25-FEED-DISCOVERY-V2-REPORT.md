# GreenHaven Phase 25 — Feed + Discovery Engine V2

## Scope
Cross-surface feed/discovery reliability and ranking hardening. No client-authoritative rewards or economy changes.

## Implemented
- Abortable durable feed reads.
- Generation-based stale-response protection for feed refresh/pagination orchestration.
- Signalled GETs bypass concurrent GET coalescing so cancellation is isolated and deterministic.
- Preserved stable `(before,beforeId)` server cursor pagination and V3 visibility path.
- For You now excludes muted authors as well as blocked authors.
- Added author-diversity guard to prevent one author monopolising consecutive For You positions while preserving ranked order as much as possible.
- Trending explanation now reflects contribution signals (discussion/saves/shares), not raw-like popularity language.
- Corrected Latest ordering to newest-first timestamp semantics.
- Preserved canonical For You / Following / Friends / Communities / Trending lanes.
- Preserved search AbortController stale-request cancellation and Phase 24 post lifecycle reconciliation.
- Preserved offline/online feed state and pull/manual refresh behavior.

## Verification
- Phase 25 Feed + Discovery V2: 13/13 PASS
- Phase 24 Post Surface Convergence: 15/15 PASS
- Phase 23 Correlation Envelope: 13/13 PASS
- Phase 22 Unified Activity Center: 17/17 PASS
- Phase 21 Activity/Wallet Attribution: 12/12 PASS
- Phase 20 Community Comment Convergence: 9/9 PASS
- Phase 18 Community + Notification Convergence: 13/13 PASS
- Phase 16 Cross-Surface Integrity: 13/13 PASS

## Runtime boundary
No production Next.js build/typecheck is claimed unless dependencies are installed and the real runtime/build environment is available.
