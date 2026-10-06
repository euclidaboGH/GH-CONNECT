-- GHPV-3: persist curator calibration updates (no GHC).
-- Depends on 20261013 gh_curator_calibration.

CREATE TABLE IF NOT EXISTS public.gh_ghpv_calibration_applies (
  idempotency_key text PRIMARY KEY,
  user_id         text NOT NULL,
  applied_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_cal_apply_user_nonempty CHECK (length(trim(user_id)) > 0)
);

ALTER TABLE public.gh_ghpv_calibration_applies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_cal_apply_no_client ON public.gh_ghpv_calibration_applies;
CREATE POLICY gh_cal_apply_no_client ON public.gh_ghpv_calibration_applies
  FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.gh_ghpv_apply_calibration(
  p_user_id text,
  p_jcs numeric,
  p_integrity numeric,
  p_correct integer,
  p_incorrect integer,
  p_unresolved integer,
  p_curation_power numeric,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ACTOR_REQUIRED');
  END IF;
  IF v_key IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'IDEMPOTENCY_REQUIRED');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('gh_ghpv_cal:' || trim(p_user_id)));

  IF EXISTS (
    SELECT 1 FROM public.gh_ghpv_calibration_applies WHERE idempotency_key = v_key
  ) THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'ghcMutated', false);
  END IF;

  INSERT INTO public.gh_curator_calibration (
    user_id, jcs, integrity_score, correct_count, incorrect_count,
    unresolved_count, curation_power, updated_at
  ) VALUES (
    trim(p_user_id),
    greatest(0, least(100, coalesce(p_jcs, 50))),
    greatest(0, least(100, coalesce(p_integrity, 70))),
    greatest(0, coalesce(p_correct, 0)),
    greatest(0, coalesce(p_incorrect, 0)),
    greatest(0, coalesce(p_unresolved, 0)),
    greatest(0, coalesce(p_curation_power, 1)),
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

  INSERT INTO public.gh_ghpv_calibration_applies (idempotency_key, user_id)
  VALUES (v_key, trim(p_user_id));

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'userId', trim(p_user_id),
    'jcs', greatest(0, least(100, coalesce(p_jcs, 50))),
    'ghcMutated', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_ghpv_apply_calibration(
  text, numeric, numeric, integer, integer, integer, numeric, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_ghpv_apply_calibration(
  text, numeric, numeric, integer, integer, integer, numeric, text
) TO service_role;

COMMENT ON FUNCTION public.gh_ghpv_apply_calibration IS
  'GHPV-3 curator calibration persist; no GHC mutation.';
