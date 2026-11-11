-- Run #252: pin the search_path of two SECURITY INVOKER helper functions flagged
-- by Supabase's database security advisor. Both functions use only pg_catalog
-- built-ins; ghc_available_balance fully qualifies its application table.
BEGIN;
ALTER FUNCTION public.ghc_available_balance(text) SET search_path = pg_catalog;
ALTER FUNCTION public.gh_reputation_level_from_points(integer) SET search_path = pg_catalog;
COMMIT;
