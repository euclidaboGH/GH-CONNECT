-- Pi-verified GHC pack purchase credit (idempotent by reference_id).
-- Not general minting: only PI_PACK_PURCHASE source with unique reference.

CREATE OR REPLACE FUNCTION public.ghc_credit_pack_purchase(
  p_user_id text,
  p_amount numeric,
  p_reference_id text,
  p_reason text DEFAULT 'Pi pack purchase',
  p_product_id text DEFAULT NULL,
  p_intent_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.ghc_transactions%ROWTYPE;
  v_tx_id uuid;
  v_amount numeric := abs(coalesce(p_amount, 0));
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  END IF;
  IF v_amount IS NULL OR v_amount <= 0 OR v_amount > 100000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;
  IF p_reference_id IS NULL OR length(trim(p_reference_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REFERENCE_REQUIRED');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ghc_pack:' || trim(p_user_id) || ':' || trim(p_reference_id)));

  SELECT * INTO v_existing
  FROM public.ghc_transactions
  WHERE user_id = trim(p_user_id)
    AND reference_id = trim(p_reference_id)
    AND status = 'posted'
    AND amount > 0
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'alreadyCredited', true,
      'idempotent', true,
      'transactionId', v_existing.id::text,
      'amount', v_existing.amount
    );
  END IF;

  INSERT INTO public.ghc_transactions (
    user_id, kind, amount, status, reason, source_event, reference_id, metadata
  ) VALUES (
    trim(p_user_id),
    'earned',
    v_amount,
    'posted',
    coalesce(nullif(trim(p_reason), ''), 'Pi pack purchase'),
    'PI_PACK_PURCHASE',
    trim(p_reference_id),
    jsonb_build_object(
      'productId', p_product_id,
      'intentId', p_intent_id,
      'settlement', 'pi_verified_pack'
    )
  )
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'ok', true,
    'alreadyCredited', false,
    'transactionId', v_tx_id::text,
    'amount', v_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_credit_pack_purchase(text, numeric, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_credit_pack_purchase(text, numeric, text, text, text, text) TO service_role;

COMMENT ON FUNCTION public.ghc_credit_pack_purchase(text, numeric, text, text, text, text) IS
  'Idempotent credit for Pi-verified GHC packs. Not general issuance.';
