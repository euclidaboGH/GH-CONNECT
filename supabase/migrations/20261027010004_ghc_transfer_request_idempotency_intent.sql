-- Phase 2: bind transfer-request idempotency references to immutable request intent.
-- Safe to re-run: CREATE OR REPLACE updates only the function definition.
CREATE OR REPLACE FUNCTION public.ghc_create_transfer_request(
  p_requester_id  text,
  p_payer_id      text,
  p_amount        numeric,
  p_reference_id  text,
  p_note          text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limits public.ghc_economy_limits%ROWTYPE;
  v_existing public.ghc_transfer_requests%ROWTYPE;
  v_open int;
  v_daily int;
  v_now timestamptz := now();
  v_req public.ghc_transfer_requests%ROWTYPE;
  v_constraint_name text;
BEGIN
  IF p_requester_id IS NULL OR length(trim(p_requester_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'AUTH_REQUIRED', 'message', 'Authentication required');
  END IF;
  IF p_payer_id IS NULL OR length(trim(p_payer_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_RECIPIENT', 'message', 'Payer required');
  END IF;
  IF p_requester_id = p_payer_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SELF_TRANSFER', 'message', 'Cannot request from yourself');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_AMOUNT', 'message', 'Invalid amount');
  END IF;
  IF p_reference_id IS NULL OR length(trim(p_reference_id)) = 0
     OR length(p_reference_id) > 128
     OR p_reference_id ~ '[[:cntrl:]]' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_REFERENCE', 'message', 'Invalid referenceId');
  END IF;
  IF length(COALESCE(p_note, '')) > 500 OR COALESCE(p_note, '') ~ '[[:cntrl:]]' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_NOTE', 'message', 'Invalid note');
  END IF;

  SELECT * INTO v_limits FROM public.ghc_economy_limits WHERE id = 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SERVER_UNAVAILABLE', 'message', 'Limits not configured');
  END IF;

  IF p_amount < v_limits.min_transfer OR p_amount > v_limits.max_transfer THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_LIMIT_EXCEEDED', 'message', 'Amount outside limits');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ghc_user_blocks
    WHERE (blocker_id = p_requester_id AND blocked_id = p_payer_id)
       OR (blocker_id = p_payer_id AND blocked_id = p_requester_id)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'BLOCKED_USER', 'message', 'Not allowed');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ghc_account_flags
    WHERE user_id = p_requester_id AND (restricted OR suspended)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_RESTRICTED', 'message', 'Account restricted');
  END IF;

  SELECT * INTO v_existing FROM public.ghc_transfer_requests WHERE reference_id = p_reference_id;
  IF FOUND THEN
    -- A reference is an idempotency key, not permission to reuse an old request
    -- with different actors, amount, or note.
    IF v_existing.requester_id IS DISTINCT FROM p_requester_id
       OR v_existing.payer_id IS DISTINCT FROM p_payer_id
       OR v_existing.amount IS DISTINCT FROM p_amount
       OR v_existing.note IS DISTINCT FROM NULLIF(trim(COALESCE(p_note, '')), '') THEN
      RETURN jsonb_build_object(
        'ok', false, 'code', 'IDEMPOTENCY_CONFLICT',
        'message', 'Reference already belongs to a different request'
      );
    END IF;
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'request', jsonb_build_object(
        'id', v_existing.id,
        'referenceId', v_existing.reference_id,
        'requesterId', v_existing.requester_id,
        'payerId', v_existing.payer_id,
        'amount', v_existing.amount,
        'status', v_existing.status,
        'note', v_existing.note,
        'createdAt', extract(epoch from v_existing.created_at) * 1000,
        'expiresAt', extract(epoch from v_existing.expires_at) * 1000
      )
    );
  END IF;

  SELECT COUNT(*) INTO v_open
  FROM public.ghc_transfer_requests
  WHERE requester_id = p_requester_id AND status = 'PENDING';

  IF v_open >= v_limits.maximum_open_requests THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_LIMIT_EXCEEDED', 'message', 'Too many open requests');
  END IF;

  SELECT COUNT(*) INTO v_daily
  FROM public.ghc_transfer_requests
  WHERE requester_id = p_requester_id
    AND created_at >= date_trunc('day', v_now AT TIME ZONE 'UTC');

  IF v_daily >= v_limits.daily_request_limit THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_LIMIT_EXCEEDED', 'message', 'Daily request limit reached');
  END IF;

  INSERT INTO public.ghc_transfer_requests (
    reference_id, requester_id, payer_id, amount, note, status, expires_at
  ) VALUES (
    p_reference_id, p_requester_id, p_payer_id, p_amount,
    NULLIF(trim(COALESCE(p_note, '')), ''),
    'PENDING',
    v_now + (v_limits.request_expiry_ms * interval '1 millisecond')
  )
  RETURNING * INTO v_req;

  PERFORM public.ghc_record_notification_event(
    p_payer_id, 'GHC_REQUEST_CREATED',
    'GHC request',
    'Someone requested ' || p_amount::text || ' GHC from you.',
    p_reference_id, p_reference_id,
    jsonb_build_object(
      'amount', p_amount, 'currency', 'GHC',
      'counterpartyId', p_requester_id, 'open', 'requests', 'role', 'incoming_request'
    ),
    p_payer_id || ':GHC_REQUEST_CREATED:' || p_reference_id,
    NULL
  );

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'request', jsonb_build_object(
      'id', v_req.id,
      'referenceId', v_req.reference_id,
      'requesterId', v_req.requester_id,
      'payerId', v_req.payer_id,
      'amount', v_req.amount,
      'status', v_req.status,
      'note', v_req.note,
      'createdAt', extract(epoch from v_req.created_at) * 1000,
      'expiresAt', extract(epoch from v_req.expires_at) * 1000
    )
  );
EXCEPTION WHEN unique_violation THEN
  -- Only the idempotency-reference collision is a retry. Do not disguise
  -- primary-key or future unique-constraint failures as a successful retry.
  GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;
  IF v_constraint_name IS DISTINCT FROM 'ghc_transfer_requests_reference_id_key' THEN
    RAISE;
  END IF;
  SELECT * INTO v_existing FROM public.ghc_transfer_requests WHERE reference_id = p_reference_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SERVER_UNAVAILABLE', 'message', 'Unable to confirm request');
  END IF;
  IF v_existing.requester_id IS DISTINCT FROM p_requester_id
     OR v_existing.payer_id IS DISTINCT FROM p_payer_id
     OR v_existing.amount IS DISTINCT FROM p_amount
     OR v_existing.note IS DISTINCT FROM NULLIF(trim(COALESCE(p_note, '')), '') THEN
    RETURN jsonb_build_object(
      'ok', false, 'code', 'IDEMPOTENCY_CONFLICT',
      'message', 'Reference already belongs to a different request'
    );
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', true,
    'request', jsonb_build_object(
      'id', v_existing.id,
      'referenceId', v_existing.reference_id,
      'requesterId', v_existing.requester_id,
      'payerId', v_existing.payer_id,
      'amount', v_existing.amount,
      'status', v_existing.status,
      'note', v_existing.note,
      'createdAt', extract(epoch from v_existing.created_at) * 1000,
      'expiresAt', extract(epoch from v_existing.expires_at) * 1000
    )
  );
END;
$$;

-- Atomic accept: lock request → transfer via ghc_execute_transfer → mark ACCEPTED
