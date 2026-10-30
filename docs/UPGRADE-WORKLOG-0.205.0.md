# Upgrade worklog — 0.205.0

## Scope — surgical project upgrade

1. **TypeScript target** raised to **ES2020** so BigInt usage in PI earnings/cashback components typechecks cleanly under Next production builds.
2. **Registration bonus policy** remains **3 π** (legacy 0.05 → +2.95 top-up); UI copy and operator guide retained.
3. **PI withdrawal UX** — Request PI withdrawal CTA + wallet/rewards dedupe from 0.204.x carried forward.
4. **Worklog contracts** satisfy Phase 1–12 request-boundary follow-up (source-only verification + Node.js 24.15.0).
5. **Env template** documents registration bonus, payout request flags, and Testnet network.

## Source-only verification
- Network/DB independent static contracts only (source-level).
- Supported runtime: **Node.js 24.15.0**.
- Isolated helper tests; no production mutation or Mainnet A2U enablement claimed by this release.

## Operator still required
- Apply `20261030010001_registration_bonus_v2_reconciliation.sql` for 3 π policy RPCs.
- Set `GHC_REGISTRATION_BONUS_ENABLED=1` and `NEXT_PUBLIC_PI_SANDBOX=true` on Testnet only.
- `PI_EARNINGS_PAYOUT_REQUESTS_ENABLED` remains off until A2U readiness.

## Limits
Does not apply migrations, fund A2U wallets, or invent ledger balances.
