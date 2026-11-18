-- Phase 3 hardening: immutable ledger events, payload-bound idempotency and
-- serialized financial mutations. Additive replacement of RPC implementations.
-- No payout execution flags are changed and no historical rows are rewritten.

CREATE OR REPLACE FUNCTION public.gh_earnings_ledger_reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'GH_EARNINGS_LEDGER_APPEND_ONLY' USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS gh_earnings_ledger_append_only ON public.gh_earnings_ledger_entries;
CREATE TRIGGER gh_earnings_ledger_append_only
BEFORE UPDATE OR DELETE ON public.gh_earnings_ledger_entries
FOR EACH ROW EXECUTE FUNCTION public.gh_earnings_ledger_reject_mutation();

-- Credit retries are idempotent only when the business payload matches exactly.
CREATE OR REPLACE FUNCTION public.gh_earnings_post_credit(
  p_user_id text,
  p_amount_atomic numeric,
  p_source_kind text,
  p_unique_ref text,
  p_status text DEFAULT 'available',
  p_source_table text DEFAULT NULL,
  p_source_id text DEFAULT NULL,
  p_reason text DEFAULT '',
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user text := NULLIF(trim(COALESCE(p_user_id, '')), '');
  v_ref text := NULLIF(trim(COALESCE(p_unique_ref, '')), '');
  v_kind text := NULLIF(trim(COALESCE(p_source_kind, '')), '');
  v_status text := COALESCE(NULLIF(trim(COALESCE(p_status, '')), ''), 'available');
  v_table text := NULLIF(trim(COALESCE(p_source_table, '')), '');
  v_source_id text := NULLIF(trim(COALESCE(p_source_id, '')), '');
  v_existing public.gh_earnings_ledger_entries%ROWTYPE;
  v_row public.gh_earnings_ledger_entries%ROWTYPE;
BEGIN
  IF v_user IS NULL OR length(v_user) > 160 OR v_ref IS NULL OR length(v_ref) > 200
     OR v_kind IS NULL OR p_amount_atomic IS NULL OR p_amount_atomic <= 0
     OR trunc(p_amount_atomic) <> p_amount_atomic THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  IF v_status NOT IN ('pending', 'available') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CREDIT_STATUS');
  END IF;
  IF v_kind NOT IN ('cashback', 'activity_reward', 'creator_earning', 'charity', 'adjustment', 'system') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_SOURCE_KIND');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('gh_earnings:' || v_user, 0));

  SELECT * INTO v_existing FROM public.gh_earnings_ledger_entries
   WHERE user_id = v_user AND unique_ref = v_ref;
  IF FOUND THEN
    IF v_existing.entry_type <> 'credit'
       OR v_existing.amount_atomic <> p_amount_atomic
       OR v_existing.source_kind <> v_kind
       OR v_existing.status <> v_status
       OR v_existing.source_table IS DISTINCT FROM v_table
       OR v_existing.source_id IS DISTINCT FROM v_source_id THEN
      RETURN jsonb_build_object('ok', false, 'error', 'IDEMPOTENCY_PAYLOAD_CONFLICT');
    END IF;
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'entryId', v_existing.id,
      'status', v_existing.status, 'amountAtomic', v_existing.amount_atomic);
  END IF;

  INSERT INTO public.gh_earnings_ledger_entries (
    user_id, asset, entry_type, source_kind, amount_atomic, status, unique_ref,
    source_table, source_id, reason, metadata
  ) VALUES (
    v_user, 'PI', 'credit', v_kind, p_amount_atomic, v_status, v_ref,
    v_table, v_source_id, left(COALESCE(p_reason, ''), 240), COALESCE(p_metadata, '{}'::jsonb)
  ) RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'entryId', v_row.id,
    'status', v_row.status, 'amountAtomic', v_row.amount_atomic);
END;
$$;

-- Serialize payout reservation and bind an idempotency key to amount + request id.
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
  v_amount numeric(38,0);
  v_available numeric(38,0);
  v_bal jsonb;
  v_policy public.gh_earnings_payout_policy%ROWTYPE;
  v_existing public.gh_earnings_ledger_entries%ROWTYPE;
  v_row public.gh_earnings_ledger_entries%ROWTYPE;
BEGIN
  IF v_user IS NULL OR length(v_user) > 160 OR v_ref IS NULL OR length(v_ref) > 200
     OR v_pay IS NULL OR length(v_pay) > 200 OR p_amount_atomic IS NULL OR p_amount_atomic <= 0
     OR trunc(p_amount_atomic) <> p_amount_atomic THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  v_amount := trunc(p_amount_atomic);
  PERFORM pg_advisory_xact_lock(hashtextextended('gh_earnings:' || v_user, 0));

  SELECT * INTO v_existing FROM public.gh_earnings_ledger_entries
   WHERE user_id = v_user AND unique_ref = v_ref;
  IF FOUND THEN
    IF v_existing.entry_type <> 'reserve' OR v_existing.amount_atomic <> v_amount
       OR v_existing.payout_request_id IS DISTINCT FROM v_pay
       OR v_existing.status <> 'reserved' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'IDEMPOTENCY_PAYLOAD_CONFLICT');
    END IF;
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'entryId', v_existing.id,
      'status', v_existing.status, 'amountAtomic', v_existing.amount_atomic, 'payoutRequestId', v_pay);
  END IF;

  SELECT * INTO v_policy FROM public.gh_earnings_payout_policy WHERE singleton_id = 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'PAYOUT_POLICY_MISSING'); END IF;
  IF v_amount < v_policy.min_payout_atomic THEN
    RETURN jsonb_build_object('ok', false, 'error', 'BELOW_MIN_PAYOUT', 'minPayoutAtomic', v_policy.min_payout_atomic);
  END IF;
  IF v_amount > v_policy.max_single_payout_atomic THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ABOVE_MAX_SINGLE_PAYOUT', 'maxSinglePayoutAtomic', v_policy.max_single_payout_atomic);
  END IF;
  v_bal := public.gh_earnings_balances(v_user, 'PI');
  IF COALESCE((v_bal->>'ok')::boolean, false) IS NOT TRUE THEN RETURN v_bal; END IF;
  v_available := COALESCE((v_bal->>'availableAtomic')::numeric, 0);
  IF v_available < v_amount THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_AVAILABLE_EARNINGS',
      'availableAtomic', v_available, 'requestedAtomic', v_amount);
  END IF;

  INSERT INTO public.gh_earnings_ledger_entries (
    user_id, asset, entry_type, source_kind, amount_atomic, status, unique_ref,
    payout_request_id, reason
  ) VALUES (v_user, 'PI', 'reserve', COALESCE(NULLIF(trim(p_source_kind), ''), 'withdrawal'),
    v_amount, 'reserved', v_ref, v_pay, left(COALESCE(p_reason, ''), 240))
  RETURNING * INTO v_row;
  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'entryId', v_row.id,
    'status', 'reserved', 'amountAtomic', v_row.amount_atomic, 'payoutRequestId', v_pay);
END;
$$;

-- Settlement retries must match the exact original payout reservation and amount.
CREATE OR REPLACE FUNCTION public.gh_earnings_settle(
  p_user_id text,
  p_amount_atomic numeric,
  p_unique_ref text,
  p_payout_request_id text,
  p_reason text DEFAULT 'payout_settled'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user text := NULLIF(trim(COALESCE(p_user_id, '')), '');
  v_ref text := NULLIF(trim(COALESCE(p_unique_ref, '')), '');
  v_pay text := NULLIF(trim(COALESCE(p_payout_request_id, '')), '');
  v_reserved numeric(38,0);
  v_existing public.gh_earnings_ledger_entries%ROWTYPE;
  v_row public.gh_earnings_ledger_entries%ROWTYPE;
BEGIN
  IF v_user IS NULL OR length(v_user) > 160 OR v_ref IS NULL OR length(v_ref) > 200
     OR v_pay IS NULL OR length(v_pay) > 200 OR p_amount_atomic IS NULL OR p_amount_atomic <= 0
     OR trunc(p_amount_atomic) <> p_amount_atomic THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('gh_earnings:' || v_user, 0));

  SELECT * INTO v_existing FROM public.gh_earnings_ledger_entries
   WHERE user_id = v_user AND unique_ref = v_ref;
  IF FOUND THEN
    IF v_existing.entry_type <> 'settle' OR v_existing.amount_atomic <> p_amount_atomic
       OR v_existing.payout_request_id IS DISTINCT FROM v_pay OR v_existing.status <> 'paid' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'IDEMPOTENCY_PAYLOAD_CONFLICT');
    END IF;
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'entryId', v_existing.id,
      'status', v_existing.status, 'amountAtomic', v_existing.amount_atomic);
  END IF;

  SELECT COALESCE(SUM(CASE
    WHEN entry_type = 'reserve' AND status = 'reserved' AND payout_request_id = v_pay THEN amount_atomic
    WHEN entry_type = 'settle' AND status = 'paid' AND payout_request_id = v_pay THEN -amount_atomic
    WHEN entry_type = 'release_reserve' AND status = 'available' AND payout_request_id = v_pay THEN -amount_atomic
    ELSE 0 END), 0)
  INTO v_reserved FROM public.gh_earnings_ledger_entries
  WHERE user_id = v_user AND asset = 'PI';
  IF v_reserved < p_amount_atomic THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_RESERVED_FOR_PAYOUT', 'reservedAtomic', v_reserved);
  END IF;

  INSERT INTO public.gh_earnings_ledger_entries (
    user_id, asset, entry_type, source_kind, amount_atomic, status, unique_ref,
    payout_request_id, reason
  ) VALUES (v_user, 'PI', 'settle', 'withdrawal', p_amount_atomic, 'paid', v_ref, v_pay,
    left(COALESCE(p_reason, ''), 240)) RETURNING * INTO v_row;
  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'entryId', v_row.id,
    'status', 'paid', 'amountAtomic', v_row.amount_atomic);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_earnings_ledger_reject_mutation() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.gh_earnings_post_credit(text, numeric, text, text, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_earnings_reserve(text, numeric, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_earnings_settle(text, numeric, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_earnings_post_credit(text, numeric, text, text, text, text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_earnings_reserve(text, numeric, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_earnings_settle(text, numeric, text, text, text) TO service_role;

COMMENT ON FUNCTION public.gh_earnings_ledger_reject_mutation() IS
  'Rejects UPDATE/DELETE on the append-only PI earnings ledger; corrections use compensating entries.';
COMMENT ON FUNCTION public.gh_earnings_post_credit(text, numeric, text, text, text, text, text, text, jsonb) IS
  'Posts a positive integer-atomic PI credit with per-user serialization and payload-bound idempotency.';
COMMENT ON FUNCTION public.gh_earnings_reserve(text, numeric, text, text, text, text) IS
  'Atomically reserves available PI earnings; retries must match exact amount and payout request.';
COMMENT ON FUNCTION public.gh_earnings_settle(text, numeric, text, text, text) IS
  'Settles only a matching reserved PI payout amount; per-user serialized and payload-bound idempotency.';

-- Release retries must match the exact reservation and may never over-release.
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
  v_reserved numeric(38,0);
  v_existing public.gh_earnings_ledger_entries%ROWTYPE;
  v_row public.gh_earnings_ledger_entries%ROWTYPE;
BEGIN
  IF v_user IS NULL OR length(v_user) > 160 OR v_ref IS NULL OR length(v_ref) > 200
     OR v_pay IS NULL OR length(v_pay) > 200 OR p_amount_atomic IS NULL OR p_amount_atomic <= 0
     OR trunc(p_amount_atomic) <> p_amount_atomic THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('gh_earnings:' || v_user, 0));

  SELECT * INTO v_existing FROM public.gh_earnings_ledger_entries
   WHERE user_id = v_user AND unique_ref = v_ref;
  IF FOUND THEN
    IF v_existing.entry_type <> 'release_reserve' OR v_existing.amount_atomic <> p_amount_atomic
       OR v_existing.payout_request_id IS DISTINCT FROM v_pay OR v_existing.status <> 'available' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'IDEMPOTENCY_PAYLOAD_CONFLICT');
    END IF;
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'entryId', v_existing.id,
      'status', v_existing.status, 'amountAtomic', v_existing.amount_atomic);
  END IF;

  SELECT COALESCE(SUM(CASE
    WHEN entry_type = 'reserve' AND status = 'reserved' AND payout_request_id = v_pay THEN amount_atomic
    WHEN entry_type = 'settle' AND status = 'paid' AND payout_request_id = v_pay THEN -amount_atomic
    WHEN entry_type = 'release_reserve' AND status = 'available' AND payout_request_id = v_pay THEN -amount_atomic
    ELSE 0 END), 0)
  INTO v_reserved FROM public.gh_earnings_ledger_entries
  WHERE user_id = v_user AND asset = 'PI';
  IF v_reserved < p_amount_atomic THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_RESERVED_TO_RELEASE', 'reservedAtomic', v_reserved);
  END IF;

  INSERT INTO public.gh_earnings_ledger_entries (
    user_id, asset, entry_type, source_kind, amount_atomic, status, unique_ref,
    payout_request_id, reason
  ) VALUES (v_user, 'PI', 'release_reserve', 'withdrawal', p_amount_atomic, 'available', v_ref, v_pay,
    left(COALESCE(p_reason, ''), 240)) RETURNING * INTO v_row;
  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'entryId', v_row.id,
    'status', 'available', 'amountAtomic', v_row.amount_atomic);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_earnings_release_reserve(text, numeric, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_earnings_release_reserve(text, numeric, text, text, text) TO service_role;
COMMENT ON FUNCTION public.gh_earnings_release_reserve(text, numeric, text, text, text) IS
  'Releases only the exact remaining PI payout reservation; retries are payload-bound and serialized.';
