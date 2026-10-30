# Phase 4 — PI withdrawal to KYC’d linked Pi wallet

## Goal
Eligible Testnet users request a PI payout. Net amount (after **3%** fee) is reserved for transfer to the **Pi wallet linked at authentication**. Client never invents a paid result.

## Flow
1. **Quote** — `POST /api/economy/earnings/quote` with server-derived amount → gross / fee / net + recipient username.
2. **Request** — `POST /api/economy/earnings/withdrawals` with `amountAtomic` + idempotency key → durable payout request + ledger reservation.
3. **Execute** — operator/worker `POST .../withdrawals/execute` with service secret → A2U transfer, receipt-verified, ledger `paid`.

## Eligibility (server)
- Available / withdrawable balance ≥ min payout
- `piWalletLinked` from `gh_pi_identities` (or equivalent)
- Authorization checks on execute
- `PI_NETWORK=testnet`
- Request gate: `PI_EARNINGS_PAYOUT_REQUESTS_ENABLED=true`
- Execute gate: `PI_EARNINGS_PAYOUT_EXECUTION_ENABLED=true` + `PI_A2U_ENABLED=true` + `PI_A2U_TESTNET_ONLY=true` + credentials

## UI
- Unified earnings dashboard: **Preview 3% fee** → structured quote card → **Withdraw to Pi wallet**
- Destination shows linked `@username` when known
- Steps copy: Preview → Request → Server A2U
- Wallet primary action **Withdraw** (PI rail) scrolls to PI tools

## Acceptance
- [ ] Quote returns fee bps 300 (3%) and linked recipient
- [ ] Request fails closed when flag off (503, no invented success)
- [ ] Request creates reservation; `transferSubmitted: false` until worker
- [ ] Execute is secret-gated and Testnet-only
- [ ] UI never claims “paid” from request alone
- [ ] `check:phase4-pi-withdraw-kyc` passes

## Limits
Source package does not fund A2U or enable Mainnet. Operator must fund Testnet wallet and enable flags after identity verification.
