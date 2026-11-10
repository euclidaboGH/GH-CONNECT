-- Hardening follow-up: the reaction roster must not disclose engagement on
-- posts the authenticated actor is not allowed to see. Safe to re-run.
CREATE OR REPLACE FUNCTION public.gh_list_post_reactions(
  p_actor_id text,
  p_post_id text,
  p_reaction text DEFAULT 'like',
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_reaction text := lower(trim(COALESCE(p_reaction, 'like')));
  v_author text;
  v_visibility text;
  v_actor text := trim(COALESCE(p_actor_id, ''));
  v_rows jsonb;
BEGIN
  IF p_post_id IS NULL OR length(trim(p_post_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_POST');
  END IF;
  IF v_actor = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ACTOR_REQUIRED');
  END IF;
  SELECT author_id, visibility INTO v_author, v_visibility
  FROM public.gh_posts
  WHERE id = trim(p_post_id) AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  -- Keep the roster no more visible than the post itself.
  IF EXISTS (
    SELECT 1 FROM public.ghc_user_blocks b
    WHERE (b.blocker_id = v_actor AND b.blocked_id = v_author)
       OR (b.blocker_id = v_author AND b.blocked_id = v_actor)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_visibility = 'public' OR v_author = v_actor THEN
    NULL;
  ELSIF v_visibility = 'followers' AND EXISTS (
    SELECT 1 FROM public.gh_follows f
    WHERE f.follower_id = v_actor AND f.following_id = v_author
  ) THEN
    NULL;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb ORDER BY q."createdAt" DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      r.user_id AS "userId",
      COALESCE(pr.display_name, pr.username, 'Member') AS "displayName",
      CASE
        WHEN jsonb_typeof(pr.photos) = 'array' AND jsonb_array_length(pr.photos) > 0
          THEN pr.photos->>0
        ELSE ''
      END AS "avatarUrl",
      r.reaction AS "reaction",
      (extract(epoch from r.created_at)*1000)::bigint AS "createdAt"
    FROM public.gh_post_reactions r
    LEFT JOIN public.gh_user_profiles pr ON pr.gh_user_id = r.user_id
    WHERE r.post_id = p_post_id
      AND (v_reaction = '' OR r.reaction = v_reaction)
    ORDER BY r.created_at DESC
    LIMIT v_limit
  ) q;

  RETURN jsonb_build_object(
    'ok', true,
    'postId', p_post_id,
    'reaction', v_reaction,
    'users', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_list_post_reactions(text, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_list_post_reactions(text, text, text, integer) TO service_role;
