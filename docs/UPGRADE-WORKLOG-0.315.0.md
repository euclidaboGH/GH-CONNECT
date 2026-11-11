# UPGRADE WORKLOG — 0.315.0

**Date:** 2026-11-05

## Source-only verification · Node.js 24.15.0 runtime limitation

Static checks do not prove funded Testnet A2U or Mainnet outgoing-wallet approval.

## Against official Pi A2U docs

GreenHaven already implements the backend lifecycle in `withdrawals/execute`:

1. `createPayment` (amount, memo, metadata, uid)
2. Persist provider payment id
3. `submitPayment`
4. Persist txid
5. `completePayment` + **independent** `getPayment` before ledger settle

Request path reserves funds and requires wallet authorization. Execution is fail-closed until operator flags and funding.

## This release

- `docs/PI_A2U_OFFICIAL_COMPLIANCE_CHECKLIST.md` maps official steps → files.
- **Withdrawal PIN** (6-digit): migration `20261105200001_withdrawal_pin_security.sql`, `/api/identity/withdrawal-pin`, integrated in `PiWithdrawSheet`.
- PIN is **not** sent to Pi Platform and is **not** the wallet seed.

## Operator still required

- Apply PIN migration when ready.
- Configure `PI_API_KEY` + Testnet app wallet seed.
- Fund Testnet outgoing wallet.
- User consent once + PIN + withdraw request.
- Enable request/execution flags only on Testnet with executor key.
