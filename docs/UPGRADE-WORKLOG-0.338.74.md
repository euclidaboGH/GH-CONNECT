# UPGRADE-WORKLOG 0.338.74

## Build fixes
1. Community canonical post card engagement uses `normalizeEngagementMetrics` (required numbers).
2. `lib/social/client.ts` duplicate `cursor` identifier renamed to `safeNextCursor`.
3. Pass 40: PROJECT_TRUTH canonical navigation `Home · Messages · Communities · Cart · Profile`.
4. normalizeEngagementMetrics explicit return type.

## 20 upgrades (source-level)
1. Engagement metrics always full numbers on community cards.
2. Safe community post pagination cursor validation.
3. Canonical five-item nav contract documented.
4. Fail-soft Vercel prepare retained.
5. Community post surface shares Feed engagement bus.
6. Reaction broadcast carries likeCount when server returns it.
7. Type-safe PostEngagementMetrics on merge.
8. Cursor regex bound for beforeId.
9. nextCursor null when invalid.
10. Render post engagement override no longer spreads partials.
11. PROJECT_TRUTH version identity.
12. Manifest project_version sync.
13. App release version sync.
14. Phase 24 readiness baseline identity.
15. Request-boundary worklog source-only.
16. Doc hygiene worklog classification entry.
17. Community list posts keyset cursor stability.
18. No invented engagement totals.
19. Wallet remains overlay (not bottom nav).
20. Production remains NOT APPROVED.

## Source-only verification
Node.js 24.15.0. Source-level only. Production **NOT APPROVED**.
