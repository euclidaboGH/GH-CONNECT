# Upgrade worklog — 0.331.0

**Scope:** Phase 10.4 measured performance and device-acceptance foundation.

## Changes

- Added a post-build scan of emitted client JavaScript chunks, reporting raw and gzip bytes, largest chunk and the top 20 chunks. Initial aggregate and per-chunk budgets are explicit and configurable.
- Added a machine-readable `docs/performance/latest-js-budget.json` build artifact.
- Added an opt-in mobile Playwright smoke using the shared E2E URL resolver and its production opt-in guard. It records response start, DOMContentLoaded, load, JavaScript transfer, LCP, CLS and long-task count without login or mutation.
- Added a documented Android WebView / Pi Browser acceptance matrix, repeated-sample guidance and explicit performance targets.
- Added contract and runtime tests for budget pass/fail/report behavior.
- Hardened signed-media in-flight cache cleanup so an older request cannot erase a newer same-key request after cache invalidation.
- No dependency added, no database migration, no financial authority change and no production test run.

## Verification

- Phase 10.4 source contract: 8/8.
- Phase 10.4 budget runtime tests: 3/3.
- Existing Phase 10 Settings/performance: 14/14.
- Existing Phase 10 resilience: 17/17.
- Existing Phase 10 navigation/media: 9/9.
- Existing Phase 10 navigation runtime: 7/7.
- Existing service-worker policy: 11/11.

The first targeted Phase 9 release-gate invocation reported 15/16 because its roadmap assertion still expected the old Phase 10 version marker. The roadmap is updated to 0.331.0; rerun that gate and the full static suite before declaring consolidated verification green. The environment currently exposes Node 22.16.0, not the required Node 24.15.0, and has no installed project dependencies. TypeScript, ESLint, Next.js production build, generated bundle measurements, Playwright browser smoke and physical-device acceptance have not been run.

Verification in this release is source-only (source-level contracts and isolated helper tests); it is not a runtime, database or device verification.

## Acceptance status

Phase 10 remains active. This release introduces measurement tooling, not proof of improved runtime speed. Production remains unapproved; all Pi/GHC financial controls remain unchanged.
