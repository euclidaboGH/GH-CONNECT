-- Phase 2: explicitly lock down the SECURITY DEFINER transfer-request entry point.
-- This migration changes only function metadata and grants; it moves no financial data.
BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.ghc_create_transfer_request(text,text,numeric,text,text)') IS NULL THEN
    RAISE EXCEPTION 'Required function public.ghc_create_transfer_request(text,text,numeric,text,text) is missing';
  END IF;
END;
$$;

-- Put trusted built-ins first and temporary objects last in the SECURITY DEFINER
-- function's resolution path. Tables and application functions in its body are
-- schema-qualified, so public remains available without shadowing pg_catalog.
ALTER FUNCTION public.ghc_create_transfer_request(text, text, numeric, text, text)
  SET search_path = pg_catalog, public, pg_temp;

REVOKE ALL ON FUNCTION public.ghc_create_transfer_request(text, text, numeric, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ghc_create_transfer_request(text, text, numeric, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.ghc_create_transfer_request(text, text, numeric, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ghc_create_transfer_request(text, text, numeric, text, text) TO service_role;

COMMIT;
