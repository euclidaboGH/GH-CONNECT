> **LEGACY VERIFICATION FIXTURE — NOT CURRENT PRODUCT AUTHORITY.** This worklog records the completed 0.338.101 RUN372 release and is retained unchanged as historical evidence. The current source version and follow-on work are recorded in `docs/UPGRADE-WORKLOG-0.338.102.md`.

# Upgrade worklog — 0.338.101 RUN372

**Date:** 2026-11-19  
**Baseline:** user-supplied RUN371 Pi CDN Sandbox authentication-fix archive  
**Package identity:** `gh-connect@0.338.101`  
**Scope:** complete operational disconnection of Field Research / Research Studio.

- Set the canonical Field Research service to `UNAVAILABLE` and removed its active destination.
- Removed the special client navigation path into Research Studio.
- Added an edge middleware kill switch for `/api/research/**` and `/api/field/**` (HTTP 503, no-store, stable error code, request correlation ID).
- Added non-disclosing 404 blocking for `/field/**` and `/r/**` before page handlers execute.
- Removed research routes from the public-route allowlist and blocked indexing of the suspended routes.
- Preserved source code, schema files, migration status/history and data; no database changes were made.
- Added RUN372 regression gate (8/8) to static, prebuild, pretypecheck and prelint workflows; reconciled existing route-boundary and service-registry checks.
- Bumped package metadata to `0.338.101`; dependency graph was not changed.

**Targeted verification:** RUN372 isolation 8/8; RUN342 auth-scope isolation 6/6; public-route boundary 12/12; ecosystem registry PASS (42 services / 11 Active / 30 Coming Soon / 1 Unavailable); ecosystem coverage 15/15.

**Limitations:** Full `npm run verify:static`, supported Node 24 typecheck/lint/build and live Pi Browser/Testnet acceptance remain outstanding. This blocks runtime access to Research/Field routes but retains their source in the repository; it does not claim physical removal from the TypeScript/build graph.

No Supabase writes, migration application, GitHub push, Vercel deployment or Mainnet action occurred. Production remains NOT APPROVED.

## Coordinated implementation steps

1. Confirmed the RUN371 archive as the exact source baseline.
2. Audited the ecosystem service registry and canonical release helper.
3. Changed only the Field Research service status to unavailable and removed its destination.
4. Removed the special client-side navigation branch into Research Studio.
5. Added an early middleware block for all Research and Field API prefixes.
6. Added a non-disclosing page-route block for Field Research and public research share links.
7. Removed research/field routes from the public-route allowlist and crawler allow policy.
8. Preserved all research source files, migrations, migration classifications and historical records.
9. Added targeted regression coverage and updated the existing route and service registry tests.
10. Synchronized release metadata, package lock root version and migration inventory manifest.

Source-only verification scope: targeted and full static source regression checks. Full Node.js 24.15.0 dependency-backed typecheck, lint, Next.js production build and browser/device acceptance remain required.
