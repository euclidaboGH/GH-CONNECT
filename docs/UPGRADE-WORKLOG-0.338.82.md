# UPGRADE-WORKLOG 0.338.82

## Summary
Enable and solidify gated upgrades from the past 48 hours (0.338.74–0.338.81). Source-only verification. Production remains **NOT APPROVED**.

## Identity
- package.json / package-lock.json / APP_RELEASE_VERSION / VERIFIED_MANIFEST / PROJECT_TRUTH / SOURCE_OF_TRUTH / Phase 1 audit → `0.338.82`.

## Enabled / completed gated upgrades
1. Community pagination cursor strictNullChecks (`undefined` reassignment) retained from 0.338.80.
2. Phase 4 gate patterns retained (`String(cursor.before)`, `nextCursor: cursor`).
3. FB-reference feed visual 3-phase polish retained from 0.338.81.
4. Pass 40 canonical navigation contract retained (Home · Messages · Communities · Cart · Profile).
5. Run 248/269/299/300 release and doc-hygiene contracts retained.
6. Production remains explicitly **NOT APPROVED**.
7. Pi Browser runtime detection expanded (bridge globals, session marker, hostname, referrer, UA).
8. `markPiBrowserRuntime()` persists soft-connect mode for the session.
9. Auth loading screen marks Pi Browser and expands soft-connect message matching (timeout/network/SDK).
10. Sign-in-with-Pi button marks runtime before SDK reinitialize.
11. Reserved-π incomplete withdrawal return path remains wired on earnings + withdraw sheet.
12. Humanized release-reserved error map retained (migration pending, ledger unavailable, rejected).
13. Wallet Phase 7 open-transition and sticky max retained.
14. Cart/wallet surface separation retained.
15. CALLS_PRODUCTION_ENABLED remains false (infrastructure-gated).
16. REMOTE_PUSH_PRODUCTION_ENABLED remains false (infrastructure-gated).
17. Events / Charity / Creator Tools stay Coming Soon fail-closed.
18. Membership rate limits + Pi intent discriminators retained.
19. Messaging 80-char idempotency + body bound retained.
20. Marketplace commission fixed 500 bps retained.
21. Feed reduced-data + media prefetch hard upper bound retained.
22. Notification deep-link sanitize retained.
23. Auth session max concurrent + step-up rotation retained.
24. Global language foundation + Nigerian pilot retained.
25. Regional context coarse location headers retained.
26. Strict Vercel buildCommand + prepare-vercel-build webpack cache eviction retained.
27. Doc hygiene classifies UPGRADE-WORKLOG-0.338.82.md.
28. Repository consistency + jsx-safety + bounded-json retained.
29. Flat GitHub root package for Vercel Root Directory `.`.
30. Release summary updated for 0.338.82 in-app notice.

## Intentionally not enabled
- Live voice/video production calls (`CALLS_PRODUCTION_ENABLED`)
- Remote push production delivery
- Any live database migration application
- Production approval

## Verification notes
Source-level only. Node.js 24.15.0. No live migrations, no real financial transactions. Operator must re-run full static suite and Preview deploy on supported runtime.
