-- PASS 5 — durable mute/restrict + minimal polls + community role set
-- Additive; service-role only.

CREATE TABLE IF NOT EXISTS public.gh_user_mutes (
  muter_id   text NOT NULL,
  muted_id   text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (muter_id, muted_id),
  CONSTRAINT gh_user_mutes_no_self CHECK (muter_id <> muted_id)
);

CREATE TABLE IF NOT EXISTS public.gh_user_restricts (
  restrictor_id text NOT NULL,
  restricted_id text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (restrictor_id, restricted_id),
  CONSTRAINT gh_user_restricts_no_self CHECK (restrictor_id <> restricted_id)
);

ALTER TABLE public.gh_user_mutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gh_user_restricts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_user_mutes_no_client ON public.gh_user_mutes;
CREATE POLICY gh_user_mutes_no_client ON public.gh_user_mutes FOR ALL USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS gh_user_restricts_no_client ON public.gh_user_restricts;
CREATE POLICY gh_user_restricts_no_client ON public.gh_user_restricts FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.gh_mute_set(p_muter text, p_muted text, p_mute boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_muter = p_muted THEN RETURN jsonb_build_object('ok', false, 'error', 'SELF'); END IF;
  IF p_mute THEN
    INSERT INTO public.gh_user_mutes (muter_id, muted_id) VALUES (p_muter, p_muted) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.gh_user_mutes WHERE muter_id = p_muter AND muted_id = p_muted;
  END IF;
  RETURN jsonb_build_object('ok', true, 'muted', p_mute);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_restrict_set(p_restrictor text, p_restricted text, p_restrict boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_restrictor = p_restricted THEN RETURN jsonb_build_object('ok', false, 'error', 'SELF'); END IF;
  IF p_restrict THEN
    INSERT INTO public.gh_user_restricts (restrictor_id, restricted_id) VALUES (p_restrictor, p_restricted) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.gh_user_restricts WHERE restrictor_id = p_restrictor AND restricted_id = p_restricted;
  END IF;
  RETURN jsonb_build_object('ok', true, 'restricted', p_restrict);
END; $$;

GRANT EXECUTE ON FUNCTION public.gh_mute_set(text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_restrict_set(text, text, boolean) TO service_role;

CREATE TABLE IF NOT EXISTS public.gh_polls (
  id         text PRIMARY KEY,
  post_id    text,
  author_id  text NOT NULL,
  question   text NOT NULL,
  options    jsonb NOT NULL DEFAULT '[]'::jsonb,
  closes_at  timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gh_poll_votes (
  poll_id    text NOT NULL REFERENCES public.gh_polls(id) ON DELETE CASCADE,
  user_id    text NOT NULL,
  option_id  text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)
);

ALTER TABLE public.gh_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gh_poll_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_polls_no_client ON public.gh_polls;
CREATE POLICY gh_polls_no_client ON public.gh_polls FOR ALL USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS gh_poll_votes_no_client ON public.gh_poll_votes;
CREATE POLICY gh_poll_votes_no_client ON public.gh_poll_votes FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.gh_poll_create(p_row jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id text := COALESCE(p_row->>'id', '');
BEGIN
  IF v_id = '' OR COALESCE(p_row->>'authorId','') = '' OR COALESCE(p_row->>'question','') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  INSERT INTO public.gh_polls (id, post_id, author_id, question, options, closes_at)
  VALUES (
    v_id,
    NULLIF(p_row->>'postId',''),
    p_row->>'authorId',
    p_row->>'question',
    COALESCE(p_row->'options', '[]'::jsonb),
    CASE WHEN p_row ? 'closesAt' THEN to_timestamp((p_row->>'closesAt')::bigint/1000.0) ELSE NULL END
  ) ON CONFLICT (id) DO NOTHING;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_poll_vote(p_poll_id text, p_user_id text, p_option_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.gh_polls WHERE id = p_poll_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF EXISTS (SELECT 1 FROM public.gh_poll_votes WHERE poll_id = p_poll_id AND user_id = p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_VOTED');
  END IF;
  INSERT INTO public.gh_poll_votes (poll_id, user_id, option_id) VALUES (p_poll_id, p_user_id, p_option_id);
  RETURN jsonb_build_object('ok', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.gh_poll_create(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_poll_vote(text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.gh_community_set_role(
  p_community_id text,
  p_actor_id text,
  p_target_id text,
  p_role text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor_role text; v_target_role text;
BEGIN
  IF p_role NOT IN ('admin', 'moderator', 'member') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_ROLE');
  END IF;
  IF p_actor_id = p_target_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SELF_ROLE');
  END IF;
  SELECT role INTO v_actor_role FROM public.gh_community_members
    WHERE community_id = p_community_id AND gh_user_id = p_actor_id AND status = 'active';
  IF v_actor_role IS NULL OR v_actor_role NOT IN ('owner', 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  SELECT role INTO v_target_role FROM public.gh_community_members
    WHERE community_id = p_community_id AND gh_user_id = p_target_id AND status = 'active';
  IF v_target_role IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_MEMBER');
  END IF;
  IF v_target_role = 'owner' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CANNOT_CHANGE_OWNER');
  END IF;
  IF v_actor_role = 'admin' AND v_target_role = 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  UPDATE public.gh_community_members SET role = p_role
    WHERE community_id = p_community_id AND gh_user_id = p_target_id;
  RETURN jsonb_build_object('ok', true, 'role', p_role);
END; $$;

GRANT EXECUTE ON FUNCTION public.gh_community_set_role(text, text, text, text) TO service_role;
