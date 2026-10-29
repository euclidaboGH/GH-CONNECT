# Upgrade worklog — 0.179.0

## Scope
One-time **0.05 π registration bonus** for authenticated users (server ledger credit, claim UI on Wallet + Rewards).

## Source-only verification
- Network/DB independent static contracts only.
- Supported runtime: **Node.js 24.15.0**.

## Behaviour
- Amount and unique_ref derived server-side (`registration_bonus:v1:{userId}`).
- Credits unified earnings ledger as `available` / source_kind `system`.
- Idempotent; disable with `GHC_REGISTRATION_BONUS_ENABLED=0`.
- Does not invent balances when ledger is unavailable.

## Limits
Does not prove Testnet apply, funded A2U, or production readiness.
