# Phase 5 — Cashback attribution & reconciliation (0.161.0)

## Goal
Expand cashback beyond marketplace fees only through **explicitly supported** PI revenue sources, with refund/chargeback linkage and period reconciliation before treating liability as settled.

## Supported sources
- marketplace_fee
- membership_revenue
- promotion_revenue
- digital_service_revenue
- creator_tip_revenue (new)
- refund / chargeback (require related eligible positive event)

## Delivered
- Migration `20261029010008_pi_cashback_phase5_attribution_reconcile.sql`
- `attributeCashbackEligibleRevenue` + `reconcileCashbackPeriod`
- `GET /api/economy/rewards/pi-cashback/reconcile` (operator key)
- Rate remains **300 bps** of eligible net

## Not claimed
- Automatic eligibility on every payment
- Remote migration applied
- Live period close / funded liability

## Operator
1. Apply migration after history reconcile on Testnet
2. Set `GHC_OPERATOR_RECONCILE_KEY` (or A2U admin key)
3. `GET .../reconcile?startsAt=&endsAt=` with `x-ghc-operator-key`
