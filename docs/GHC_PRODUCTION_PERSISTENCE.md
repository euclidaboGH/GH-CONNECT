# GHC production persistence

## Rule

On Vercel / production, **Supabase Postgres is the only authoritative GHC ledger**.

Process-local Maps and `GHC_SERVER_MEMORY` **cannot** be the source of truth for balances, claims, transfers, or rewards across serverless instances.

## Daily rewards

Authoritative path:

`POST /api/economy/rewards/daily` → `rpcExecuteDailyClaimV12` → `ghc_execute_daily_claim_v12`

Streak state is loaded via `ghc_get_claim_streak`. If the DB is configured but the RPC fails, the server **fails closed** (does not invent an empty memory streak).

## Required environment (production / Vercel)

| Variable | Role |
|----------|------|
| `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only RPC access |

Apply economy migrations including:

- ledger / transfer RPCs
- `ghc_execute_daily_claim_v12`
- claim streak functions

## Memory mode

Allowed only when **not** on Vercel and **not** production, for local/dev/test.

`GHC_ALLOW_MEMORY_IN_PRODUCTION` is **ignored**.
