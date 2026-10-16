-- READ-ONLY verification after membership migrations (01 + 02)
-- Do not INSERT/UPDATE/DELETE

-- 1) Table exists
SELECT to_regclass('public.ghc_membership_entitlements') AS membership_table;

-- 2) Required columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'ghc_membership_entitlements'
ORDER BY ordinal_position;

-- 3) Unique index on purchase_ref (partial where not null)
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'ghc_membership_entitlements';

-- 4) RLS enabled
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'ghc_membership_entitlements';

-- 5) Client-deny policy
SELECT polname, polcmd, polroles::regrole[]
FROM pg_policy
WHERE polrelid = 'public.ghc_membership_entitlements'::regclass;

-- 6) Upsert RPC exists + security definer
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
       p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'ghc_membership_upsert';

-- 7) Activity window + global demand tables (same migration family)
SELECT to_regclass('public.ghc_activity_emission_windows') AS activity_windows,
       to_regclass('public.ghc_global_emission_demand') AS global_demand;
