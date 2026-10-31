-- GreenHaven clean-install validation (read-only assertions)
-- Run AFTER all migrations on a disposable/new database.
DO $$
DECLARE missing text[] := ARRAY[]::text[]; n text;
BEGIN
  FOREACH n IN ARRAY ARRAY['gh_posts','gh_post_comments','gh_post_reactions','gh_post_curations','gh_follows','ghc_user_blocks','gh_community_members','gh_marketplace_listings','gh_marketplace_orders','gh_content_events'] LOOP
    IF to_regclass('public.'||n) IS NULL THEN missing := array_append(missing,n); END IF;
  END LOOP;
  IF cardinality(missing)>0 THEN RAISE EXCEPTION 'Missing required tables: %', missing; END IF;
END $$;

DO $$
DECLARE missing text[] := ARRAY[]::text[]; n text;
BEGIN
  FOREACH n IN ARRAY ARRAY['gh_post_viewer_can_read','gh_post_list_feed_v3','gh_marketplace_orders_list_for_user','gh_post_attention_summary'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE ns.nspname='public' AND p.proname=n) THEN missing := array_append(missing,n); END IF;
  END LOOP;
  IF cardinality(missing)>0 THEN RAISE EXCEPTION 'Missing required functions: %', missing; END IF;
END $$;

-- SECURITY DEFINER functions still executable by PUBLIC (should be reviewed; zero is preferred unless explicitly intended).
SELECT n.nspname AS schema, p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prosecdef AND has_function_privilege('public', p.oid, 'EXECUTE')
ORDER BY 1,2,3;
