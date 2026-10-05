-- =============================================================================
-- 20261009_ghc_balance_lock_and_spendable.sql
-- Shared per-user balance serialization + withdrawal-aware spendable check.
-- Forward-only. Does not rewrite ledger history.
--
-- Problem:
--   ghc_execute_transfer locked ghc_send:{user}
--   ghc_execute_spend locked ghc_spend:{user}
--   ghc_withdrawal_create locked ghc_withdraw:{user}
--   Spend used ghc_available_balance without subtracting pending withdrawal locks.
-- Cross-domain races could authorize the same GHC twice.
--
-- Fix:
--   1) Shared advisory lock namespace: ghc_balance:{userId}
--   2) ghc_spendable_balance = posted ledger - pending withdrawal locks
--   3) Transfer, spend, withdrawal create all acquire ghc_balance lock
--   4) Spend and transfer debit checks use spendable (transfer: ledger available
--      is still correct for dual-entry; spend subtracts withdrawal locks)
-- =============================================================================

-- Spendable = posted ledger balance minus GHC reserved by open withdrawals
CREATE OR REPLACE FUNCTION public.ghc_spendable_balance(p_user_id text)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT GREATEST(
    0,
    COALESCE(public.ghc_available_balance(p_user_id), 0)
      - COALESCE(public.ghc_withdrawal_locked_ghc(p_user_id), 0)
  );
$$;

REVOKE ALL ON FUNCTION public.ghc_spendable_balance(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_spendable_balance(text) TO service_role;

COMMENT ON FUNCTION public.ghc_spendable_balance(text) IS
  'Posted ledger balance minus pending withdrawal reservations; used by spend/transfer authorization.';

-- ---------------------------------------------------------------------------
-- Spend: shared balance lock + withdrawal-aware available check
-- Signature preserved from 202609080001
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ghc_execute_spend(
  p_user_id text,
  p_amount numeric,
  p_reference_id text,
  p_reason text DEFAULT NULL,
  p_source_event text DEFAULT NULL
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
  IF v_amount <> round(v_amount, 4) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT_PRECISION');
  END IF;

  -- Shared balance serialization (transfer / spend / withdrawal)
  PERFORM pg_advisory_xact_lock(hashtext('ghc_balance:' || p_user_id));

  SELECT * INTO v_existing
  FROM public.ghc_transactions
  WHERE user_id = p_user_id
    AND reference_id = p_reference_id
    AND kind IN ('spent', 'purchased')
    AND status = 'posted'
  LIMIT 1;

  IF FOUND THEN
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

  -- Must not spend GHC reserved for pending withdrawals
  v_avail := public.ghc_spendable_balance(p_user_id);
  IF v_avail < v_amount THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_BALANCE', 'available', v_avail);
  END IF;

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
    'amount', v_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_execute_spend(text, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_execute_spend(text, numeric, text, text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- Transfer: shared balance lock on sender (single-user debit serialization)
-- Signature preserved from 20260821
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ghc_execute_transfer(
  p_sender_id     text,
  p_to_user_id    text,
  p_amount        numeric,
  p_reference_id  text,
  p_note          text DEFAULT NULL,
  p_request_id    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limits      public.ghc_economy_limits%ROWTYPE;
  v_available   numeric;
  v_sent_today  numeric;
  v_recv_today  numeric;
  v_existing_out public.ghc_transactions%ROWTYPE;
  v_existing_in  public.ghc_transactions%ROWTYPE;
  v_debit_id    uuid;
  v_credit_id   uuid;
  v_now         timestamptz := now();
BEGIN
  IF p_sender_id IS NULL OR length(trim(p_sender_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'AUTH_REQUIRED', 'message', 'Authentication required');
  END IF;
  IF p_to_user_id IS NULL OR length(trim(p_to_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_RECIPIENT', 'message', 'Recipient required');
  END IF;
  IF p_sender_id = p_to_user_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SELF_TRANSFER', 'message', 'Cannot send to yourself');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_AMOUNT', 'message', 'Invalid amount');
  END IF;
  IF p_reference_id IS NULL OR length(trim(p_reference_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_FAILED', 'message', 'referenceId required');
  END IF;

  SELECT * INTO v_limits FROM public.ghc_economy_limits WHERE id = 1 FOR SHARE;
  IF p_amount < v_limits.min_transfer OR p_amount > v_limits.max_transfer THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_LIMIT_EXCEEDED', 'message', 'Amount outside transfer limits');
  END IF;

  -- Shared balance lock (same namespace as spend/withdrawal)
  PERFORM pg_advisory_xact_lock(hashtext('ghc_balance:' || p_sender_id));

  IF EXISTS (
    SELECT 1 FROM public.ghc_account_flags
    WHERE user_id = p_sender_id AND (restricted OR suspended)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_RESTRICTED', 'message', 'Account restricted');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ghc_user_blocks
    WHERE (blocker_id = p_sender_id AND blocked_id = p_to_user_id)
       OR (blocker_id = p_to_user_id AND blocked_id = p_sender_id)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'BLOCKED_USER', 'message', 'Transfers not allowed');
  END IF;

  SELECT * INTO v_existing_out FROM public.ghc_transactions
   WHERE user_id = p_sender_id AND reference_id = p_reference_id
     AND kind = 'transfer_out' AND status = 'posted'
   LIMIT 1;
  IF FOUND THEN
    SELECT * INTO v_existing_in FROM public.ghc_transactions
     WHERE user_id = p_to_user_id AND reference_id = p_reference_id
       AND kind = 'transfer_in' AND status = 'posted'
     LIMIT 1;
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'referenceId', p_reference_id,
      'debitTx', jsonb_build_object(
        'id', v_existing_out.id, 'userId', v_existing_out.user_id, 'kind', v_existing_out.kind,
        'amount', v_existing_out.amount, 'status', v_existing_out.status,
        'referenceId', v_existing_out.reference_id, 'reason', v_existing_out.reason,
        'createdAt', extract(epoch from v_existing_out.created_at) * 1000
      ),
      'creditTx', CASE WHEN v_existing_in.id IS NOT NULL THEN jsonb_build_object(
        'id', v_existing_in.id, 'userId', v_existing_in.user_id, 'kind', v_existing_in.kind,
        'amount', v_existing_in.amount, 'status', v_existing_in.status,
        'referenceId', v_existing_in.reference_id, 'reason', v_existing_in.reason,
        'createdAt', extract(epoch from v_existing_in.created_at) * 1000
      ) ELSE NULL END
    );
  END IF;

  -- Spendable: do not transfer GHC reserved for pending withdrawals
  v_available := public.ghc_spendable_balance(p_sender_id);
  IF v_available < p_amount THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INSUFFICIENT_BALANCE', 'message', 'Insufficient available GHC');
  END IF;

  SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_sent_today
  FROM public.ghc_transactions
  WHERE user_id = p_sender_id AND kind = 'transfer_out' AND status = 'posted'
    AND created_at >= date_trunc('day', v_now AT TIME ZONE 'UTC');

  IF v_sent_today + p_amount > v_limits.daily_send_limit THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_LIMIT_EXCEEDED', 'message', 'Daily send limit reached');
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_recv_today
  FROM public.ghc_transactions
  WHERE user_id = p_to_user_id AND kind = 'transfer_in' AND status = 'posted'
    AND created_at >= date_trunc('day', v_now AT TIME ZONE 'UTC');

  IF v_recv_today + p_amount > v_limits.daily_receive_limit THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_LIMIT_EXCEEDED', 'message', 'Recipient daily receive limit reached');
  END IF;

  INSERT INTO public.ghc_transactions (
    user_id, kind, amount, status, reason, source_event, reference_id, request_id, counterparty_id, metadata, posted_at
  ) VALUES (
    p_sender_id, 'transfer_out', -p_amount, 'posted',
    COALESCE(NULLIF(trim(p_note), ''), 'Sent GHC'),
    'WALLET_TRANSFER', p_reference_id, p_request_id, p_to_user_id,
    jsonb_build_object('direction','send','transferStatus','completed','note', p_note),
    v_now
  ) RETURNING id INTO v_debit_id;

  INSERT INTO public.ghc_transactions (
    user_id, kind, amount, status, reason, source_event, reference_id, request_id, counterparty_id, metadata, posted_at
  ) VALUES (
    p_to_user_id, 'transfer_in', p_amount, 'posted',
    COALESCE(NULLIF(trim(p_note), ''), 'Received GHC'),
    'WALLET_TRANSFER', p_reference_id, p_request_id, p_sender_id,
    jsonb_build_object('direction','receive','transferStatus','completed','note', p_note),
    v_now
  ) RETURNING id INTO v_credit_id;

  INSERT INTO public.ghc_economy_events (user_id, event_type, payload, reference_id)
  VALUES
    (p_sender_id, 'GHC_SENT', jsonb_build_object('amount', p_amount, 'toUserId', p_to_user_id), p_reference_id),
    (p_to_user_id, 'GHC_RECEIVED', jsonb_build_object('amount', p_amount, 'fromUserId', p_sender_id), p_reference_id);

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'referenceId', p_reference_id,
    'debitTx', jsonb_build_object(
      'id', v_debit_id, 'userId', p_sender_id, 'kind', 'transfer_out',
      'amount', -p_amount, 'status', 'posted',
      'referenceId', p_reference_id, 'reason', COALESCE(NULLIF(trim(p_note), ''), 'Sent GHC'),
      'createdAt', extract(epoch from v_now) * 1000
    ),
    'creditTx', jsonb_build_object(
      'id', v_credit_id, 'userId', p_to_user_id, 'kind', 'transfer_in',
      'amount', p_amount, 'status', 'posted',
      'referenceId', p_reference_id, 'reason', COALESCE(NULLIF(trim(p_note), ''), 'Received GHC'),
      'createdAt', extract(epoch from v_now) * 1000
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_execute_transfer(text, text, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_execute_transfer(text, text, numeric, text, text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- Withdrawal create: shared balance lock (same namespace)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ghc_withdrawal_create(
  p_user_id text,
  p_ghc_amount numeric,
  p_ghc_per_pi numeric,
  p_pi_wallet text,
  p_idempotency_key text,
  p_min_pi numeric DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
  v_locked numeric;
  v_withdrawable numeric;
  v_pi numeric;
  v_id text;
  v_existing public.ghc_withdrawal_requests%ROWTYPE;
  v_wallet text := trim(COALESCE(p_pi_wallet, ''));
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'USER_REQUIRED');
  END IF;
  IF p_ghc_amount IS NULL OR p_ghc_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;
  IF p_ghc_per_pi IS NULL OR p_ghc_per_pi <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_RATE');
  END IF;
  IF length(v_wallet) < 8 OR length(v_wallet) > 256 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_WALLET');
  END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'IDEMPOTENCY_REQUIRED');
  END IF;

  -- Shared with spend/transfer
  PERFORM pg_advisory_xact_lock(hashtext('ghc_balance:' || p_user_id));

  SELECT * INTO v_existing
  FROM public.ghc_withdrawal_requests
  WHERE user_id = p_user_id AND idempotency_key = trim(p_idempotency_key)
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'request', to_jsonb(v_existing)
    );
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_balance
  FROM public.ghc_transactions
  WHERE user_id = p_user_id AND status = 'posted';

  v_locked := public.ghc_withdrawal_locked_ghc(p_user_id);
  v_withdrawable := v_balance - v_locked;
  IF v_withdrawable < p_ghc_amount THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'INSUFFICIENT_WITHDRAWABLE',
      'balance', v_balance,
      'locked', v_locked,
      'withdrawable', v_withdrawable
    );
  END IF;

  v_pi := round((p_ghc_amount / p_ghc_per_pi)::numeric, 8);
  IF v_pi < COALESCE(p_min_pi, 100) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'BELOW_MINIMUM_PI',
      'piAmount', v_pi,
      'minPi', COALESCE(p_min_pi, 100)
    );
  END IF;

  v_id := 'wd_' || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.ghc_withdrawal_requests (
    id, user_id, ghc_amount, ghc_per_pi, pi_amount, min_pi_threshold,
    pi_wallet_address, status, idempotency_key
  ) VALUES (
    v_id, p_user_id, p_ghc_amount, p_ghc_per_pi, v_pi, COALESCE(p_min_pi, 100),
    v_wallet, 'requested', trim(p_idempotency_key)
  )
  RETURNING * INTO v_existing;

  RETURN jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'request', to_jsonb(v_existing),
    'balance', v_balance,
    'locked', v_locked + p_ghc_amount,
    'withdrawable', v_withdrawable - p_ghc_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_withdrawal_create(text, numeric, numeric, text, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_withdrawal_create(text, numeric, numeric, text, text, numeric) TO service_role;

COMMENT ON FUNCTION public.ghc_execute_spend IS
  'Spend debit; ghc_balance advisory lock; spendable excludes pending withdrawal locks; idempotent reference.';
COMMENT ON FUNCTION public.ghc_execute_transfer IS
  'Dual-entry transfer; ghc_balance lock on sender; spendable excludes pending withdrawal locks.';
