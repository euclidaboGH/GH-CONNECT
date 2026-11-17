-- Phase 6: Authoritative available balances, min payout policy, concurrent-safe reserve.
-- Balances are derived only from gh_earnings_ledger_entries. Client amounts are never trusted.

-- Policy knobs (single row)
CREATE TABLE IF NOT EXISTS public.gh_earnings_payout_policy (
  singleton_id          integer PRIMARY KEY DEFAULT 1 CHECK (singleton_id = 1),
  min_payout_atomic     numeric(38,0) NOT NULL DEFAULT 1000000
                        CHECK (min_payout_atomic >= 0), -- 0.1 PI default (1e7 scale)
  max_single_payout_atomic numeric(38,0) NOT NULL DEFAULT 1000000000
                        CHECK (max_single_payout_atomic > 0), -- 100 PI
  fee_atomic            numeric(38,0) NOT NULL DEFAULT 0 CHECK (fee_atomic >= 0),
  asset                 text NOT NULL DEFAULT 'PI' CHECK (asset = 'PI'),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.gh_earnings_payout_policy (singleton_id)
VALUES (1) ON CONFLICT (singleton_id) DO NOTHING;

ALTER TABLE public.gh_earnings_payout_policy ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_earnings_payout_policy_no_client ON public.gh_earnings_payout_policy;
CREATE POLICY gh_earnings_payout_policy_no_client ON public.gh_earnings_payout_policy
  FOR ALL USING (false) WITH CHECK (false);
REVOKE ALL ON TABLE public.gh_earnings_payout_policy FROM PUBLIC, anon, authenticated, service_role;

-- Concurrent-safe balances under advisory lock (used by reserve path)
CREATE OR REPLACE FUNCTION public.gh_earnings_balances_locked(
  p_user_id text,
  p_asset text DEFAULT 'PI'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user text := NULLIF(trim(COALESCE(p_user_id, '')), '');
BEGIN
  IF v_user IS NULL OR length(v_user) > 160 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  -- Serialize balance mutations per user within this transaction
  PERFORM pg_advisory_xact_lock(hashtextextended('gh_earnings:' || v_user, 0));
  RETURN public.gh_earnings_balances(v_user, COALESCE(NULLIF(trim(p_asset), ''), 'PI'));
END;
$$;

-- Withdrawable snapshot: available - policy floors, never client-supplied
CREATE OR REPLACE FUNCTION public.gh_earnings_withdrawable(
  p_user_id text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user text := NULLIF(trim(COALESCE(p_user_id, '')), '');
  v_bal jsonb;
  v_policy public.gh_earnings_payout_policy%ROWTYPE;
  v_available numeric(38,0);
  v_reserved numeric(38,0);
  v_pending numeric(38,0);
  v_paid numeric(38,0);
  v_withdrawable numeric(38,0);
  v_eligible boolean;
  v_reasons text[] := ARRAY[]::text[];
BEGIN
  IF v_user IS NULL OR length(v_user) > 160 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  SELECT * INTO v_policy FROM public.gh_earnings_payout_policy WHERE singleton_id = 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PAYOUT_POLICY_MISSING');
  END IF;

  v_bal := public.gh_earnings_balances(v_user, 'PI');
  IF (v_bal->>'ok')::boolean IS NOT TRUE THEN
    RETURN v_bal;
  END IF;

  v_available := COALESCE((v_bal->>'availableAtomic')::numeric, 0);
  v_reserved := COALESCE((v_bal->>'reservedAtomic')::numeric, 0);
  v_pending := COALESCE((v_bal->>'pendingAtomic')::numeric, 0);
  v_paid := COALESCE((v_bal->>'paidAtomic')::numeric, 0);

  -- Floor to whole atomic units (already integer); withdrawable is available only
  v_withdrawable := trunc(v_available);
  IF v_withdrawable < 0 THEN v_withdrawable := 0; END IF;

  v_eligible := true;
  IF v_withdrawable < v_policy.min_payout_atomic THEN
    v_eligible := false;
    v_reasons := array_append(v_reasons, 'BELOW_MIN_PAYOUT');
  END IF;
  IF v_withdrawable <= 0 THEN
    v_eligible := false;
    v_reasons := array_append(v_reasons, 'NO_AVAILABLE_BALANCE');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'userId', v_user,
    'asset', 'PI',
    'atomicScale', 10000000,
    'pendingAtomic', v_pending,
    'availableAtomic', v_available,
    'reservedAtomic', v_reserved,
    'paidAtomic', v_paid,
    'withdrawableAtomic', v_withdrawable,
    'minPayoutAtomic', v_policy.min_payout_atomic,
    'maxSinglePayoutAtomic', v_policy.max_single_payout_atomic,
    'feeAtomic', v_policy.fee_atomic,
    'eligible', v_eligible,
    'reasons', to_jsonb(v_reasons),
    -- Display (exact division by scale)
    'pending', (v_pending / 10000000.0),
    'available', (v_available / 10000000.0),
    'reserved', (v_reserved / 10000000.0),
    'paid', (v_paid / 10000000.0),
    'withdrawable', (v_withdrawable / 10000000.0),
    'minPayout', (v_policy.min_payout_atomic / 10000000.0),
    'maxSinglePayout', (v_policy.max_single_payout_atomic / 10000000.0),
    'fee', (v_policy.fee_atomic / 10000000.0),
    'rounding', 'floor_atomic',
    'authority', 'gh_earnings_ledger_entries'
  );
END;
$$;

-- Replace reserve with advisory-locked concurrent-safe version + min/max policy
CREATE OR REPLACE FUNCTION public.gh_earnings_reserve(
  p_user_id text,
  p_amount_atomic numeric,
  p_unique_ref text,
  p_payout_request_id text,
  p_source_kind text DEFAULT 'withdrawal',
  p_reason text DEFAULT 'payout_reservation'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user text := NULLIF(trim(COALESCE(p_user_id, '')), '');
  v_ref text := NULLIF(trim(COALESCE(p_unique_ref, '')), '');
  v_pay text := NULLIF(trim(COALESCE(p_payout_request_id, '')), '');
  v_bal jsonb;
  v_available numeric(38,0);
  v_policy public.gh_earnings_payout_policy%ROWTYPE;
  v_amount numeric(38,0);
  v_existing public.gh_earnings_ledger_entries%ROWTYPE;
  v_row public.gh_earnings_ledger_entries%ROWTYPE;
BEGIN
  IF v_user IS NULL OR v_ref IS NULL OR v_pay IS NULL
     OR p_amount_atomic IS NULL OR p_amount_atomic <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  -- Exact integer atomic only (reject fractional atomic)
  IF trunc(p_amount_atomic) <> p_amount_atomic THEN
    RETURN jsonb_build_object('ok', false, 'error', 'AMOUNT_MUST_BE_INTEGER_ATOMIC');
  END IF;
  v_amount := trunc(p_amount_atomic);

  SELECT * INTO v_policy FROM public.gh_earnings_payout_policy WHERE singleton_id = 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PAYOUT_POLICY_MISSING');
  END IF;
  IF v_amount < v_policy.min_payout_atomic THEN
    RETURN jsonb_build_object('ok', false, 'error', 'BELOW_MIN_PAYOUT', 'minPayoutAtomic', v_policy.min_payout_atomic);
  END IF;
  IF v_amount > v_policy.max_single_payout_atomic THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ABOVE_MAX_SINGLE_PAYOUT', 'maxSinglePayoutAtomic', v_policy.max_single_payout_atomic);
  END IF;

  -- Serialize concurrent reserves for the same user
  PERFORM pg_advisory_xact_lock(hashtextextended('gh_earnings:' || v_user, 0));

  SELECT * INTO v_existing FROM public.gh_earnings_ledger_entries
    WHERE user_id = v_user AND unique_ref = v_ref;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true, 'duplicate', true, 'entryId', v_existing.id,
      'status', v_existing.status, 'amountAtomic', v_existing.amount_atomic
    );
  END IF;

  v_bal := public.gh_earnings_balances(v_user, 'PI');
  IF (v_bal->>'ok')::boolean IS NOT TRUE THEN
    RETURN v_bal;
  END IF;
  v_available := COALESCE((v_bal->>'availableAtomic')::numeric, 0);
  IF v_available < v_amount THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'INSUFFICIENT_AVAILABLE_EARNINGS',
      'availableAtomic', v_available,
      'requestedAtomic', v_amount
    );
  END IF;

  INSERT INTO public.gh_earnings_ledger_entries (
    user_id, asset, entry_type, source_kind, amount_atomic, status, unique_ref,
    payout_request_id, reason
  ) VALUES (
    v_user, 'PI', 'reserve', COALESCE(NULLIF(trim(p_source_kind), ''), 'withdrawal'),
    v_amount, 'reserved', v_ref, v_pay, left(COALESCE(p_reason, ''), 240)
  ) RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true, 'duplicate', false, 'entryId', v_row.id,
    'status', 'reserved', 'amountAtomic', v_row.amount_atomic, 'payoutRequestId', v_pay
  );
END;
$$;

-- Release a reservation back to available (failed/interrupted payout — compensating entry)
CREATE OR REPLACE FUNCTION public.gh_earnings_release_reserve(
  p_user_id text,
  p_amount_atomic numeric,
  p_unique_ref text,
  p_payout_request_id text,
  p_reason text DEFAULT 'payout_reservation_released'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user text := NULLIF(trim(COALESCE(p_user_id, '')), '');
  v_ref text := NULLIF(trim(COALESCE(p_unique_ref, '')), '');
  v_pay text := NULLIF(trim(COALESCE(p_payout_request_id, '')), '');
  v_existing public.gh_earnings_ledger_entries%ROWTYPE;
  v_row public.gh_earnings_ledger_entries%ROWTYPE;
  v_reserved numeric(38,0);
  v_amount numeric(38,0);
BEGIN
  IF v_user IS NULL OR v_ref IS NULL OR v_pay IS NULL
     OR p_amount_atomic IS NULL OR p_amount_atomic <= 0
     OR trunc(p_amount_atomic) <> p_amount_atomic THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  v_amount := trunc(p_amount_atomic);

  PERFORM pg_advisory_xact_lock(hashtextextended('gh_earnings:' || v_user, 0));

  SELECT * INTO v_existing FROM public.gh_earnings_ledger_entries
    WHERE user_id = v_user AND unique_ref = v_ref;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true, 'duplicate', true, 'entryId', v_existing.id, 'status', v_existing.status
    );
  END IF;

  SELECT COALESCE(SUM(CASE
    WHEN entry_type = 'reserve' AND status = 'reserved' AND payout_request_id = v_pay THEN amount_atomic
    WHEN entry_type = 'settle' AND status = 'paid' AND payout_request_id = v_pay THEN -amount_atomic
    WHEN entry_type = 'release_reserve' AND status = 'available' AND payout_request_id = v_pay THEN -amount_atomic
    ELSE 0 END), 0)
  INTO v_reserved
  FROM public.gh_earnings_ledger_entries
  WHERE user_id = v_user AND asset = 'PI';

  IF v_reserved < v_amount THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_RESERVED_TO_RELEASE', 'reservedAtomic', v_reserved);
  END IF;

  INSERT INTO public.gh_earnings_ledger_entries (
    user_id, asset, entry_type, source_kind, amount_atomic, status, unique_ref,
    payout_request_id, reason
  ) VALUES (
    v_user, 'PI', 'release_reserve', 'withdrawal', v_amount, 'available', v_ref, v_pay,
    left(COALESCE(p_reason, ''), 240)
  ) RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true, 'duplicate', false, 'entryId', v_row.id,
    'status', 'available', 'amountAtomic', v_row.amount_atomic
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_earnings_balances_locked(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_earnings_withdrawable(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_earnings_reserve(text, numeric, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_earnings_release_reserve(text, numeric, text, text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.gh_earnings_balances_locked(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_earnings_withdrawable(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_earnings_reserve(text, numeric, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_earnings_release_reserve(text, numeric, text, text, text) TO service_role;

COMMENT ON TABLE public.gh_earnings_payout_policy IS
  'Phase 6 min/max/fee policy for PI earnings withdrawals. Amounts are integer atomic units (1e-7 PI).';
COMMENT ON FUNCTION public.gh_earnings_withdrawable(text) IS
  'Authoritative withdrawable PI balance from ledger entries + policy. Never accepts client amounts.';
