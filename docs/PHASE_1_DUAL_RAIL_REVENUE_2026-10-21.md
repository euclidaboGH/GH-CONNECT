# Phase 1 — Dual-rail revenue & two-asset wallet (0.65.0)

Aligned with the product audit: **Pi and GHC are separate rails**, not a free exchange.

## Policy (reconciled)

| Rule | Implementation |
|------|----------------|
| No free π↔GHC FX | `ASSET_POLICY.conversionEnabled = false` |
| Dual checkout | Membership, marketplace, fees accept π **or** GHC at independent prices |
| Governed Get GHC | Fixed packs via `/api/economy/purchase-ghc` after Pi intent completes |
| GHC→π | Settlement only when funded/approved flags — not a wallet swap |
| No combined wealth | Wallet shows GHC balance and π payment history separately |

## Wallet (Phase 1)

- **Your Assets**: GHC row + π row
- **Activity** filtered by selected rail
- **Get GHC**: Rewards · Receive · **fixed π packs** from server catalog
- **GH Pay** panel for π memberships/services
- Pack selection stores `productId` for fulfillment after π payment

## Revenue foundation

- Membership activate: `method: "pi" | "ghc"`
- Marketplace orders: pay with GHC ledger or π intent
- Community / listing pilot fees: settle GHC spend or π intent
- Company revenue = verified π receipts + platform fees — GHC spends are ledger utility, not automatic cash

## Phase order (next)

2. **Utility** — expand GHC sinks (boosts, creator tools), issuance dashboard  
3. **Acquisition** — legal/platform review of packs before mainnet scale  
4. **Scale** — seller commissions, funded payouts, analytics  

## Env (testnet)

Same as 0.64.1 unlock + `NEXT_PUBLIC_GHC_BUY_WITH_PI=true` for pack UI.

## Explicit non-goals this phase

- Live market rate swap π↔GHC  
- Advertising GHC as an investment  
- Unfunded GHC→π redemption  
