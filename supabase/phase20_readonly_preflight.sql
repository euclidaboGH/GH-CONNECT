-- PHASE 20 READ-ONLY PREFLIGHT. Safe to run before applying migrations.
-- This script does not create, alter, update, or delete anything.
WITH expected(version, migration_name) AS (
  VALUES
    ('202610250006','202610250006_pi_a2u_sdk_execution_orchestration.sql'),
    ('202610250007','202610250007_ghc_atomic_seller_payout_settlement.sql')
), history AS (
  SELECT version::text AS version FROM supabase_migrations.schema_migrations
)
SELECT e.version, e.migration_name,
       EXISTS(SELECT 1 FROM history h WHERE h.version=e.version) AS recorded_in_supabase_history
FROM expected e ORDER BY e.version;

-- Current target schema: missing tables/functions are expected before apply, but must be
-- explained against the real target migration history rather than guessed from file names.
SELECT object_name, object_kind, to_regclass(object_name) IS NOT NULL AS exists_now
FROM (VALUES
 ('public.gh_seller_payout_requests','table'),
 ('public.gh_seller_payout_allocations','table'),
 ('public.ghc_transactions','table'),
 ('public.ghc_economy_events','table'),
 ('public.gh_pi_identities','table'),
 ('public.gh_seller_payout_ghc_settlements','table'),
 ('public.gh_pi_a2u_executions','table'),
 ('public.gh_pi_a2u_sequence_lease','table')
) v(object_name, object_kind)
ORDER BY object_name;

SELECT fn, to_regprocedure(fn) IS NOT NULL AS exists_now
FROM (VALUES
 ('public.gh_pi_a2u_begin_execution(text,text,text)'),
 ('public.gh_pi_a2u_update_execution(text,text,text,text,text,text)'),
 ('public.gh_pi_a2u_release_sequence_lease(text,text)'),
 ('public.gh_seller_payout_settle_ghc_atomic(text,text)'),
 ('public.gh_seller_payout_record_pi_confirmation(text,text,text,text,numeric,text,boolean,text)'),
 ('public.gh_seller_payout_transition(text,text,text,text)')
) v(fn) ORDER BY fn;

-- Read-only current access posture. The actual service_role grants should be checked again
-- with PHASE20_POST_MIGRATION_ASSERTIONS.sql after the reviewed migrations are applied.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN (
 'gh_seller_payout_requests','gh_seller_payout_ghc_settlements',
 'gh_pi_a2u_executions','gh_pi_a2u_sequence_lease'
) ORDER BY c.relname;
