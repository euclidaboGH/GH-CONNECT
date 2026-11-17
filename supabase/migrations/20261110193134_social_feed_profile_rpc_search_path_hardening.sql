-- Run #272: harden the two service-only social read RPCs that were still using
-- search_path=public. Their existing grants are intentionally unchanged.
ALTER FUNCTION public.gh_post_feed_engagement_batch(text[], text)
  SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.gh_comment_reaction_list(text)
  SET search_path = pg_catalog, public, pg_temp;
