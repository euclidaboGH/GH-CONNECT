-- Community chat governance follow-up: never mutate a chat request to approved
-- before verifying that the requester still has active Community membership.
-- This preserves the owner-only approval rule and makes approval fail atomically.
CREATE OR REPLACE FUNCTION public.gh_community_chat_review(
  p_community_id text,
  p_owner_id text,
  p_user_id text,
  p_approve boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  c public.gh_communities%ROWTYPE;
BEGIN
  SELECT * INTO c
  FROM public.gh_communities
  WHERE id = trim(p_community_id) AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF c.created_by <> trim(p_owner_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'OWNER_ONLY');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.gh_community_chat_requests
    WHERE community_id = c.id
      AND gh_user_id = trim(p_user_id)
      AND status = 'pending'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REQUEST_NOT_FOUND');
  END IF;

  -- Approval must prove current Community membership before changing the
  -- durable request state or adding the user to the realtime conversation.
  IF p_approve AND NOT EXISTS (
    SELECT 1
    FROM public.gh_community_members
    WHERE community_id = c.id
      AND gh_user_id = trim(p_user_id)
      AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'COMMUNITY_MEMBERSHIP_REQUIRED');
  END IF;

  UPDATE public.gh_community_chat_requests
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'declined' END,
      decided_at = now(),
      decided_by = trim(p_owner_id)
  WHERE community_id = c.id
    AND gh_user_id = trim(p_user_id)
    AND status = 'pending';

  IF p_approve THEN
    INSERT INTO public.gh_conversation_members(
      conversation_id, gh_user_id, role, left_at
    ) VALUES (
      c.id, trim(p_user_id), 'member', NULL
    )
    ON CONFLICT(conversation_id, gh_user_id)
    DO UPDATE SET left_at = NULL;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'status', CASE WHEN p_approve THEN 'approved' ELSE 'declined' END,
    'conversationId', CASE WHEN p_approve THEN c.id ELSE NULL END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_community_chat_review(text, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_community_chat_review(text, text, text, boolean) TO service_role;
COMMENT ON FUNCTION public.gh_community_chat_review(text, text, text, boolean) IS
  'Owner-only chat request decision. Approval verifies active Community membership before mutating request state or conversation membership.';
