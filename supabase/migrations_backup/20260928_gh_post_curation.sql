-- Phase 3: post curation (upvote / downvote) — quality signal only.
-- NOT financial. No GHC/Pi/reputation/Curation Power weights.
-- One active choice per (post_id, user_id). Likes remain separate.

ALTER TABLE public.gh_posts
  ADD COLUMN IF NOT EXISTS upvote_count integer NOT NULL DEFAULT 0
    CHECK (upvote_count >= 0);
ALTER TABLE public.gh_posts
  ADD COLUMN IF NOT EXISTS downvote_count integer NOT NULL DEFAULT 0
    CHECK (downvote_count >= 0);

CREATE TABLE IF NOT EXISTS public.gh_post_curations (
  post_id     text NOT NULL,
  user_id     text NOT NULL,
  choice      text NOT NULL CHECK (choice IN ('upvote', 'downvote')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_gh_post_curations_post_choice
  ON public.gh_post_curations (post_id, choice);

ALTER TABLE public.gh_post_curations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_post_curations_no_client ON public.gh_post_curations;
CREATE POLICY gh_post_curations_no_client ON public.gh_post_curations
  FOR ALL USING (false) WITH CHECK (false);

/**
 * Atomic curation set/toggle.
 * p_choice: 'upvote' | 'downvote' | 'neutral' (clear vote)
 * Returns authoritative counts + viewer state.
 */
CREATE OR REPLACE FUNCTION public.gh_post_curation_set(
  p_post_id text,
  p_user_id text,
  p_choice text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_choice text := lower(trim(COALESCE(p_choice, 'neutral')));
  v_author text;
  v_visibility text;
  v_prev text;
  v_up integer;
  v_down integer;
  v_state text := 'neutral';
BEGIN
  IF p_post_id IS NULL OR length(trim(p_post_id)) = 0 THEN
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
  FROM public.gh_posts
  WHERE id = trim(p_post_id) AND deleted_at IS NULL;

  IF v_author IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ghc_user_blocks
    WHERE (blocker_id = trim(p_user_id) AND blocked_id = v_author)
       OR (blocker_id = v_author AND blocked_id = trim(p_user_id))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF v_visibility = 'public' OR v_author = trim(p_user_id) THEN
    NULL;
  ELSIF v_visibility = 'followers' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.gh_follows
      WHERE follower_id = trim(p_user_id) AND following_id = v_author
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT choice INTO v_prev
  FROM public.gh_post_curations
  WHERE post_id = trim(p_post_id) AND user_id = trim(p_user_id);

  -- Toggle off if same choice sent again
  IF v_prev IS NOT NULL AND v_choice = v_prev THEN
    v_choice := 'neutral';
  END IF;

  IF v_prev IS NOT NULL THEN
    DELETE FROM public.gh_post_curations
    WHERE post_id = trim(p_post_id) AND user_id = trim(p_user_id);
    IF v_prev = 'upvote' THEN
      UPDATE public.gh_posts
        SET upvote_count = GREATEST(upvote_count - 1, 0), updated_at = now()
        WHERE id = trim(p_post_id);
    ELSIF v_prev = 'downvote' THEN
      UPDATE public.gh_posts
        SET downvote_count = GREATEST(downvote_count - 1, 0), updated_at = now()
        WHERE id = trim(p_post_id);
    END IF;
  END IF;

  IF v_choice IN ('upvote', 'downvote') THEN
    INSERT INTO public.gh_post_curations (post_id, user_id, choice)
    VALUES (trim(p_post_id), trim(p_user_id), v_choice)
    ON CONFLICT (post_id, user_id) DO UPDATE
      SET choice = EXCLUDED.choice, updated_at = now();
    IF v_choice = 'upvote' THEN
      UPDATE public.gh_posts
        SET upvote_count = upvote_count + 1, updated_at = now()
        WHERE id = trim(p_post_id);
    ELSE
      UPDATE public.gh_posts
        SET downvote_count = downvote_count + 1, updated_at = now()
        WHERE id = trim(p_post_id);
    END IF;
    v_state := v_choice;
  ELSE
    v_state := 'neutral';
  END IF;

  SELECT upvote_count, downvote_count INTO v_up, v_down
  FROM public.gh_posts WHERE id = trim(p_post_id);

  RETURN jsonb_build_object(
    'ok', true,
    'choice', v_state,
    'upvoteCount', COALESCE(v_up, 0),
    'downvoteCount', COALESCE(v_down, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_post_curation_set(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_post_curation_set(text, text, text) TO service_role;

COMMENT ON TABLE public.gh_post_curations IS
  'Phase 3 curation votes. Quality signal only. Independent of likes.';
