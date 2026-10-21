# Phase 4 — Scale: commissions, payouts, monitoring (0.68.0)

## Goals

- Transparent marketplace platform fee (bps)
- Seller/creator payout eligibility (hold, identity, caps)
- Operator scale + revenue policy APIs
- Refund window rules
- Keep GHC utility separate from company revenue journal

## Marketplace commission

- Env: `GHC_MARKETPLACE_PLATFORM_FEE_BPS` (default **500** = 5%)
- Helper: `splitMarketplaceCommission({ grossAmount, currency })`
- Company fee → `appendVerifiedCompanyRevenueEvent` after verified payment
- Seller proceeds → payout eligibility, not instant A2U

## Payout eligibility

- Seller hold: `GHC_SELLER_PAYOUT_HOLD_DAYS` (default **3**)
- Max single A2U: `GHC_A2U_MAX_SINGLE_PI` (default **100**)
- GHC cannot be A2U’d — internal ledger only
- Pi identity required for π seller payouts
- Existing A2U routes remain privileged (`x-ghc-a2u-admin-key`)

## Monitoring APIs

| Route | Auth | Purpose |
|-------|------|---------|
| `GET /api/economy/scale` | optional | Issuance caps, sinks, packs, commission & payout policy |
| `GET /api/admin/revenue-summary` | `x-ghc-admin-key` = `GHC_ADMIN_API_KEY` or `GHC_A2U_ADMIN_KEY` | Operator commerce summary |

## Refunds

- `evaluateMarketplaceRefund` — 72h buyer self-serve window after completion (configurable)
- No client-invented balances

## Operator env (Vercel, private)

```
GHC_MARKETPLACE_PLATFORM_FEE_BPS=500
GHC_SELLER_PAYOUT_HOLD_DAYS=3
GHC_A2U_MAX_SINGLE_PI=100
GHC_ADMIN_API_KEY=<long random>
# existing A2U key still used for payout execution
GHC_A2U_ADMIN_KEY=<long random>
```

## Explicit non-goals

- Automatic mainnet A2U without admin + funded treasury process
- Free GHC→π redemption
