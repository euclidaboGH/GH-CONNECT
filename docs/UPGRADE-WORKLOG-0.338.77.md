# UPGRADE-WORKLOG 0.338.77

## Blocking / recurring fixes
1. Doc hygiene: auto-classify **all** `docs/UPGRADE-WORKLOG-*.md` into the required set (stops 0.338.73-style unclassified failures on version bumps).
2. Run 248: **strict** `prepare-vercel-build.mjs && unset npm_config_cache_dir NPM_CONFIG_CACHE_DIR && npm run build`.
3. Webpack pack eviction in prepare (targets oversized Vercel restore packs).
4. SOURCE_OF_TRUTH / package / app-release identity `0.338.77`.
5. Community engagement metrics + social `safeNextCursor` TypeScript fixes.
6. Pass 40 canonical nav contract retained.

## 20 upgrades
1. Permanent worklog classification policy (all existing worklogs required).
2. Dated-current allowlist includes 2026-11-15 and 0.338.x bodies.
3. Strict cache-dir unset after prepare.
4. Type-safe community post engagement.
5. Safe community posts keyset cursor.
6. Five-item bottom nav contract.
7. Run 269 ACL / SOT package line.
8. Run 300/301 release integrity retained.
9. Regional context + global language foundation retained.
10. Events discovery Coming Soon fail-closed retained.
11. Phase 6 performance/accessibility retained.
12. Messaging bounded JSON retained.
13. Social upstream timeouts retained.
14. Membership rate limits retained.
15. Withdrawal health read-only probe retained.
16. No browser Supabase credentials.
17. Prebuild diagnostic runner retained.
18. Migration inventory source-only retained.
19. Production NOT APPROVED boundary.
20. Flat GitHub root for Vercel Root Directory `.`.

## Source-only verification
Source-level only. Node.js 24.15.0. Production **NOT APPROVED**.
