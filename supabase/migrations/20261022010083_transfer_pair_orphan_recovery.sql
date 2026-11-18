-- Stage 2.3 — Transfer pair integrity (ops / service_role only).
-- ghc_execute_transfer writes debit+credit in one transaction; orphans should be rare.
-- These RPCs support inspection and safe completion of a missing transfer_in only.
-- Does NOT mint net-new GHC beyond completing an already-debited transfer_out.

CREATE OR REPLACE FUNCTION public.ghc_list_orphan_transfer_outs(
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      t.id AS "debitId",
      t.user_id AS "senderId",
      t.counterparty_id AS "recipientId",
      abs(t.amount) AS amount,
      t.reference_id AS "referenceId",
      (extract(epoch from t.created_at) * 1000)::bigint AS "createdAt"
    FROM public.ghc_transactions t
    WHERE t.kind = 'transfer_out'
      AND t.status = 'posted'
      AND t.reference_id IS NOT NULL
      AND t.counterparty_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.ghc_transactions i
        WHERE i.kind = 'transfer_in'
          AND i.status = 'posted'
          AND i.reference_id = t.reference_id
          AND i.user_id = t.counterparty_id
      )
    ORDER BY t.created_at DESC
    LIMIT v_limit
  ) q;

  RETURN jsonb_build_object('ok', true, 'orphans', COALESCE(v_rows, '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_list_orphan_transfer_outs(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_list_orphan_transfer_outs(integer) TO service_role;

-- Complete missing transfer_in for an existing posted transfer_out (no second debit).
CREATE OR REPLACE FUNCTION public.ghc_complete_orphan_transfer_in(
  p_reference_id text,
  p_operator_note text DEFAULT 'ops_complete_orphan_transfer_in'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_out public.ghc_transactions%ROWTYPE;
  v_in public.ghc_transactions%ROWTYPE;
  v_credit_id uuid;
  v_now timestamptz := now();
  v_note text := left(trim(COALESCE(p_operator_note, 'ops_complete_orphan_transfer_in')), 160);
  v_amount numeric;
BEGIN
  IF p_reference_id IS NULL OR btrim(p_reference_id) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_REFERENCE');
  END IF;

  SELECT * INTO v_out
  FROM public.ghc_transactions
  WHERE kind = 'transfer_out'
    AND status = 'posted'
    AND reference_id = p_reference_id
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NO_TRANSFER_OUT');
  END IF;

  IF v_out.counterparty_id IS NULL OR btrim(v_out.counterparty_id) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'MISSING_COUNTERPARTY');
  END IF;

  v_amount := abs(v_out.amount);
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_DEBIT_AMOUNT');
  END IF;

  SELECT * INTO v_in
  FROM public.ghc_transactions
  WHERE kind = 'transfer_in'
    AND status = 'posted'
    AND reference_id = p_reference_id
    AND user_id = v_out.counterparty_id
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'referenceId', p_reference_id,
      'creditTx', jsonb_build_object(
        'id', v_in.id,
        'userId', v_in.user_id,
        'amount', v_in.amount
      )
    );
  END IF;

  INSERT INTO public.ghc_transactions (
    user_id, kind, amount, status, reason, source_event, reference_id,
    request_id, counterparty_id, metadata, posted_at
  ) VALUES (
    v_out.counterparty_id,
    'transfer_in',
    v_amount,
    'posted',
    COALESCE(NULLIF(trim(v_out.reason), ''), 'Received GHC'),
    'WALLET_TRANSFER_ORPHAN_COMPLETE',
    p_reference_id,
    v_out.request_id,
    v_out.user_id,
    jsonb_build_object(
      'direction', 'receive',
      'transferStatus', 'completed',
      'opsNote', v_note,
      'completedFromDebitId', v_out.id
    ),
    v_now
  ) RETURNING id INTO v_credit_id;

  INSERT INTO public.ghc_economy_events (user_id, event_type, payload, reference_id)
  VALUES (
    v_out.counterparty_id,
    'GHC_RECEIVED',
    jsonb_build_object(
      'amount', v_amount,
      'fromUserId', v_out.user_id,
      'opsComplete', true,
      'note', v_note
    ),
    p_reference_id
  );

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'reconciled', true,
    'referenceId', p_reference_id,
    'debitId', v_out.id,
    'creditId', v_credit_id,
    'amount', v_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_complete_orphan_transfer_in(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_complete_orphan_transfer_in(text, text) TO service_role;

COMMENT ON FUNCTION public.ghc_complete_orphan_transfer_in IS
  'Ops-only: insert missing transfer_in for an existing transfer_out. Never creates a second debit.';
