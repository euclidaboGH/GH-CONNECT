-- GH-CONNECT Phase 3 — canonical story audience enforcement for mutual matches.
-- Additive replacement of story list/view/reaction RPCs; no data rewrite or balance change.
-- A match is a reciprocal durable like/superlike in ghc_match_signals.
-- Review against the target migration history and disposable PostgreSQL before applying.

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

  UPDATE public.gh_stories
    SET status = 'expired'
    WHERE status = 'published' AND expires_at <= now();

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
      (extract(epoch from s.expires_at) * 1000)::bigint AS "expiresAt"
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
            WHERE f1.follower_id = p_viewer_id AND f1.following_id = s.owner_id
          )
        )
        OR (
          s.audience = 'matches-only'
          AND EXISTS (
            SELECT 1
            FROM public.ghc_match_signals viewer_signal
            JOIN public.ghc_match_signals owner_signal
              ON owner_signal.from_user_id = viewer_signal.to_user_id
             AND owner_signal.to_user_id = viewer_signal.from_user_id
            WHERE viewer_signal.from_user_id = p_viewer_id
              AND viewer_signal.to_user_id = s.owner_id
              AND viewer_signal.signal IN ('like', 'superlike')
              AND owner_signal.signal IN ('like', 'superlike')
          )
        )
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

CREATE OR REPLACE FUNCTION public.gh_story_view(p_story_id text, p_viewer_id text)
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
  IF p_viewer_id IS NULL OR btrim(p_viewer_id) = '' OR p_story_id IS NULL OR btrim(p_story_id) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_REQUEST');
  END IF;

  SELECT owner_id, audience INTO v_owner, v_audience
  FROM public.gh_stories
  WHERE id = p_story_id AND status = 'published' AND expires_at > now();
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
      SELECT 1 FROM public.gh_follows f1
      JOIN public.gh_follows f2
        ON f2.follower_id = f1.following_id
       AND f2.following_id = f1.follower_id
      WHERE f1.follower_id = p_viewer_id AND f1.following_id = v_owner
    ) INTO v_allowed;
  ELSIF v_audience = 'matches-only' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.ghc_match_signals viewer_signal
      JOIN public.ghc_match_signals owner_signal
        ON owner_signal.from_user_id = viewer_signal.to_user_id
       AND owner_signal.to_user_id = viewer_signal.from_user_id
      WHERE viewer_signal.from_user_id = p_viewer_id
        AND viewer_signal.to_user_id = v_owner
        AND viewer_signal.signal IN ('like', 'superlike')
        AND owner_signal.signal IN ('like', 'superlike')
    ) INTO v_allowed;
  END IF;

  IF NOT v_allowed THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AVAILABLE');
  END IF;

  IF v_owner <> p_viewer_id THEN
    INSERT INTO public.gh_story_views (story_id, viewer_id)
    VALUES (p_story_id, p_viewer_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_story_reaction_toggle(
  p_story_id text,
  p_user_id text,
  p_reaction text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner text;
  v_audience text;
  v_allowed boolean := false;
  v_active boolean;
  v_counts jsonb;
  v_mine jsonb;
BEGIN
  IF p_user_id IS NULL OR btrim(p_user_id) = '' OR p_story_id IS NULL OR btrim(p_story_id) = ''
     OR p_reaction IS NULL OR p_reaction NOT IN ('💚', '🔥', '👏', '😂', '😍') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_REACTION');
  END IF;

  SELECT owner_id, audience INTO v_owner, v_audience
  FROM public.gh_stories
  WHERE id = p_story_id AND status = 'published' AND expires_at > now();
  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AVAILABLE');
  END IF;
  IF v_owner = p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SELF_REACTION');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.ghc_user_blocks b
    WHERE (b.blocker_id = p_user_id AND b.blocked_id = v_owner)
       OR (b.blocker_id = v_owner AND b.blocked_id = p_user_id)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AVAILABLE');
  END IF;

  IF v_audience = 'everyone' THEN
    v_allowed := true;
  ELSIF v_audience = 'followers' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.gh_follows f
      WHERE f.follower_id = p_user_id AND f.following_id = v_owner
    ) INTO v_allowed;
  ELSIF v_audience = 'friends' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.gh_follows f1
      JOIN public.gh_follows f2
        ON f2.follower_id = f1.following_id
       AND f2.following_id = f1.follower_id
      WHERE f1.follower_id = p_user_id AND f1.following_id = v_owner
    ) INTO v_allowed;
  ELSIF v_audience = 'matches-only' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.ghc_match_signals viewer_signal
      JOIN public.ghc_match_signals owner_signal
        ON owner_signal.from_user_id = viewer_signal.to_user_id
       AND owner_signal.to_user_id = viewer_signal.from_user_id
      WHERE viewer_signal.from_user_id = p_user_id
        AND viewer_signal.to_user_id = v_owner
        AND viewer_signal.signal IN ('like', 'superlike')
        AND owner_signal.signal IN ('like', 'superlike')
    ) INTO v_allowed;
  END IF;

  IF NOT v_allowed THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AVAILABLE');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.gh_story_reactions
    WHERE story_id = p_story_id AND user_id = p_user_id AND reaction = p_reaction
  ) INTO v_active;

  IF v_active THEN
    DELETE FROM public.gh_story_reactions
    WHERE story_id = p_story_id AND user_id = p_user_id AND reaction = p_reaction;
  ELSE
    INSERT INTO public.gh_story_reactions (story_id, user_id, reaction)
    VALUES (p_story_id, p_user_id, p_reaction)
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT COALESCE(jsonb_object_agg(reaction, reaction_count), '{}'::jsonb)
    INTO v_counts
  FROM (
    SELECT reaction, count(*)::integer AS reaction_count
    FROM public.gh_story_reactions
    WHERE story_id = p_story_id
    GROUP BY reaction
  ) counts;

  SELECT COALESCE(jsonb_agg(reaction ORDER BY reaction), '[]'::jsonb)
    INTO v_mine
  FROM public.gh_story_reactions
  WHERE story_id = p_story_id AND user_id = p_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'active', NOT v_active,
    'reaction', p_reaction,
    'reactionCounts', v_counts,
    'viewerReactions', v_mine,
    'reactionCount', (SELECT count(*)::integer FROM public.gh_story_reactions WHERE story_id = p_story_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_story_list_active(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_story_view(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_story_reaction_toggle(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_story_list_active(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_story_view(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_story_reaction_toggle(text, text, text) TO service_role;
