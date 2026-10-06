-- =============================================================================
-- 20261018_ghpv_calibration_bounds.sql
-- GHPV-1B: database-enforced calibration bounds on settlement commit.
--
-- Purpose:
--   Do not trust application-computed nextJcs / jcsDelta blindly.
--   Clamp JCS to 0–100, integrity to 0–100, and per-event JCS delta to ±2.5.
--   Unresolved/protected alignments persist delta 0.
--
-- Dependencies:
--   20261017_ghpv_settlement_engine.sql
--
-- Objects modified:
--   gh_ghpv_commit_settlement (CREATE OR REPLACE)
--
-- Security:
--   SECURITY DEFINER, search_path = public
--   REVOKE PUBLIC; GRANT service_role only
--   Existing RLS deny-all on GHPV tables is unchanged
--
-- Idempotency:
--   Unchanged. Existing (content_id, settlement_epoch) returns without re-apply.
--
-- Rollback:
--   Forward-only. Re-applying this file is safe (CREATE OR REPLACE).
--
-- GHC impact:
--   NONE.
--
-- Deployment:
--   Apply after 20261017 on Testnet only. Not executed by this repository change.
--
-- Quality lifecycle (existing settlement_status values):
--   open        = judgment still collecting
--   pending     = reserved; not auto-set by this migration
--   settled     = validated consensus recorded
--   unresolved  = epoch closed without a forced truth
--   quarantined = operator hold; commit does not clear it
-- =============================================================================

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
  v_align text;
  v_delta numeric;
  v_jcs numeric;
  v_integrity numeric;
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
      'ok', true, 'idempotent', true, 'settlementId', v_existing, 'ghcMutated', false
    );
  END IF;

  -- Quality delta is a signal, not money. Bound it.
  p_quality_delta := greatest(-25, least(25, coalesce(p_quality_delta, 0)));

  INSERT INTO public.gh_judgment_settlements (
    content_id, settlement_epoch, confidence, consensus_choice, quality_delta, metadata
  ) VALUES (
    trim(p_content_id),
    trim(p_settlement_epoch),
    greatest(0, least(100, coalesce(p_confidence, 0))),
    nullif(trim(coalesce(p_consensus, '')), ''),
    p_quality_delta,
    jsonb_build_object('status', v_status, 'engine', 'ghpv-1b', 'antiWhaleShare', 0.12)
  )
  RETURNING id INTO v_id;

  IF jsonb_typeof(p_effects) = 'array' THEN
    FOR v_effect IN SELECT * FROM jsonb_array_elements(p_effects)
    LOOP
      v_align := coalesce(v_effect->>'alignment', 'unresolved');
      IF v_align NOT IN ('aligned', 'misaligned', 'neutral', 'unresolved', 'protected') THEN
        v_align := 'unresolved';
      END IF;
      v_delta := coalesce((v_effect->>'jcsDelta')::numeric, 0);
      IF v_align IN ('unresolved', 'protected', 'neutral') THEN
        v_delta := 0;
      END IF;
      v_delta := greatest(-2.5, least(2.5, v_delta));
      v_jcs := greatest(0, least(100, coalesce((v_effect->>'nextJcs')::numeric, 50)));
      v_integrity := greatest(0, least(100, coalesce((v_effect->>'nextIntegrity')::numeric, 70)));

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
        v_align,
        v_delta,
        v_key
      )
      ON CONFLICT (idempotency_key) DO NOTHING;

      IF coalesce(v_effect->>'reviewerId', '') <> '' AND v_effect ? 'nextJcs' THEN
        INSERT INTO public.gh_curator_calibration (
          user_id, jcs, integrity_score, correct_count, incorrect_count,
          unresolved_count, curation_power, updated_at
        ) VALUES (
          v_effect->>'reviewerId',
          v_jcs,
          v_integrity,
          greatest(0, coalesce((v_effect->>'correctCount')::integer, 0)),
          greatest(0, coalesce((v_effect->>'incorrectCount')::integer, 0)),
          greatest(0, coalesce((v_effect->>'unresolvedCount')::integer, 0)),
          greatest(0, least(100, coalesce((v_effect->>'curationPower')::numeric, 1))),
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
      WHEN settlement_status = 'quarantined' THEN 'quarantined'
      WHEN v_status = 'settled' THEN 'settled'
      WHEN v_status = 'unresolved' THEN 'unresolved'
      ELSE 'open'
    END,
    confidence = greatest(0, least(100, coalesce(p_confidence, 0))),
    quality_score = greatest(-100, least(100, quality_score + p_quality_delta)),
    settled_at = CASE WHEN v_status = 'settled' THEN now() ELSE settled_at END,
    updated_at = now()
  WHERE content_id = trim(p_content_id);

  RETURN jsonb_build_object(
    'ok', true, 'idempotent', false, 'settlementId', v_id, 'status', v_status, 'ghcMutated', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_ghpv_commit_settlement(
  text, text, text, text, numeric, numeric, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_ghpv_commit_settlement(
  text, text, text, text, numeric, numeric, jsonb
) TO service_role;

COMMENT ON FUNCTION public.gh_ghpv_commit_settlement(text, text, text, text, numeric, numeric, jsonb) IS
  'GHPV-1B commit with DB-enforced JCS 0-100 and delta ±2.5. No GHC.';
