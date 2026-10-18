# Massive upgrade — Stages 2 complete + Stages 3–5 foundation

**Date:** 2026-10-18  
**Baseline:** 0.61.1 Stage 2.3 transfer orphan package  

## Why this pass

Previous Stage 2 slices (payment claim, membership orphan, transfer pair) were necessary but narrow. This package adds the **product economy spine** from the approved roadmap while remaining **fail-closed**.

## Delivered

### Stage 2 (carried forward)
Financial gates, stale marketplace claim recovery, membership orphan complete, transfer pair complete.

### Stage 3 Referral
Schema, ensure/attribute/queue/settle RPCs, APIs, membership-activate queue hook, settlement flag **OFF**.

### Stage 4 Curation redistribute
Balance-funded debit→credit RPC, flag **OFF**, issuance guard allows pair only.

### Stage 5 Fees
Pilot fee policy module; collection only when env rates approved.

### Issuance guard
Daily Claim + `REFERRAL_REWARD_V1` + verified redistribution; still blocks generic earned mint.

## Verification (this environment)

- `npm run test:stage3-5-economy` PASS  
- `npm run operator:stage2-gates` PASS  
- Migration inventory **96** files  

## Not verified live

npm ci / production build · disposable Postgres · Testnet settlement · Pi Browser E2E  
