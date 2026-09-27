-- GHC → Pi withdrawal requests (manual/platform settlement).
-- Lock model: pending rows reserve GHC; settle posts one durable spend on complete.
-- Rate: freeze ghc_per_pi on each request (default from app: REFERENCE_GHC_PER_PI = 100).

CREATE TABLE IF NOT EXISTS public.ghc_withdrawal_requests (
  id                text PRIMARY KEY,
  user_id           text NOT NULL,
  ghc_amount        numeric(24, 8) NOT NULL CHECK (ghc_amount > 0),
  ghc_per_pi        numeric(24, 8) NOT NULL CHECK (ghc_per_pi > 0),
  pi_amount         numeric(24, 12) NOT NULL CHECK (pi_amount > 0),
  min_pi_threshold  numeric(24, 8) NOT NULL DEFAULT 100,
  pi_wallet_address text NOT NULL,
  status            text NOT NULL DEFAULT 'requested'
                    CHECK (status IN (
                      'requested', 'under_review', 'approved', 'processing',
                      'completed', 'rejected', 'failed'
                    )),
  idempotency_key   text NOT NULL,
  reject_reason     text,
  settlement_ref    text,
  operator_id       text,
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ghc_withdrawal_idempotency
  ON public.ghc_withdrawal_requests (user_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_ghc_withdrawal_user_created
  ON public.ghc_withdrawal_requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ghc_withdrawal_status
  ON public.ghc_withdrawal_requests (status, created_at DESC)
  WHERE status NOT IN ('completed', 'rejected', 'failed');

ALTER TABLE public.ghc_withdrawal_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ghc_withdrawal_requests_no_client ON public.ghc_withdrawal_requests;
CREATE POLICY ghc_withdrawal_requests_no_client ON public.ghc_withdrawal_requests
  FOR ALL USING (false) WITH CHECK (false);

-- Pending lock total for a user
CREATE OR REPLACE FUNCTION public.ghc_withdrawal_locked_ghc(p_user_id text)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(ghc_amount), 0)
  FROM public.ghc_withdrawal_requests
  WHERE user_id = p_user_id
    AND status IN ('requested', 'under_review', 'approved', 'processing');
$$;

REVOKE ALL ON FUNCTION public.ghc_withdrawal_locked_ghc(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_withdrawal_locked_ghc(text) TO service_role;

-- Create request + virtual lock (atomic under advisory lock)
CREATE OR REPLACE FUNCTION public.ghc_withdrawal_create(
  p_user_id text,
  p_ghc_amount numeric,
  p_ghc_per_pi numeric,
  p_pi_wallet text,
  p_idempotency_key text,
  p_min_pi numeric DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
  v_locked numeric;
  v_withdrawable numeric;
  v_pi numeric;
  v_id text;
  v_existing public.ghc_withdrawal_requests%ROWTYPE;
  v_wallet text := trim(COALESCE(p_pi_wallet, ''));
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'USER_REQUIRED');
  END IF;
  IF p_ghc_amount IS NULL OR p_ghc_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;
  IF p_ghc_per_pi IS NULL OR p_ghc_per_pi <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_RATE');
  END IF;
  IF length(v_wallet) < 8 OR length(v_wallet) > 256 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_WALLET');
  END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'IDEMPOTENCY_REQUIRED');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ghc_withdraw:' || p_user_id));

  SELECT * INTO v_existing
  FROM public.ghc_withdrawal_requests
  WHERE user_id = p_user_id AND idempotency_key = trim(p_idempotency_key)
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'request', to_jsonb(v_existing)
    );
  END IF;

  -- Ledger balance: sum of posted amounts (same convention as wallet)
  SELECT COALESCE(SUM(amount), 0) INTO v_balance
  FROM public.ghc_transactions
  WHERE user_id = p_user_id AND status = 'posted';

  v_locked := public.ghc_withdrawal_locked_ghc(p_user_id);
  v_withdrawable := v_balance - v_locked;
  IF v_withdrawable < p_ghc_amount THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'INSUFFICIENT_WITHDRAWABLE',
      'balance', v_balance,
      'locked', v_locked,
      'withdrawable', v_withdrawable
    );
  END IF;

  v_pi := round((p_ghc_amount / p_ghc_per_pi)::numeric, 8);
  IF v_pi < COALESCE(p_min_pi, 100) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'BELOW_MINIMUM_PI',
      'piAmount', v_pi,
      'minPi', COALESCE(p_min_pi, 100)
    );
  END IF;

  v_id := 'wd_' || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.ghc_withdrawal_requests (
    id, user_id, ghc_amount, ghc_per_pi, pi_amount, min_pi_threshold,
    pi_wallet_address, status, idempotency_key
  ) VALUES (
    v_id, p_user_id, p_ghc_amount, p_ghc_per_pi, v_pi, COALESCE(p_min_pi, 100),
    v_wallet, 'requested', trim(p_idempotency_key)
  )
  RETURNING * INTO v_existing;

  RETURN jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'request', to_jsonb(v_existing),
    'balance', v_balance,
    'locked', v_locked + p_ghc_amount,
    'withdrawable', v_withdrawable - p_ghc_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_withdrawal_create(text, numeric, numeric, text, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_withdrawal_create(text, numeric, numeric, text, text, numeric) TO service_role;

-- Operator status transition (no balance side-effects except reject/fail release via status)
CREATE OR REPLACE FUNCTION public.ghc_withdrawal_set_status(
  p_id text,
  p_operator_id text,
  p_status text,
  p_settlement_ref text DEFAULT NULL,
  p_reject_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.ghc_withdrawal_requests%ROWTYPE;
  v_next text := lower(trim(COALESCE(p_status, '')));
BEGIN
  IF p_id IS NULL OR length(trim(p_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ID_REQUIRED');
  END IF;
  IF p_operator_id IS NULL OR length(trim(p_operator_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'OPERATOR_REQUIRED');
  END IF;
  IF v_next NOT IN (
    'under_review', 'approved', 'processing', 'completed', 'rejected', 'failed'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_STATUS');
  END IF;

  SELECT * INTO v_row FROM public.ghc_withdrawal_requests WHERE id = trim(p_id) FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_row.status IN ('completed', 'rejected', 'failed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'TERMINAL_STATE', 'request', to_jsonb(v_row));
  END IF;

  IF v_next = 'completed' AND (p_settlement_ref IS NULL OR length(trim(p_settlement_ref)) = 0) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SETTLEMENT_REF_REQUIRED');
  END IF;

  UPDATE public.ghc_withdrawal_requests
  SET
    status = v_next,
    operator_id = trim(p_operator_id),
    settlement_ref = CASE WHEN v_next = 'completed' THEN trim(p_settlement_ref) ELSE settlement_ref END,
    reject_reason = CASE WHEN v_next IN ('rejected', 'failed') THEN left(trim(COALESCE(p_reject_reason, '')), 500) ELSE reject_reason END,
    updated_at = now(),
    completed_at = CASE WHEN v_next = 'completed' THEN now() ELSE completed_at END
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'request', to_jsonb(v_row));
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_withdrawal_set_status(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_withdrawal_set_status(text, text, text, text, text) TO service_role;
