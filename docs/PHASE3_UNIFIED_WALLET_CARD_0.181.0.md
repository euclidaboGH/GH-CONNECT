# Phase 3 — Unified Wallet Integration 0.181.0

## Scope

This release continues the unified PI earnings + GHC utility wallet from 0.180.0 and hardens the PI balance panel against stale data and unclear payout eligibility.

## Improvements

- The PI earnings panel continues to read only from the authenticated, server-authoritative `/api/economy/earnings/withdrawable` endpoint with caching disabled.
- PI available, withdrawable, pending, and reserved amounts are validated before display. Invalid or unavailable responses fail closed rather than becoming a fabricated zero.
- The panel now reflects server-provided payout eligibility and linked Pi identity status. It does not treat a displayed balance as proof that a payout is authorized or will settle.
- A direct “Refresh PI balance” action allows the user to retry after a failed request.
- PI balance requests have a 10-second timeout and latest-request-wins sequencing. An older response cannot overwrite a newer refresh after network overlap.
- Refresh controls and lifecycle listeners are cleaned up on unmount. Wallet, earnings, and wallet-synced events continue to trigger a read-only refresh.
- PI and GHC remain separate asset rails, balances, and histories. No client-supplied amount can mutate either ledger.

## Verification

- Unified-wallet contract: 13/13 passed.
- Registration bonus: 18/18 passed.
- Wallet cross-feature reconciliation: 32/32 passed.
- Wallet transaction integration: 41/41 passed.
- Payment-intent hardening: 11/11 passed.
- Wallet authorization: 13/13 passed.
- Security headers: 7/7 passed.
- API CSRF contract: 7/7 passed.
- Release hygiene and project-truth checks pass after version/manifest synchronization.
- Production-safety scan: 866 source files scanned, 21 checks passed, 0 failed.

## Explicitly not claimed

The current working environment is Node.js 22.16.0, while this repository requires Node.js 24.15.0 or later, and dependencies are not installed. A supported-runtime TypeScript check, lint, production build, browser/device acceptance, and live Testnet verification have not been completed here. No Supabase migration or deployment has been applied. These are release gates, not implied successes.

## Next Phase 3 work

- Validate the unified card and accessibility on mobile and desktop.
- Run the supported Node 24.15.0 CI pipeline and resolve any compile/lint regressions.
- Verify the balance response against real Testnet ledger data and test refresh behavior after claim, purchase, payment recovery, and payout settlement.
- Keep payout authorization, fee quotes, reservation, A2U receipt verification, settlement, and recovery server-side. Mainnet remains gated.
