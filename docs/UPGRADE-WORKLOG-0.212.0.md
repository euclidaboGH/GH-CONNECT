# Upgrade worklog — 0.212.0

## Phase 5 complete — wallet PI claim & withdraw release gate

- Aggregate static gate: `check:phase5-wallet-release-gate` (nests Phases 1–4 + registration + unified wallet).
- Operator checklist: `docs/OPERATOR_CHECKLIST_WALLET_PI_5PHASE.md`
- Gate doc: `docs/PHASE5_WALLET_RELEASE_GATE.md`
- Fail-closed defaults preserved (bonus, payout requests, A2U execution off; network=testnet).
- Roadmap status markers for Phases 1–4.

## Source-only verification
- Network/DB independent static contracts only (source-level).
- Supported runtime: **Node.js 24.15.0**.
- Live Testnet credit/A2U still requires operator migration, flags, and funding.
