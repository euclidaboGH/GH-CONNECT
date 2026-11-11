# Phase 7 — Marketplace (Buyer, Seller, Orders, Payment)

**Date:** 2026-11-08  
**Baseline:** 0.333.0  
**Release:** 0.334.0  

## Objective

Server-authoritative commerce: inventory reservation, payment claim fencing, honest buyer errors, and no client-trusted price/seller fields.

## Implemented in this increment

1. **Marketplace integrity** — `humanizeMarketplaceOrderError`, `isOwnListingSeller`.
2. **Order create** — per-buyer rate limit; humanized messages for own-buy, stock, variant, idempotency conflicts.
3. **Cart hygiene** — `removeOwnSellerCartItems` strips the viewer’s own listings before checkout UI.
4. **Preserved contracts** — durable reservation RPC authority; client price/seller ignored; payment claim before spend; lifecycle labels; zero stock not coerced.

## Completion register

| # | Workstream | State |
|---:|---|---|
| 1–6 | Feed → Communities | Implemented, awaiting verification |
| 7 | Marketplace | Implemented, awaiting verification |
| 8 | Profile & Matching | Not started |
| 9 | Settings & Filters | Not started |
| 10 | Platform-wide acceptance | Not started |

Production remains **NOT APPROVED**. Live Pi/GHC settlement still requires operator Testnet evidence.
