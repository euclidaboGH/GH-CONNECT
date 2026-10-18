-- GreenHaven product policy update: creators may self-curate their own content.
-- Self-curation is an encouragement/display signal only: it must never generate GHC
-- reward, reputation points, or independent-reviewer evidence. TESTNET FIRST.
-- The prior 004 function is replaced here with the same SET/toggle and access checks,
-- removing only the author-equals-voter rejection.
CREATE OR REPLACE FUNCTION public.gh_post_curation_set(
  p_post_id text, p_user_id text, p_choice text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_choice text := lower(trim(coalesce(p_choice, 'neutral')));
  v_author text; v_visibility text; v_prev text;
  v_up integer; v_down integer; v_state text := 'neutral';
BEGIN
  IF p_post_id IS NULL OR length(trim(p_post_id)) = 0 OR length(trim(p_post_id)) > 128 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CONTENT_REQUIRED');
  END IF;
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ACTOR_REQUIRED');
  END IF;
  IF v_choice NOT IN ('upvote', 'downvote', 'neutral') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CHOICE');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('gh_curate:' || trim(p_post_id) || ':' || trim(p_user_id)));
  SELECT author_id, visibility INTO v_author, v_visibility
  FROM public.gh_posts WHERE id = trim(p_post_id) AND deleted_at IS NULL;
  IF v_author IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF EXISTS (SELECT 1 FROM public.ghc_user_blocks
    WHERE (blocker_id = trim(p_user_id) AND blocked_id = v_author)
       OR (blocker_id = v_author AND blocked_id = trim(p_user_id))) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_visibility = 'public' THEN NULL;
  ELSIF v_visibility = 'followers' THEN
    IF NOT EXISTS (SELECT 1 FROM public.gh_follows
      WHERE follower_id = trim(p_user_id) AND following_id = v_author) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;
  ELSE RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
  SELECT choice INTO v_prev FROM public.gh_post_curations
  WHERE post_id = trim(p_post_id) AND user_id = trim(p_user_id);
  IF v_prev IS NOT NULL AND v_choice = v_prev THEN v_choice := 'neutral'; END IF;
  IF v_prev IS NOT NULL THEN
    DELETE FROM public.gh_post_curations WHERE post_id = trim(p_post_id) AND user_id = trim(p_user_id);
    IF v_prev = 'upvote' THEN UPDATE public.gh_posts SET upvote_count = greatest(upvote_count - 1, 0), updated_at = now() WHERE id = trim(p_post_id);
    ELSIF v_prev = 'downvote' THEN UPDATE public.gh_posts SET downvote_count = greatest(downvote_count - 1, 0), updated_at = now() WHERE id = trim(p_post_id); END IF;
  END IF;
  IF v_choice IN ('upvote', 'downvote') THEN
    INSERT INTO public.gh_post_curations (post_id, user_id, choice) VALUES (trim(p_post_id), trim(p_user_id), v_choice)
    ON CONFLICT (post_id, user_id) DO UPDATE SET choice = EXCLUDED.choice, updated_at = now();
    IF v_choice = 'upvote' THEN UPDATE public.gh_posts SET upvote_count = upvote_count + 1, updated_at = now() WHERE id = trim(p_post_id);
    ELSE UPDATE public.gh_posts SET downvote_count = downvote_count + 1, updated_at = now() WHERE id = trim(p_post_id); END IF;
    v_state := v_choice;
  END IF;
  SELECT upvote_count, downvote_count INTO v_up, v_down FROM public.gh_posts WHERE id = trim(p_post_id);
  RETURN jsonb_build_object('ok', true, 'choice', v_state, 'upvoteCount', coalesce(v_up, 0), 'downvoteCount', coalesce(v_down, 0));
END; $$;
REVOKE ALL ON FUNCTION public.gh_post_curation_set(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_post_curation_set(text, text, text) TO service_role;
COMMENT ON FUNCTION public.gh_post_curation_set(text, text, text) IS
  'Author may self-curate for display/encouragement; self-curation is never reward or independent-settlement evidence.';
