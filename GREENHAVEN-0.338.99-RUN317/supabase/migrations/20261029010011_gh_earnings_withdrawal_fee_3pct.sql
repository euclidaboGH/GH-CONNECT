-- Phase 6 cont: 3% withdrawal fee (bps). Net goes to user via linked Pi identity (app auth mapping).
-- Fee is platform retention; never paid to the withdrawing user as cashback.

ALTER TABLE public.gh_earnings_payout_policy
  ADD COLUMN IF NOT EXISTS fee_bps integer NOT NULL DEFAULT 300
    CHECK (fee_bps >= 0 AND fee_bps <= 10000);

-- Keep fee_atomic as optional flat fee (0); percentage is primary via fee_bps
UPDATE public.gh_earnings_payout_policy
SET fee_bps = 300, fee_atomic = 0, updated_at = now()
WHERE singleton_id = 1;

-- Quote a withdrawal: gross, fee (3%), net to user. Amounts are integer atomic.
CREATE OR REPLACE FUNCTION public.gh_earnings_quote_withdrawal(
  p_user_id text,
  p_gross_atomic numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user text := NULLIF(trim(COALESCE(p_user_id, '')), '');
  v_gross numeric(38,0);
  v_fee numeric(38,0);
  v_net numeric(38,0);
  v_policy public.gh_earnings_payout_policy%ROWTYPE;
  v_bal jsonb;
  v_available numeric(38,0);
  v_map public.gh_pi_identities%ROWTYPE;
  v_auth public.gh_pi_wallet_authorizations%ROWTYPE;
BEGIN
  IF v_user IS NULL OR p_gross_atomic IS NULL OR p_gross_atomic <= 0
     OR trunc(p_gross_atomic) <> p_gross_atomic THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  v_gross := trunc(p_gross_atomic);

  SELECT * INTO v_policy FROM public.gh_earnings_payout_policy WHERE singleton_id = 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PAYOUT_POLICY_MISSING');
  END IF;

  IF v_gross < v_policy.min_payout_atomic THEN
    RETURN jsonb_build_object('ok', false, 'error', 'BELOW_MIN_PAYOUT', 'minPayoutAtomic', v_policy.min_payout_atomic);
  END IF;
  IF v_gross > v_policy.max_single_payout_atomic THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ABOVE_MAX_SINGLE_PAYOUT', 'maxSinglePayoutAtomic', v_policy.max_single_payout_atomic);
  END IF;

  -- Fee = ceil(gross * bps / 10000) in atomic units, but never >= gross
  v_fee := trunc((v_gross * v_policy.fee_bps + 9999) / 10000); -- ceil division for bps
  IF v_policy.fee_atomic > 0 THEN
    v_fee := v_fee + v_policy.fee_atomic;
  END IF;
  IF v_fee >= v_gross THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FEE_EXCEEDS_GROSS');
  END IF;
  v_net := v_gross - v_fee;

  v_bal := public.gh_earnings_balances(v_user, 'PI');
  IF (v_bal->>'ok')::boolean IS NOT TRUE THEN
    RETURN v_bal;
  END IF;
  v_available := COALESCE((v_bal->>'availableAtomic')::numeric, 0);
  IF v_available < v_gross THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'INSUFFICIENT_AVAILABLE_EARNINGS',
      'availableAtomic', v_available,
      'requestedAtomic', v_gross
    );
  END IF;

  -- Linked Pi recipient from durable identity (auth mapping) — never client-supplied
  SELECT * INTO v_map FROM public.gh_pi_identities WHERE gh_user_id = v_user LIMIT 1;
  IF NOT FOUND OR v_map.pi_app_uid IS NULL OR length(trim(v_map.pi_app_uid)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'LINKED_PI_IDENTITY_REQUIRED');
  END IF;

  -- Prefer active wallet authorization when table exists
  IF to_regclass('public.gh_pi_wallet_authorizations') IS NOT NULL THEN
    SELECT * INTO v_auth FROM public.gh_pi_wallet_authorizations
      WHERE gh_user_id = v_user AND status = 'active' AND pi_app_uid = v_map.pi_app_uid
      LIMIT 1;
    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'WALLET_AUTHORIZATION_REQUIRED',
        'mappedPiAppUid', v_map.pi_app_uid
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'userId', v_user,
    'asset', 'PI',
    'atomicScale', 10000000,
    'feeBps', v_policy.fee_bps,
    'grossAtomic', v_gross,
    'feeAtomic', v_fee,
    'netAtomic', v_net,
    'gross', (v_gross / 10000000.0),
    'fee', (v_fee / 10000000.0),
    'net', (v_net / 10000000.0),
    'recipientPiAppUid', v_map.pi_app_uid,
    'recipientUsername', v_map.pi_username,
    'availableAtomic', v_available,
    'rounding', 'ceil_fee_bps_floor_net',
    'destination', 'linked_pi_wallet_a2u',
    'message', 'Net amount is sent to the Pi wallet linked at authentication; 3% fee is platform retention.'
  );
END;
$$;

-- Enrich withdrawable snapshot with fee_bps
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
  v_map public.gh_pi_identities%ROWTYPE;
  v_linked boolean := false;
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

  SELECT * INTO v_map FROM public.gh_pi_identities WHERE gh_user_id = v_user LIMIT 1;
  IF FOUND AND v_map.pi_app_uid IS NOT NULL AND length(trim(v_map.pi_app_uid)) > 0 THEN
    v_linked := true;
  ELSE
    v_eligible := false;
    v_reasons := array_append(v_reasons, 'LINKED_PI_IDENTITY_REQUIRED');
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
    'feeAtomicFlat', v_policy.fee_atomic,
    'feeBps', v_policy.fee_bps,
    'feePercent', (v_policy.fee_bps / 100.0),
    'eligible', v_eligible,
    'reasons', to_jsonb(v_reasons),
    'linkedPiAppUid', v_map.pi_app_uid,
    'linkedPiUsername', v_map.pi_username,
    'piWalletLinked', v_linked,
    'pending', (v_pending / 10000000.0),
    'available', (v_available / 10000000.0),
    'reserved', (v_reserved / 10000000.0),
    'paid', (v_paid / 10000000.0),
    'withdrawable', (v_withdrawable / 10000000.0),
    'minPayout', (v_policy.min_payout_atomic / 10000000.0),
    'maxSinglePayout', (v_policy.max_single_payout_atomic / 10000000.0),
    'rounding', 'floor_atomic',
    'withdrawalFee', '3% of gross (fee_bps=300); net sent to linked Pi wallet',
    'authority', 'gh_earnings_ledger_entries'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_earnings_quote_withdrawal(text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_earnings_quote_withdrawal(text, numeric) TO service_role;
REVOKE ALL ON FUNCTION public.gh_earnings_withdrawable(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_earnings_withdrawable(text) TO service_role;

COMMENT ON FUNCTION public.gh_earnings_quote_withdrawal(text, numeric) IS
  'Phase 6: quote gross/fee(3%)/net for PI withdrawal. Recipient is durable linked Pi identity only.';
