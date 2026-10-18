# Stage 2.1 — Stale marketplace payment-claim recovery

**Date:** 2026-10-18  
**Baseline:** 0.61.1 Stage 2 financial gates package

## Problem

Phase 9.1 keeps `payment_claimed_at` set while payment is in flight so expiry cannot release stock. If payment never resolves, inventory can stay reserved indefinitely.

## Solution (source)

- List stale claims (service_role)
- Force-release claim after minimum age with audit note
- **No** auto-complete payment, **no** GHC mint, **no** silent stock release beyond clearing the claim so the existing expiry worker can run later

## Verification

`npm run test:marketplace-stale-claim` — PASS in packaging environment  
`npm run operator:stage2-gates` — PASS  
Inventory: **91** SQL files after new migration

## Live still required

Disposable PostgreSQL apply + concurrent tests; Testnet ops runbook for force-release.
