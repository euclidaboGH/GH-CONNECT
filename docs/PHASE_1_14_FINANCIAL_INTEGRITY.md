# Financial Integrity Pass — Source

**Result:** PASS (no additional source defects requiring code change)

## Mutation inventory (summary)

| Operation | Server authoritative | Auth/ownership | Idempotent | Ledger/RPC |
|-----------|---------------------|----------------|------------|------------|
| Daily claim | Yes (void client amounts) | session | Yes (day key) | ghc_execute_daily_claim_v12 |
| Transfer | Yes (sender=session) | session; void body userId | referenceId | ghc_execute_transfer |
| Spend | Catalog amount | session + step-up | referenceId | ghc_execute_spend |
| Admin credit | Cap + key | timing-safe admin key | referenceId | memory only / DB 503 |
| Marketplace pay | order.totalAmount | buyer=session | market_order_{id} | spend RPC |
| Membership Pi | intent ownership | session + COMPLETED | purchaseRef | grantEntitlement |
| Membership GHC | catalog spend | session | purchaseRef | spend + grant |
| Payment complete | intent ownership | session | COMPLETED status | intent store |
| Withdrawal create | server balance | session | client key | lock + request |
| Withdrawal ops | operator ids | GH_WITHDRAWAL_OPERATOR_IDS | status machine | no auto Pi |
| Tips | intent only | session | tip key | **no ledger** |
| A2U | admin key + seed | gated | n/a | disabled without seed |
| Staking | GET signal | session | n/a | no balance mutation |
| Messaging premium | catalog spend | session | referenceId | spend |

## Double-credit analysis
Major paths use referenceId / purchaseRef / day key / COMPLETED status / order status recovery.

## Client authority
Derived balance from ledger txs is display/cache. Production Vercel blocks memory financial authority when DB configured. HTTP economy forced same-origin `/api`.

## Migrations
54 unchanged. Phase 15 NOT STARTED.
