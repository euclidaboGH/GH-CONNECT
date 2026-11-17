-- GREENHAVEN DATABASE RESET — DESTRUCTIVE
-- Purpose: remove GreenHaven application objects from public without deleting
-- Supabase Auth users, Storage objects/buckets, extensions, or Supabase-owned
-- extension objects.
--
-- Use ONLY when intentionally rebuilding the GreenHaven database from the
-- current canonical installer. This is NOT a normal feature migration.
--
-- GreenHaven application-object naming policy:
--   gh*   / ghc* / ghpv*
-- The reset targets those public objects only and excludes extension-owned
-- objects. Storage is intentionally untouched.

BEGIN;

-- 1) Drop application views/materialized views first so dependent objects can
-- be removed cleanly.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relkind, n.nspname, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname ~ '^(gh|ghc|ghpv)'
      AND c.relkind IN ('v','m')
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid = 'pg_class'::regclass
          AND d.objid = c.oid
          AND d.deptype = 'e'
      )
    ORDER BY CASE WHEN c.relkind = 'm' THEN 0 ELSE 1 END, c.relname
  LOOP
    IF r.relkind = 'm' THEN
      EXECUTE format('DROP MATERIALIZED VIEW IF EXISTS %I.%I CASCADE', r.nspname, r.relname);
    ELSE
      EXECUTE format('DROP VIEW IF EXISTS %I.%I CASCADE', r.nspname, r.relname);
    END IF;
  END LOOP;
END $$;

-- 2) Drop GreenHaven functions/procedures/aggregates. Extension-owned
-- functions are excluded.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid, n.nspname, p.proname, p.prokind,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname ~ '^(gh|ghc|ghpv)'
      AND p.prokind IN ('f','p','a','w')
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid = 'pg_proc'::regclass
          AND d.objid = p.oid
          AND d.deptype = 'e'
      )
    ORDER BY p.proname, args
  LOOP
    IF r.prokind = 'a' THEN
      EXECUTE format('DROP AGGREGATE IF EXISTS %I.%I(%s) CASCADE', r.nspname, r.proname, r.args);
    ELSE
      EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', r.nspname, r.proname, r.args);
    END IF;
  END LOOP;
END $$;

-- 3) Drop application tables. CASCADE removes their indexes, constraints,
-- triggers, policies and table-owned sequences.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, c.relname, c.relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname ~ '^(gh|ghc|ghpv)'
      AND c.relkind IN ('r','p','f')
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid = 'pg_class'::regclass
          AND d.objid = c.oid
          AND d.deptype = 'e'
      )
    ORDER BY c.relname
  LOOP
    IF r.relkind = 'f' THEN
      EXECUTE format('DROP FOREIGN TABLE IF EXISTS %I.%I CASCADE', r.nspname, r.relname);
    ELSE
      EXECUTE format('DROP TABLE IF EXISTS %I.%I CASCADE', r.nspname, r.relname);
    END IF;
  END LOOP;
END $$;

-- 4) Remove standalone GreenHaven sequences that were not owned by a table.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'S'
      AND c.relname ~ '^(gh|ghc|ghpv)'
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid = 'pg_class'::regclass
          AND d.objid = c.oid
          AND d.deptype = 'e'
      )
    ORDER BY c.relname
  LOOP
    EXECUTE format('DROP SEQUENCE IF EXISTS %I.%I CASCADE', r.nspname, r.relname);
  END LOOP;
END $$;

-- 5) Remove standalone GreenHaven enum/domain/composite types. Table row
-- types are owned by their tables and should already be gone.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, t.typname, t.typtype
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname ~ '^(gh|ghc|ghpv)'
      AND (
        t.typtype IN ('e','d')
        OR (t.typtype = 'c' AND t.typrelid = 0)
      )
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid = 'pg_type'::regclass
          AND d.objid = t.oid
          AND d.deptype = 'e'
      )
    ORDER BY t.typname
  LOOP
    IF r.typtype = 'd' THEN
      EXECUTE format('DROP DOMAIN IF EXISTS %I.%I CASCADE', r.nspname, r.typname);
    ELSE
      EXECUTE format('DROP TYPE IF EXISTS %I.%I CASCADE', r.nspname, r.typname);
    END IF;
  END LOOP;
END $$;

COMMIT;

-- Post-reset safety assertion. This is read-only and intentionally fails if
-- any GreenHaven application object remains in public.
DO $$
DECLARE remaining integer;
BEGIN
  SELECT count(*) INTO remaining
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname ~ '^(gh|ghc|ghpv)'
    AND c.relkind IN ('r','p','v','m','f','S')
    AND NOT EXISTS (
      SELECT 1 FROM pg_depend d
      WHERE d.classid = 'pg_class'::regclass
        AND d.objid = c.oid
        AND d.deptype = 'e'
    );
  IF remaining <> 0 THEN
    RAISE EXCEPTION 'GreenHaven reset incomplete: % application relations remain', remaining;
  END IF;
END $$;

SELECT 'GREENHAVEN RESET: PASS' AS result;
