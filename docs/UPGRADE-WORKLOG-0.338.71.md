# Run #308 — Phase 5 durable feed preferences and server enforcement

**Release candidate:** `0.338.71`  
**Date:** 2026-11-14  
**Derived from:** Run #307 / `0.338.70`  
**Phase:** 5 — Feed quality, discovery and user control

## Implementation

1. Added `gh_feed_preferences`, keyed by authenticated user ID, to persist hidden post IDs, less-relevant post IDs, muted topics, feed lane, location lane, intention bias and focus mode.
2. Enabled RLS with an explicit deny-all browser policy; revoked all table privileges from `PUBLIC`, `anon` and `authenticated`; granted table access only to `service_role`.
3. Added `gh_feed_preferences_get` and `gh_feed_preferences_set` SECURITY DEFINER RPCs with fixed `search_path`, bounded payload collections, input validation and service-role-only execution.
4. Added `lib/server/feed/preferences-store.ts` as the sole server RPC adapter for durable feed preferences.
5. Added authenticated GET/PUT `/api/social/feed/preferences` routes. Identity is always derived from the authenticated session; user IDs are never accepted from request bodies. Requests are rate-limited, writes are bounded to 24 KiB, and preference enums/IDs/Unicode topics are validated.
6. Updated the Feed client to hydrate from the account's server snapshot, import existing device-local preferences when the server has no row, and debounce subsequent saves. Reads and writes are fenced to the initiating account. The UI reports cross-device sync only after a durable server response; on API/migration failure it accurately reports device-only state.
7. Updated the canonical feed route to apply durable hidden-post, less-relevant-post and muted-topic preferences when the preference service is available. The cursor remains based on the raw canonical RPC page so filtered rows cannot cause pagination loops or repeated pages. Client-side controls remain active as an offline fallback.
8. Improved Unicode topic matching so underscore and hyphen separators are normalized consistently in content and topic phrases.
9. Added `check-phase5-feed-preferences.mjs` (13/13) and `test-phase5-feed-preferences.mjs`; registered both in `pretypecheck`, `prebuild:checks` and `verify:static`.
10. Bumped package/app release metadata to `0.338.71` / Run #308 and updated current source-of-truth, project-truth, roadmap and release documentation.
11. Preserved the user's prior local feed settings during first-time server-store adoption when no durable row exists.
12. Normalized hidden and less-relevant post identifiers, deduplicated values and bounded each collection to 200 IDs.
13. Normalized muted topics with NFKC and locale-aware lowercase handling while retaining Unicode combining marks.
14. Added API allowlists for feed mode, location lane and intention-bias values; unknown values are rejected rather than silently persisted.
15. Rejected malformed, primitive, oversized and over-limit preference payloads before any privileged RPC call.
16. Added per-account durable read/write rate limits with deny-on-rate-limit-service-unavailable behavior.
17. Ensured client request bodies cannot choose the account identifier; the authenticated session remains the only identity authority.
18. Added a 500 ms client save debounce to coalesce rapid filter and topic-control changes and reduce write amplification.
19. Fenced delayed preference writes and responses with both an owner check and a monotonically increasing request generation.
20. Kept device-local cached values as an offline fallback without misreporting them as cross-device durable state.
21. Updated the generated migration checklist, verified source manifest and Testnet apply-order inventory to 223 migration sources; the new migration remains REVIEW_REQUIRED.

GHC and Pi remain separate rails and ledgers; Phase 5 feed preferences do not alter either financial authority.

## Migration and safety boundary

Migration `supabase/migrations/20261114100001_gh_feed_preferences_durable.sql` is included in the source archive and added to `MIGRATION-SOURCE-MANIFEST.csv` as `REVIEW_REQUIRED`. It has **not** been applied. The repository contains substantially more migration sources than the previously inspected live migration ledger, and Testnet/Mainnet exact migration history still requires reconciliation. Do not apply this migration in isolation or bulk-replay the source tree. No live Supabase schema/data, wallet, GHC or Pi financial state was changed.

## Verification in this workspace

- Phase 5 durable preference source contract: **13/13 PASS**.
- Phase 5 durable preference runtime tests: **PASS** (account-scoped exclusions, Unicode topic matching, whole-token safety).
- Phase 5 feed-quality runtime tests: **PASS**.
- Full `npm run verify:static`: **PASS, 63/63 child suites, 4,047 PASS lines, zero FAIL lines**. This is source-only verification scope and source/static evidence only; the source workspace has no installed project dependencies and uses Node 22.16.0 while the project requires Node.js 24.15.0.
- Changed-file TypeScript/TSX parser validation: **7/7 PASS**. Dependency-backed TypeScript typecheck, ESLint, Next.js production build, PostgreSQL migration execution, authenticated two-account browser/device tests and performance baselines: **not run**.

## Release status

Phase 5 source implementation is complete. External release acceptance remains open pending exact migration-history reconciliation, review/application and postflight of the new migration, supported Node 24.15.0 typecheck/lint/build, and authenticated browser/Android/Pi Browser/two-account validation. No GitHub push, pull request or Vercel deployment occurred. **Production is NOT APPROVED.**
