# GH-CONNECT — Phase 2 Pi Wallet Action & Eligibility Upgrade

Date: 2026-11-02  
Baseline: `0.274.3` + Phase 1.1 Pi identity reconnect/results hardening.  
Scope: Pi wallet action navigation, identity controls, eligibility visibility, and withdrawal feedback.

## Implemented

- Renamed Pi action hints so the balance-card withdrawal action is clearly navigation to the one authoritative payout workflow, not a second independent payout implementation.
- Renamed the misleading `Status` and `Linked` actions to `Eligibility` and `Identity`.
- Added dedicated client events connecting the wallet-card controls to the dashboard's eligibility, identity, and payout modules.
- Added an expandable identity module with an explicit reconnect/verify action, current linked-account status, and explanation that identity, payout consent, and eligibility are separate controls.
- Added an expandable eligibility/status module showing the server's eligibility result, server-provided reason codes, identity linkage, payout authorization, withdrawable amount, minimum payout, and deployment-gate guidance.
- Changed withdrawal action handling so missing identity or ineligibility produces an actionable message and opens the corresponding status module instead of leaving a disabled-looking button without explanation.
- Preserved the existing authoritative quote, consent, withdrawal-request, idempotency, server identity mapping, and ledger-history flows.
- Added a static regression checker and registered it in `prebuild` and `verify:static`.

## Safety boundaries

- No payout flag was enabled and no authorization gate was bypassed.
- No database migration or live payment was executed.
- A client-side identity handshake is not treated as server verification; Phase 1.1 verification requirements remain in place.
- `eligible=true` does not by itself mean payouts are enabled: payout intake and Testnet execution are separate deployment/operator gates.

## Verification

Run `node scripts/check-phase2-pi-wallet-actions.mjs` plus the existing Phase 1 identity, wallet authorization, earnings dashboard, and wallet-refresh checkers. These are source-contract checks only. Full typecheck, lint, production build, live Pi Browser authentication, and Testnet payout E2E must be completed in the project's supported Node 24.15.0 environment before release.
