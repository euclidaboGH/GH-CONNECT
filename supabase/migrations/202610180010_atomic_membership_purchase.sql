-- Atomically spend GHC and persist the corresponding membership entitlement.
-- Requires the existing ghc_execute_spend and ghc_membership_upsert RPCs.
CREATE OR REPLACE FUNCTION public.ghc_purchase_membership(
  p_user_id text,
  p_amount numeric,
  p_reference_id text,
  p_reason text,
  p_row jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_spend jsonb;
  v_row jsonb;
  v_existing public.ghc_membership_entitlements%ROWTYPE;
  v_upsert jsonb;
  v_now timestamptz := now();
BEGIN
  IF p_user_id IS NULL OR btrim(p_user_id) = '' OR p_reference_id IS NULL OR btrim(p_reference_id) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_MEMBERSHIP_PURCHASE');
  END IF;
  IF p_row->>'user_id' IS DISTINCT FROM p_user_id
     OR p_row->>'purchase_ref' IS DISTINCT FROM p_reference_id
     OR p_row->>'tier' NOT IN ('vip', 'vvip')
     OR p_row->>'billing_period' NOT IN ('monthly', 'four_months', 'eight_months', 'yearly') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_MEMBERSHIP_ENTITLEMENT');
  END IF;

  -- A committed purchase replay returns the existing entitlement without spending again.
  SELECT * INTO v_existing
  FROM public.ghc_membership_entitlements
  WHERE user_id = p_user_id
  LIMIT 1;
  IF FOUND AND v_existing.purchase_ref = p_reference_id THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true,
      'spend', jsonb_build_object('ok', true, 'idempotent', true, 'referenceId', p_reference_id),
      'entitlement', to_jsonb(v_existing));
  END IF;

  -- Both nested RPC operations run in this transaction; an entitlement write failure
  -- rolls back the ledger debit too.
  v_spend := public.ghc_execute_spend(
    p_user_id, p_amount, p_reference_id, p_reason, 'PREMIUM_PURCHASE'
  );
  IF coalesce((v_spend->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN v_spend;
  END IF;
  IF coalesce((v_spend->>'idempotent')::boolean, false) IS TRUE THEN
    -- An old debit without its matching entitlement must be reconciled by support;
    -- never turn an orphaned debit into a second grant on retry.
    RETURN jsonb_build_object('ok', false, 'error', 'MEMBERSHIP_PURCHASE_RECONCILIATION_REQUIRED');
  END IF;

  v_row := p_row || jsonb_build_object(
    'updated_at', v_now,
    'audit', coalesce(v_existing.audit, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'at', floor(extract(epoch from v_now) * 1000),
      'action', 'GRANT',
      'detail', concat(p_row->>'tier', '/', p_row->>'billing_period', '/ghc')
    ))
  );
  v_upsert := public.ghc_membership_upsert(v_row);
  IF coalesce((v_upsert->>'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'MEMBERSHIP_ENTITLEMENT_WRITE_FAILED';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'spend', v_spend,
    'entitlement', v_row
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_purchase_membership(text, numeric, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_purchase_membership(text, numeric, text, text, jsonb) TO service_role;
