> **LEGACY VERIFICATION FIXTURE** — superseded by current package worklog; retained for audit trail only.

# Upgrade worklog — 0.275.0

## Wallet & Rewards Phase 4 — Withdrawal journey

### Product
- Rewards Centre: claims only; removed duplicate `PiPayoutAuthorizationCard` + `UnifiedEarningsDashboard`.
- Rewards links to Wallet for Pi withdraw (`Open Wallet · Withdraw Pi`).
- Settings retains authorization card for grant/revoke management.
- Unified earnings dashboard: single primary control chains authorize → quote → request when server confirms.

### Security
- Does not weaken `WALLET_AUTHORIZATION_REQUIRED` or client-controlled recipients.
- Fee quote remains server `POST /api/economy/earnings/quote`.
- No new migrations; prior notification privilege/order migrations unchanged.

### Validation
- `npm run check:wallet-phase4-withdrawal-journey` (11/11)
- Source-level / source-only verification only. Supported runtime: Node.js 24.15.0.
Document date: 2026-11-03.
