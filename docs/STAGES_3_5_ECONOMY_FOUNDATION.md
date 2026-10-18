# Stages 3–5 — Economy foundation (2026-10-18)

Built on Stage 2 recovery work. **Fail-closed by default.**

## Stage 3 — Referral programme

| Piece | Detail |
|-------|--------|
| Code per user | `ghc_referral_ensure_code` + `GET /api/referral/code` |
| Attribution | `ghc_referral_attribute` + `POST /api/referral/attribute` (once, no self) |
| Queue | After verified VIP **GHC** membership charge: 5% of **charged** amount |
| Settle | `ghc_settle_referral_reward` only if `GHC_REFERRAL_SETTLEMENT_ENABLED=1` |
| Issuance | `REFERRAL_REWARD_V1` allowed by amended guard; other mints still blocked |

## Stage 4 — Curation redistribution

| Piece | Detail |
|-------|--------|
| RPC | `ghc_curation_redistribute` — debit voter, credit author, same amount |
| Cap | 1 GHC per call at SQL; app can pass less |
| Flag | `GHC_CURATION_REDISTRIBUTE_ENABLED=1` required |
| Net GHC | **Zero mint** — pure redistribution |

## Stage 5 — Fee policy

| Feature | Pilot proposal | Activation |
|---------|----------------|------------|
| Marketplace listing | 5 GHC or 0.05 Pi | `GHC_MARKETPLACE_LISTING_FEE_GHC` / `_PI` |
| Community create | 50 GHC or 0.5 Pi | `GHC_COMMUNITY_CREATE_FEE_GHC` / `_PI` |

Unset env → `ratesApproved: false` (display only, no collection gate).

## Operator enable order

1. Disposable PG apply migrations `202610181500`–`152` + prior Stage 2.x  
2. Run smoke SQL + concurrent tests  
3. Testnet reconcile  
4. Enable referral settlement **only** after queue→settle evidence  
5. Enable curation redistribute with daily voter caps in app  
6. Set fee env only after product approval  

## Non-goals still

Mainnet auto-apply · silent mint · client-supplied prices · durable messaging default on
