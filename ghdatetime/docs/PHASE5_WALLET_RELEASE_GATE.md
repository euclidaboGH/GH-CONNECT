# Phase 5 — Wallet / PI claim & withdraw release gate

## Scope
Integration of Phases 1–4 into a single Testnet-ready source release. **No Mainnet A2U enablement by default.**

| Phase | Deliverable | Status (source) |
|-------|-------------|-----------------|
| 1 | Registration top-up 3 π / 2.95 π legacy | Complete |
| 2 | Dual-asset wallet (PI + GHC) | Complete |
| 3 | PI claim buttons + events | Complete |
| 4 | Withdraw quote → request → execute (Testnet) | Complete |
| 5 | Gates, operator checklist, package | This document |

## Static contracts (must pass)
```
npm run check:phase1-registration-topup
npm run check:phase2-dual-asset-wallet
npm run check:phase3-pi-claim-buttons
npm run check:phase4-pi-withdraw-kyc
npm run check:registration-bonus
npm run check:unified-wallet-card
npm run check:release-hygiene
npm run check:project-truth
npm run check:phase5-wallet-release-gate
```

## Default flags (fail-closed)
| Variable | Default | Live Testnet when ready |
|----------|---------|-------------------------|
| `GHC_REGISTRATION_BONUS_ENABLED` | `0` | `1` |
| `NEXT_PUBLIC_PI_SANDBOX` | unset/false | `true` |
| `PI_NETWORK` | `testnet` | `testnet` |
| `PI_EARNINGS_PAYOUT_REQUESTS_ENABLED` | `0` / not `true` | `true` |
| `PI_EARNINGS_PAYOUT_EXECUTION_ENABLED` | `0` | `true` (worker only) |
| `PI_A2U_ENABLED` | `0` | `true` (worker only) |
| `PI_A2U_TESTNET_ONLY` | `1` | `1` |

Mainnet A2U must remain disabled unless a separate, reviewed Mainnet gate is completed.

## Operator checklist (Testnet)
1. [ ] Apply `supabase/migrations/20261030010001_registration_bonus_v2_reconciliation.sql`
2. [ ] Confirm Node **24.15.0** on CI/deploy
3. [ ] Set registration bonus flags + sandbox + redeploy
4. [ ] Legacy user: Wallet → claim remaining 2.95 π (or backfill SQL after preview)
5. [ ] Verify ledger: v1 (500000) + v2_topup (29500000) **or** single v2 (30000000)
6. [ ] Confirm min payout threshold understood before enabling requests
7. [ ] Fund Testnet A2U wallet; verify linked KYC’d Pi identity
8. [ ] Enable `PI_EARNINGS_PAYOUT_REQUESTS_ENABLED=true` only on Testnet
9. [ ] Eligible user: Preview 3% fee → Withdraw to Pi wallet → request reserved
10. [ ] Worker: execute with service secret; receipt-verified; ledger `paid`
11. [ ] Confirm client never shows paid from request-only response
12. [ ] Do **not** set Mainnet execution flags in this release

## Acceptance
- All Phase 1–5 static contracts pass on source tree
- `.env.example` remains fail-closed for payouts and bonus
- Package contains migration, docs PHASE1–5, roadmap
- No secrets in tree; lockfile present

## Limits
Source verification is **not** proof of live A2U or credited balances. Operator DB + flags + funding are required for production-like Testnet proof.
