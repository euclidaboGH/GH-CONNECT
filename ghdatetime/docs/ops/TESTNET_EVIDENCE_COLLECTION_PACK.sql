-- =============================================================================
-- GH-CONNECT v0.59.4 -- TESTNET EVIDENCE COLLECTION PACK (READ-ONLY)
-- =============================================================================
-- HOW TO USE (IMPORTANT):
-- 1. Open Supabase -> SQL Editor for the Testnet / Preview project ONLY.
-- 2. Paste ONLY this .sql file. Do NOT paste the markdown checklist.
-- 3. Prefer Run as a single script. If one statement fails, continue with
--    the next PART (see PART markers below).
-- 4. Copy every result grid and send back (no secrets).
--
-- SAFETY: SELECT / catalog reads only. No DDL/DML.
-- =============================================================================

-- ##########################################################################
-- PART 1 of 3 -- Sections A, B, C, D
-- ##########################################################################

-- A -- DATABASE IDENTITY
SELECT
  'A_DATABASE_IDENTITY' AS section,
  current_database() AS database_name,
  current_user AS current_user,
  session_user AS session_user,
  version() AS postgres_version,
  current_setting('server_version', true) AS server_version,
  NOW() AS observed_at_utc;

-- B1 -- migration history relation probe
SELECT
  'B_MIGRATION_HISTORY_RELATION' AS section,
  n.nspname AS schema_name,
  c.relname AS relation_name,
  c.relkind AS relkind
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('supabase_migrations', 'public')
  AND c.relname IN ('schema_migrations', 'supabase_migrations')
ORDER BY 1, 2, 3;

-- B2 -- Do NOT reference supabase_migrations.schema_migrations directly.
-- Postgres fails at plan time if the relation is absent (ERROR 42P01),
-- even inside a conditional subquery. Probe information_schema only.
SELECT
  'B_MIGRATION_HISTORY_ROWS' AS section,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'supabase_migrations'
        AND table_name = 'schema_migrations'
    ) THEN 'HISTORY_TABLE_PRESENT'
    ELSE 'HISTORY_UNKNOWN'
  END AS migration_version;

-- C -- CORE TABLE EXISTENCE (one row per object; paste-safe, no multi-line strings)
SELECT 'C_CORE_TABLE_EXISTENCE' AS section, x.object_name AS object, 'TABLE' AS type,
  EXISTS (
    SELECT 1 FROM information_schema.tables t
    WHERE t.table_schema = 'public' AND t.table_name = x.object_name
  ) AS exists,
  'public' AS schema
FROM (
  SELECT unnest(ARRAY[
    'gh_pi_identities',
    'gh_sessions',
    'gh_step_ups',
    'gh_webauthn_credentials',
    'gh_webauthn_challenges',
    'gh_user_profiles',
    'gh_user_progress',
    'gh_user_achievements',
    'ghc_payment_intents',
    'ghc_membership_entitlements',
    'ghc_user_accounts',
    'ghc_transactions',
    'ghc_economy_events',
    'ghc_transfer_requests',
    'ghc_withdrawal_requests',
    'ghc_claim_pending',
    'ghc_claim_streak_state',
    'gh_conversations',
    'gh_conversation_members',
    'gh_messages',
    'gh_marketplace_listings',
    'gh_marketplace_orders',
    'gh_posts',
    'gh_communities'
  ]) AS object_name
) x
ORDER BY x.object_name;

-- D -- PAYMENT RPC REQUIRED FLAGS
SELECT
  'D_PAYMENT_RPC_REQUIRED_FLAGS' AS section,
  req.rpc,
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = req.rpc
  ) AS exists
FROM (
  SELECT unnest(ARRAY[
    'ghc_payment_intent_upsert',
    'ghc_payment_intent_get',
    'ghc_payment_intent_by_provider'
  ]) AS rpc
) req
ORDER BY req.rpc;

-- D -- PAYMENT RPC SIGNATURES (empty if missing)
SELECT
  'D_PAYMENT_RPC_EXISTENCE' AS section,
  p.proname AS rpc,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS return_type,
  n.nspname AS schema,
  p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'ghc_payment_intent_upsert',
    'ghc_payment_intent_get',
    'ghc_payment_intent_by_provider'
  )
ORDER BY p.proname;

-- ##########################################################################
-- PART 2 of 3 -- Sections E, F, G
-- ##########################################################################

-- E -- RLS STATUS
SELECT
  'E_RLS_STATUS' AS section,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'ghc_payment_intents',
    'ghc_membership_entitlements',
    'gh_pi_identities',
    'gh_sessions',
    'ghc_user_accounts',
    'ghc_transactions',
    'ghc_economy_events',
    'ghc_transfer_requests',
    'ghc_withdrawal_requests',
    'gh_user_profiles',
    'gh_conversations',
    'gh_messages'
  )
ORDER BY c.relname;

-- F -- POLICY INVENTORY
SELECT
  'F_POLICY_INVENTORY' AS section,
  schemaname AS schema,
  tablename AS table_name,
  policyname AS policy_name,
  cmd AS command,
  roles::text AS roles,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'ghc_payment_intents',
    'ghc_membership_entitlements',
    'gh_pi_identities',
    'gh_sessions',
    'ghc_user_accounts',
    'ghc_transactions',
    'ghc_economy_events'
  )
ORDER BY tablename, policyname;

-- G1 -- COLUMNS
SELECT
  'G_COLUMNS' AS section,
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'ghc_payment_intents',
    'ghc_membership_entitlements',
    'gh_pi_identities',
    'gh_sessions'
  )
ORDER BY table_name, ordinal_position;

-- G2 -- CONSTRAINTS
SELECT
  'G_CONSTRAINTS' AS section,
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name IN (
    'ghc_payment_intents',
    'ghc_membership_entitlements',
    'gh_pi_identities',
    'gh_sessions'
  )
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;

-- G3 -- INDEXES
SELECT
  'G_INDEXES' AS section,
  tablename AS table_name,
  indexname AS index_name,
  indexdef AS index_definition
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'ghc_payment_intents',
    'ghc_membership_entitlements',
    'gh_pi_identities',
    'gh_sessions'
  )
ORDER BY tablename, indexname;

-- ##########################################################################
-- PART 3 of 3 -- Sections H, I, J (skip H queries if tables missing)
-- ##########################################################################

-- H1 -- payment intent by status (skip if table missing)
SELECT
  'H_PAYMENT_INTENT_BY_STATUS' AS section,
  status::text AS status,
  COUNT(*)::bigint AS row_count
FROM public.ghc_payment_intents
GROUP BY status
ORDER BY status;

SELECT
  'H_PAYMENT_INTENT_TOTAL' AS section,
  COUNT(*)::bigint AS total_intents,
  COUNT(DISTINCT user_id)::bigint AS distinct_users,
  COUNT(provider_payment_id)::bigint AS with_provider_id,
  COUNT(*) FILTER (WHERE provider_payment_id IS NULL)::bigint AS null_provider_id
FROM public.ghc_payment_intents;

SELECT
  'H_DUPLICATE_PROVIDER_PAYMENT_ID' AS section,
  provider_payment_id,
  COUNT(*)::bigint AS cnt
FROM public.ghc_payment_intents
WHERE provider_payment_id IS NOT NULL
  AND btrim(provider_payment_id) <> ''
GROUP BY provider_payment_id
HAVING COUNT(*) > 1
ORDER BY cnt DESC
LIMIT 50;

-- H2 -- membership
SELECT
  'H_MEMBERSHIP_BY_TIER' AS section,
  tier::text AS tier,
  COUNT(*)::bigint AS row_count
FROM public.ghc_membership_entitlements
GROUP BY tier
ORDER BY tier;

SELECT
  'H_MEMBERSHIP_TOTAL' AS section,
  COUNT(*)::bigint AS total_entitlements,
  COUNT(DISTINCT user_id)::bigint AS distinct_users
FROM public.ghc_membership_entitlements;

SELECT
  'H_DUPLICATE_PURCHASE_REF' AS section,
  purchase_ref::text AS purchase_ref,
  COUNT(*)::bigint AS cnt
FROM public.ghc_membership_entitlements
WHERE purchase_ref IS NOT NULL
GROUP BY purchase_ref
HAVING COUNT(*) > 1
ORDER BY cnt DESC
LIMIT 50;

-- H3 -- identity / session counts (no tokens)
SELECT
  'H_IDENTITY_SESSION_COUNTS' AS section,
  (SELECT COUNT(*)::bigint FROM public.gh_pi_identities) AS pi_identities,
  (SELECT COUNT(*)::bigint FROM public.gh_sessions) AS sessions,
  (SELECT COUNT(*)::bigint FROM public.gh_sessions WHERE revoked_at IS NULL) AS sessions_active_unrevoked;

-- I -- public gh_/ghc_ tables
SELECT
  'I_PUBLIC_TABLES_GH' AS section,
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (table_name LIKE 'gh\_%' ESCAPE '\' OR table_name LIKE 'ghc\_%' ESCAPE '\')
ORDER BY table_name;

-- I -- public gh_/ghc_ functions
SELECT
  'I_PUBLIC_FUNCTIONS_GH' AS section,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (p.proname LIKE 'gh\_%' ESCAPE '\' OR p.proname LIKE 'ghc\_%' ESCAPE '\')
ORDER BY p.proname
LIMIT 300;

-- J -- GAP ANALYSIS for Prompt 2 required objects
SELECT
  'J_GAP_ANALYSIS' AS section,
  r.object_name,
  r.object_type,
  CASE
    WHEN r.object_type = 'TABLE' AND EXISTS (
      SELECT 1 FROM information_schema.tables t
      WHERE t.table_schema = 'public' AND t.table_name = r.object_name
    ) THEN 'PRESENT'
    WHEN r.object_type = 'FUNCTION' AND EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = r.object_name
    ) THEN 'PRESENT'
    ELSE 'MISSING'
  END AS classification,
  r.why_required
FROM (
  SELECT * FROM (VALUES
    ('gh_pi_identities', 'TABLE', 'Pi identity bind; auth path'),
    ('gh_sessions', 'TABLE', 'Durable session / revoke'),
    ('ghc_payment_intents', 'TABLE', 'Durable payment intents'),
    ('ghc_membership_entitlements', 'TABLE', 'VIP/VVIP entitlement store'),
    ('ghc_payment_intent_upsert', 'FUNCTION', 'Intent durable write RPC'),
    ('ghc_payment_intent_get', 'FUNCTION', 'Intent load by id RPC'),
    ('ghc_payment_intent_by_provider', 'FUNCTION', 'Intent load by Pi payment id RPC')
  ) AS v(object_name, object_type, why_required)
) r
ORDER BY classification DESC, object_name;

SELECT 'Z_SCRIPT_COMPLETE' AS section, NOW() AS completed_at_utc;
