-- GREENHAVEN / GH CONNECT — Pi authentication and durable-session diagnostics
-- TARGET: Supabase TESTNET project tpckwgdsjlkzscjlxiwe
-- READ ONLY: this script contains SELECT statements only. It does not alter data,
-- privileges, RLS policies, migrations, identities, sessions, or payment records.
-- Do not export token_hash values, raw tokens, Pi UIDs, or user IDs.

-- 1) Confirm required tables and their shape.
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('gh_pi_identities', 'gh_sessions')
order by table_name, ordinal_position;

-- 2) Check RLS and effective table privileges. RLS policies still apply after grants.
select c.relname as table_name, c.relrowsecurity as rls_enabled,
       has_table_privilege('anon', c.oid, 'select') as anon_select_granted,
       has_table_privilege('authenticated', c.oid, 'select') as authenticated_select_granted,
       has_table_privilege('service_role', c.oid, 'select') as service_role_select_granted,
       (select count(*) from pg_policies p
        where p.schemaname='public' and p.tablename=c.relname) as policy_count
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('gh_pi_identities','gh_sessions')
order by c.relname;

-- 3) Inspect policy definitions (expected: deny all direct client access).
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname='public' and tablename in ('gh_pi_identities','gh_sessions')
order by tablename, policyname;

-- 4) Identity integrity summary. No identifiers or usernames are returned.
select count(*) as identity_rows,
       count(*) filter (where pi_app_uid is null or btrim(pi_app_uid)='') as blank_pi_uids,
       count(*) filter (where gh_user_id is null or btrim(gh_user_id)='') as blank_gh_user_ids,
       count(*) filter (where verified_at is null) as missing_verified_at,
       count(*) filter (where onboarding_completed) as onboarding_completed_rows,
       min(created_at) as first_identity_created_at,
       max(created_at) as last_identity_created_at,
       max(verified_at) as most_recent_identity_verification,
       max(last_seen_at) as most_recent_identity_activity
from public.gh_pi_identities;

-- 5) Session integrity summary. Hash values and user IDs are intentionally omitted.
select count(*) as session_rows,
       count(*) filter (where revoked_at is not null) as revoked_sessions,
       count(*) filter (where revoked_at is null and expires_at <= now()) as expired_unrevoked_sessions,
       count(*) filter (where revoked_at is null and expires_at > now()
                         and absolute_expires_at > now()) as currently_active_sessions,
       count(*) filter (where absolute_expires_at < expires_at) as invalid_expiry_order,
       count(*) filter (where token_hash is null or length(token_hash) <> 64) as invalid_sha256_hash_shape,
       count(*) filter (where gh_user_id is null or btrim(gh_user_id)='') as blank_session_user_ids,
       min(created_at) as first_session_created_at,
       max(created_at) as last_session_created_at,
       max(last_seen_at) as most_recent_session_activity
from public.gh_sessions;

-- 6) Detect duplicate identity mappings (should return zero rows).
select 'duplicate_pi_app_uid' as issue, count(*) as duplicate_groups
from (select pi_app_uid from public.gh_pi_identities group by pi_app_uid having count(*) > 1) d
union all
select 'duplicate_gh_user_id', count(*)
from (select gh_user_id from public.gh_pi_identities group by gh_user_id having count(*) > 1) d;

-- 7) Authentication security-event summary for the last 7 days.
-- Only event code/outcome/count/timestamp are shown; no actor IDs or metadata.
select event_type, outcome, reason_code, count(*) as event_count,
       min(created_at) as first_event_at, max(created_at) as last_event_at
from public.gh_security_events
where event_type like 'auth.pi.%'
  and created_at >= now() - interval '7 days'
group by event_type, outcome, reason_code
order by last_event_at desc;

-- 8) Verify the core tables' migration records exist in this database.
-- This is a catalog/history check only; it does not apply or repair migrations.
select to_regclass('public.gh_pi_identities') as gh_pi_identities_table,
       to_regclass('public.gh_sessions') as gh_sessions_table,
       to_regprocedure('public.gh_session_issue_with_cap(uuid,text,text,timestamp with time zone,timestamp with time zone,timestamp with time zone,timestamp with time zone,text,jsonb,integer)') as optional_atomic_session_rpc;
