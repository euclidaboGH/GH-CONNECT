-- Phase 3 disposable PostgreSQL concurrency drill.
-- USE ONLY against disposable databases. Never point at production.
-- Requires migrations through 20261108110001_phase3_wallet_rewards_membership_concurrency_recovery.sql

\set ON_ERROR_STOP on
\echo '=== Phase 3 concurrent claim / membership drill (disposable only) ==='

DO $$
BEGIN
  IF current_database() ~* 'prod|mainnet|live' THEN
    RAISE EXCEPTION 'Refusing to run concurrent drill on database name %', current_database();
  END IF;
END $$;

-- Synthetic users
SELECT set_config('gh.drill_user_a', 'drill-user-a-' || substr(md5(random()::text), 1, 8), false);
SELECT set_config('gh.drill_user_b', 'drill-user-b-' || substr(md5(random()::text), 1, 8), false);

\echo 'User A:' 
SELECT current_setting('gh.drill_user_a');
\echo 'User B:'
SELECT current_setting('gh.drill_user_b');

-- Concurrent registration-bonus style unique_ref collision simulation:
-- Two sessions would call gh_earnings_registration_bonus_claim; here we exercise
-- ledger unique (user_id, unique_ref) if the table is present.

DO $$
DECLARE
  u text := current_setting('gh.drill_user_a', true);
  ref text := 'registration_bonus:v2:' || u;
  inserted int := 0;
BEGIN
  IF to_regclass('public.gh_unified_earnings_ledger') IS NULL
     AND to_regclass('public.gh_earnings_ledger_entries') IS NULL THEN
    RAISE NOTICE 'Ledger table not found — apply earnings migrations before this drill';
    RETURN;
  END IF;

  -- Prefer unified ledger entry shape if present; otherwise skip with notice.
  IF to_regclass('public.gh_earnings_ledger_entries') IS NOT NULL THEN
    BEGIN
      INSERT INTO public.gh_earnings_ledger_entries (
        user_id, unique_ref, amount_atomic, kind, status, created_at
      ) VALUES (
        u, ref, 30000000, 'activity', 'available', now()
      );
      inserted := 1;
    EXCEPTION WHEN unique_violation THEN
      inserted := 0;
    EXCEPTION WHEN undefined_column OR undefined_table THEN
      RAISE NOTICE 'Ledger shape differs — run application-level concurrent HTTP claims instead';
      RETURN;
    END;

    BEGIN
      INSERT INTO public.gh_earnings_ledger_entries (
        user_id, unique_ref, amount_atomic, kind, status, created_at
      ) VALUES (
        u, ref, 30000000, 'activity', 'available', now()
      );
      RAISE EXCEPTION 'FAIL: duplicate unique_ref insert succeeded (expected unique violation)';
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE 'PASS: duplicate registration_bonus unique_ref rejected';
    END;
  END IF;
END $$;

-- Membership advisory path smoke: lock must be acquirable and release on commit
DO $$
DECLARE
  u text := current_setting('gh.drill_user_b', true);
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('ghc_membership_purchase:' || u, 0)
  );
  RAISE NOTICE 'PASS: membership purchase advisory lock acquired for %', u;
END $$;

\echo '=== Drill complete. Follow with parallel HTTP claim/activate tests from two clients. ==='
