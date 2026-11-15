# UPGRADE-WORKLOG 0.338.78

## Blocking fixes
1. Phase 4 community pagination: parameter renamed to `pageCursor`; validated local remains `cursor` so `nextCursor: cursor` and TypeScript stay valid.
2. Run #299: PROJECT_TRUTH includes `Production remains **NOT APPROVED**`.
3. Strict Vercel buildCommand + webpack pack eviction.
4. Doc hygiene classifies all UPGRADE-WORKLOG files.
5. Community engagement normalizeEngagementMetrics.

## 20 upgrades
1. Community post keyset cursor type-safe.
2. Client validates nextCursor before exposing it.
3. Hub load-more cursor contract retained.
4. Explicit production NOT APPROVED in project truth.
5. Run 248 cache-dir unset after prepare.
6. Run 269 SOT package line.
7. Run 300/301 release integrity.
8. Phase 3 creator/media gate retained.
9. Account-scoped drafts exclude blob URLs.
10. Indeterminate upload indicator.
11. Reduced-motion upload animation.
12. Feed account-switch fencing retained.
13. Profile timeline owner fence retained.
14. Membership rate limits retained.
15. Cashback quarterly policy retained.
16. Regional context retained.
17. Global language foundation retained.
18. Events Coming Soon fail-closed retained.
19. Production NOT APPROVED boundary.
20. Flat GitHub root for Vercel `.`.

## Source-only verification
Source-level only. Node.js 24.15.0. Production **NOT APPROVED**.
