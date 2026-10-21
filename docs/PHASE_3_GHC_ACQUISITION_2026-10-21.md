# Phase 3 — Governed Pi → GHC acquisition (0.67.0)

## Product definition

**Not an exchange.** Users buy a **fixed utility pack**: pay a fixed π amount, receive a fixed GHC credit after server verification.

| Product | π | GHC |
|---------|---|-----|
| ghc_pack_10 | 0.5 | 10 |
| ghc_pack_50 | 2 | 50 |
| ghc_pack_100 | 3.5 | 100 |
| ghc_pack_250 | 8 | 250 |
| ghc_pack_500 | 15 | 500 |

## Flow

1. `POST /api/economy/packs/intent` `{ productId }` → durable intent (amount from catalog)
2. User completes Pi payment (GH Pay / Pi Browser)
3. `POST /api/payments/fulfill` **or** `POST /api/economy/purchase-ghc` → idempotent ledger credit
4. Wallet available balance increases

## Controls

- Feature flag: `GHC_BUY_WITH_PI_ENABLED` or `GHC_TESTNET_UNLOCK`
- Rate limits + daily pack caps (`GHC_PACK_MAX_PER_DAY`, default 5)
- Amount must match catalog exactly
- Credit RPC `ghc_credit_pack_purchase` (migration 202610210002)
- Free π↔GHC FX remains **disabled** in `ASSET_POLICY`

## Operator

- Apply `ghc_credit_pack_purchase` migration
- Pi sandbox keys for testnet
- Optional: `GHC_PACK_MAX_PER_DAY`, `GHC_PACK_MAX_GHC_PER_DAY`

## Explicit non-goals

- Live market rate
- GHC→π redemption without funded settlement product
- Client-invented pack sizes
