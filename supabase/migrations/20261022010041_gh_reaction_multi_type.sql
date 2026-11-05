-- Multi-type durable reactions (allowlist) + clearer toggle response.
-- Safe on existing gh_post_reactions (post_id, user_id, reaction) PK.
-- like_count on gh_posts only moves for reaction = 'like'.

CREATE OR REPLACE FUNCTION public.gh_reaction_toggle(
  p_post_id text,
  p_user_id text,
  p_reaction text DEFAULT 'like'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
  v_count integer;
  v_reaction text := lower(trim(COALESCE(p_reaction, 'like')));
BEGIN
  IF v_reaction NOT IN (
    'like', 'love', 'laugh', 'wow', 'sad', 'angry',
    'support', 'inspire', 'insight', 'celebrate'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_REACTION');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.gh_posts WHERE id = p_post_id AND deleted_at IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.gh_post_reactions
    WHERE post_id = p_post_id AND user_id = p_user_id AND reaction = v_reaction
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM public.gh_post_reactions
    WHERE post_id = p_post_id AND user_id = p_user_id AND reaction = v_reaction;
    IF v_reaction = 'like' THEN
      UPDATE public.gh_posts
        SET like_count = GREATEST(like_count - 1, 0), updated_at = now()
        WHERE id = p_post_id;
    END IF;
  ELSE
    INSERT INTO public.gh_post_reactions (post_id, user_id, reaction)
    VALUES (p_post_id, p_user_id, v_reaction)
    ON CONFLICT DO NOTHING;
    IF v_reaction = 'like' THEN
      UPDATE public.gh_posts
        SET like_count = like_count + 1, updated_at = now()
        WHERE id = p_post_id;
    END IF;
  END IF;

  SELECT like_count INTO v_count FROM public.gh_posts WHERE id = p_post_id;
  RETURN jsonb_build_object(
    'ok', true,
    'reaction', v_reaction,
    'active', NOT v_exists,
    'liked', CASE WHEN v_reaction = 'like' THEN NOT v_exists ELSE
      EXISTS (
        SELECT 1 FROM public.gh_post_reactions
        WHERE post_id = p_post_id AND user_id = p_user_id AND reaction = 'like'
      )
    END,
    'likeCount', COALESCE(v_count, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_reaction_toggle(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_reaction_toggle(text, text, text) TO service_role;
