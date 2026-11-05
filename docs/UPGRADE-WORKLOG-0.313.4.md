# UPGRADE WORKLOG — 0.313.4

**Date:** 2026-11-05

## Scope

Source-only verification. Runtime database apply, live A2U payout, and Mainnet remain operator-owned.

## Fixes

1. **identity-context.tsx** — `useIdentity()` fallback now implements full `IdentityContextValue` (`matchesUserId`, `getIdentityAliases`), matching the provider value. Prevents TypeScript production-build failure when modules mount outside the provider.
2. **doc hygiene** — Classify `0.313.x` / `2026-11-05` worklogs as current so CI does not fail on legitimate release notes.
3. **lint** — Remove stale unused `@next/next/no-img-element` eslint-disable directives (LazyImage / shared primitives already satisfy the rule).

## Non-changes

- Explicit wallet authorization and payout execution gates unchanged.
- No bulk authorization or Mainnet enablement.
