# Phase 5 — Product UX release gate (0.313.0)

**Date:** 4 November 2026  
**Baseline:** Phases 1–4 product UX track on GreenHaven 0.312.x lineage  

## Classification

| Label | Status |
|-------|--------|
| SOURCE VERIFIED | Yes — nested contracts + version sync |
| DATABASE APPLIED | **No** — operator must apply `20261104180001` on Testnet |
| RUNTIME VERIFIED | **No** — Preview deploy + smoke is operator-owned |
| TESTNET VERIFIED | **No** — A2U funding / live withdraw not claimed |
| PRODUCTION VERIFIED | **No** — Mainnet blocked |

## Programme map (this track)

| Phase | Focus |
|-------|--------|
| 1 | Story media facade + humanized errors |
| 2 | Discover presence/CTA, Interest, Priority notifs |
| 3 | Communities My membership enrichment |
| 4 | Feed soft-refresh, composer Story, stories single-path |
| 5 | Aggregated gate, version 0.313.0, operator checklist |

## Fail-closed (must remain disabled until explicitly enabled)

- `PI_A2U_ENABLED=0`
- `PI_EARNINGS_PAYOUT_REQUESTS_ENABLED=0` / execution flags
- `GHC_WITHDRAWALS_ENABLED=0`
- Registration bonus / referral settlement / curation redistribute as documented in `.env.example`

## Gate command

```bash
node scripts/check-phase5-product-ux-release-gate-2026-11-04.mjs
```

## Operator next steps

See `docs/OPERATOR_PRODUCT_UX_TESTNET_CHECKLIST_0.313.md`.
