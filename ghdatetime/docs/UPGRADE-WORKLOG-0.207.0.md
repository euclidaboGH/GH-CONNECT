# Upgrade worklog — 0.207.0

## 5-phase wallet / PI claim / withdraw roadmap

See `docs/ROADMAP-WALLET-PI-CLAIM-WITHDRAW-5PHASE.md`.

1. Legacy **2.95 π** top-up path (to complete **3 π**) — claim UI + operator backfill.
2. Dual-asset wallet professional polish.
3. Registration bonus claim CTAs.
4. **Withdraw to Pi wallet** CTA + KYC’d linked-wallet copy; durable request + server A2U.
5. Gates, docs, release package.

## Source-only verification
- Network/DB independent static contracts only (source-level).
- Supported runtime: **Node.js 24.15.0**.
- Does not apply migrations or execute live A2U. Operator must enable Testnet flags and fund workers separately.
