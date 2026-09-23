# Pre-Supabase migration — blocker fixes (2026-09-23)

## Applied in tree

| Item | Fix |
|------|-----|
| P0 A2U syntax | `app/api/payments/a2u/complete/route.ts` — closed `apiKey` guard; removed premature `}` |
| P1 RLS | Additive migration `20260923_ghc_user_accounts_rls_lockdown.sql` — deny client ALL on `ghc_user_accounts` |
| P1 Service worker | `public/sw.js` — `/api/**` network-only; never cache personalized responses; cache name bumped to `gh-connect-v2-static` |
| P2 Profile arrays | `lib/server/identity/profile-store.ts` — explicit empty `photos` / `interests` / etc. clear existing |

## Keep disabled until implemented

- `GHC_A2U_ADMIN_KEY` / A2U payout path (no full chain submit)
- `PI_WALLET_PRIVATE_SEED`
- `PI_STAKING_API_ENABLED`
- `GHC_GOVERNANCE_SERVER`
- `GHC_REALTIME_CONFIGURED`

## Verify before staging deploy

```bash
npm ci --legacy-peer-deps
npm run typecheck
npm run lint
npm run test:safety
npm run build
```

Apply **all** migrations in `supabase/migrations/` (31+ including lockdown) on a **staging** project first.

Manifest note: older docs saying “22 migrations” are stale; count files in `supabase/migrations/`.
