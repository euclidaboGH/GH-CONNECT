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

PART 1 of 3 -- Sections A, B, C, D
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
-- 