# Run #310 — Phase 6 performance and accessibility hardening

**Release candidate:** `0.338.73`  
**Date:** 15 November 2026  
**Derived from:** Run #309 / `0.338.72`  
**Phase:** 6 — Performance, accessibility and release acceptance

## Implementation

1. Preserved the existing feed latency work: independent visibility, durable preference and mute reads execute concurrently, while visibility and mute failures remain fail-closed.
2. Preserved bounded concurrent public identity hydration, the public-field allowlist, row/depth/identity/response/time limits and raw-page cursor progression.
3. Replaced the RUM collector's per-surface array of up to 500 layout-shift objects with a constant-memory CLS session-window accumulator. The accumulator retains only the current session window and maximum observed window, so a long-lived tab does not accumulate an ever-growing list or silently stop measuring CLS after a fixed number of entries.
4. Made the batch CLS helper sort entries by start time before calculating session windows, protecting the pure helper from unordered input.
5. Improved bounded INP interaction retention. The previous collector retained the first 200 interaction IDs, which could exclude slower interactions that occurred later in a long session. The new bounded policy keeps the slowest 200 observed interactions and updates a retained interaction with its maximum duration. Memory remains capped while later slow interactions can replace faster early samples.
6. Ordered each layout-shift observer batch by `startTime` before feeding the streaming accumulator.
7. Added regression tests for constant-memory CLS accumulation, out-of-order batch input, and replacement of fast early interactions by slower later interactions.
8. Updated the Phase 6 source gate from 21 to 23 assertions and updated the existing RUM contract check for the new accumulator design.
9. Synchronized package, lockfile and app release metadata to `0.338.73` / Run #310.
10. No database migration or schema change was introduced. No wallet, GHC, Pi payment, settlement, payout or blockchain authority was changed.

## Verification

| Check | Result |
|---|---:|
| Phase 6 performance/accessibility source gate | **23/23 PASS** |
| Core Web Vitals budget and collector helper tests | **16/16 PASS** |
| Privacy-safe RUM source contract | **17/17 PASS** |
| Run #262 build-memory guard | **6/6 PASS** |
| Vercel build hygiene | **17/17 PASS** |
| Run #300 release integrity | **20/20 PASS** |
| Run #301 release-gate hardening | **20/20 PASS** |
| Phase 24 final release review | **PASS** |
| Full `npm run verify:static` | **4,072 PASS / 0 FAIL; exit 0** |

The full static runner completed successfully with 4,072 PASS assertions and zero FAIL assertions. These are source and unit-contract results; they establish source-only verification scope, not a production build or real browser/device acceptance result.

## Environment and remaining acceptance gates

- Available runtime is Node `22.16.0`; Required Node.js 24.15.0 remains the project runtime baseline (`^24.15.0`).
- Dependencies are not installed in this workspace. A dependency-backed TypeScript check, ESLint run and Next.js production build were not performed.
- Playwright browser tests were not executed; only the test source contract was inspected. Authenticated two-account journeys, Android/Pi Browser, low-memory device and constrained-network measurements remain outstanding.
- Supabase inspection remains read-only. No migration was applied and no claim is made that repository migration files are applied to Testnet or Mainnet.
- No GitHub push, pull request, Vercel deployment or production promotion was performed.

## Release decision

**Phase 6 source hardening increment: IMPLEMENTED; targeted checks PASS.**  
**Phase 6 acceptance: NOT ESTABLISHED.**  
**Production: NOT APPROVED.**

## Candidate archive

`GREENHAVEN-0.338.73-PHASE6-PERFORMANCE-ACCESSIBILITY-2026-11-15.zip`
