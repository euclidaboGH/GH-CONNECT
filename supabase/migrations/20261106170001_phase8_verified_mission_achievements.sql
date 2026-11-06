-- Phase 8: server-verified, durable, idempotent mission achievement unlocks.
-- Additive only. Does not issue GHC, Pi, cashback, membership, or other value.
-- Apply to a disposable database/Testnet after operator review; never auto-apply.

CREATE OR REPLACE FUNCTION public.gh_rewards_mission_complete(
  p_user_id text,
  p_code text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user text := trim(coalesce(p_user_id, ''));
  v_code text := lower(trim(coalesce(p_code, '')));
  v_eligible boolean := false;
  v_inserted integer := 0;
  v_achievement_id text;
BEGIN
  IF v_user = '' OR length(v_user) > 256 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_USER');
  END IF;
  IF v_code NOT IN (
    'join_community', 'first_post', 'first_comment', 'meaningful_contribution',
    'complete_profile', 'send_connection', 'accept_connection'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_MISSION');
  END IF;

  -- Serialize each user's mission claim. The unique user/achievement index is
  -- the final idempotency fence if concurrent requests reach the insert.
  PERFORM pg_advisory_xact_lock(hashtext('gh_rewards_mission:' || v_user || ':' || v_code));

  CASE v_code
    WHEN 'join_community' THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.gh_community_members m
        JOIN public.gh_communities c ON c.id = m.community_id
        WHERE m.gh_user_id = v_user
          AND m.status = 'active'
          AND c.deleted_at IS NULL
      ) INTO v_eligible;
    WHEN 'first_post' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.gh_posts p
        WHERE p.author_id = v_user AND p.deleted_at IS NULL
      ) INTO v_eligible;
    WHEN 'first_comment' THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.gh_post_comments c
        JOIN public.gh_posts p ON p.id = c.post_id
        WHERE c.author_id = v_user
          AND c.deleted_at IS NULL
          AND p.deleted_at IS NULL
      ) INTO v_eligible;
    WHEN 'meaningful_contribution' THEN
      SELECT
        EXISTS (SELECT 1 FROM public.gh_posts p
          WHERE p.author_id = v_user AND p.deleted_at IS NULL)
        OR EXISTS (SELECT 1 FROM public.gh_post_comments c
          JOIN public.gh_posts p ON p.id = c.post_id
          WHERE c.author_id = v_user AND c.deleted_at IS NULL AND p.deleted_at IS NULL)
      INTO v_eligible;
    WHEN 'complete_profile' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.gh_user_profiles p
        WHERE p.gh_user_id = v_user
          AND p.onboarded = true
          AND length(trim(coalesce(p.display_name, ''))) > 0
      ) INTO v_eligible;
    WHEN 'send_connection' THEN
      -- Connection-request storage is an operator-approved migration in some
      -- deployments. Resolve it dynamically so this migration can still apply
      -- when that optional table is absent; the mission then fails closed.
      IF to_regclass('public.ghc_connection_requests') IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'MISSION_SOURCE_UNAVAILABLE');
      END IF;
      EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.ghc_connection_requests r WHERE r.from_user_id = $1 AND r.status IN (''pending'', ''accepted''))'
        INTO v_eligible USING v_user;
    WHEN 'accept_connection' THEN
      IF to_regclass('public.ghc_connection_requests') IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'MISSION_SOURCE_UNAVAILABLE');
      END IF;
      EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.ghc_connection_requests r WHERE r.to_user_id = $1 AND r.status = ''accepted'')'
        INTO v_eligible USING v_user;
  END CASE;

  IF NOT v_eligible THEN
    RETURN jsonb_build_object(
      'ok', true, 'completed', false, 'verified', false,
      'alreadyCompleted', false, 'grantedGhc', 0,
      'error', 'MISSION_NOT_VERIFIED',
      'message', 'The required action is not yet confirmed in GreenHaven records.'
    );
  END IF;

  v_achievement_id := v_code;
  INSERT INTO public.gh_user_achievements
    (gh_user_id, achievement_id, source_event, meta)
  VALUES
    (v_user, v_achievement_id, 'mission_verified:' || v_code,
     jsonb_build_object('verification', 'server', 'missionCode', v_code))
  ON CONFLICT (gh_user_id, achievement_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'completed', true,
    'verified', true,
    'alreadyCompleted', v_inserted = 0,
    'achievementId', v_achievement_id,
    'grantedGhc', 0,
    'rewardStatus', 'achievement_only',
    'message', CASE WHEN v_inserted = 0
      THEN 'This verified achievement was already unlocked.'
      ELSE 'Mission verified and achievement unlocked. GHC activity rewards remain disabled by current issuance policy.'
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_rewards_mission_complete(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_rewards_mission_complete(text, text) TO service_role;
COMMENT ON FUNCTION public.gh_rewards_mission_complete(text, text) IS
  'Verifies supported mission completion against durable GreenHaven rows and idempotently unlocks a non-financial achievement. Never issues GHC or Pi.';
