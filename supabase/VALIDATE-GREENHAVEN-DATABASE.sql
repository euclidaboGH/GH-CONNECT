-- GREENHAVEN DATABASE VALIDATION — READ ONLY
-- Run after RESET + CANONICAL INSTALL on a clean/disposable database.
-- This script does not mutate data or schema.

DO $$
DECLARE missing text[] := ARRAY[]::text[]; n text;
BEGIN
  FOREACH n IN ARRAY ARRAY[
    'gh_posts','gh_post_comments','gh_post_reactions','gh_post_curations',
    'gh_follows','ghc_user_blocks','gh_community_members',
    'gh_marketplace_listings','gh_marketplace_orders','gh_content_events',
    'gh_media_assets','gh_social_notifications','gh_conversations','gh_messages',
    'gh_user_profiles','ghc_transactions','ghc_payment_intents',
    'ghc_membership_entitlements','ghc_withdrawal_requests'
  ] LOOP
    IF to_regclass('public.'||n) IS NULL THEN missing := array_append(missing,n); END IF;
  END LOOP;
  IF cardinality(missing)>0 THEN RAISE EXCEPTION 'Missing required GreenHaven tables: %', missing; END IF;
END $$;

DO $$
DECLARE missing text[] := ARRAY[]::text[]; n text;
BEGIN
  FOREACH n IN ARRAY ARRAY[
    'gh_post_viewer_can_read','gh_post_list_feed_v3',
    'gh_marketplace_orders_list_for_user','gh_post_attention_summary',
    'gh_media_asset_create','gh_follow_status','gh_social_notification_create',
    'ghc_execute_spend','ghc_payment_intent_upsert','ghc_membership_upsert'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace ns ON ns.oid=p.pronamespace
      WHERE ns.nspname='public' AND p.proname=n
    ) THEN missing := array_append(missing,n); END IF;
  END LOOP;
  IF cardinality(missing)>0 THEN RAISE EXCEPTION 'Missing required GreenHaven functions: %', missing; END IF;
END $$;

DO $$
DECLARE table_count integer; function_count integer;
BEGIN
  SELECT count(*) INTO table_count
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname ~ '^(gh|ghc|ghpv)';

  SELECT count(*) INTO function_count
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname ~ '^(gh|ghc|ghpv)';

  -- The canonical source currently contains 100 executable GreenHaven table definitions.
  -- Two additional CREATE TABLE strings are intentionally comment-only proposal/note text.
  -- Keep this as a floor while the named-table contract above remains authoritative.
  IF table_count < 100 THEN RAISE EXCEPTION 'Unexpected GreenHaven table count: % (expected at least 100)', table_count; END IF;
  IF function_count < 173 THEN RAISE EXCEPTION 'Unexpected GreenHaven function count: % (expected at least 173)', function_count; END IF;
END $$;

-- Required application tables must have RLS enabled.
DO $$
DECLARE missing text[] := ARRAY[]::text[]; n text; enabled boolean;
BEGIN
  FOREACH n IN ARRAY ARRAY[
    'gh_posts','gh_post_comments','gh_post_reactions','gh_follows',
    'gh_media_assets','gh_social_notifications','gh_messages','gh_user_profiles'
  ] LOOP
    SELECT c.relrowsecurity INTO enabled
    FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
    WHERE ns.nspname='public' AND c.relname=n;
    IF coalesce(enabled,false) = false THEN missing := array_append(missing,n); END IF;
  END LOOP;
  IF cardinality(missing)>0 THEN RAISE EXCEPTION 'Required RLS not enabled: %', missing; END IF;
END $$;

SELECT
  'GREENHAVEN DATABASE VALIDATION: PASS' AS result,
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname ~ '^(gh|ghc|ghpv)') AS greenhaven_tables,
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname ~ '^(gh|ghc|ghpv)') AS greenhaven_functions;

-- Review-only: SECURITY DEFINER functions still executable by PUBLIC.
SELECT n.nspname AS schema, p.proname,
       pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND p.prosecdef
  AND has_function_privilege('public', p.oid, 'EXECUTE')
ORDER BY 1,2,3;
