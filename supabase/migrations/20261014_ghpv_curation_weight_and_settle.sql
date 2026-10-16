-- GHPV-1A/1B: record weighted curation into quality state; settle judgment (no GHC).
-- Depends on 20261013_ghpv_judgment_infrastructure.sql

-- Allow unresolved-style statuses on quality state
ALTER TABLE public.gh_content_quality_state
  DROP CONSTRAINT IF EXISTS gh_content_quality_state_settlement_status_check;

ALTER TABLE public.gh_content_quality_state
  ADD CONSTRAINT gh_content_quality_state_settlement_status_check
  CHECK (settlement_status IN (
    'open', 'eligible', 'settling', 'settled', 'unresolved', 'quarantined', 'pending'
  ));

/**
 * After a durable vote: adjust open quality weights. Does NOT settle, does NOT mint GHC.
 */
CREATE OR REPLACE FUNCTION public.gh_ghpv_record_curation_weight(
  p_content_id text,
  p_reviewer_id text,
  p_choice text,
  p_weight numeric,
  p_judgment_mode text DEFAULT 'useful'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_choice text := lower(trim(coalesce(p_choice, '')));
  v_w numeric := greatest(0, coalesce(p_weight, 0));
  v_mode text := lower(trim(coalesce(p_judgment_mode, 'useful')));
BEGIN
  IF p_content_id IS NULL OR length(trim(p_content_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CONTENT_REQUIRED');
  END IF;
  IF p_reviewer_id IS NULL OR length(trim(p_reviewer_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ACTOR_REQUIRED');
  END IF;
  IF v_choice NOT IN ('upvote', 'downvote', 'neutral') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CHOICE');
  END IF;
  IF v_mode NOT IN ('factual', 'useful', 'creative', 'opinion', 'harm') THEN
    v_mode := 'useful';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('gh_ghpv_q:' || trim(p_content_id)));

  INSERT INTO public.gh_content_quality_state AS q (
    content_id, content_kind, judgment_mode, quality_score, confidence,
    upvote_weight, downvote_weight, independent_voters, settlement_status, updated_at
  ) VALUES (
    trim(p_content_id), 'post', v_mode, 0, 0,
    CASE WHEN v_choice = 'upvote' THEN v_w ELSE 0 END,
    CASE WHEN v_choice = 'downvote' THEN v_w ELSE 0 END,
    CASE WHEN v_choice IN ('upvote', 'downvote') THEN 1 ELSE 0 END,
    'open', now()
  )
  ON CONFLICT (content_id) DO UPDATE SET
    judgment_mode = EXCLUDED.judgment_mode,
    upvote_weight = CASE
      WHEN v_choice = 'upvote' THEN public.gh_content_quality_state.upvote_weight + v_w
      WHEN v_choice = 'neutral' THEN public.gh_content_quality_state.upvote_weight
      ELSE public.gh_content_quality_state.upvote_weight
    END,
    downvote_weight = CASE
      WHEN v_choice = 'downvote' THEN public.gh_content_quality_state.downvote_weight + v_w
      WHEN v_choice = 'neutral' THEN public.gh_content_quality_state.downvote_weight
      ELSE public.gh_content_quality_state.downvote_weight
    END,
    independent_voters = public.gh_content_quality_state.independent_voters
      + CASE WHEN v_choice IN ('upvote', 'downvote') THEN 1 ELSE 0 END,
    settlement_status = CASE
      WHEN public.gh_content_quality_state.settlement_status IN ('settled') THEN 'settled'
      ELSE 'open'
    END,
    updated_at = now();

  RETURN jsonb_build_object(
    'ok', true,
    'contentId', trim(p_content_id),
    'choice', v_choice,
    'weight', v_w,
    'settled', false,
    'ghcMutated', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_ghpv_record_curation_weight(text, text, text, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_ghpv_record_curation_weight(text, text, text, numeric, text) TO service_role;

/**
 * Idempotent settlement insert. Application computes outcome; RPC persists.
 * p_payload: jsonb from server settlement engine.
 */
CREATE OR REPLACE FUNCTION public.gh_ghpv_persist_settlement(
  p_content_id text,
  p_settlement_epoch text,
  p_status text,
  p_consensus text,
  p_confidence numeric,
  p_quality_delta numeric,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_existing uuid;
BEGIN
  IF p_content_id IS NULL OR length(trim(p_content_id)) = 0
     OR p_settlement_epoch IS NULL OR length(trim(p_settlement_epoch)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('gh_ghpv_settle:' || trim(p_content_id)));

  SELECT id INTO v_existing
  FROM public.gh_judgment_settlements
  WHERE content_id = trim(p_content_id) AND settlement_epoch = trim(p_settlement_epoch);

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'settlementId', v_existing, 'ghcMutated', false);
  END IF;

  INSERT INTO public.gh_judgment_settlements (
    content_id, settlement_epoch, confidence, consensus_choice, quality_delta, metadata
  ) VALUES (
    trim(p_content_id),
    trim(p_settlement_epoch),
    greatest(0, least(100, coalesce(p_confidence, 0))),
    nullif(trim(coalesce(p_consensus, '')), ''),
    coalesce(p_quality_delta, 0),
    coalesce(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  UPDATE public.gh_content_quality_state
  SET
    settlement_status = CASE
      WHEN lower(trim(p_status)) = 'settled' THEN 'settled'
      WHEN lower(trim(p_status)) = 'unresolved' THEN 'unresolved'
      ELSE 'open'
    END,
    confidence = greatest(0, least(100, coalesce(p_confidence, 0))),
    quality_score = quality_score + coalesce(p_quality_delta, 0),
    settled_at = CASE WHEN lower(trim(p_status)) = 'settled' THEN now() ELSE settled_at END,
    updated_at = now()
  WHERE content_id = trim(p_content_id);

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'settlementId', v_id,
    'ghcMutated', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_ghpv_persist_settlement(text, text, text, text, numeric, numeric, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_ghpv_persist_settlement(text, text, text, text, numeric, numeric, jsonb) TO service_role;

COMMENT ON FUNCTION public.gh_ghpv_record_curation_weight IS
  'GHPV-1A weighted vote into quality state; no settlement; no GHC.';
COMMENT ON FUNCTION public.gh_ghpv_persist_settlement IS
  'GHPV-1B idempotent settlement persist; no GHC.';
