# Run #309 — Phase 6 performance and accessibility hardening

**Release candidate:** `0.338.72`  
**Date:** 2026-11-14  
**Derived from:** Run #308 / `0.338.71`  
**Phase:** 6 — Performance, accessibility and release acceptance

## Implementation

1. Profiled the canonical social feed request path and identified serial, independent reads for post visibility, durable preferences and muted-author state.
2. Moved those three independent reads into one `Promise.all` fan-out. The route still blocks delivery unless canonical visibility and mute privacy checks succeed; durable preferences remain an enhancement with the existing account-scoped fallback.
3. Identified a second serial latency chain in public profile hydration: post authors and comment authors were fetched in separate sequential requests despite having independent inputs.
4. Moved post-author and comment-author profile hydration into concurrent bounded batches. The existing 500-row, 12-depth, 100-identity, 1 MiB response and 5-second timeout limits remain intact.
5. Preserved the public profile field allowlist and the existing best-effort identity enrichment boundary.
6. Preserved canonical feed pagination: cursor advancement remains anchored to the last raw server row, not the filtered/hydrated client-visible list.
7. Added `e2e/phase6-performance-accessibility.spec.ts` covering reduced-motion preference, responsive horizontal overflow at 320/360/390/768/1440px, keyboard focus traversal, and assistive-technology announcements for offline/reconnect states.
8. Added `scripts/check-phase6-performance-accessibility.mjs` (21/21) to verify concurrent feed/hydration reads, fail-closed privacy, bounded profile hydration, public-field allowlists, cursor behavior, no-store responses, focus visibility, reduced motion, offline announcements, privacy-safe RUM, Core Web Vitals budgets and E2E coverage.
9. Registered the Phase 6 source gate in `pretypecheck`, `prebuild:checks`, `prelint` and `verify:static`.
10. Bumped synchronized package/lock/app release metadata to `0.338.72` / Run #309.
11. Added the Phase 6 E2E spec to the existing Playwright suite; no test credentials, identities, Pi account or financial state are fabricated.
12. No database migration or schema change was introduced. No wallet, GHC, Pi, blockchain or other financial authority was changed.

## Verification

- Phase 6 performance/accessibility source gate: **21/21 PASS**.
- Existing Phase 5 feed preference and quality tests remain registered and unchanged.
- Full static verification is source-only verification scope; it does not prove a production build or runtime acceptance.
- Playwright browser execution, supported Node 24.15.0 dependency-backed typecheck/lint/build, authenticated two-account E2E, Android/Pi Browser, low-memory device profiling, and Vercel Preview verification require the supported runtime, installed dependencies, actual target environment and authorized test accounts. They are not inferred from source checks.

## Release status

Phase 6 source hardening is implemented, but Phase 6 acceptance is **BLOCKED** on runtime and external evidence: clean Node 24.15.0 install/typecheck/lint/prebuild/build, Playwright browser execution, authenticated cross-account journeys, device/network performance measurements, database/RPC readiness evidence, Vercel Preview runtime/commit alignment and existing release approval. Production remains **NOT APPROVED**. No Supabase migration, GitHub push/PR or Vercel deployment was performed.

## Candidate archive

- Archive: `GREENHAVEN-0.338.72-PHASE6-PERFORMANCE-ACCESSIBILITY-2026-11-14.zip`
- ZIP integrity: PASS; independently extracted archive contains 2,499 files.
