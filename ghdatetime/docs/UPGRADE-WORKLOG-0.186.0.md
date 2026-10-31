# GreenHaven v0.186.0 — Phase 1–4 audit hardening

## Scope
This release continues the Phase 1–4 system audit on top of v0.185.0. It hardens the dedicated Pi Testnet general-earnings execution worker without changing the reward policy, ledger accounting model, payout fee policy, identity model, or branding.

## Changes
- Bounded the execution endpoint request body to 8 KiB.
- Added a service-role-only execution heartbeat RPC.
- Extended worker leases to ten minutes and refreshes them every 45 seconds while the provider workflow is active.
- The heartbeat refuses to revive expired or replaced leases; lease loss causes the worker to retain the reservation as uncertain.
- Recovery now skips `completePayment` when the provider already reports developer completion, then independently reads the receipt before settlement.
- Added static regression assertions for these boundaries.

## Verification status
- Static verification is run separately and reported in the delivery notes.
- PostgreSQL failure-injection and true concurrent-session tests are not claimed unless run against a disposable PostgreSQL instance.
- Node.js 24 production build and authenticated Pi Testnet payout lifecycle are not claimed unless executed in their required environments.
- Mainnet payout execution remains disabled.

The available audit runtime is Node.js 22.16.0; the project requires Node.js 24.15.0. Therefore the work performed here is source-level verification only, not a Node.js 24 production build.
