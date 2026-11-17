# UPGRADE WORKLOG — 0.313.6

**Date:** 2026-11-05

## Scope

Source-only verification on **Node.js 24.15.0** (engine pin). Checks are **source-level** / static contracts and isolated helper tests. They do **not** prove Testnet payout execution, funded A2U, or Supabase apply success.

**Runtime limitation:** live Preview requires operator flags, service-role env, and explicit per-user wallet consent before any withdrawal request. Runtime database apply, live A2U payout, and Mainnet remain operator-owned and are **not** claimed by this release.

## Problem (from live Preview video)

Wallet UI showed **3.00 π**, **Pi identity linked**, and **payout eligible / Eligible to withdraw**, but **Withdraw to Pi wallet** returned `WALLET_AUTHORIZATION_REQUIRED`.

Server JSON confirmed: `hasMapping: true`, `authorizationActive: false`, `consentedAt: null`. The security gate was correct; the UI overstated readiness.

## Fixes

1. **features/wallet/wallet-balance.tsx** — Portfolio reads `walletAuthorization` from `/api/economy/earnings/withdrawable`. “Payout eligible” only when consent is active **and** economy-eligible. Otherwise: “authorize wallet to withdraw”.
2. **components/ghc/unified-earnings-dashboard.tsx** — Banner when consent missing. Primary button labels **Authorize Pi wallet for payouts** and remains tappable without economy-eligible. After verified POST+GET, continues to quote/request. Never treats identity link alone as authorization.
3. **Security** — No change to `assert_payout` / grant RPCs. Consent remains explicit. Execution stays fail-closed.

## Verification boundary

- Checks are source-level / static contracts and isolated helper tests.
- They do not prove Testnet payout execution, funded A2U, or Supabase apply success.
- Runtime limitation: live Preview requires operator flags, service-role env, and explicit per-user wallet consent before any withdrawal request.

## Non-changes

- No bulk authorization, no Mainnet, no `PI_EARNINGS_PAYOUT_EXECUTION_ENABLED` auto-on.
