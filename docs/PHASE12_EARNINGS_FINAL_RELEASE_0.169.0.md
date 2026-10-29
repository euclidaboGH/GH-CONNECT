# Phase 12 — Pi earnings / A2U final source release readiness (0.169.0)

## Status

**NOT APPROVED for production or Mainnet.**

This release consolidates the **source** implementation of Phases 1–11 on the Pi earnings, cashback, and A2U track. It does **not** prove:

- Remote Supabase migrations applied
- Funded Pi Testnet A2U wallet transfer + receipt
- Node 24 production build on CI
- Browser accessibility / multi-account operator acceptance
- Pi Network Mainnet authorization

## Track delivered (source)

| Phase | Focus |
|------:|-------|
| 1 | A2U recovery / attention on unrelated incomplete |
| 2 | Wallet authorization consent |
| 3 | Unified PI earnings ledger |
| 4 | Controlled reward adapters |
| 5 | Cashback attribution + period reconcile |
| 6 | Available balances + **3% withdrawal fee** |
| 7 | Shared A2U orchestration + review queue |
| 8 | Unified earnings dashboard UI |
| 9 | Charity / platform utility segregation |
| 10 | Testnet static gate + live probe script + receipt verify |
| 11 | Cross-feature wallet reconciliation |
| 12 | Final source gate + version alignment |

## Operator checklist (required before claiming “works”)

1. Reconcile migration history; apply `20261029010004`–`20261029010012` on Testnet if missing.
2. Deploy Preview **0.169.0** with Testnet Pi credentials and funded app wallet.
3. `GHC_E2E_ALLOW_TESTNET=1 npm run operator:live-e2e-pi-earnings`
4. Complete one real cashback/A2U claim; verify on-chain Testnet credit matches ledger `paid` + `receipt`.
5. Confirm concurrent claim cannot double-reserve the same entitlement.
6. Explicit human approval before any Mainnet discussion.

## Commands

```bash
node scripts/check-phase12-earnings-final-gate.mjs
npm run operator:live-e2e-pi-earnings   # after deploy + env
```

## Safety

No production database, balances, or migrations are mutated by this gate.
