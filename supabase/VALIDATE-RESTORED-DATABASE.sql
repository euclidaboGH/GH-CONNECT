-- GREENHAVEN POST-RESTORE INTEGRITY GATE — READ ONLY
-- Run ONLY against a disposable restored database, never production.
-- Raises on critical catalog regressions and prints non-blocking inventory for review.
-- No schema, data, roles, grants, or migration history are modified.

BEGIN TRANSACTION READ ONLY;

DO $$
DECLARE missing text[] := ARRAY[]::text[]; item text;
BEGIN
  FOREACH item IN ARRAY ARRAY[
    'gh_user_profiles', 'gh_posts', 'gh_media_assets', 'gh_messages',
    'ghc_transactions', 'ghc_payment_intents', 'ghc_withdrawal_requests',
    'gh_marketplace_orders'
  ] LOOP
    IF to_regclass(format('public.%I', item)) IS NULL THEN missing := array_append(missing, item); END IF;
  END LOOP;
  IF cardinality(missing) > 0 THEN RAISE EXCEPTION 'RESTORE GATE FAIL: required tables missing: %', missing; END IF;
END $$;

DO $$
DECLARE unsafe_tables text[];
BEGIN
  SELECT array_agg(format('%I', c.relname) ORDER BY c.relname) INTO unsafe_tables
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
    AND c.relname ~ '^(gh|ghc|ghpv)' AND NOT c.relrowsecurity;
  IF unsafe_tables IS NOT NULL THEN RAISE EXCEPTION 'RESTORE GATE FAIL: GreenHaven tables without RLS: %', unsafe_tables; END IF;
END $$;

DO $$
DECLARE unsafe_routines text[];
BEGIN
  SELECT array_agg(format('%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid)) ORDER BY p.proname)
    INTO unsafe_routines
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) acl
  WHERE n.nspname = 'public' AND p.prosecdef AND acl.grantee = 0 AND acl.privilege_type = 'EXECUTE';
  IF unsafe_routines IS NOT NULL THEN RAISE EXCEPTION 'RESTORE GATE FAIL: SECURITY DEFINER routines executable by PUBLIC: %', unsafe_routines; END IF;
END $$;

DO $$
DECLARE unsafe_routines text[];
BEGIN
  SELECT array_agg(format('%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid)) ORDER BY p.proname)
    INTO unsafe_routines
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prosecdef
    AND NOT EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) cfg WHERE cfg ~ '^search_path=');
  IF unsafe_routines IS NOT NULL THEN RAISE EXCEPTION 'RESTORE GATE FAIL: SECURITY DEFINER routines without pinned search_path: %', unsafe_routines; END IF;
END $$;

-- Report only: these require explicit reviewer decisions, not automatic schema mutation.
SELECT 'RESTORE_GATE_INVENTORY' AS section,
       (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind IN ('r','p') AND c.relname ~ '^(gh|ghc|ghpv)') AS greenhaven_tables,
       (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.prosecdef) AS security_definer_routines,
       (SELECT count(*) FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND con.contype = 'f' AND NOT con.convalidated) AS unvalidated_foreign_keys,
       (SELECT count(*) FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname ~ '^(gh|ghc|ghpv)' AND NOT i.indisvalid) AS invalid_indexes;

SELECT 'RESTORE_GATE_PASS' AS result, current_database() AS database_name,
       current_setting('server_version') AS postgres_version, now() AT TIME ZONE 'UTC' AS checked_at_utc;
COMMIT;
