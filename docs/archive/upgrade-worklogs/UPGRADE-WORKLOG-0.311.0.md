# GreenHaven upgrade worklog — 0.311.0

**Date:** 2026-11-04  
**Baseline:** 0.310.0 Phase 24  
**Phase:** 26 — wallet ledger resilience and premium wallet experience

## Implemented

- Added a 10-second bounded request for the authoritative GHC wallet summary.
- Wallet read refreshes now abort superseded requests, clear timeout handles and invalidate in-flight work on provider unmount.
- Unified Pi earnings dashboard refresh now uses a single latest-request-wins controller, a 10-second timeout and deterministic cleanup on unmount/retry/event refresh.
- Reworked the wallet balance surface into a premium active-asset hero with deep emerald/navy and restrained gold accents, separate Pi/GHC rails, available/pending/locked or withdrawable/reserved breakdowns, privacy masking and clear unavailable states.
- GHC is labelled server-confirmed only when the validated wallet snapshot is both `ready` and sourced from the server. A stale/local fallback is not represented as a confirmed financial balance.
- Added `docs/CURRENT_BUILD_CONTEXT.md` as the canonical current product/build brief. Older worklogs and visual references are explicitly historical, not active implementation instructions.
- Added Phase 26 regression gate to `prebuild` and `verify:static`.

## Preserved

No SQL migration was added, removed, rewritten or applied. No GHC minting, Pi conversion, wallet transfer, payment completion, payout execution, escrow release, refund, treasury movement or ledger settlement authority changed. Existing wallet APIs, authorization, account identity and server ledger remain authoritative.

## Verification boundary

The Phase 26 source contract validates bounded reads, request cancellation, latest-request-wins behavior, accurate balance authority labels, separate asset rails, documentation precedence and release-pipeline registration. Source-only checks do not prove a supported-runtime build, live database/provider behavior, browser/device rendering, or production financial acceptance. Node.js 24.15.0 and dependency installation remain required for typecheck, lint and production build. Production remains **NOT APPROVED** pending all external release gates.
