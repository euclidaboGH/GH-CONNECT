# Operator checklist — Wallet withdraw + A2U (Testnet only)

Document date: 2026-11-03.

## A. Database (notification defects — independent of A2U)

Apply **in order** if not already applied (Review in SQL Editor first):

1. `supabase/migrations/20261101150001_fix_notification_list_createdAt_order.sql`
2. `supabase/migrations/20261101160001_harden_notification_rpc_execute_privileges.sql`

Verify privileges:

```sql
SELECT p.proname,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('gh_notification_inbox_list', 'gh_social_notifications_list')
ORDER BY 1;
```

Target: **service_role = true**, **authenticated = false**, **anon = false** for both.

Do **not** apply `20261101140001_ensure_earnings_payout_policy_fee_bps.sql` for the `42703` issue (`fee_bps` already exists on Testnet).

## B. App path (user)

1. Sign in with Pi (identity linked).
2. Rewards → **Open Wallet · Withdraw Pi**.
3. On Wallet Pi card: **Authorize Pi wallet** (once).
4. **Review fee & withdraw** → **Withdraw to Pi**.
5. Expect: request reserved only when `PI_EARNINGS_PAYOUT_REQUESTS_ENABLED=true` and `PI_NETWORK=testnet`.
6. Execution requires separate worker flags (`PI_EARNINGS_PAYOUT_EXECUTION_ENABLED`, `PI_A2U_ENABLED`) and funded Testnet A2U — never enable Mainnet here.

## C. Vercel / env (fail-closed defaults in `.env.example`)

| Variable | Safe default | Testnet when ready |
|----------|--------------|--------------------|
| `PI_NETWORK` | `testnet` | `testnet` |
| `PI_EARNINGS_PAYOUT_REQUESTS_ENABLED` | `0` | `true` |
| `PI_EARNINGS_PAYOUT_EXECUTION_ENABLED` | `0` | `true` (worker) |
| `PI_A2U_ENABLED` | `0` | `true` (worker) |
| `PI_A2U_TESTNET_ONLY` | `1` | `1` |

## D. Health (infrastructure only — not user eligibility)

- `GET /api/health/withdrawals`
- Authenticated: `GET /api/economy/earnings/withdrawable`

## Limits

Source packages and static gates do **not** prove live Pi transfer success. Operator must fund A2U, apply SQL, set flags, and verify with two Testnet accounts.
