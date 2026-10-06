-- =============================================================================
-- 20261017_ghpv_settlement_engine.sql
-- GHPV-1B: authoritative settlement snapshot + idempotent commit.
--
-- Purpose:
--   Derive settlement inputs only from server tables (posts, curations, active weights).
--   Persist one settlement per (content_id, settlement_epoch).
--   Record judgment events and optional calibration updates in the same transaction.
--
-- Dependencies:
--   20261013_ghpv_judgment_infrastructure.sql
--   20261014_ghpv_curation_weight_and_settle.sql
--   20261015_ghpv_curator_calibration_apply.sql
--   20261016_ghpv_active_weight_set_semantics.sql
--
-- Objects:
--   gh_ghpv_settlement_snapshot(text)
--   gh_ghpv_commit_settlement(text, text, text, text, numeric, numeric, jsonb)
--
-- Security:
--   SECURITY DEFINER, search_path = public
--   REVOKE PUBLIC; GRANT EXECUTE TO service_role only
--   Client roles cannot call these RPCs or write GHPV tables (RLS deny-all remains)
--
-- Idempotency:
--   Unique (content_id, settlement_epoch) + advisory lock.
--   Repeat commit returns existing settlement and does not re-apply calibration.
--
-- Concurrency:
--   pg_advisory_xact_lock on content settlement key.
--   Snapshot is the active-weight rows that still match gh_post_curations.
--
-- Rollback:
--   Forward-only. Do not drop historical settlements in production.
--   Safe to re-run CREATE OR REPLACE / IF NOT EXISTS objects.
--
-- GHC / economy:
--   NONE. No ghc_* tables or RPCs are referenced.
--
-- Deployment:
--   Apply on Testnet only after 20261013–20261016. Do not apply from this repo automatically.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.gh_ghpv_settlement_snapshot(
  p_content_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author text;
  v_mode text;
  v_status text;
  v_votes jsonb;
BEGIN
  IF p_content_id IS NULL OR length(trim(p_content_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CONTENT_REQUIRED');
  END IF;

  SELECT author_id INTO v_author
  FROM public.gh_posts
  WHERE id = trim(p_content_id) AND deleted_at IS NULL;

  IF v_author IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  SELECT judgment_mode, settlement_status
  INTO v_mode, v_status
  FROM public.gh_content_quality_state
  WHERE content_id = trim(p_content_id);

  -- Only votes that exist in BOTH active weights and current curation row.
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'reviewerId', w.reviewer_id,
    'choice', w.choice,
    'weight', w.weight
  ) ORDER BY w.reviewer_id), '[]'::jsonb)
  INTO v_votes
  FROM public.gh_ghpv_active_weights w
  JOIN public.gh_post_curations c
    ON c.post_id = w.content_id
   AND c.user_id = w.reviewer_id
   AND c.choice = w.choice
  WHERE w.content_id = trim(p_content_id);

  RETURN jsonb_build_object(
    'ok', true,
    'contentId', trim(p_content_id),
    'authorId', v_author,
    'judgmentMode', coalesce(v_mode, 'useful'),
    'settlementStatus', coalesce(v_status, 'open'),
    'votes', v_votes,
    'ghcMutated', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_ghpv_settlement_snapshot(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_ghpv_settlement_snapshot(text) TO service_role;

/**
 * Commit one epoch. p_effects is server-computed only.
 * Shape: [{reviewerId, choice, alignment, jcsDelta, nextJcs, nextIntegrity,
 *          correctCount, incorrectCount, unresolvedCount, curationPower}]
 */
CREATE OR REPLACE FUNCTION public.gh_ghpv_commit_settlement(
  p_content_id text,
  p_settlement_epoch text,
  p_status text,
  p_consensus text,
  p_confidence numeric,
  p_quality_delta numeric,
  p_effects jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_existing uuid;
  v_effect jsonb;
  v_key text;
  v_status text := lower(trim(coalesce(p_status, 'unresolved')));
BEGIN
  IF p_content_id IS NULL OR length(trim(p_content_id)) = 0
     OR p_settlement_epoch IS NULL OR length(trim(p_settlement_epoch)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.gh_posts
    WHERE id = trim(p_content_id) AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('gh_ghpv_settle:' || trim(p_content_id)));

  SELECT id INTO v_existing
  FROM public.gh_judgment_settlements
  WHERE content_id = trim(p_content_id)
    AND settlement_epoch = trim(p_settlement_epoch);

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'settlementId', v_existing,
      'ghcMutated', false
    );
  END IF;

  INSERT INTO public.gh_judgment_settlements (
    content_id, settlement_epoch, confidence, consensus_choice, quality_delta, metadata
  ) VALUES (
    trim(p_content_id),
    trim(p_settlement_epoch),
    greatest(0, least(100, coalesce(p_confidence, 0))),
    nullif(trim(coalesce(p_consensus, '')), ''),
    coalesce(p_quality_delta, 0),
    jsonb_build_object(
      'status', v_status,
      'engine', 'ghpv-1b',
      'antiWhaleShare', 0.12
    )
  )
  RETURNING id INTO v_id;

  IF jsonb_typeof(p_effects) = 'array' THEN
    FOR v_effect IN SELECT * FROM jsonb_array_elements(p_effects)
    LOOP
      v_key := 'judgment:' || trim(p_content_id) || ':' || trim(p_settlement_epoch)
        || ':' || coalesce(v_effect->>'reviewerId', '');
      INSERT INTO public.gh_judgment_events (
        settlement_id, reviewer_id, choice, alignment, jcs_delta, idempotency_key
      ) VALUES (
        v_id,
        coalesce(v_effect->>'reviewerId', ''),
        CASE
          WHEN coalesce(v_effect->>'choice', 'neutral') IN ('upvote', 'downvote', 'neutral')
          THEN coalesce(v_effect->>'choice', 'neutral')
          ELSE 'neutral'
        END,
        CASE
          WHEN coalesce(v_effect->>'alignment', 'unresolved') IN (
            'aligned', 'misaligned', 'neutral', 'unresolved', 'protected'
          ) THEN coalesce(v_effect->>'alignment', 'unresolved')
          ELSE 'unresolved'
        END,
        coalesce((v_effect->>'jcsDelta')::numeric, 0),
        v_key
      )
      ON CONFLICT (idempotency_key) DO NOTHING;

      IF coalesce(v_effect->>'reviewerId', '') <> ''
         AND v_effect ? 'nextJcs' THEN
        INSERT INTO public.gh_curator_calibration (
          user_id, jcs, integrity_score, correct_count, incorrect_count,
          unresolved_count, curation_power, updated_at
        ) VALUES (
          v_effect->>'reviewerId',
          greatest(0, least(100, coalesce((v_effect->>'nextJcs')::numeric, 50))),
          greatest(0, least(100, coalesce((v_effect->>'nextIntegrity')::numeric, 70))),
          greatest(0, coalesce((v_effect->>'correctCount')::integer, 0)),
          greatest(0, coalesce((v_effect->>'incorrectCount')::integer, 0)),
          greatest(0, coalesce((v_effect->>'unresolvedCount')::integer, 0)),
          greatest(0, coalesce((v_effect->>'curationPower')::numeric, 1)),
          now()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          jcs = EXCLUDED.jcs,
          integrity_score = EXCLUDED.integrity_score,
          correct_count = EXCLUDED.correct_count,
          incorrect_count = EXCLUDED.incorrect_count,
          unresolved_count = EXCLUDED.unresolved_count,
          curation_power = EXCLUDED.curation_power,
          updated_at = now();
      END IF;
    END LOOP;
  END IF;

  UPDATE public.gh_content_quality_state
  SET
    settlement_status = CASE
      WHEN v_status = 'settled' THEN 'settled'
      WHEN v_status = 'unresolved' THEN 'unresolved'
      ELSE 'open'
    END,
    confidence = greatest(0, least(100, coalesce(p_confidence, 0))),
    quality_score = quality_score + coalesce(p_quality_delta, 0),
    settled_at = CASE WHEN v_status = 'settled' THEN now() ELSE settled_at END,
    updated_at = now()
  WHERE content_id = trim(p_content_id);

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'settlementId', v_id,
    'status', v_status,
    'ghcMutated', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_ghpv_commit_settlement(
  text, text, text, text, numeric, numeric, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_ghpv_commit_settlement(
  text, text, text, text, numeric, numeric, jsonb
) TO service_role;

COMMENT ON FUNCTION public.gh_ghpv_settlement_snapshot(text) IS
  'GHPV-1B authoritative vote snapshot. Joins active weights to current curations. No GHC.';
COMMENT ON FUNCTION public.gh_ghpv_commit_settlement(text, text, text, text, numeric, numeric, jsonb) IS
  'GHPV-1B idempotent epoch commit + judgment events + calibration. No GHC.';
