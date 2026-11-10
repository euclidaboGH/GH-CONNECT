> **LEGACY VERIFICATION FIXTURE — NOT CURRENT PRODUCT AUTHORITY.**
> This document is retained only because an executable regression/operator check references it. For current implementation decisions, follow `docs/SOURCE_OF_TRUTH.md` and executable source. Do not resurrect historical behavior from this file.

# Phase 1 — Registration bonus top-up (complete 3 π)

## Policy
| User class | Credit | unique_ref | Atomic |
|------------|--------|------------|--------|
| New user | **3 π** | `registration_bonus:v2:{userId}` | 30_000_000 |
| Legacy v1 (verified 0.05 π) | **2.95 π** top-up | `registration_bonus:v2_topup:{userId}` | 29_500_000 |
| Already v2 or top-up | no-op (duplicate) | existing ref | — |

**Math:** 0.05 + 2.95 = **3 π**. Do not use 2.85.

## Source components
- Migration: `supabase/migrations/20261030010001_registration_bonus_v2_reconciliation.sql`
- RPCs: `gh_earnings_registration_bonus_status`, `gh_earnings_registration_bonus_claim` (service_role only)
- Server: `lib/server/earnings/registration-bonus.ts`
- API: `GET/POST /api/economy/earnings/registration-bonus`
- UI: `RegistrationBonusCard` (Wallet + Rewards); legacy auto-reconcile on load when claimable
- Backfill: `scripts/ops/phase2-registration-bonus-backfill-testnet.sql`

## Operator steps (Testnet only)
1. Confirm project is Testnet Supabase.
2. Apply migration `20261030010001_registration_bonus_v2_reconciliation.sql`.
3. Set env and redeploy:
   ```
   GHC_REGISTRATION_BONUS_ENABLED=1
   NEXT_PUBLIC_PI_SANDBOX=true
   PI_NETWORK=testnet
   ```
4. Legacy user: open Wallet — card auto-reconciles **or** tap **Claim remaining 2.95 π**.
5. Optional mass reconcile after preview SQL in the backfill script.
6. Verify ledger:

```sql
select unique_ref, amount_atomic, status, created_at
from public.gh_earnings_ledger_entries
where user_id = '<user_id>'
  and unique_ref like 'registration_bonus:%'
order by created_at;
```

Expected for legacy: one v1 row (500000) + one v2_topup row (29500000).

## Acceptance
- [ ] Migration applied
- [ ] Flags enabled on Testnet only
- [ ] Legacy user ledger totals 3 π available (or reserved/paid per lifecycle)
- [ ] New user can claim 3 π once
- [ ] Re-claim returns duplicate, no double credit
- [ ] Client never posts a client-chosen amount

## Limits
Source package does not mutate production. Live credit requires operator DB + env.
