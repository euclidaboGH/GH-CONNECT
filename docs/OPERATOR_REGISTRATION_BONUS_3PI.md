# Registration bonus policy — 3 π

## Policy

> **Math:** 3 π total − 0.05 π legacy = **2.95 π** top-up (not 2.85). Use the constants in code only.

- **New users:** one-time **3 π** credit (`registration_bonus:v2:{userId}`), atomic `30_000_000`.
- **Legacy v1 (0.05 π) claimants:** idempotent top-up **2.95 π** (`registration_bonus:v2_topup:{userId}`), atomic `29_500_000`.
- Only one known Testnet user claimed the legacy 0.05 π amount.

## Required migration
Apply (REVIEW_REQUIRED → operator-approved):

`supabase/migrations/20261030010001_registration_bonus_v2_reconciliation.sql`

This replaces/creates:
- `gh_earnings_registration_bonus_status(text)`
- `gh_earnings_registration_bonus_claim(text)`

Both are **service_role only**. Application routes call them with the service role; clients never choose the amount.

## Env
```
GHC_REGISTRATION_BONUS_ENABLED=1
NEXT_PUBLIC_PI_SANDBOX=true
PI_NETWORK=testnet
```

## After migrate
1. Redeploy app with this release.
2. Legacy user opens Wallet → Registration bonus → **Claim remaining 2.95 π**.
3. New users see **Claim 3 π**.
4. Ledger total for legacy user = 0.05 + 2.95 = **3 π**.

Do not bulk-credit via ad-hoc SQL. Use the claim RPC (or the Testnet-only operator backfill script if present) so unique_ref remains the sole idempotency key.
