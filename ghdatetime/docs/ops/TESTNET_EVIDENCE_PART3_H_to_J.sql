-- PART 3 ONLY
PART 3 of 3 -- Sections H, I, J (skip H queries if tables missing)
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
