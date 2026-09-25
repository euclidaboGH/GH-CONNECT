# GreenHaven stabilization ops (Testnet → Mainnet)

## Status after 2026-09-25 hardening pass

| Item | Status |
|------|--------|
| Domain validation key in source | Removed (env-only) |
| Middleware hard-coded key | Removed |
| `gh_post_list_feed` order fix | Migration present |
| Authoritative `gh_poll_vote` | Migration present |
| RPC PUBLIC execute revoke | Migration present |
| Next.js | `15.5.26` (package.json; run `npm install` to refresh lockfile) |

## Operator: apply database on Testnet first

1. Open **Testnet** Supabase SQL editor (or CLI).
2. Apply all files under `supabase/migrations/` in **filename sort order**.
3. Especially ensure these exist after apply:
   - `gh_pi_identities`, `gh_sessions`
   - `ghc_payment_intents` + payment RPCs
   - `ghc_membership_entitlements` + `ghc_membership_upsert`
   - `gh_posts`, `gh_communities`, …
   - `20260925_gh_post_list_feed_order_fix.sql`
   - `20260925_gh_poll_vote_authoritative.sql`
   - `20260925_rpc_acl_lockdown.sql`
4. Verify:
   ```sql
   SELECT to_regclass('public.gh_pi_identities');
   SELECT has_function_privilege('anon', 'public.gh_community_join(text,text)', 'execute');
   -- expect false for anon execute after ACL lockdown
   ```
5. Point **Vercel Preview** at Testnet Supabase + Testnet Pi credentials.
6. Only after Testnet E2E: apply the **same** migration set to Mainnet Supabase.

## Vercel env (same names, different values)

See `VERCEL_DEPLOY.txt`.

## Not done in this pass (intentional)

- Full community domain migration off local `Conversation` authority
- Home community pulse / invite card product wiring
- Automated test suite re-green (home/community copy tests)
- A2U activation
- Lockfile regeneration if `npm install` was not run in CI environment
