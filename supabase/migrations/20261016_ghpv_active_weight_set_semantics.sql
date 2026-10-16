-- =============================================================================
-- 20261016_ghpv_active_weight_set_semantics.sql
-- GHPV-1A fix: active per-reviewer weight (set/replace), not cumulative API adds.
-- Does NOT mint GHC. Does NOT settle judgments. Does NOT change gh_post_curations.
-- Depends on: 20261013 (quality state), 20261014 (record RPC name).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.gh_ghpv_active_weights (
  content_id     text NOT NULL,
  reviewer_id    text NOT NULL,
  choice         text NOT NULL CHECK (choice IN ('upvote', 'downvote')),
  weight         numeric(18, 6) NOT NULL CHECK (weight >= 0),
  curation_power numeric(12, 6) NOT NULL DEFAULT 0 CHECK (curation_power >= 0),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (content_id, reviewer_id),
  CONSTRAINT gh_ghpv_aw_content_nonempty CHECK (length(trim(content_id)) > 0),
  CONSTRAINT gh_ghpv_aw_reviewer_nonempty CHECK (length(trim(reviewer_id)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_gh_ghpv_active_weights_content
  ON public.gh_ghpv_active_weights (content_id);

ALTER TABLE public.gh_ghpv_active_weights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_ghpv_aw_no_client ON public.gh_ghpv_active_weights;
CREATE POLICY gh_ghpv_aw_no_client ON public.gh_ghpv_active_weights
  FOR ALL USING (false) WITH CHECK (false);

COMMENT ON TABLE public.gh_ghpv_active_weights IS
  'GHPV-1A: one active weighted contribution per (content, reviewer). Not a ledger.';

/**
 * Recompute aggregate quality weights from active reviewer rows.
 */
CREATE OR REPLACE FUNCTION public.gh_ghpv_recompute_quality_aggregates(
  p_content_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_up numeric(18, 6);
  v_down numeric(18, 6);
  v_n integer;
BEGIN
  SELECT
    coalesce(sum(CASE WHEN choice = 'upvote' THEN weight ELSE 0 END), 0),
    coalesce(sum(CASE WHEN choice = 'downvote' THEN weight ELSE 0 END), 0),
    count(*)::integer
  INTO v_up, v_down, v_n
  FROM public.gh_ghpv_active_weights
  WHERE content_id = trim(p_content_id);

  INSERT INTO public.gh_content_quality_state AS q (
    content_id, content_kind, judgment_mode, quality_score, confidence,
    upvote_weight, downvote_weight, independent_voters, settlement_status, updated_at
  ) VALUES (
    trim(p_content_id), 'post', 'useful', 0, 0,
    v_up, v_down, v_n, 'open', now()
  )
  ON CONFLICT (content_id) DO UPDATE SET
    upvote_weight = EXCLUDED.upvote_weight,
    downvote_weight = EXCLUDED.downvote_weight,
    independent_voters = EXCLUDED.independent_voters,
    settlement_status = CASE
      WHEN q.settlement_status IN ('settled', 'quarantined') THEN q.settlement_status
      ELSE 'open'
    END,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.gh_ghpv_recompute_quality_aggregates(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_ghpv_recompute_quality_aggregates(text) TO service_role;

/**
 * SET semantics (not ADD): establishes the reviewer's CURRENT contribution only.
 * neutral → delete active row; recompute aggregates from remaining rows.
 * Idempotent for identical (choice, weight).
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
  v_prev_choice text;
  v_prev_weight numeric;
  v_up numeric;
  v_down numeric;
  v_n integer;
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

  -- Serialize per (content, reviewer) — matches curation lock grain
  PERFORM pg_advisory_xact_lock(
    hashtext('gh_ghpv_aw:' || trim(p_content_id) || ':' || trim(p_reviewer_id))
  );

  SELECT choice, weight INTO v_prev_choice, v_prev_weight
  FROM public.gh_ghpv_active_weights
  WHERE content_id = trim(p_content_id) AND reviewer_id = trim(p_reviewer_id);

  IF v_choice = 'neutral' THEN
    DELETE FROM public.gh_ghpv_active_weights
    WHERE content_id = trim(p_content_id) AND reviewer_id = trim(p_reviewer_id);
  ELSE
    INSERT INTO public.gh_ghpv_active_weights (
      content_id, reviewer_id, choice, weight, curation_power, updated_at
    ) VALUES (
      trim(p_content_id), trim(p_reviewer_id), v_choice, v_w, v_w, now()
    )
    ON CONFLICT (content_id, reviewer_id) DO UPDATE SET
      choice = EXCLUDED.choice,
      weight = EXCLUDED.weight,
      curation_power = EXCLUDED.curation_power,
      updated_at = now();
  END IF;

  -- Ensure quality state row exists with judgment_mode
  INSERT INTO public.gh_content_quality_state AS q (
    content_id, content_kind, judgment_mode, quality_score, confidence,
    upvote_weight, downvote_weight, independent_voters, settlement_status, updated_at
  ) VALUES (
    trim(p_content_id), 'post', v_mode, 0, 0, 0, 0, 0, 'open', now()
  )
  ON CONFLICT (content_id) DO UPDATE SET
    judgment_mode = COALESCE(NULLIF(v_mode, ''), q.judgment_mode),
    updated_at = now();

  PERFORM public.gh_ghpv_recompute_quality_aggregates(trim(p_content_id));

  SELECT upvote_weight, downvote_weight, independent_voters
  INTO v_up, v_down, v_n
  FROM public.gh_content_quality_state
  WHERE content_id = trim(p_content_id);

  RETURN jsonb_build_object(
    'ok', true,
    'contentId', trim(p_content_id),
    'reviewerId', trim(p_reviewer_id),
    'choice', v_choice,
    'weight', CASE WHEN v_choice = 'neutral' THEN 0 ELSE v_w END,
    'previousChoice', v_prev_choice,
    'previousWeight', v_prev_weight,
    'upvoteWeight', coalesce(v_up, 0),
    'downvoteWeight', coalesce(v_down, 0),
    'independentVoters', coalesce(v_n, 0),
    'settled', false,
    'ghcMutated', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_ghpv_record_curation_weight(text, text, text, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_ghpv_record_curation_weight(text, text, text, numeric, text) TO service_role;

COMMENT ON FUNCTION public.gh_ghpv_record_curation_weight(text, text, text, numeric, text) IS
  'GHPV-1A SET active weight per reviewer; recompute aggregates; no settlement; no GHC.';
