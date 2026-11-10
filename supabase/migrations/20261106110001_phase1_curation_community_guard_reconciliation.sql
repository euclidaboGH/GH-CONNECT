-- Phase 1 deep completion: align curation eligibility with canonical post visibility,
-- serialize per-user daily limits, and make community-feed cursor ordering deterministic.
-- No wallet, GHC issuance, Pi payment, or reward settlement. Harden the internal GHPV writer to server-only access.

CREATE INDEX IF NOT EXISTS idx_gh_curator_activity_user_day_author
  ON public.gh_curator_activity_events (user_id, created_at DESC, author_id);

CREATE OR REPLACE FUNCTION public.gh_curation_preflight(
  p_post_id text,
  p_user_id text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_post public.gh_posts%ROWTYPE;
  v_user text := trim(coalesce(p_user_id, ''));
  v_post_id text := trim(coalesce(p_post_id, ''));
  v_votes integer := 0;
  v_distinct integer := 0;
  v_rapid integer := 0;
  v_author_count integer := 0;
  v_risk numeric := 0;
  v_remaining integer := 0;
BEGIN
  IF v_user = '' OR length(v_user) > 256 THEN
    RETURN jsonb_build_object('ok', false, 'eligible', false, 'error', 'ACTOR_REQUIRED');
  END IF;
  IF v_post_id = '' OR length(v_post_id) > 128 THEN
    RETURN jsonb_build_object('ok', false, 'eligible', false, 'error', 'CONTENT_REQUIRED');
  END IF;

  SELECT * INTO v_post
  FROM public.gh_posts
  WHERE id = v_post_id
    AND deleted_at IS NULL
    AND archived_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'eligible', false, 'error', 'NOT_FOUND');
  END IF;

  -- Product policy is explicit: authors cannot curate their own posts.
  -- This matches the final canonical write RPC; older allow-self-curation
  -- migrations are historical and are superseded by this enforced policy.
  IF v_post.author_id = v_user THEN
    RETURN jsonb_build_object('ok', false, 'eligible', false, 'error', 'SELF_CURATION_FORBIDDEN');
  END IF;

  -- Use the same visibility authority as Feed/Profile and the final curation
  -- write RPC. This includes blocks, followers, mutuals, and active community
  -- membership even when a community-bound post is marked public.
  IF NOT public.gh_post_viewer_can_read(v_user, v_post_id) THEN
    RETURN jsonb_build_object('ok', false, 'eligible', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT count(*)::integer, count(DISTINCT post_id)::integer
    INTO v_votes, v_distinct
  FROM public.gh_curator_activity_events
  WHERE user_id = v_user
    AND created_at >= current_date;

  SELECT count(*)::integer
    INTO v_rapid
  FROM public.gh_curator_activity_events
  WHERE user_id = v_user
    AND created_at >= now() - interval '10 minutes';

  SELECT count(*)::integer
    INTO v_author_count
  FROM public.gh_curator_activity_events
  WHERE user_id = v_user
    AND author_id = v_post.author_id
    AND created_at >= current_date;

  IF v_votes > 0 THEN
    v_risk := least(100, (v_author_count::numeric / v_votes::numeric) * 60
      + least(1, v_rapid::numeric / 20) * 40);
  END IF;
  v_remaining := greatest(0, 120 - v_votes);

  IF v_votes >= 120 THEN
    RETURN jsonb_build_object('ok', false, 'eligible', false,
      'error', 'DAILY_CURATION_LIMIT', 'riskScore', v_risk, 'remaining', 0);
  END IF;
  IF v_risk >= 70 THEN
    RETURN jsonb_build_object('ok', false, 'eligible', false,
      'error', 'CURATION_REVIEW_REQUIRED', 'riskScore', v_risk, 'remaining', v_remaining);
  END IF;

  RETURN jsonb_build_object('ok', true, 'eligible', true,
    'riskScore', v_risk, 'remaining', v_remaining,
    'dailyVotes', v_votes, 'dailyDistinctPosts', v_distinct);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_curation_preflight(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_curation_preflight(text, text) TO service_role;
COMMENT ON FUNCTION public.gh_curation_preflight(text, text) IS
  'Phase 1 canonical curation preflight: denies self-curation and applies the same viewer visibility policy as post reads and writes, including active community membership.';

CREATE OR REPLACE FUNCTION public.gh_post_curation_set_with_reward(
  p_post_id text,
  p_user_id text,
  p_choice text,
  p_percentage numeric DEFAULT 100,
  p_curation_weight numeric DEFAULT 0,
  p_judgment_mode text DEFAULT 'useful'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_user text := trim(coalesce(p_user_id, ''));
  v_guard jsonb;
  v_vote jsonb;
  v_choice text;
  v_reward jsonb := jsonb_build_object(
    'ok', true, 'credited', false, 'amount', 0,
    'reason', 'NO_REWARD_FOR_NON_UPVOTE'
  );
  v_weighted jsonb;
  v_activity jsonb;
  v_weight numeric(18,6) := greatest(0, least(coalesce(p_curation_weight, 0), 1000000));
  v_percentage numeric(5,2) := round(coalesce(p_percentage, 100), 2);
BEGIN
  IF v_user = '' OR length(v_user) > 256 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ACTOR_REQUIRED');
  END IF;
  IF v_percentage < 0 OR v_percentage > 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_PERCENTAGE');
  END IF;

  -- Serialize this user's daily quota across different posts. Without this
  -- lock, concurrent votes on separate posts could all pass the 120/day check.
  PERFORM pg_advisory_xact_lock(
    hashtext('gh_curate_daily:' || v_user || ':' || current_date::text)
  );

  v_guard := public.gh_curation_preflight(p_post_id, v_user);
  IF coalesce((v_guard->>'ok')::boolean, false) IS NOT TRUE
     OR coalesce((v_guard->>'eligible')::boolean, false) IS NOT TRUE THEN
    RETURN v_guard;
  END IF;

  v_vote := public.gh_post_curation_set(p_post_id, v_user, p_choice);
  IF coalesce((v_vote->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN v_vote;
  END IF;
  v_choice := coalesce(v_vote->>'choice', 'neutral');

  IF v_choice IN ('upvote', 'downvote') THEN
    UPDATE public.gh_post_curations
    SET reward_percentage = v_percentage, updated_at = now()
    WHERE post_id = trim(p_post_id) AND user_id = v_user;
  END IF;

  IF v_choice = 'upvote' THEN
    v_reward := public.ghc_curation_reward_credit(v_user, trim(p_post_id), v_choice, v_percentage);
    IF coalesce((v_reward->>'ok')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'Curation reward evaluation failed: %',
        coalesce(v_reward->>'error', 'REWARD_EVALUATION_FAILED');
    END IF;
  END IF;

  v_weighted := public.gh_ghpv_record_curation_weight(
    trim(p_post_id), v_user, v_choice,
    CASE WHEN v_choice = 'neutral' THEN 0 ELSE v_weight * (v_percentage / 100) END,
    p_judgment_mode
  );
  IF coalesce((v_weighted->>'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'GHPV curation weight update failed: %',
      coalesce(v_weighted->>'error', 'GHPV_WEIGHT_UPDATE_FAILED');
  END IF;

  v_activity := public.gh_curation_activity_record(trim(p_post_id), v_user, v_choice);
  IF coalesce((v_activity->>'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Curation activity audit failed: %',
      coalesce(v_activity->>'error', 'CURATION_ACTIVITY_AUDIT_FAILED');
  END IF;

  RETURN v_vote || jsonb_build_object(
    'reward', v_reward,
    'ghpv', v_weighted,
    'rewardPercentage', v_percentage,
    'guard', v_guard
  );
END;
$$;

-- The GHPV weight writer is an internal helper called only from the atomic
-- server-side curation wrapper. Do not expose it as a standalone PostgREST RPC:
-- it accepts user/post identifiers and would bypass canonical visibility,
-- daily quota serialization and mandatory activity auditing.
REVOKE ALL ON FUNCTION public.gh_ghpv_record_curation_weight(text, text, text, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_ghpv_record_curation_weight(text, text, text, numeric, text) TO service_role;

REVOKE ALL ON FUNCTION public.gh_post_curation_set_with_reward(text, text, text, numeric, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_post_curation_set_with_reward(text, text, text, numeric, numeric, text) TO service_role;
COMMENT ON FUNCTION public.gh_post_curation_set_with_reward(text, text, text, numeric, numeric, text) IS
  'Atomic Phase 1 curation pipeline: per-user daily serialization, canonical visibility preflight, durable vote, reward-policy evaluation, GHPV SET semantics and mandatory activity audit. No client authority or direct GHC issuance.';

-- The public cursor is expressed in epoch milliseconds. Order on that same
-- precision plus id so the WHERE cursor and ORDER BY use identical keys.
CREATE OR REPLACE FUNCTION public.gh_community_post_list(
  p_community_id text,
  p_viewer_id text,
  p_limit integer DEFAULT 40,
  p_before_ms bigint DEFAULT NULL,
  p_before_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_community_id text := trim(coalesce(p_community_id, ''));
  v_viewer_id text := trim(coalesce(p_viewer_id, ''));
  v_limit integer := least(greatest(coalesce(p_limit, 40), 1), 100);
  v_rows jsonb;
BEGIN
  IF v_community_id = '' OR v_viewer_id = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ACTOR_AND_COMMUNITY_REQUIRED');
  END IF;
  IF (p_before_ms IS NULL) <> (p_before_id IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_COMMUNITY_POST_CURSOR');
  END IF;
  IF public.gh_community_platform_role(v_community_id, v_viewer_id) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT coalesce(
    jsonb_agg(to_jsonb(q) ORDER BY q."createdAt" DESC, q.id DESC),
    '[]'::jsonb
  ) INTO v_rows
  FROM (
    SELECT
      p.id,
      p.author_id AS "authorId",
      p.author_name AS "authorName",
      p.author_photo AS "authorPhoto",
      p.content,
      p.images,
      p.video,
      p.pdf,
      p.pdf_name AS "pdfName",
      p.visibility,
      p.community_id AS "communityId",
      p.community_name AS "communityName",
      p.content_type AS "contentType",
      coalesce(p.like_count, 0) AS likes,
      coalesce(p.comment_count, 0) AS "commentCount",
      coalesce(p.share_count, 0) AS shares,
      coalesce(p.upvote_count, 0) AS "upvoteCount",
      coalesce(p.downvote_count, 0) AS "downvoteCount",
      p.is_edited AS "isEdited",
      (extract(epoch FROM p.created_at) * 1000)::bigint AS "createdAt",
      (SELECT c.choice FROM public.gh_post_curations c
        WHERE c.post_id = p.id AND c.user_id = v_viewer_id LIMIT 1) AS "viewerCurationChoice",
      EXISTS (SELECT 1 FROM public.gh_post_reactions r
        WHERE r.post_id = p.id AND r.user_id = v_viewer_id AND r.reaction = 'like') AS "likedByMe",
      coalesce((
        SELECT jsonb_object_agg(t.reaction, t.total)
        FROM (
          SELECT r.reaction, count(*)::integer AS total
          FROM public.gh_post_reactions r
          WHERE r.post_id = p.id
          GROUP BY r.reaction
        ) t
      ), '{}'::jsonb) AS "reactionCounts",
      coalesce((
        SELECT jsonb_agg(r.reaction ORDER BY r.reaction)
        FROM public.gh_post_reactions r
        WHERE r.post_id = p.id AND r.user_id = v_viewer_id
      ), '[]'::jsonb) AS "viewerReactions",
      EXISTS (SELECT 1 FROM public.gh_saves s
        WHERE s.post_id = p.id AND s.user_id = v_viewer_id) AS "savedByMe"
    FROM public.gh_posts p
    WHERE p.community_id = v_community_id
      AND p.deleted_at IS NULL
      AND p.archived_at IS NULL
      AND public.gh_post_viewer_can_read(v_viewer_id, p.id)
      AND (
        p_before_ms IS NULL
        OR (extract(epoch FROM p.created_at) * 1000)::bigint < p_before_ms
        OR (
          (extract(epoch FROM p.created_at) * 1000)::bigint = p_before_ms
          AND p.id < p_before_id
        )
      )
    ORDER BY (extract(epoch FROM p.created_at) * 1000)::bigint DESC, p.id DESC
    LIMIT v_limit
  ) q;

  RETURN jsonb_build_object('ok', true, 'posts', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_community_post_list(text, text, integer, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_community_post_list(text, text, integer, bigint, text) TO service_role;
COMMENT ON FUNCTION public.gh_community_post_list(text, text, integer, bigint, text) IS
  'Lists canonical community posts for an active member with viewer-specific state and deterministic millisecond/id keyset pagination.';
