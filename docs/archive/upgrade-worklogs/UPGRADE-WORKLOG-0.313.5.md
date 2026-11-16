# UPGRADE WORKLOG — 0.313.5

**Date:** 2026-11-05

## Scope

Source-only verification on **Node.js 24.15.0** (engine pin). Checks are **source-level** / static contracts and isolated helper tests. They do **not** prove Testnet payout execution, funded A2U, or Supabase apply success.

**Runtime limitation:** live Preview requires operator flags, service-role env, and explicit per-user wallet consent before any withdrawal request. Runtime database apply, live A2U payout, and Mainnet remain operator-owned and are **not** claimed by this release.

## Fixes

1. **identity-context.tsx** (from 0.313.4) — `useIdentity()` fallback implements full `IdentityContextValue` (`matchesUserId`, `getIdentityAliases`).
2. **doc hygiene** — Classify `0.313.x` / `2026-11-05` worklogs as current.
3. **lint** — Remove stale unused `@next/next/no-img-element` eslint-disable directives.
4. **Phase 1–12 request-boundary follow-up** — Worklog documents source-only verification and Node.js 24.15.0 runtime limitation so `check-phase1-12-request-boundary-followup.mjs` passes.

## Verification boundary

- Checks are source-level / static contracts and isolated helper tests.
- They do not prove Testnet payout execution, funded A2U, or Supabase apply success.
- Runtime limitation: live Preview requires operator flags, service-role env, and explicit per-user wallet consent before any withdrawal request.

## Non-changes

- Explicit wallet authorization and payout execution gates unchanged.
- No bulk authorization or Mainnet enablement.
- No automatic `PI_EARNINGS_PAYOUT_EXECUTION_ENABLED`.
