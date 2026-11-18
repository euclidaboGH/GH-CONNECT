# UPGRADE WORKLOG — 0.313.2

**Date:** 2026-11-05

## Scope

Source-only verification on Node.js 24.15.0 (engine pin). Runtime database apply, live A2U payout, and Mainnet remain operator-owned and are **not** claimed by this release.

## Build / CI fixes

1. **communities-screen.tsx** — restored missing `</>` on `CollapsingAppHeader` `secondary` fragment (Vercel SWC syntax error).
2. **wallet-authorization.ts** — corrected trailing-slash strip regex on Supabase URL (`/\/$/` → `/\/$/` as `/\/$/` in source) so the module parses under Next SWC.
3. **docs/PHASE3-UNIFIED-EARNINGS-LEDGER-HARDENING.md** — marked as current 0.313.x engineering note for doc-hygiene gate.
4. **Release baseline sync** — README, PROJECT_TRUTH, PHASE-12 release readiness identify **0.313.2**.

## Verification boundary

- Checks are **source-level** / static contracts and isolated helper tests.
- They do **not** prove Testnet payout execution, funded A2U, or Supabase apply success.
- Runtime limitation: live Preview requires operator flags, service-role env, and explicit per-user wallet consent before any withdrawal request.

## Non-changes

- No bulk wallet authorization.
- No Mainnet enablement.
- No automatic `PI_EARNINGS_PAYOUT_EXECUTION_ENABLED`.
- Withdrawal still requires per-user explicit consent + Testnet flags + funded execution path.
