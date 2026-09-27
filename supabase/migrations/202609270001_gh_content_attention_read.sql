-- Phase 2.5: attention read model (aggregates only; no economy).
-- Spec: docs/GH_ATTENTION.md
-- Uses denormalized counters on gh_posts + gh_saves count + optional complete count.
-- Does NOT scan full event history for feed listing.

CREATE OR REPLACE FUNCTION public.gh_post_attention_summary(
  p_post_id text,
  p_viewer_id text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post public.gh_posts%ROWTYPE;
  v_saves integer := 0;
  v_completes integer := 0;
  v_is_author boolean := false;
  v_views integer := 0;
  v_qviews integer := 0;
BEGIN
  IF p_post_id IS NULL OR length(trim(p_post_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CONTENT_REQUIRED');
  END IF;
  IF p_viewer_id IS NULL OR length(trim(p_viewer_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ACTOR_REQUIRED');
  END IF;

  SELECT * INTO v_post
  FROM public.gh_posts
  WHERE id = trim(p_post_id) AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  v_is_author := (v_post.author_id = trim(p_viewer_id));

  -- Non-authors: only public posts may expose coarse public aggregates
  IF NOT v_is_author THEN
    IF v_post.visibility <> 'public' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;
  END IF;

  -- Denormalized counters (O(1) on post row; requires 20260927_gh_content_events.sql)
  SELECT
    COALESCE(p.view_count, 0),
    COALESCE(p.qualified_view_count, 0)
  INTO v_views, v_qviews
  FROM public.gh_posts p
  WHERE p.id = v_post.id;

  SELECT COUNT(*)::integer INTO v_saves
  FROM public.gh_saves
  WHERE post_id = v_post.id;

  -- Completes: count distinct actors (bounded by post; not a full-table scan)
  SELECT COUNT(*)::integer INTO v_completes
  FROM public.gh_content_events
  WHERE content_id = v_post.id
    AND event_type = 'complete';

  -- Author gets full private insights; public viewers get the same counters
  -- (no viewer identity list, no raw events).
  RETURN jsonb_build_object(
    'ok', true,
    'postId', v_post.id,
    'isAuthor', v_is_author,
    'visibility', v_post.visibility,
    'metrics', jsonb_build_object(
      'views', v_views,
      'qualifiedViews', v_qviews,
      'completions', v_completes,
      'saves', v_saves,
      'shares', COALESCE(v_post.share_count, 0),
      'likes', COALESCE(v_post.like_count, 0),
      'comments', COALESCE(v_post.comment_count, 0)
    ),
    'source', 'server_aggregates'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_post_attention_summary(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_post_attention_summary(text, text) TO service_role;

COMMENT ON FUNCTION public.gh_post_attention_summary IS
  'Phase 2.5 read model. Author or public-post viewer only. No raw event export. No economy.';
