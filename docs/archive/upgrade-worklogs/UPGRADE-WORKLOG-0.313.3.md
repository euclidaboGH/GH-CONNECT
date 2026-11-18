# UPGRADE WORKLOG — 0.313.3

**Date:** 2026-11-05

## Scope

Source-only verification on Node.js 24.15.0 (engine pin). Runtime database apply, live A2U payout, and Mainnet remain operator-owned and are **not** claimed by this release.

## Fixes

1. **message-screen.tsx** — `ghc.following` was used for DM name/photo enrichment but missing from the local `useGHC()` narrow cast, causing a TypeScript production-build failure. Following graph is now included (string IDs or peer records), matching friends/matches/candidates enrichment.
2. **Phase 1–12 acceptance / consolidation baseline** — `docs/PHASE-1-12-SYSTEM-WIDE-ACCEPTANCE.md` identifies current package baseline and audit status for this release.
3. Release truth (package, lockfile, app-release, README, PROJECT_TRUTH, Phase-12 readiness, verified manifest) synchronized to **0.313.3**.

## Verification boundary

- Checks are **source-level** / static contracts and isolated helper tests.
- They do **not** prove Testnet payout execution, funded A2U, or Supabase apply success.
- Runtime limitation: live Preview requires operator flags, service-role env, and explicit per-user wallet consent before any withdrawal request.

## Non-changes

- No bulk wallet authorization.
- No Mainnet enablement.
- No automatic `PI_EARNINGS_PAYOUT_EXECUTION_ENABLED`.
