-- Phase 4: Controlled reward-source adapters for unified PI earnings ledger.
-- Every attempt is audited. Credits only via service_role RPCs with explicit policy gates in app code.
-- Does NOT reopen GHC issuance. Does NOT auto-reward views or self-interactions.

CREATE TABLE IF NOT EXISTS public.gh_earnings_reward_attempts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         text NOT NULL,
  source_kind     text NOT NULL CHECK (source_kind IN (
                    'activity_reward', 'creator_earning', 'referral', 'promotion',
                    'community', 'utility', 'system'
                  )),
  reference_id    text NOT NULL,
  outcome         text NOT NULL CHECK (outcome IN ('credited', 'denied', 'duplicate')),
  deny_reason     text,
  amount_atomic   numeric(38,0) NOT NULL DEFAULT 0 CHECK (amount_atomic >= 0),
  ledger_entry_id uuid,
  actor_id        text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_reward_attempt_user_nonempty CHECK (length(trim(user_id)) BETWEEN 1 AND 160),
  CONSTRAINT gh_reward_attempt_ref_nonempty CHECK (length(trim(reference_id)) BETWEEN 1 AND 200)
);

-- One evaluation outcome per user/source/reference (idempotent attempts)
CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_earnings_reward_attempt_ref
  ON public.gh_earnings_reward_attempts (user_id, source_kind, reference_id);

CREATE INDEX IF NOT EXISTS idx_gh_earnings_reward_attempts_user
  ON public.gh_earnings_reward_attempts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gh_earnings_reward_attempts_outcome
  ON public.gh_earnings_reward_attempts (outcome, source_kind, created_at DESC);

ALTER TABLE public.gh_earnings_reward_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_earnings_reward_attempts_no_client ON public.gh_earnings_reward_attempts;
CREATE POLICY gh_earnings_reward_attempts_no_client ON public.gh_earnings_reward_attempts
  FOR ALL USING (false) WITH CHECK (false);

REVOKE ALL ON TABLE public.gh_earnings_reward_attempts FROM PUBLIC, anon, authenticated, service_role;

-- Daily per-user per-source atomic credit cap tracking (derived also from attempts)
CREATE OR REPLACE FUNCTION public.gh_earnings_reward_day_credited(
  p_user_id text,
  p_source_kind text,
  p_day_utc date DEFAULT (timezone('utc', now()))::date
) RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(SUM(amount_atomic), 0)::numeric(38,0)
  FROM public.gh_earnings_reward_attempts
  WHERE user_id = trim(p_user_id)
    AND source_kind = trim(p_source_kind)
    AND outcome = 'credited'
    AND (created_at AT TIME ZONE 'utc')::date = p_day_utc;
$$;

CREATE OR REPLACE FUNCTION public.gh_earnings_reward_record_attempt(
  p_user_id text,
  p_source_kind text,
  p_reference_id text,
  p_outcome text,
  p_amount_atomic numeric DEFAULT 0,
  p_deny_reason text DEFAULT NULL,
  p_ledger_entry_id uuid DEFAULT NULL,
  p_actor_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user text := NULLIF(trim(COALESCE(p_user_id, '')), '');
  v_kind text := NULLIF(trim(COALESCE(p_source_kind, '')), '');
  v_ref text := NULLIF(trim(COALESCE(p_reference_id, '')), '');
  v_outcome text := NULLIF(trim(COALESCE(p_outcome, '')), '');
  v_existing public.gh_earnings_reward_attempts%ROWTYPE;
  v_row public.gh_earnings_reward_attempts%ROWTYPE;
BEGIN
  IF v_user IS NULL OR v_kind IS NULL OR v_ref IS NULL OR v_outcome IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  IF v_outcome NOT IN ('credited', 'denied', 'duplicate') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_OUTCOME');
  END IF;
  IF v_kind NOT IN ('activity_reward', 'creator_earning', 'referral', 'promotion', 'community', 'utility', 'system') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_SOURCE_KIND');
  END IF;
  IF p_amount_atomic IS NULL OR p_amount_atomic < 0 OR trunc(p_amount_atomic) <> p_amount_atomic THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;

  SELECT * INTO v_existing FROM public.gh_earnings_reward_attempts
    WHERE user_id = v_user AND source_kind = v_kind AND reference_id = v_ref;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true, 'duplicate', true, 'attemptId', v_existing.id,
      'outcome', v_existing.outcome, 'amountAtomic', v_existing.amount_atomic,
      'denyReason', v_existing.deny_reason
    );
  END IF;

  INSERT INTO public.gh_earnings_reward_attempts (
    user_id, source_kind, reference_id, outcome, deny_reason, amount_atomic,
    ledger_entry_id, actor_id, metadata
  ) VALUES (
    v_user, v_kind, v_ref, v_outcome,
    NULLIF(left(trim(COALESCE(p_deny_reason, '')), 160), ''),
    p_amount_atomic, p_ledger_entry_id,
    NULLIF(trim(COALESCE(p_actor_id, '')), ''),
    COALESCE(p_metadata, '{}'::jsonb)
  ) RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true, 'duplicate', false, 'attemptId', v_row.id,
    'outcome', v_row.outcome, 'amountAtomic', v_row.amount_atomic
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_earnings_reward_day_credited(text, text, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_earnings_reward_record_attempt(text, text, text, text, numeric, text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_earnings_reward_day_credited(text, text, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_earnings_reward_record_attempt(text, text, text, text, numeric, text, uuid, text, jsonb) TO service_role;

COMMENT ON TABLE public.gh_earnings_reward_attempts IS
  'Phase 4 audit of reward adapter decisions. Credited rows must correspond to ledger unique_ref; denied rows never mint.';
