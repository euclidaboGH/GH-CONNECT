# Phase 11 — Cross-feature wallet reconciliation (0.168.0)

## Goal
Read-only composition of GHC vs PI rails, PI earnings withdrawable, charity segregation, and pointers to payment-intent reconciliation. No invented balances.

## Delivered
- `lib/server/economy/cross-feature-reconcile.ts`
- `GET /api/economy/wallet/cross-reconcile` (authenticated)
- Dashboard attention findings from cross-reconcile
- Live E2E probe when cookie present

## Related
- `/api/payments/reconciliation` — Pi intents ↔ marketplace/membership
- `/api/economy/earnings/withdrawable` — PI earnings authority
- `/api/economy/earnings/charity` — non-withdrawable gifts

## Not claimed
- Full GHC ledger row-by-row vs PI mathematical identity
- Live funded A2U receipt
