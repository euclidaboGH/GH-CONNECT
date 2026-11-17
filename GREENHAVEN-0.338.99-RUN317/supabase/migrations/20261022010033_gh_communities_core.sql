-- PASS 3 — Minimal durable communities (additive)
-- Does not replace local community-registry board/events; anchors membership + privacy server-side.
-- Reuses ghc_community_reports / ghc_community_moderation_log if already applied.

CREATE TABLE IF NOT EXISTS public.gh_communities (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  purpose         text NOT NULL DEFAULT '',
  description     text NOT NULL DEFAULT '',
  category        text NOT NULL DEFAULT 'general',
  privacy         text NOT NULL DEFAULT 'public'
    CHECK (privacy IN ('public', 'private', 'invite-only')),
  created_by      text NOT NULL,
  cover_image     text,
  rules           jsonb NOT NULL DEFAULT '[]'::jsonb,
  tags            jsonb NOT NULL DEFAULT '[]'::jsonb,
  welcome_message text NOT NULL DEFAULT '',
  conversation_id text,
  member_count    integer NOT NULL DEFAULT 1 CHECK (member_count >= 0),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_gh_communities_public
  ON public.gh_communities (created_at DESC)
  WHERE deleted_at IS NULL AND privacy = 'public';

CREATE TABLE IF NOT EXISTS public.gh_community_members (
  community_id    text NOT NULL REFERENCES public.gh_communities(id) ON DELETE CASCADE,
  gh_user_id      text NOT NULL,
  role            text NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'moderator', 'member')),
  status          text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'pending', 'banned', 'left')),
  joined_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (community_id, gh_user_id)
);

CREATE INDEX IF NOT EXISTS idx_gh_community_members_user
  ON public.gh_community_members (gh_user_id)
  WHERE status = 'active';

ALTER TABLE public.gh_communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gh_community_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gh_communities_no_client ON public.gh_communities;
CREATE POLICY gh_communities_no_client ON public.gh_communities
  FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS gh_community_members_no_client ON public.gh_community_members;
CREATE POLICY gh_community_members_no_client ON public.gh_community_members
  FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.gh_community_create(p_row jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text := COALESCE(p_row->>'id', '');
  v_creator text := COALESCE(p_row->>'createdBy', '');
BEGIN
  IF v_id = '' OR v_creator = '' OR COALESCE(p_row->>'name', '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  INSERT INTO public.gh_communities (
    id, name, purpose, description, category, privacy, created_by,
    cover_image, rules, tags, welcome_message, conversation_id
  ) VALUES (
    v_id,
    p_row->>'name',
    COALESCE(p_row->>'purpose', ''),
    COALESCE(p_row->>'description', ''),
    COALESCE(p_row->>'category', 'general'),
    COALESCE(p_row->>'privacy', 'public'),
    v_creator,
    NULLIF(p_row->>'coverImage', ''),
    COALESCE(p_row->'rules', '[]'::jsonb),
    COALESCE(p_row->'tags', '[]'::jsonb),
    COALESCE(p_row->>'welcomeMessage', ''),
    NULLIF(p_row->>'conversationId', '')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.gh_community_members (community_id, gh_user_id, role, status)
  VALUES (v_id, v_creator, 'owner', 'active')
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_community_join(
  p_community_id text,
  p_user_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_privacy text;
  v_status text;
BEGIN
  SELECT privacy INTO v_privacy FROM public.gh_communities
  WHERE id = p_community_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.gh_community_members
    WHERE community_id = p_community_id AND gh_user_id = p_user_id AND status = 'banned'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'BANNED');
  END IF;

  v_status := CASE WHEN v_privacy = 'public' THEN 'active' ELSE 'pending' END;

  INSERT INTO public.gh_community_members (community_id, gh_user_id, role, status)
  VALUES (p_community_id, p_user_id, 'member', v_status)
  ON CONFLICT (community_id, gh_user_id) DO UPDATE
    SET status = CASE
      WHEN gh_community_members.status = 'banned' THEN 'banned'
      WHEN gh_community_members.status = 'active' THEN 'active'
      ELSE EXCLUDED.status
    END;

  IF v_status = 'active' THEN
    UPDATE public.gh_communities
      SET member_count = (
        SELECT count(*) FROM public.gh_community_members
        WHERE community_id = p_community_id AND status = 'active'
      ),
      updated_at = now()
    WHERE id = p_community_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', v_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_community_leave(
  p_community_id text,
  p_user_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.gh_community_members
    SET status = 'left'
    WHERE community_id = p_community_id
      AND gh_user_id = p_user_id
      AND role <> 'owner';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_MEMBER_OR_OWNER');
  END IF;
  UPDATE public.gh_communities
    SET member_count = (
      SELECT count(*) FROM public.gh_community_members
      WHERE community_id = p_community_id AND status = 'active'
    ),
    updated_at = now()
  WHERE id = p_community_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_community_list_public(p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb ORDER BY q."createdAt" DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      c.id,
      c.name,
      c.purpose,
      c.description,
      c.category,
      c.privacy,
      c.created_by AS "createdBy",
      c.member_count AS "memberCount",
      (extract(epoch from c.created_at)*1000)::bigint AS "createdAt"
    FROM public.gh_communities c
    WHERE c.deleted_at IS NULL AND c.privacy = 'public'
    ORDER BY c.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100)
  ) q;
  RETURN jsonb_build_object('ok', true, 'communities', v_rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_community_member_role(
  p_community_id text,
  p_user_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role text; v_status text;
BEGIN
  SELECT role, status INTO v_role, v_status
  FROM public.gh_community_members
  WHERE community_id = p_community_id AND gh_user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'role', null, 'status', null);
  END IF;
  RETURN jsonb_build_object('ok', true, 'role', v_role, 'status', v_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.gh_community_create(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_community_join(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_community_leave(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_community_list_public(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_community_member_role(text, text) TO service_role;

-- PASS 4 — join request approve / reject (admin/owner only)

CREATE OR REPLACE FUNCTION public.gh_community_join_decide(
  p_community_id text,
  p_actor_id text,
  p_applicant_id text,
  p_approve boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role text;
  v_actor_status text;
BEGIN
  IF p_actor_id = p_applicant_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SELF_DECIDE');
  END IF;

  SELECT role, status INTO v_actor_role, v_actor_status
  FROM public.gh_community_members
  WHERE community_id = p_community_id AND gh_user_id = p_actor_id;

  IF NOT FOUND OR v_actor_status <> 'active' OR v_actor_role NOT IN ('owner', 'admin', 'moderator') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.gh_community_members
    WHERE community_id = p_community_id AND gh_user_id = p_applicant_id AND status = 'pending'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NO_PENDING');
  END IF;

  IF p_approve THEN
    UPDATE public.gh_community_members
      SET status = 'active', role = 'member'
      WHERE community_id = p_community_id AND gh_user_id = p_applicant_id;
    UPDATE public.gh_communities
      SET member_count = (
        SELECT count(*) FROM public.gh_community_members
        WHERE community_id = p_community_id AND status = 'active'
      ),
      updated_at = now()
    WHERE id = p_community_id;
    RETURN jsonb_build_object('ok', true, 'status', 'active');
  ELSE
    UPDATE public.gh_community_members
      SET status = 'left'
      WHERE community_id = p_community_id AND gh_user_id = p_applicant_id AND status = 'pending';
    RETURN jsonb_build_object('ok', true, 'status', 'rejected');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gh_community_join_decide(text, text, text, boolean) TO service_role;
