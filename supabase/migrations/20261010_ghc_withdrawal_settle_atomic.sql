-- =============================================================================
-- 20261010_ghc_withdrawal_settle_atomic.sql
-- Atomic withdrawal settlement: debit + complete in one transaction.
--
-- Fixes P1.4A: ordinary ghc_execute_spend uses ghc_spendable_balance which
-- subtracts ALL active locks including status=processing. Settlement could not
-- consume its own reservation.
--
-- This RPC:
--   - locks ghc_balance:{userId}
--   - FOR UPDATE the withdrawal row
--   - excludes ONLY this withdrawal from the reservation sum
--   - posts one debit with reference withdrawal_settle:{id}
--   - sets status=completed in the same transaction
-- Ordinary ghc_execute_spend / ghc_spendable_balance are UNCHANGED.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ghc_withdrawal_settle(
  p_id text,
  p_operator_id text,
  p_settlement_ref text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.ghc_withdrawal_requests%ROWTYPE;
  v_ledger numeric;
  v_locked_others numeric;
  v_settle_avail numeric;
  v_amount numeric;
  v_ref text;
  v_existing public.ghc_transactions%ROWTYPE;
  v_tx_id uuid;
  v_now timestamptz := now();
BEGIN
  IF p_id IS NULL OR length(trim(p_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ID_REQUIRED');
  END IF;
  IF p_operator_id IS NULL OR length(trim(p_operator_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'OPERATOR_REQUIRED');
  END IF;
  IF p_settlement_ref IS NULL OR length(trim(p_settlement_ref)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SETTLEMENT_REF_REQUIRED');
  END IF;

  -- Lock withdrawal row first (stable order: row then balance key is fine for single-user settle)
  SELECT * INTO v_row
  FROM public.ghc_withdrawal_requests
  WHERE id = trim(p_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  v_amount := v_row.ghc_amount;
  v_ref := 'withdrawal_settle:' || v_row.id;

  -- Shared balance serialization with spend/transfer/withdrawal-create
  PERFORM pg_advisory_xact_lock(hashtext('ghc_balance:' || v_row.user_id));

  -- Idempotent: already completed
  IF v_row.status = 'completed' THEN
    SELECT * INTO v_existing
    FROM public.ghc_transactions
    WHERE user_id = v_row.user_id
      AND reference_id = v_ref
      AND kind IN ('spent', 'purchased')
      AND status = 'posted'
    LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'request', to_jsonb(v_row),
        'transactionId', v_existing.id,
        'referenceId', v_ref
      );
    END IF;
    -- Completed without ledger row is inconsistent; do not invent a second debit path here
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'COMPLETED_WITHOUT_DEBIT',
      'request', to_jsonb(v_row)
    );
  END IF;

  IF v_row.status IN ('rejected', 'failed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'TERMINAL_STATE', 'request', to_jsonb(v_row));
  END IF;

  IF v_row.status NOT IN ('requested', 'under_review', 'approved', 'processing') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_STATUS', 'request', to_jsonb(v_row));
  END IF;

  -- Existing debit for this settle ref (retry after partial failure)
  SELECT * INTO v_existing
  FROM public.ghc_transactions
  WHERE user_id = v_row.user_id
    AND reference_id = v_ref
    AND kind IN ('spent', 'purchased')
    AND status = 'posted'
  LIMIT 1;

  IF FOUND THEN
    IF abs(v_existing.amount) <> v_amount THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'IDEMPOTENCY_CONFLICT',
        'message', 'settlement reference exists with different amount'
      );
    END IF;
    -- Debit exists; complete withdrawal in this transaction
    UPDATE public.ghc_withdrawal_requests
    SET
      status = 'completed',
      operator_id = trim(p_operator_id),
      settlement_ref = trim(p_settlement_ref),
      updated_at = v_now,
      completed_at = COALESCE(completed_at, v_now)
    WHERE id = v_row.id
    RETURNING * INTO v_row;

    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'request', to_jsonb(v_row),
      'transactionId', v_existing.id,
      'referenceId', v_ref
    );
  END IF;

  v_ledger := public.ghc_available_balance(v_row.user_id);

  -- Exclude ONLY this withdrawal from active locks
  SELECT COALESCE(SUM(ghc_amount), 0) INTO v_locked_others
  FROM public.ghc_withdrawal_requests
  WHERE user_id = v_row.user_id
    AND status IN ('requested', 'under_review', 'approved', 'processing')
    AND id <> v_row.id;

  v_settle_avail := v_ledger - COALESCE(v_locked_others, 0);
  IF v_settle_avail < v_amount THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'INSUFFICIENT_BALANCE',
      'available', GREATEST(0, v_settle_avail),
      'ledger', v_ledger,
      'lockedOthers', v_locked_others,
      'amount', v_amount
    );
  END IF;

  -- Authoritative debit (negative amount, same convention as ghc_execute_spend)
  INSERT INTO public.ghc_transactions (
    user_id, kind, amount, status, reason, source_event, reference_id, created_at, posted_at
  ) VALUES (
    v_row.user_id,
    'spent',
    -v_amount,
    'posted',
    'GHC withdrawal settled to Pi',
    'WITHDRAWAL_SETTLE',
    v_ref,
    v_now,
    v_now
  )
  RETURNING id INTO v_tx_id;

  UPDATE public.ghc_withdrawal_requests
  SET
    status = 'completed',
    operator_id = trim(p_operator_id),
    settlement_ref = trim(p_settlement_ref),
    updated_at = v_now,
    completed_at = v_now
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'request', to_jsonb(v_row),
    'transactionId', v_tx_id,
    'referenceId', v_ref,
    'amount', v_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_withdrawal_settle(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_withdrawal_settle(text, text, text) TO service_role;

COMMENT ON FUNCTION public.ghc_withdrawal_settle(text, text, text) IS
  'Atomic withdrawal settlement: ghc_balance lock; exclude only this reservation; one debit; completed in same txn.';
