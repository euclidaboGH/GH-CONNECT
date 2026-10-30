# Upgrade worklog — 0.204.1

## Change
Registration bonus policy confirmed at **3 π** (not 0.05 π).

- New users: full 3 π credit
- Single known legacy 0.05 π claimant: claim remaining **2.95 π** via idempotent top-up
- UI clarifies policy total and remaining amount
- Operator guide: `docs/OPERATOR_REGISTRATION_BONUS_3PI.md`

## Limits
Requires migration `20261030010001_registration_bonus_v2_reconciliation.sql` applied on Testnet DB. Without it, live ledger may still only show the historical 0.05 π credit.


## Source-only verification
- Network/DB independent static contracts only (source-level).
- Supported runtime: **Node.js 24.15.0**.
- Isolated helper tests where applicable; no production mutation claimed.
