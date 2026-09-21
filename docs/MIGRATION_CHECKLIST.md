# Supabase migration verification (read-only)

**Never** drop production tables to “fix” identity or ledger data.  
**Never** disable RLS in Production for debugging.

## 1. Confirm migration files exist in the repo

| Migration | Purpose |
|-----------|---------|
| `20260908_gh_pi_identities.sql` | Pi → GH user mapping |
| `20260908_gh_sessions.sql` | Server sessions |
| `20260919_gh_user_profiles_and_progress.sql` | Profile / achievements / progress |
| `20260919_gh_messaging_durable.sql` | Conversations + messages |
| Economy series (`20260821` … wallet snapshot) | GHC ledger / claims / spends |

Apply **only** via Supabase SQL editor or CLI with review. Prefer Staging first.

## 2. Read-only existence checks (SQL editor)

```sql
-- Tables present?
select to_regclass('public.gh_pi_identities') as gh_pi_identities;
select to_regclass('public.gh_sessions') as gh_sessions;
select to_regclass('public.gh_user_profiles') as gh_user_profiles;
select to_regclass('public.gh_user_achievements') as gh_user_achievements;
select to_regclass('public.gh_conversations') as gh_conversations;
select to_regclass('public.gh_messages') as gh_messages;
```

Expected: each returns the relation name, not `null`.

## 3. RLS smoke (do not change policies)

```sql
-- As service role (Dashboard SQL runs as privileged): should succeed
select count(*) from public.gh_pi_identities;
```

From the **anon** key (client): PostgREST should not return arbitrary rows  
(deny-all / no broad SELECT policies on these tables).

## 4. Runtime proof

After deploy:

```http
GET /api/health
```

Expect checks:

- `identity_durable` = pass  
- `session_durable` = pass  
- `supabase_config` = pass  
- `messaging_durable` = pass (after messaging migration)  

Production with critical failures → HTTP **503**.

## 5. Staging mirror

1. Create/use a Staging Supabase project.  
2. Apply the same migrations.  
3. Point Vercel **Preview** env at Staging.  
4. Run IDOR checklist (`docs/IDOR_TEST_CHECKLIST.md`).  
5. Only then apply to Production.
