-- Phase 6: Fix spend ledger sign + strengthen spend idempotency.
-- Memory path already stores spends as negative amounts (SUM-based balance).
-- DB RPC previously inserted positive amounts for kind=spent, which inflated balances.
-- Additive: REPLACE function only; no table drops; no balance rewrites.

CREATE OR REPLACE FUNCTION public.ghc_execute_spend(
  p_user_id text,
  p_amount numeric,
  p_reference_id text,
  p_reason text DEFAULT 'Purchase',
  p_source_event text DEFAULT 'SPEND'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount numeric := abs(coalesce(p_amount, 0));
  v_signed numeric;
  v_avail numeric;
  v_existing public.ghc_transactions%ROWTYPE;
  v_tx_id uuid;
  v_now timestamptz := now();
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_USER');
  END IF;
  IF p_reference_id IS NULL OR length(trim(p_reference_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_REFERENCE');
  END IF;
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;
  -- Match transfer precision: numeric(18,4)
  IF v_amount <> round(v_amount, 4) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT_PRECISION');
  END IF;

  -- Serialize concurrent spends for this user
  PERFORM pg_advisory_xact_lock(hashtext('ghc_spend:' || p_user_id));

  -- Idempotency: existing spend/purchase with same reference
  SELECT * INTO v_existing
  FROM public.ghc_transactions
  WHERE user_id = p_user_id
    AND reference_id = p_reference_id
    AND kind IN ('spent', 'purchased')
    AND status = 'posted'
  LIMIT 1;

  IF FOUND THEN
    -- Conflicting reuse of same reference with different amount
    IF abs(v_existing.amount) <> v_amount THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'IDEMPOTENCY_CONFLICT',
        'message', 'referenceId already used with a different amount'
      );
    END IF;
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'transactionId', v_existing.id,
      'referenceId', p_reference_id,
      'amount', abs(v_existing.amount)
    );
  END IF;

  v_avail := public.ghc_available_balance(p_user_id);
  IF v_avail < v_amount THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_BALANCE', 'available', v_avail);
  END IF;

  -- Authoritative sign: debits are negative so SUM(amount) remains correct
  v_signed := -v_amount;

  INSERT INTO public.ghc_transactions (
    user_id, kind, amount, status, reason, source_event, reference_id, created_at, posted_at
  ) VALUES (
    p_user_id, 'spent', v_signed, 'posted', coalesce(p_reason, 'Purchase'),
    coalesce(p_source_event, 'SPEND'), p_reference_id, v_now, v_now
  ) RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'transactionId', v_tx_id,
    'referenceId', p_reference_id,
    'amount', v_amount,
    'tx', jsonb_build_object(
      'id', v_tx_id,
      'userId', p_user_id,
      'kind', 'spent',
      'amount', v_signed,
      'status', 'posted',
      'reason', coalesce(p_reason, 'Purchase'),
      'sourceEvent', coalesce(p_source_event, 'SPEND'),
      'referenceId', p_reference_id,
      'createdAt', (extract(epoch from v_now) * 1000)::bigint
    )
  );
EXCEPTION WHEN unique_violation THEN
  -- Concurrent insert with same reference — treat as idempotent if amount matches
  SELECT * INTO v_existing
  FROM public.ghc_transactions
  WHERE user_id = p_user_id
    AND reference_id = p_reference_id
    AND kind IN ('spent', 'purchased')
    AND status = 'posted'
  LIMIT 1;
  IF FOUND AND abs(v_existing.amount) = v_amount THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'transactionId', v_existing.id,
      'referenceId', p_reference_id
    );
  END IF;
  RETURN jsonb_build_object('ok', false, 'error', 'IDEMPOTENCY_CONFLICT');
WHEN undefined_table OR undefined_column THEN
  RETURN jsonb_build_object('ok', false, 'error', 'SCHEMA_MISMATCH');
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_execute_spend(text, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_execute_spend(text, numeric, text, text, text) TO service_role;

-- Unique spend reference per user (idempotency at index level)
CREATE UNIQUE INDEX IF NOT EXISTS uq_ghc_spend_ref
  ON public.ghc_transactions (user_id, reference_id)
  WHERE kind IN ('spent', 'purchased') AND status = 'posted' AND reference_id IS NOT NULL;

COMMENT ON FUNCTION public.ghc_execute_spend IS
  'Phase 6: spend debits as negative amounts; advisory lock; idempotent reference; amount conflict rejection.';
