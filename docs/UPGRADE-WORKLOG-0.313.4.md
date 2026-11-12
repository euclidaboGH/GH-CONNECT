# UPGRADE WORKLOG — 0.313.4

**Date:** 2026-11-05

## Scope

Source-only verification on **Node.js 24.15.0** (engine pin). Checks are **source-level** / static contracts and isolated helper tests. They do **not** prove Testnet payout execution, funded A2U, or Supabase apply success.

**Runtime limitation:** live Preview requires operator flags, service-role env, and explicit per-user wallet consent before any withdrawal request. Runtime database apply, live A2U payout, and Mainnet remain operator-owned and are **not** claimed by this release.

## Fixes

1. **identity-context.tsx** — `useIdentity()` fallback now implements full `IdentityContextValue` (`matchesUserId`, `getIdentityAliases`), matching the provider value. Prevents TypeScript production-build failure when modules mount outside the provider.
2. **doc hygiene** — Classify `0.313.x` / `2026-11-05` worklogs as current so CI does not fail on legitimate release notes.
3. **lint** — Remove stale unused `@next/next/no-img-element` eslint-disable directives (LazyImage / shared primitives already satisfy the rule).
4. **request-boundary follow-up worklog** — Documents source-only verification and Node.js 24.15.0 runtime limitation required by the Phase 1–12 bounded-write contract.

## Verification boundary

- Checks are source-level / static contracts and isolated helper tests.
- They do not prove Testnet payout execution, funded A2U, or Supabase apply success.
- Runtime limitation: live Preview requires operator flags, service-role env, and explicit per-user wallet consent before any withdrawal request.

## Non-changes

- Explicit wallet authorization and payout execution gates unchanged.
- No bulk authorization or Mainnet enablement.
- No automatic `PI_EARNINGS_PAYOUT_EXECUTION_ENABLED`.
