# Upgrade worklog — 0.211.0

## Phase 4 complete — PI withdraw to KYC’d Pi wallet

- Structured **Withdrawal quote** card (gross / 3% fee / net / destination).
- **Preview 3% fee** + primary **Withdraw to Pi wallet**.
- Request path reserves net; never client-claims paid.
- Execute remains secret-gated, Testnet-only worker.
- Events: wallet + earnings refresh + toast on successful request.
- Doc: `docs/PHASE4_PI_WITHDRAW_KYC.md`
- Contract: `check:phase4-pi-withdraw-kyc`

## Source-only verification
- Network/DB independent static contracts only (source-level).
- Supported runtime: **Node.js 24.15.0**.
- Live A2U requires operator flags, funding, and identity checks.
