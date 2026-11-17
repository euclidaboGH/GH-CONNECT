# Run #306 — Phase 4 community experience and governance completion

**Release candidate:** `0.338.69`  
**Base:** user-uploaded GREENHAVEN 0.338.67 archive (SHA-256 `85297603f3e67bb67d8a4b689d63e42146f83a69a9922a744bdf753611e93a2e`).

## Twenty coordinated upgrades

1. Replaced the archived board's simplified author/body box with the canonical `EnhancedPostCard` visual renderer.
2. Replaced the legacy discussion's simplified author/body box with the same canonical renderer.
3. Replaced non-member sample-post previews with the same canonical renderer and explicit join-preview state.
4. Added an explicit `readOnly` mode to the shared post renderer for historical and preview-only content.
5. Suppressed post menus in read-only mode so synthetic and legacy IDs cannot trigger management actions.
6. Suppressed social reaction, comment, share and save action bars in read-only mode.
7. Suppressed quality curation and reward panels in read-only mode so historical content cannot enter contribution/reward flows; poll voting and challenge joining are also disabled for archived/sample content.
8. Suppressed engagement roster surfaces in read-only mode while preserving safe media/content presentation.
9. Preserved clear archived/pinned labels instead of presenting historical content as current durable posts.
10. Kept legacy discussion comment expansion available as a separate, explicit legacy interaction where supported.
11. Made pinned discussions sort ahead of unpinned discussions.
12. Kept New sorting chronological with deterministic ID tie-breaking.
13. Implemented Top sorting using reaction, comment and share signals rather than likes alone.
14. Implemented Hot sorting with time decay so it is distinct from Top and New.
15. Kept the current board filter/search pipeline ahead of ranking so user filters remain respected.
16. Reworked announcement cards into semantic articles with restrained type treatment, quiet pinned state and locale-formatted dates; pinned items sort first without hiding unpinned announcements.
17. Changed moderator report resolution to wait for server-confirmed durable persistence before updating local state.
18. Added per-report busy state and disabled concurrent moderator decisions while a report action is pending; failed persistence leaves the report unchanged.
19. Consolidated governance reads/writes onto canonical `gh_community_*` tables and role-rechecking RPCs; moderation appends use `gh_community_moderation_log_append`, the canonical post-card report menu writes through the community report RPC, report create/resolve use canonical RPCs, and the duplicate client-side report mirror was removed.
20. Hardened governance routes with private no-store responses and fail-closed mutation rate limits; added the 19-check Phase 4 completion gate and registered it in pretypecheck, prebuild and static verification.

## Verification evidence

- Phase 4 community completion: **21/21**.
- Community keyset pagination: **12/12**.
- Run #270 community integrity: **53/53**.
- Phase 4 social/community boundaries: **9/9**.
- Community global-standard contracts: **11/11**.
- Priority 7 community transformation: **13/13**.
- Community idempotency contract: **5/5**.
- JSX syntax parsing: **9/9 changed TypeScript/TSX files parsed without diagnostics**.
- JSX safety scan: **1,100 files; no findings**.
- Repository consistency: **6/6** (1,641 source files, zero unresolved imports; package scripts resolve).
- Release integrity: **20/20**.
- Project truth: **11/11**.
- Migration source manifest: **222/222**.
- Full `npm run verify:static`: **4,009 PASS assertions, 0 FAIL assertions**.

## Source-only verification scope and remaining acceptance

This remains a **source-only verification scope**. The available runtime is Node 22.16.0, while `.nvmrc` requires Node 24.15.0; project `node_modules` are not installed. Therefore dependency-backed TypeScript, ESLint, Next.js production build, authenticated browser/mobile tests, and two-account community/moderation acceptance remain outstanding.

Live Supabase observations were read-only. Testnet contains the canonical community tables/RPCs and denies client table access via RLS/grants, but its migration ledger has 40 entries versus 222 repository migration sources and needs full reconciliation. Mainnet's migration ledger returned zero entries and canonical community RPCs were absent; the `public.rls_auto_enable()` SECURITY DEFINER execution grant requires a separate controlled privilege review. No DDL, migration, policy, grant, row, financial state, GitHub push or Vercel deployment was changed. Production remains **NOT APPROVED**.
