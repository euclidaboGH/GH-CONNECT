-- Run 270: close the community-membership -> realtime-chat revocation gap.
-- Applied to GH Connect Testnet under generated history version 20261110182120.
-- Function-only access-control patch plus reconciliation of stale chat grants.
-- No rows or conversation content are deleted; rejoining a Community does not
-- silently rejoin its Chat channel. Mainnet was not accessed.

CREATE OR REPLACE FUNCTION public.gh_community_join(
  p_community_id text,
  p_user_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_community public.gh_communities%ROWTYPE;
  v_status text;
BEGIN
  -- Serialize membership transitions with chat join/review/leave/removal.
  SELECT * INTO v_community
  FROM public.gh_communities
  WHERE id = trim(p_community_id) AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.gh_community_members
    WHERE community_id = v_community.id
      AND gh_user_id = trim(p_user_id)
      AND status = 'banned'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'BANNED');
  END IF;

  v_status := CASE WHEN v_community.privacy = 'public' THEN 'active' ELSE 'pending' END;
  INSERT INTO public.gh_community_members (community_id, gh_user_id, role, status)
  VALUES (v_community.id, trim(p_user_id), 'member', v_status)
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
      WHERE community_id = v_community.id AND status = 'active'
    ), updated_at = now()
    WHERE id = v_community.id;
  END IF;

  -- Deliberately do not restore gh_conversation_members here. Chat remains
  -- explicit opt-in even when a former member rejoins the Community.
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
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_community public.gh_communities%ROWTYPE;
  v_role text;
BEGIN
  SELECT * INTO v_community
  FROM public.gh_communities
  WHERE id = trim(p_community_id) AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  UPDATE public.gh_community_members
  SET status = 'left'
  WHERE community_id = v_community.id
    AND gh_user_id = trim(p_user_id)
    AND role <> 'owner'
    AND status IN ('active', 'pending')
  RETURNING role INTO v_role;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_MEMBER_OR_OWNER');
  END IF;

  -- Revoke the independent realtime conversation grant in the same transaction.
  UPDATE public.gh_conversation_members
  SET left_at = COALESCE(left_at, now())
  WHERE conversation_id = v_community.id
    AND gh_user_id = trim(p_user_id)
    AND left_at IS NULL;

  UPDATE public.gh_community_chat_requests
  SET status = 'cancelled', decided_at = now(), decided_by = trim(p_user_id)
  WHERE community_id = v_community.id
    AND gh_user_id = trim(p_user_id)
    AND status IN ('pending', 'approved');

  UPDATE public.gh_communities
  SET member_count = (
    SELECT count(*) FROM public.gh_community_members
    WHERE community_id = v_community.id AND status = 'active'
  ), updated_at = now()
  WHERE id = v_community.id;

  RETURN jsonb_build_object('ok', true, 'chatAccessRevoked', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_community_member_remove(
  p_community_id text,
  p_actor_id text,
  p_target_id text,
  p_ban boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_community public.gh_communities%ROWTYPE;
  v_actor_role text;
  v_target_role text;
BEGIN
  SELECT * INTO v_community
  FROM public.gh_communities
  WHERE id = trim(p_community_id) AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  v_actor_role := public.gh_community_platform_role(v_community.id, trim(p_actor_id));
  IF v_actor_role NOT IN ('owner', 'admin', 'moderator') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT role INTO v_target_role
  FROM public.gh_community_members
  WHERE community_id = v_community.id AND gh_user_id = trim(p_target_id)
  FOR UPDATE;
  IF v_target_role IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_target_role = 'owner' OR trim(p_target_id) = trim(p_actor_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CANNOT_REMOVE');
  END IF;
  IF v_actor_role = 'moderator' AND v_target_role IN ('admin', 'moderator') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  UPDATE public.gh_community_members
  SET status = CASE WHEN p_ban THEN 'banned' ELSE 'left' END
  WHERE community_id = v_community.id AND gh_user_id = trim(p_target_id);

  -- A removed/banned member must lose the separate conversation grant as well.
  UPDATE public.gh_conversation_members
  SET left_at = COALESCE(left_at, now())
  WHERE conversation_id = v_community.id
    AND gh_user_id = trim(p_target_id)
    AND left_at IS NULL;

  UPDATE public.gh_community_chat_requests
  SET status = 'declined', decided_at = now(), decided_by = trim(p_actor_id)
  WHERE community_id = v_community.id
    AND gh_user_id = trim(p_target_id)
    AND status IN ('pending', 'approved');

  UPDATE public.gh_communities
  SET member_count = (
    SELECT count(*) FROM public.gh_community_members
    WHERE community_id = v_community.id AND status = 'active'
  ), updated_at = now()
  WHERE id = v_community.id;

  INSERT INTO public.gh_community_moderation_log (
    id, community_id, actor_id, action, target_type, target_id, metadata
  ) VALUES (
    'mlog_' || replace(gen_random_uuid()::text, '-', ''),
    v_community.id,
    trim(p_actor_id),
    CASE WHEN p_ban THEN 'ban_member' ELSE 'remove_member' END,
    'member',
    trim(p_target_id),
    jsonb_build_object('chatAccessRevoked', true)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'status', CASE WHEN p_ban THEN 'banned' ELSE 'left' END,
    'chatAccessRevoked', true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_community_chat_state(
  p_community_id text,
  p_user_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_community public.gh_communities%ROWTYPE;
  v_member boolean := false;
  v_chat_member boolean := false;
  v_request_status text;
BEGIN
  SELECT * INTO v_community
  FROM public.gh_communities
  WHERE id = trim(p_community_id) AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.gh_community_members
    WHERE community_id = v_community.id
      AND gh_user_id = trim(p_user_id)
      AND status = 'active'
  ) INTO v_member;

  -- Defensive read-side guard: stale conversation membership is never enough.
  SELECT v_member AND EXISTS (
    SELECT 1 FROM public.gh_conversation_members
    WHERE conversation_id = v_community.id
      AND gh_user_id = trim(p_user_id)
      AND left_at IS NULL
  ) INTO v_chat_member;

  SELECT status INTO v_request_status
  FROM public.gh_community_chat_requests
  WHERE community_id = v_community.id AND gh_user_id = trim(p_user_id);

  RETURN jsonb_build_object(
    'ok', true,
    'enabled', v_community.chat_enabled,
    'privacy', v_community.chat_privacy,
    'communityMember', v_member,
    'chatMember', v_chat_member,
    'requestStatus', v_request_status,
    'owner', v_community.created_by = trim(p_user_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_community_join(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_community_leave(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_community_member_remove(text, text, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_community_chat_state(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_community_join(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_community_leave(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_community_member_remove(text, text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_community_chat_state(text, text) TO service_role;

COMMENT ON FUNCTION public.gh_community_leave(text, text) IS
  'Leaving a Community atomically revokes its separate realtime Chat membership and cancels any pending/approved chat request.';
COMMENT ON FUNCTION public.gh_community_member_remove(text, text, text, boolean) IS
  'Moderator removal/ban atomically revokes the removed member’s separate realtime Chat membership and records the revocation.';
COMMENT ON FUNCTION public.gh_community_chat_state(text, text) IS
  'Chat membership is reported only when the viewer also has active Community membership.';


-- Revoke any stale chat grants already present before this patch. This is
-- intentionally limited to community conversations and only removes access
-- where no active Community membership exists; messages and history are kept.
UPDATE public.gh_conversation_members cm
SET left_at = COALESCE(cm.left_at, now())
FROM public.gh_communities c
WHERE c.id = cm.conversation_id
  AND c.deleted_at IS NULL
  AND cm.left_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.gh_community_members m
    WHERE m.community_id = c.id
      AND m.gh_user_id = cm.gh_user_id
      AND m.status = 'active'
  );

UPDATE public.gh_community_chat_requests r
SET status = 'cancelled', decided_at = now(), decided_by = 'system:membership-reconciliation'
WHERE r.status IN ('pending', 'approved')
  AND EXISTS (SELECT 1 FROM public.gh_communities c WHERE c.id = r.community_id AND c.deleted_at IS NULL)
  AND NOT EXISTS (
    SELECT 1 FROM public.gh_community_members m
    WHERE m.community_id = r.community_id
      AND m.gh_user_id = r.gh_user_id
      AND m.status = 'active'
  );
