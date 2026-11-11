> **LEGACY VERIFICATION FIXTURE** — superseded by current package worklog; retained for audit trail only.

# Upgrade worklog — 0.276.0

## Wallet & Rewards Phase 5 — Release gate

### Integration
- Rewards → Wallet deep link carries `focus: "gh-pi-earnings-tools"`.
- Settings stores `ghc.wallet.focus` in sessionStorage when opening wallet.
- Wallet selects PI rail, PI history rail, and scrolls to withdraw tools.
- Phase 5 gate runs child contracts for phases 1–4.

### Boundaries
- No Mainnet A2U enablement.
- No new financial migrations in this phase.
- Notification 42703 privilege migrations remain separate operator SQL.

### Validation
- `npm run check:wallet-phase5-release-gate`
- Source-level / source-only verification only. Supported runtime: Node.js 24.15.0.
Document date: 2026-11-03.
