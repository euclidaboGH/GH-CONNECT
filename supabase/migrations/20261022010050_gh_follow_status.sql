-- Phase 10: compact follow status + counts (additive).
-- Does not alter gh_follows schema. Session actor must be passed by server only.

CREATE OR REPLACE FUNCTION public.gh_follow_status(
  p_actor_id text,
  p_target_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_following boolean := false;
  v_followers_count integer := 0;
  v_following_count integer := 0;
  v_blocked boolean := false;
BEGIN
  IF p_target_id IS NULL OR length(trim(p_target_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'TARGET_REQUIRED');
  END IF;

  IF p_actor_id IS NOT NULL AND length(trim(p_actor_id)) > 0 THEN
    SELECT EXISTS (
      SELECT 1 FROM public.ghc_user_blocks b
      WHERE (b.blocker_id = trim(p_actor_id) AND b.blocked_id = trim(p_target_id))
         OR (b.blocker_id = trim(p_target_id) AND b.blocked_id = trim(p_actor_id))
    ) INTO v_blocked;

    IF NOT v_blocked THEN
      SELECT EXISTS (
        SELECT 1 FROM public.gh_follows f
        WHERE f.follower_id = trim(p_actor_id)
          AND f.following_id = trim(p_target_id)
      ) INTO v_following;
    END IF;
  END IF;

  SELECT COUNT(*)::integer INTO v_followers_count
  FROM public.gh_follows WHERE following_id = trim(p_target_id);

  SELECT COUNT(*)::integer INTO v_following_count
  FROM public.gh_follows WHERE follower_id = trim(p_target_id);

  RETURN jsonb_build_object(
    'ok', true,
    'targetUserId', trim(p_target_id),
    'isFollowing', v_following,
    'blocked', v_blocked,
    'followersCount', v_followers_count,
    'followingCount', v_following_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_follow_status(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_follow_status(text, text) TO service_role;
