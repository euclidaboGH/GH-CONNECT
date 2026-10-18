-- GreenHaven: durable story reactions so engagement is visible on first load.
-- All writes go through a SECURITY DEFINER RPC called only by the authenticated API.

CREATE TABLE IF NOT EXISTS public.gh_story_reactions (
  story_id   text NOT NULL REFERENCES public.gh_stories(id) ON DELETE CASCADE,
  user_id    text NOT NULL,
  reaction   text NOT NULL CHECK (reaction IN ('💚', '🔥', '👏', '😂', '😍')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, user_id, reaction)
);

CREATE INDEX IF NOT EXISTS idx_gh_story_reactions_story
  ON public.gh_story_reactions (story_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gh_story_reactions_user
  ON public.gh_story_reactions (user_id, created_at DESC);

ALTER TABLE public.gh_story_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_story_reactions_no_client ON public.gh_story_reactions;
CREATE POLICY gh_story_reactions_no_client ON public.gh_story_reactions
  FOR ALL USING (false) WITH CHECK (false);

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
  v_active boolean;
  v_counts jsonb;
  v_mine jsonb;
BEGIN
  IF p_user_id IS NULL OR btrim(p_user_id) = '' OR p_reaction IS NULL OR p_reaction NOT IN ('💚', '🔥', '👏', '😂', '😍') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_REACTION');
  END IF;

  SELECT owner_id INTO v_owner
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

REVOKE ALL ON FUNCTION public.gh_story_reaction_toggle(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_story_reaction_toggle(text, text, text) TO service_role;
