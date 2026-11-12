# UPGRADE WORKLOG — 0.313.7

**Date:** 2026-11-05

## Scope

Source-only verification on **Node.js 24.15.0** (engine pin). Checks are **source-level** / static contracts and isolated helper tests. They do **not** prove Testnet payout execution, funded A2U, or Supabase apply success.

**Runtime limitation:** live Preview requires operator flags, service-role env, and explicit per-user wallet consent before any withdrawal request. Runtime database apply, live A2U payout, and Mainnet remain operator-owned and are **not** claimed by this release.

## Fixes

1. **Unified wallet card regression** — `piSnapshot.eligible` is again the **server** `data.eligible` boolean (economy/policy). Display honesty uses `authorizationActive` + `piSnapshot.eligible` so the portfolio never says “payout eligible” without consent, while `check-unified-wallet-card.mjs` stays green.
2. **Carries 0.313.6** — authorize-first banner and primary CTA on the earnings dashboard; withdraw path still requires verified consent.

## Verification boundary

- Checks are source-level / static contracts and isolated helper tests.
- They do not prove Testnet payout execution, funded A2U, or Supabase apply success.
- Runtime limitation: live Preview requires operator flags, service-role env, and explicit per-user wallet consent before any withdrawal request.

## Non-changes

- Explicit wallet authorization and payout execution gates unchanged.
- No bulk authorization or Mainnet enablement.
