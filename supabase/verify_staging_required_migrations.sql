-- READ-ONLY verification of required staging objects after applying staging-required-migrations
-- No INSERT/UPDATE/DELETE/DDL

-- ===== Membership (critical) =====
SELECT to_regclass('public.ghc_membership_entitlements') AS membership_table;
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args, p.prosecdef
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'ghc_membership_upsert';

-- ===== Economy core tables =====
SELECT t AS table_name, to_regclass('public.' || t) AS reg
FROM unnest(ARRAY[
  'ghc_transactions','ghc_transfer_requests','ghc_economy_events','ghc_user_blocks',
  'ghc_account_flags','ghc_economy_limits','ghc_user_accounts','ghc_public_identities',
  'ghc_claim_streak_state','ghc_activity_emission_windows','ghc_global_emission_demand'
]) AS t;

-- ===== Economy RPCs (sample) =====
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args, p.prosecdef
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN (
  'ghc_execute_spend','ghc_execute_transfer','ghc_wallet_snapshot','ghc_stage_pending',
  'ghc_claim_pending','ghc_execute_daily_claim_v12','ghc_create_transfer_request',
  'ghc_accept_transfer_request','ghc_ensure_account_created_at','ghc_ensure_public_id',
  'ghc_resolve_public_id','ghc_activity_try_grant','ghc_record_global_demand','ghc_get_global_demand'
)
ORDER BY p.proname;

-- ===== Marketplace =====
SELECT to_regclass('public.gh_marketplace_listings') AS listings,
       to_regclass('public.gh_marketplace_orders') AS orders;
SELECT p.proname
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname LIKE 'gh_marketplace_%'
ORDER BY 1;

-- ===== Already-present systems (sanity) =====
SELECT to_regclass('public.ghc_payment_intents') AS payment_intents,
       to_regclass('public.gh_sessions') AS sessions,
       to_regclass('public.gh_pi_identities') AS pi_identities,
       to_regclass('public.gh_user_profiles') AS profiles,
       to_regclass('public.gh_messages') AS messages;

-- ===== Social / communities =====
SELECT to_regclass('public.gh_posts') AS posts,
       to_regclass('public.gh_communities') AS communities;

-- ===== RLS enabled on key durable tables =====
SELECT c.relname, c.relrowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'ghc_membership_entitlements','ghc_transactions','ghc_user_accounts',
    'gh_marketplace_listings','gh_marketplace_orders','gh_posts'
  )
ORDER BY 1;
