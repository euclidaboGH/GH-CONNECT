-- PHASE 1: READ-ONLY curation intelligence diagnostics.
-- Run in Supabase SQL Editor against the intended TESTNET project.
-- This file intentionally does not mutate data or apply migrations.

-- 1) Confirm the key tables and expected columns exist.
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'gh_reputation_intelligence', 'gh_curator_activity_events',
    'gh_reputation_intelligence_history', 'gh_reputation_state',
    'gh_curator_calibration', 'gh_content_quality_signals', 'gh_posts'
  )
ORDER BY table_name, ordinal_position;

-- 2) Confirm the expected RPCs exist and report their signatures.
SELECT n.nspname AS schema_name, p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_get_function_result(p.oid) AS result_type, p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'gh_reputation_intelligence_refresh', 'gh_reputation_intelligence_get',
    'gh_curation_preflight', 'gh_curation_activity_record',
    'gh_post_curation_set_with_reward'
  )
ORDER BY p.proname, arguments;

-- 3) Confirm table RLS is enabled; client access is intentionally denied by policy.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'gh_reputation_intelligence', 'gh_curator_activity_events',
    'gh_reputation_intelligence_history'
  )
ORDER BY c.relname;

-- 4) Snapshot availability summary (does not reveal user IDs).
SELECT count(*) AS snapshot_rows,
       count(*) FILTER (WHERE calculated_at >= now() - interval '24 hours') AS refreshed_last_24h,
       count(*) FILTER (WHERE curation_eligible) AS eligible_rows,
       count(*) FILTER (WHERE NOT curation_eligible) AS review_required_rows,
       max(calculated_at) AS latest_snapshot_at
FROM public.gh_reputation_intelligence;

-- 5) Inspect recent server-side errors in Supabase Logs separately.
-- The SQL editor cannot reproduce the app's service-role request identity.
-- Do not paste service-role keys or unredacted personal data into support chats.
