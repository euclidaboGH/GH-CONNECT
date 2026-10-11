# Testnet Supabase — full migration apply order

If the Testnet project shows **No migrations** / `gh_pi_identities` 404, apply **every** file in `supabase/migrations/` in **filename sort order**.

Critical early tables for Pi auth:

1. `20260908_gh_pi_identities.sql`
2. `20260908_gh_sessions.sql`
3. `20260919_gh_user_profiles_and_progress.sql`
4. `20260919_gh_messaging_durable.sql`
5. …all remaining files through…
6. `20260925_gh_post_list_feed_order_fix.sql`
7. `20260925_gh_poll_vote_authoritative.sql`
8. `20260925_rpc_acl_lockdown.sql`  ← last ACL hardening

## After apply (read-only checks)

```sql
SELECT to_regclass('public.gh_pi_identities') AS pi_identities;
SELECT to_regclass('public.gh_sessions') AS sessions;
SELECT to_regclass('public.ghc_payment_intents') AS payment_intents;
SELECT to_regclass('public.ghc_membership_entitlements') AS membership;
SELECT to_regclass('public.gh_posts') AS posts;
SELECT to_regclass('public.gh_communities') AS communities;

-- RPC should NOT be executable by anon after ACL lockdown
SELECT has_function_privilege('anon', 'public.gh_community_join(text,text)', 'execute') AS anon_can_join;
-- expect: false
```

## Vercel Preview

Point Preview env at this Testnet Supabase + Testnet Pi credentials (`NEXT_PUBLIC_PI_SANDBOX=true`).
