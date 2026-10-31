-- PART 2 ONLY
PART 2 of 3 -- Sections E, F, G
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
-- 