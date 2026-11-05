# UPGRADE WORKLOG — 0.313.8

**Date:** 2026-11-05

## Scope

Source-only verification on **Node.js 24.15.0**. Checks are **source-level** / static contracts. They do **not** prove Testnet A2U execution or funded payouts.

**Runtime limitation:** live Preview requires operator flags, service-role env, and **explicit per-user wallet consent** (`POST /api/identity/wallet-authorization`) before any withdrawal request. Mainnet remains disabled.

## Why withdrawals still returned WALLET_AUTHORIZATION_REQUIRED

Server JSON confirmed:

- `hasMapping: true` (Pi identity linked)
- `authorizationActive: false`, `consentedAt: null`, `authorizationId: null`

The payout guard is working. Consent was never recorded. Linking Pi at login is **not** the same as authorizing App-to-User payouts.

## Product fix in this release

1. **PiPayoutAuthorizationCard** is mounted on the Wallet **PI** rail, above the earnings dashboard, so Authorize is visible without Settings.
2. Primary dashboard CTA remains **Authorize Pi wallet for payouts** until GET reports `authorizationActive` + UID match.
3. Portfolio copy does not claim payout-ready without `authorizationActive`.
4. Security gate **not** removed. No bulk authorization. Testnet execution still flag- and funding-gated after consent.

## Operator / user path (Testnet)

1. Deploy this build to Preview.
2. Open Wallet → select **PI**.
3. Tap **Authorize Pi wallet for payouts** once.
4. Confirm GET `/api/identity/wallet-authorization` shows `authorizationActive: true`.
5. Then Preview fee → Withdraw (still subject to Testnet flags and A2U funding).

## Non-changes

- Explicit consent required.
- Payout execution remains separately gated.
- No Mainnet enablement.
