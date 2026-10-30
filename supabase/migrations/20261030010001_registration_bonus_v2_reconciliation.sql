-- Phase 2: registration bonus v2 policy and idempotent reconciliation.
-- No bulk credit is performed by this schema migration. Claim RPC is service_role-only.
-- PI atomic scale is 1e7: 3 PI = 30,000,000; top-up 2.95 PI = 29,500,000.

CREATE OR REPLACE FUNCTION public.gh_earnings_registration_bonus_status(
  p_user_id text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user text := NULLIF(trim(COALESCE(p_user_id, '')), '');
  v_legacy boolean := false;
  v_legacy_exists boolean := false;
  v_full boolean := false;
  v_topup boolean := false;
  v_amount numeric(38,0);
  v_ref text;
BEGIN
  IF v_user IS NULL OR length(v_user) > 160 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  SELECT EXISTS (SELECT 1 FROM public.gh_earnings_ledger_entries WHERE user_id = v_user AND unique_ref = 'registration_bonus:v1:' || v_user) INTO v_legacy_exists;
  SELECT EXISTS (SELECT 1 FROM public.gh_earnings_ledger_entries
    WHERE user_id = v_user AND unique_ref = 'registration_bonus:v1:' || v_user
      AND asset = 'PI' AND amount_atomic = 500000 AND source_kind = 'system'
      AND source_table = 'registration_bonus' AND status IN ('available', 'reserved', 'paid')) INTO v_legacy;
  SELECT EXISTS (SELECT 1 FROM public.gh_earnings_ledger_entries WHERE user_id = v_user AND unique_ref = 'registration_bonus:v2:' || v_user) INTO v_full;
  SELECT EXISTS (SELECT 1 FROM public.gh_earnings_ledger_entries WHERE user_id = v_user AND unique_ref = 'registration_bonus:v2_topup:' || v_user) INTO v_topup;

  IF v_full THEN
    RETURN jsonb_build_object('ok', true, 'legacyClaimed', v_legacy OR v_topup, 'claimed', true, 'claimable', false,
      'amountAtomic', 30000000,
      'amountPi', 3,
      'uniqueRef', 'registration_bonus:v2:' || v_user,
      'message', 'Registration bonus already credited.');
  END IF;
  IF v_legacy_exists AND NOT v_legacy AND NOT v_topup THEN
    RETURN jsonb_build_object('ok', false, 'error', 'LEGACY_BONUS_REVIEW_REQUIRED',
      'message', 'A historical registration-bonus entry exists but does not match the verified 0.05 PI policy; operator review is required.');
  END IF;
  IF v_legacy OR v_topup THEN
    v_amount := 29500000;
    v_ref := 'registration_bonus:v2_topup:' || v_user;
    RETURN jsonb_build_object('ok', true, 'legacyClaimed', true, 'claimed', v_topup, 'claimable', NOT v_topup,
      'amountAtomic', v_amount, 'amountPi', 2.95, 'uniqueRef', v_ref,
      'message', CASE WHEN v_topup THEN 'Registration bonus reconciliation already credited.' ELSE 'Reconcile the remaining 2.95 PI registration bonus.' END);
  END IF;

  v_amount := 30000000;
  v_ref := 'registration_bonus:v2:' || v_user;
  RETURN jsonb_build_object('ok', true, 'legacyClaimed', false, 'claimed', v_full, 'claimable', NOT v_full,
    'amountAtomic', v_amount, 'amountPi', 3, 'uniqueRef', v_ref,
    'message', CASE WHEN v_full THEN 'Registration bonus already credited.' ELSE 'Claim your one-time 3 PI registration bonus.' END);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_earnings_registration_bonus_claim(
  p_user_id text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user text := NULLIF(trim(COALESCE(p_user_id, '')), '');
  v_legacy boolean := false;
  v_legacy_exists boolean := false;
  v_full boolean := false;
  v_topup boolean := false;
  v_amount numeric(38,0);
  v_ref text;
  v_credit jsonb;
  v_duplicate boolean;
BEGIN
  IF v_user IS NULL OR length(v_user) > 160 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  -- Serialize same-user claims so simultaneous requests cannot choose different policy paths.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user, 0));

  SELECT EXISTS (SELECT 1 FROM public.gh_earnings_ledger_entries WHERE user_id = v_user AND unique_ref = 'registration_bonus:v1:' || v_user) INTO v_legacy_exists;
  SELECT EXISTS (SELECT 1 FROM public.gh_earnings_ledger_entries
    WHERE user_id = v_user AND unique_ref = 'registration_bonus:v1:' || v_user
      AND asset = 'PI' AND amount_atomic = 500000 AND source_kind = 'system'
      AND source_table = 'registration_bonus' AND status IN ('available', 'reserved', 'paid')) INTO v_legacy;
  SELECT EXISTS (SELECT 1 FROM public.gh_earnings_ledger_entries WHERE user_id = v_user AND unique_ref = 'registration_bonus:v2:' || v_user) INTO v_full;
  SELECT EXISTS (SELECT 1 FROM public.gh_earnings_ledger_entries WHERE user_id = v_user AND unique_ref = 'registration_bonus:v2_topup:' || v_user) INTO v_topup;
  IF v_full OR v_topup THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'legacyClaimed', v_legacy OR v_topup, 'claimed', true, 'claimable', false,
      'amountAtomic', CASE WHEN v_topup AND NOT v_full THEN 29500000 ELSE 30000000 END,
      'amountPi', CASE WHEN v_topup AND NOT v_full THEN 2.95 ELSE 3 END,
      'uniqueRef', CASE WHEN v_topup AND NOT v_full THEN 'registration_bonus:v2_topup:' || v_user ELSE 'registration_bonus:v2:' || v_user END,
      'message', 'Registration bonus already credited.');
  END IF;
  IF v_legacy_exists AND NOT v_legacy THEN
    RETURN jsonb_build_object('ok', false, 'error', 'LEGACY_BONUS_REVIEW_REQUIRED',
      'message', 'A historical registration-bonus entry exists but does not match the verified 0.05 PI policy; operator review is required.');
  END IF;
  IF v_legacy OR v_topup THEN
    v_amount := 29500000;
    v_ref := 'registration_bonus:v2_topup:' || v_user;
  ELSE
    v_amount := 30000000;
    v_ref := 'registration_bonus:v2:' || v_user;
  END IF;

  v_credit := public.gh_earnings_post_credit(
    v_user, v_amount, 'system', v_ref, 'available', 'registration_bonus',
    CASE WHEN v_legacy THEN 'v2_topup' ELSE 'v2' END,
    CASE WHEN v_legacy THEN 'registration_bonus_policy_reconciliation' ELSE 'one_time_registration_bonus' END,
    jsonb_build_object('policyVersion', 'v2', 'amountPi', v_amount / 10000000.0,
      'legacyV1ClaimFound', v_legacy)
  );

  IF COALESCE((v_credit->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'error', COALESCE(v_credit->>'error', 'CREDIT_FAILED'));
  END IF;
  v_duplicate := COALESCE((v_credit->>'duplicate')::boolean, false);
  RETURN jsonb_build_object('ok', true, 'duplicate', v_duplicate, 'entryId', v_credit->>'entryId',
    'legacyClaimed', v_legacy, 'claimed', true, 'claimable', false,
    'amountAtomic', v_amount, 'amountPi', v_amount / 10000000.0, 'uniqueRef', v_ref,
    'message', CASE WHEN v_duplicate THEN 'Registration bonus already reconciled.'
      WHEN v_legacy THEN 'Remaining 2.95 PI registration bonus reconciled.'
      ELSE '3 PI registration bonus credited.' END);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_earnings_registration_bonus_status(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_earnings_registration_bonus_claim(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_earnings_registration_bonus_status(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_earnings_registration_bonus_claim(text) TO service_role;

COMMENT ON FUNCTION public.gh_earnings_registration_bonus_status(text) IS
  'Phase 2: direct legacy/current registration-bonus status lookup, independent of statement pagination.';
COMMENT ON FUNCTION public.gh_earnings_registration_bonus_claim(text) IS
  'Phase 2: service-role-only, serialized, idempotent v2 bonus claim or v1 claimant top-up.';
