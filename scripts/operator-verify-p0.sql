-- GreenHaven P0 operator verification (read-only checks)
-- Run in Supabase SQL editor. Does NOT mutate balances or history.

-- 1) Required tables
SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE 'ghc_%'
ORDER BY 1;

-- Expect at least:
-- ghc_transactions, ghc_claim_streak_state, ghc_membership_entitlements,
-- ghc_activity_emission_windows, ghc_global_emission_demand, ghc_payment_intents

-- 2) Required RPCs
SELECT proname FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname LIKE 'ghc_%'
ORDER BY 1;

-- Expect:
-- ghc_execute_transfer, ghc_execute_spend, ghc_execute_daily_claim_v12,
-- ghc_activity_try_grant, ghc_record_global_demand, ghc_get_global_demand,
-- ghc_membership_upsert, ghc_payment_intent_*

-- 3) Membership table shape
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'ghc_membership_entitlements'
ORDER BY ordinal_position;

-- 4) RLS enabled on financial tables
SELECT relname, relrowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND relname LIKE 'ghc_%' AND relkind = 'r'
ORDER BY 1;
