# Stage 2 — Database & Financial Integrity

**Baseline:** GH-CONNECT 0.61.1 Phase 1 audit-repair candidate  
**Updated:** 2026-10-18  

## Scope

Source tooling and review order for financial migrations. **No** bulk apply. **No** referral mint. **No** curation redistribution go-live. **No** fee collection go-live. Finite-stock production sales stay **disabled**.

## Preconditions

- [x] Stage 1 inventory (90 files) + messaging durable default off  
- [ ] Operator: `npm ci --legacy-peer-deps` + typecheck + lint + build  
- [ ] Testnet migration history export  
- [ ] Mainnet migration history export (separate)

## Source commands

```bash
node scripts/operator-stage2-financial-gates.mjs
node scripts/test-stage2-source-gates.mjs
node scripts/generate-migration-inventory.mjs --check
node scripts/operator-multiuser-migrations.mjs
```

## Disposable PostgreSQL

1. Create empty database.  
2. Apply **reviewed** REQUIRED migrations in dependency order (do not dump all 90 blindly).  
3. Run `scripts/operator-sql-stage2-smoke.sql`.  
4. Exercise:
   - Daily Claim → 48h pending → redeem  
   - `ghc_purchase_membership` success + forced entitlement failure (debit must roll back)  
   - Two buyers / last unit reservation  
   - Payment claim active → expiry must **not** release stock  
   - Ambiguous payment → reservation held until operator recovery  

## GHC issuance rule (until Stage 3)

Only **Daily Claim** may issue new user-available GHC in the current guard.  
Referral 5% path requires a **dedicated** issuance amendment later — not a generic credit reopen.

## Explicit non-goals

Referral rewards · funded curation · marketplace/community fees · Mainnet apply · durable messaging default on


## Stage 2.1 — Stale payment-claim recovery

Migration: `20261022010081_marketplace_stale_payment_claim_recovery.sql`

| RPC | Purpose |
|-----|---------|
| `gh_marketplace_list_stale_payment_claims` | Inspect claims older than N minutes |
| `gh_marketplace_force_release_stale_payment_claim` | Ops clear claim after min age; **does not** mark paid |

Server helpers: `listStalePaymentClaims`, `forceReleaseStalePaymentClaim` in `lib/server/marketplace/order-store.ts`.

**Policy:** Prefer holding inventory on ambiguous payment over releasing stock while money may have moved. Force-release only after provider confirmation of failure/absence.


## Stage 2.2 — Orphaned membership purchase recovery

Migration: `20261022010082_membership_orphaned_purchase_recovery.sql`

When `ghc_purchase_membership` finds an **idempotent spend** without matching `purchase_ref` entitlement, it returns `MEMBERSHIP_PURCHASE_RECONCILIATION_REQUIRED` instead of granting again.

| RPC | Purpose |
|-----|---------|
| `ghc_membership_list_orphan_purchase_candidates` | Heuristic list of PREMIUM spends without entitlement |
| `ghc_membership_complete_orphaned_purchase` | Grant entitlement **only** if matching posted debit exists; **never** spends again |

Server: `listOrphanMembershipPurchaseCandidates`, `completeOrphanedMembershipPurchase` in `entitlement-store.ts`.


## Stage 2.3 — Transfer pair orphan recovery

Migration: `20261022010083_transfer_pair_orphan_recovery.sql`

Normal transfers write `transfer_out` + `transfer_in` in one transaction via `ghc_execute_transfer`.

| RPC | Purpose |
|-----|---------|
| `ghc_list_orphan_transfer_outs` | List posted outs missing matching in |
| `ghc_complete_orphan_transfer_in` | Insert missing in only; never a second out |

Server: `listOrphanTransferOuts`, `completeOrphanTransferIn` in `lib/server/economy/db.ts`.
