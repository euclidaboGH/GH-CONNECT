# Run #307 — Phase 5 feed quality, discovery and user-control hardening

**Release candidate:** `0.338.70`  
**Base:** Run #306 / `0.338.69`, derived from the user-uploaded 0.338.67 archive (SHA-256 `85297603f3e67bb67d8a4b689d63e42146f83a69a9922a744bdf753611e93a2e`).

## Twenty-one coordinated upgrades implemented in this source increment

1. Extracted reusable, pure feed primitives for topic parsing, interest relevance, chronological ordering and cursor progression.
2. Made hashtag parsing Unicode-aware for global scripts rather than ASCII-only word characters.
3. Added Unicode combining-mark support so decomposed accented topic names are not truncated.
4. Normalized tags with NFKC and locale-aware lowercasing before matching.
5. Preserved underscore-based topic identifiers while normalizing natural-language interests separately.
6. Replaced substring-based interest matching with whole-word and phrase-boundary matching.
7. Deduplicated normalized interest inputs so repeated profile interests cannot multiply a post's relevance score.
8. Capped each post's interest boosts to three distinct matched interests.
9. Applied whole-term matching to user-selected intention bias to avoid false positives such as “work” inside “network”.
10. Improved recommendation explanations to identify the matched interest or measured contribution signal.
11. Removed the unsupported “rising engagement” explanation when only static engagement totals are known.
12. Unified ranking tie-breaks with the canonical `createdAt DESC, id DESC` feed order.
13. Added an explicit pure helper for comparing server-issued keyset cursors in the canonical descending order.
14. Required append cursors to move strictly older, not merely differ from the previous cursor.
15. Fixed the short-final-page defect so newly fetched posts are revealed even when no next cursor remains.
16. Synchronized Load more availability with server cursors after mount, manual, focus, soft and recovery refreshes.
17. Removed the duplicate manual refresh dispatch that competed with the direct request and could supersede it.
18. Fenced Load more UI commits to the active account/request generation and reset pagination when the account changes.
19. Removed the duplicate global hidden-post storage write that could carry a preference across accounts on a shared device; the feed surface remains the single owner of account-scoped device preferences and labels their non-durable scope honestly.
20. Added a compact preference summary and a one-tap reset for hidden posts, not-interested IDs, muted topics and feed ranking controls so users can recover from accidental filtering.
21. Registered focused Phase 5 source/runtime gates in `pretypecheck`, `prebuild:checks` and `verify:static`, and synchronized release truth/documentation for 0.338.70.

## Deliberately not implemented without database reconciliation

- The current migration sources do not contain a canonical durable post-hide / not-interested / muted-topic preference store. The existing user mute and block controls do have durable authenticated server routes and canonical RPCs; these remain in force.
- No table, RPC, RLS policy or migration was invented for feed preferences. The project requires exact target migration-history reconciliation before introducing/applying schema changes. Post hides, not-interested IDs, topic mutes and tuning preferences therefore remain account-scoped on the current device; UI copy must not imply cross-device durability.
- Discovery candidate ranking and its privacy filtering remain server-owned at the candidate RPC boundary. No new public profile fields or sensitive ranking signals were introduced.

## Verification

- Phase 5 feed-quality source contract: **25/25**.
- Phase 5 feed-quality runtime tests: **PASS** for Unicode tags, combining marks, whole-interest matching, bounded boosts, deterministic chronological comparator and strict cursor monotonicity.
- Phase II feed controls/performance: **29/29**; Phase II feed safety: **12/12**; canonical feed keyset: **9/9**; Phase 1 feed product transformation: **12/12**; Run #272 feed/profile integrity: **48/48**; section-refresh hardening: **12/12**.
- Phase 4 community completion: **21/21**; community pagination: **12/12**.
- Run #300 release integrity: **20/20**; Run #301 release-gate hardening: **20/20**; Phase 1–12 consolidation: **24/24**; systematic upgrade audit: **8/8**; project truth: **11/11**; migration source inventory: **222/222**; documentation hygiene: **PASS**.
- Full `npm run verify:static`: **63/63 child suites**, **4,034 PASS lines**, **0 FAIL lines**.
- Global TypeScript `transpileModule` syntax parsing: **4/4 changed TS/TSX files**, zero syntax diagnostics.
- This is a source-only verification scope. Node 22.16.0 is below the project's pinned Node 24.15.0; dependencies are not installed in this environment. Dependency-backed typecheck, ESLint and Next.js production build remain blocked, as do authenticated browser/device and two-account acceptance.
- No Supabase migration, DDL, RLS/grant change, financial operation, GitHub push or Vercel deployment was performed. Production remains **NOT APPROVED**.
