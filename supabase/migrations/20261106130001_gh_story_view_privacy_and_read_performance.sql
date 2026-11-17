-- Phase 2 Stories: enforce audience authorization on direct view writes and
-- keep the active-story read RPC side-effect-free while returning viewer state.
-- Validate on disposable PostgreSQL and reconcile Testnet history before apply.

CREATE INDEX IF NOT EXISTS idx_gh_story_views_viewer_story
  ON public.gh_story_views (viewer_id, story_id);

CREATE OR REPLACE FUNCTION public.gh_story_list_active(p_viewer_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows jsonb;
BEGIN
  IF p_viewer_id IS NULL OR btrim(p_viewer_id) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'VIEWER_REQUIRED');
  END IF;

  -- Read-only: expired rows are excluded by predicate and cleaned by lifecycle
  -- maintenance, not mutated as a side effect of every feed/story refresh.
  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb ORDER BY q."createdAt" DESC), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT
      s.id,
      s.owner_id AS "ownerId",
      s.owner_name AS name,
      s.owner_photo AS photo,
      s.text,
      s.background,
      CASE WHEN s.media_url IS NOT NULL THEN
        jsonb_build_object('type', COALESCE(s.media_type, 'image'), 'url', s.media_url)
      ELSE NULL END AS media,
      s.audience,
      s.status,
      (extract(epoch from s.created_at) * 1000)::bigint AS "createdAt",
      (extract(epoch from s.expires_at) * 1000)::bigint AS "expiresAt",
      EXISTS (
        SELECT 1 FROM public.gh_story_views sv
        WHERE sv.story_id = s.id AND sv.viewer_id = p_viewer_id
      ) AS "viewerHasViewed",
      COALESCE((
        SELECT jsonb_object_agg(r.reaction, r.reaction_count)
        FROM (
          SELECT sr.reaction, count(*)::integer AS reaction_count
          FROM public.gh_story_reactions sr
          WHERE sr.story_id = s.id
          GROUP BY sr.reaction
        ) r
      ), '{}'::jsonb) AS "reactionCounts",
      COALESCE((
        SELECT jsonb_agg(mine.reaction ORDER BY mine.reaction)
        FROM public.gh_story_reactions mine
        WHERE mine.story_id = s.id AND mine.user_id = p_viewer_id
      ), '[]'::jsonb) AS "viewerReactions",
      (SELECT count(*)::integer FROM public.gh_story_reactions total WHERE total.story_id = s.id) AS "reactionCount"
    FROM public.gh_stories s
    WHERE s.status = 'published'
      AND s.expires_at > now()
      AND (
        s.owner_id = p_viewer_id
        OR s.audience = 'everyone'
        OR (
          s.audience = 'followers'
          AND EXISTS (
            SELECT 1 FROM public.gh_follows f
            WHERE f.follower_id = p_viewer_id AND f.following_id = s.owner_id
          )
        )
        OR (
          s.audience = 'friends'
          AND EXISTS (
            SELECT 1 FROM public.gh_follows f1
            JOIN public.gh_follows f2
              ON f2.follower_id = f1.following_id
             AND f2.following_id = f1.follower_id
            WHERE f1.follower_id = p_viewer_id
              AND f1.following_id = s.owner_id
          )
        )
        -- matches-only and private remain owner-only until a canonical durable
        -- match relation and explicit private-audience policy are implemented.
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.ghc_user_blocks b
        WHERE (b.blocker_id = p_viewer_id AND b.blocked_id = s.owner_id)
           OR (b.blocker_id = s.owner_id AND b.blocked_id = p_viewer_id)
      )
    ORDER BY s.created_at DESC
    LIMIT 100
  ) q;

  RETURN jsonb_build_object('ok', true, 'stories', v_rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_story_view_authorized_v2(p_story_id text, p_viewer_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner text;
  v_audience text;
  v_allowed boolean := false;
BEGIN
  IF p_story_id IS NULL OR btrim(p_story_id) = ''
     OR p_viewer_id IS NULL OR btrim(p_viewer_id) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_REQUEST');
  END IF;

  SELECT owner_id, audience
    INTO v_owner, v_audience
  FROM public.gh_stories
  WHERE id = p_story_id
    AND status = 'published'
    AND expires_at > now();

  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AVAILABLE');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ghc_user_blocks b
    WHERE (b.blocker_id = p_viewer_id AND b.blocked_id = v_owner)
       OR (b.blocker_id = v_owner AND b.blocked_id = p_viewer_id)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AVAILABLE');
  END IF;

  IF v_owner = p_viewer_id OR v_audience = 'everyone' THEN
    v_allowed := true;
  ELSIF v_audience = 'followers' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.gh_follows f
      WHERE f.follower_id = p_viewer_id AND f.following_id = v_owner
    ) INTO v_allowed;
  ELSIF v_audience = 'friends' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.gh_follows f1
      JOIN public.gh_follows f2
        ON f2.follower_id = f1.following_id
       AND f2.following_id = f1.follower_id
      WHERE f1.follower_id = p_viewer_id
        AND f1.following_id = v_owner
    ) INTO v_allowed;
  END IF;

  -- private and matches-only intentionally fail closed for non-owners.
  IF NOT v_allowed THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AVAILABLE');
  END IF;

  -- Do not count an author's own view as audience engagement.
  IF v_owner <> p_viewer_id THEN
    INSERT INTO public.gh_story_views (story_id, viewer_id)
    VALUES (p_story_id, p_viewer_id)
    ON CONFLICT (story_id, viewer_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('ok', true, 'durable', true);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_story_list_active(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_story_list_active(text) TO service_role;
REVOKE ALL ON FUNCTION public.gh_story_view(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_story_view(text, text) FROM service_role;
REVOKE ALL ON FUNCTION public.gh_story_view_authorized_v2(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_story_view_authorized_v2(text, text) TO service_role;
