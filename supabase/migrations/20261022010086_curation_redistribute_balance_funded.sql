-- Stage 4 foundation: curation creator rewards as redistribution of upvoter GHC.
-- Debit upvoter + credit author for the same amount. No net mint.
-- Application must still gate enablement (GHC_CURATION_REDISTRIBUTE_ENABLED).

CREATE OR REPLACE FUNCTION public.ghc_curation_redistribute(
  p_voter_id text,
  p_author_id text,
  p_post_id text,
  p_amount numeric,
  p_reference_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available numeric;
  v_ref text;
  v_debit_id uuid;
  v_credit_id uuid;
  v_now timestamptz := now();
  v_amount numeric;
BEGIN
  IF p_voter_id IS NULL OR btrim(p_voter_id) = ''
     OR p_author_id IS NULL OR btrim(p_author_id) = ''
     OR p_post_id IS NULL OR btrim(p_post_id) = ''
     OR p_reference_id IS NULL OR btrim(p_reference_id) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  IF p_voter_id = p_author_id THEN
    RETURN jsonb_build_object('ok', true, 'credited', false, 'reason', 'SELF_VOTE');
  END IF;

  v_amount := round(COALESCE(p_amount, 0), 4);
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'credited', false, 'reason', 'ZERO_AMOUNT');
  END IF;
  -- Cap per redistribution call (abuse bound); higher policy can lower further in app
  IF v_amount > 1 THEN
    v_amount := 1;
  END IF;

  v_ref := p_reference_id;

  -- Idempotent replay
  IF EXISTS (
    SELECT 1 FROM public.ghc_transactions
    WHERE reference_id = v_ref AND kind = 'transfer_out' AND status = 'posted'
      AND source_event = 'CURATION_REDISTRIBUTE_V1'
  ) THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'referenceId', v_ref);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ghc_balance:' || p_voter_id));
  PERFORM pg_advisory_xact_lock(hashtext('ghc_curation_redist:' || p_post_id || ':' || p_voter_id));

  v_available := public.ghc_available_balance(p_voter_id);
  IF v_available < v_amount THEN
    RETURN jsonb_build_object('ok', true, 'credited', false, 'reason', 'INSUFFICIENT_SPENDABLE');
  END IF;

  INSERT INTO public.ghc_transactions (
    user_id, kind, amount, status, reason, source_event, reference_id, counterparty_id, metadata, posted_at
  ) VALUES (
    p_voter_id, 'transfer_out', -v_amount, 'posted',
    'Curation contribution', 'CURATION_REDISTRIBUTE_V1', v_ref, p_author_id,
    jsonb_build_object('postId', p_post_id, 'redistribute', true), v_now
  ) RETURNING id INTO v_debit_id;

  INSERT INTO public.ghc_transactions (
    user_id, kind, amount, status, reason, source_event, reference_id, counterparty_id, metadata, posted_at
  ) VALUES (
    p_author_id, 'transfer_in', v_amount, 'posted',
    'Curation reward', 'CURATION_REDISTRIBUTE_V1', v_ref, p_voter_id,
    jsonb_build_object('postId', p_post_id, 'redistribute', true), v_now
  ) RETURNING id INTO v_credit_id;

  RETURN jsonb_build_object(
    'ok', true,
    'credited', true,
    'amount', v_amount,
    'referenceId', v_ref,
    'debitId', v_debit_id,
    'creditId', v_credit_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_curation_redistribute(text, text, text, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_curation_redistribute(text, text, text, numeric, text) TO service_role;
