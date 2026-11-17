-- Operator-only: run in Supabase SQL editor. Does not mutate data.
-- Expected objects for P0 financial durability.

SELECT 'tables' AS kind, tablename AS name
FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE 'ghc_%'
ORDER BY 2;

SELECT 'functions' AS kind, proname AS name
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND proname LIKE 'ghc_%'
ORDER BY 2;

-- Critical presence checks (return rows only if missing)
SELECT 'MISSING' AS status, expected
FROM (VALUES
  ('ghc_transactions'),
  ('ghc_claim_streak_state'),
  ('ghc_membership_entitlements'),
  ('ghc_activity_emission_windows'),
  ('ghc_global_emission_demand'),
  ('ghc_payment_intents')
) AS t(expected)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t.expected
);

SELECT 'MISSING_FN' AS status, expected
FROM (VALUES
  ('ghc_available_balance'),
  ('ghc_execute_transfer'),
  ('ghc_execute_spend'),
  ('ghc_execute_daily_claim_v12'),
  ('ghc_activity_try_grant'),
  ('ghc_record_global_demand'),
  ('ghc_get_global_demand'),
  ('ghc_membership_upsert'),
  ('ghc_payment_intent_upsert'),
  ('ghc_payment_intent_get')
) AS t(expected)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = t.expected
);
