-- Run #251: align SECURITY DEFINER RPC permissions with GreenHaven's server-only
-- PostgREST architecture. The browser uses authenticated API routes; every app
-- RPC caller is under app/api or lib/server and uses the service-role key.
-- Preserve each function's existing service_role ACL. Do not grant service_role
-- to intentionally disabled/trigger-only helpers as part of this migration.
BEGIN;

DO $$
DECLARE
  v_function record;
BEGIN
  FOR v_function IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      v_function.signature
    );
  END LOOP;
END;
$$;

-- Supabase's default public-schema function ACL grants EXECUTE to anon and
-- authenticated. Remove those defaults for future migrations owned by postgres;
-- retain the existing service_role default so server RPCs remain usable.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

COMMIT;
