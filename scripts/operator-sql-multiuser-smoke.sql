-- Multi-user smoke SQL (Supabase SQL editor, read-only checks)
-- Do not invent data. Confirm non-null regclass / true has_* after migrations.

-- Tables
SELECT to_regclass('public.gh_user_profiles') AS gh_user_profiles;
SELECT to_regclass('public.ghc_connection_requests') AS ghc_connection_requests;
SELECT to_regclass('public.ghc_match_signals') AS ghc_match_signals;
SELECT to_regclass('public.gh_social_notifications') AS gh_social_notifications;
SELECT to_regclass('public.gh_conversations') AS gh_conversations;
SELECT to_regclass('public.gh_messages') AS gh_messages;
SELECT to_regclass('public.gh_marketplace_listings') AS gh_marketplace_listings;
SELECT to_regclass('public.gh_posts') AS gh_posts;
SELECT to_regclass('public.gh_post_reactions') AS gh_post_reactions;
SELECT to_regclass('public.gh_post_comments') AS gh_post_comments;
SELECT to_regclass('public.gh_follows') AS gh_follows;

-- RPCs required for cross-account social
SELECT EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'ghc_connection_request_upsert'
) AS has_connection_upsert;

SELECT EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'gh_reaction_toggle'
) AS has_reaction_toggle;

SELECT EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname LIKE 'gh_comment%'
) AS has_comment_rpc;

SELECT EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'gh_post_list_feed'
) AS has_post_list_feed;

SELECT EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'gh_follow_set'
) AS has_follow_set;

SELECT EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'gh_social_notification_create'
) AS has_notif_create;
