-- Additive: authoritative GHC spend (debit-only) for membership/boosts
-- Does not alter historical balances or drop tables.

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
  v_avail numeric;
  v_existing uuid;
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

  -- Serialize per user
  PERFORM pg_advisory_xact_lock(hashtext('ghc_spend:' || p_user_id));

  -- Idempotency: existing spend with same reference
  SELECT id INTO v_existing
  FROM public.ghc_transactions
  WHERE user_id = p_user_id
    AND reference_id = p_reference_id
    AND kind IN ('spent', 'purchased', 'transfer_out')
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'transactionId', v_existing,
      'referenceId', p_reference_id
    );
  END IF;

  v_avail := public.ghc_available_balance(p_user_id);
  IF v_avail < v_amount THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_BALANCE', 'available', v_avail);
  END IF;

  INSERT INTO public.ghc_transactions (
    user_id, kind, amount, status, reason, source_event, reference_id, created_at
  ) VALUES (
    p_user_id, 'spent', v_amount, 'posted', coalesce(p_reason, 'Purchase'),
    coalesce(p_source_event, 'SPEND'), p_reference_id, v_now
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
      'amount', v_amount,
      'status', 'posted',
      'reason', coalesce(p_reason, 'Purchase'),
      'sourceEvent', coalesce(p_source_event, 'SPEND'),
      'referenceId', p_reference_id,
      'createdAt', (extract(epoch from v_now) * 1000)::bigint
    )
  );
EXCEPTION WHEN undefined_table OR undefined_column THEN
  RETURN jsonb_build_object('ok', false, 'error', 'SCHEMA_MISMATCH');
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_execute_spend(text, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_execute_spend(text, numeric, text, text, text) TO service_role;
