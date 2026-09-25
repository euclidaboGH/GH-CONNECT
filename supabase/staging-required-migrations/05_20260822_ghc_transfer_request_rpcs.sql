-- D6.2: Server-authoritative transfer-request RPCs (create / accept / decline / cancel)
-- Accept is atomic: ledger double-entry + request ACCEPTED in one transaction.

-- Lazy expire a single request row (idempotent)
CREATE OR REPLACE FUNCTION public.ghc_expire_request_if_needed(p_reference_id text)
RETURNS public.ghc_transfer_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.ghc_transfer_requests%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.ghc_transfer_requests WHERE reference_id = p_reference_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF r.status = 'PENDING' AND r.expires_at <= now() THEN
    UPDATE public.ghc_transfer_requests
    SET status = 'EXPIRED', resolved_at = now()
    WHERE reference_id = p_reference_id AND status = 'PENDING'
    RETURNING * INTO r;

    PERFORM public.ghc_record_notification_event(
      r.requester_id, 'GHC_REQUEST_EXPIRED',
      'Request expired',
      'The ' || r.amount::text || ' GHC request has expired.',
      r.reference_id, r.reference_id,
      jsonb_build_object('amount', r.amount, 'currency', 'GHC', 'open', 'requests'),
      r.requester_id || ':GHC_REQUEST_EXPIRED:' || r.reference_id,
      NULL
    );
    PERFORM public.ghc_record_notification_event(
      r.payer_id, 'GHC_REQUEST_EXPIRED',
      'Request expired',
      'The ' || r.amount::text || ' GHC request has expired.',
      r.reference_id, r.reference_id,
      jsonb_build_object('amount', r.amount, 'currency', 'GHC', 'open', 'requests'),
      r.payer_id || ':GHC_REQUEST_EXPIRED:' || r.reference_id,
      NULL
    );
  END IF;
  RETURN r;
END;
$$;

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
  IF p_reference_id IS NULL OR length(trim(p_reference_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_FAILED', 'message', 'referenceId required');
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
  SELECT * INTO v_existing FROM public.ghc_transfer_requests WHERE reference_id = p_reference_id;
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
CREATE OR REPLACE FUNCTION public.ghc_accept_transfer_request(
  p_actor_id      text,
  p_reference_id  text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.ghc_transfer_requests%ROWTYPE;
  xfer jsonb;
BEGIN
  IF p_actor_id IS NULL OR length(trim(p_actor_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'AUTH_REQUIRED', 'message', 'Authentication required');
  END IF;

  SELECT * INTO r FROM public.ghc_transfer_requests WHERE reference_id = p_reference_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_NOT_FOUND', 'message', 'Request not found');
  END IF;

  -- Lazy expire under lock
  IF r.status = 'PENDING' AND r.expires_at <= now() THEN
    UPDATE public.ghc_transfer_requests
    SET status = 'EXPIRED', resolved_at = now()
    WHERE reference_id = p_reference_id AND status = 'PENDING'
    RETURNING * INTO r;
    PERFORM public.ghc_record_notification_event(
      r.requester_id, 'GHC_REQUEST_EXPIRED', 'Request expired',
      'The ' || r.amount::text || ' GHC request has expired.',
      r.reference_id, r.reference_id,
      jsonb_build_object('amount', r.amount, 'open', 'requests'),
      r.requester_id || ':GHC_REQUEST_EXPIRED:' || r.reference_id, NULL
    );
    PERFORM public.ghc_record_notification_event(
      r.payer_id, 'GHC_REQUEST_EXPIRED', 'Request expired',
      'The ' || r.amount::text || ' GHC request has expired.',
      r.reference_id, r.reference_id,
      jsonb_build_object('amount', r.amount, 'open', 'requests'),
      r.payer_id || ':GHC_REQUEST_EXPIRED:' || r.reference_id, NULL
    );
    RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_EXPIRED', 'message', 'Request expired');
  END IF;

  IF r.payer_id <> p_actor_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_NOT_AUTHORIZED', 'message', 'Only the payer may accept');
  END IF;

  IF r.status = 'ACCEPTED' THEN
    -- Idempotent: return existing transfer result
    xfer := public.ghc_execute_transfer(
      r.payer_id, r.requester_id, r.amount, r.reference_id, r.note, r.reference_id
    );
    RETURN xfer;
  END IF;

  IF r.status <> 'PENDING' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_CLOSED', 'message', 'Request is ' || r.status);
  END IF;

  -- Money movement (idempotent on reference_id inside ghc_execute_transfer)
  xfer := public.ghc_execute_transfer(
    r.payer_id, r.requester_id, r.amount, r.reference_id, r.note, r.reference_id
  );

  IF (xfer->>'ok')::boolean IS DISTINCT FROM true THEN
    RETURN xfer;
  END IF;

  UPDATE public.ghc_transfer_requests
  SET status = 'ACCEPTED', transfer_ref = r.reference_id, resolved_at = now()
  WHERE reference_id = p_reference_id AND status = 'PENDING';

  PERFORM public.ghc_record_notification_event(
    r.requester_id, 'GHC_REQUEST_ACCEPTED',
    'Request accepted',
    'Your ' || r.amount::text || ' GHC request was accepted.',
    r.reference_id, r.reference_id,
    jsonb_build_object('amount', r.amount, 'currency', 'GHC', 'open', 'transaction'),
    r.requester_id || ':GHC_REQUEST_ACCEPTED:' || r.reference_id,
    NULL
  );

  -- SENT/RECEIVED already inserted by ghc_execute_transfer; ensure titled notifs
  PERFORM public.ghc_record_notification_event(
    r.payer_id, 'GHC_SENT',
    'GHC sent',
    r.amount::text || ' GHC sent.',
    r.reference_id, r.reference_id,
    jsonb_build_object('amount', r.amount, 'currency', 'GHC', 'role', 'sent', 'open', 'transaction'),
    r.payer_id || ':GHC_SENT:' || r.reference_id,
    NULL
  );
  PERFORM public.ghc_record_notification_event(
    r.requester_id, 'GHC_RECEIVED',
    'GHC received',
    'You received ' || r.amount::text || ' GHC.',
    r.reference_id, r.reference_id,
    jsonb_build_object('amount', r.amount, 'currency', 'GHC', 'role', 'received', 'open', 'transaction'),
    r.requester_id || ':GHC_RECEIVED:' || r.reference_id,
    NULL
  );

  RETURN xfer;
END;
$$;

CREATE OR REPLACE FUNCTION public.ghc_decline_transfer_request(
  p_actor_id text,
  p_reference_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.ghc_transfer_requests%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.ghc_transfer_requests WHERE reference_id = p_reference_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_NOT_FOUND', 'message', 'Request not found');
  END IF;
  IF r.payer_id <> p_actor_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_NOT_AUTHORIZED', 'message', 'Only the payer may decline');
  END IF;
  IF r.status = 'DECLINED' THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'status', 'DECLINED');
  END IF;
  IF r.status <> 'PENDING' THEN
    IF r.status = 'PENDING' AND r.expires_at <= now() THEN
      UPDATE public.ghc_transfer_requests SET status = 'EXPIRED', resolved_at = now()
      WHERE reference_id = p_reference_id;
      RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_EXPIRED', 'message', 'Request expired');
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_CLOSED', 'message', 'Request is ' || r.status);
  END IF;
  IF r.expires_at <= now() THEN
    UPDATE public.ghc_transfer_requests SET status = 'EXPIRED', resolved_at = now()
    WHERE reference_id = p_reference_id AND status = 'PENDING';
    RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_EXPIRED', 'message', 'Request expired');
  END IF;

  UPDATE public.ghc_transfer_requests
  SET status = 'DECLINED', resolved_at = now()
  WHERE reference_id = p_reference_id AND status = 'PENDING';

  PERFORM public.ghc_record_notification_event(
    r.requester_id, 'GHC_REQUEST_DECLINED',
    'Request declined',
    'Your ' || r.amount::text || ' GHC request was declined.',
    r.reference_id, r.reference_id,
    jsonb_build_object('amount', r.amount, 'open', 'requests'),
    r.requester_id || ':GHC_REQUEST_DECLINED:' || r.reference_id,
    NULL
  );

  RETURN jsonb_build_object('ok', true, 'status', 'DECLINED', 'referenceId', p_reference_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.ghc_cancel_transfer_request(
  p_actor_id text,
  p_reference_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.ghc_transfer_requests%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.ghc_transfer_requests WHERE reference_id = p_reference_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_NOT_FOUND', 'message', 'Request not found');
  END IF;
  IF r.requester_id <> p_actor_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_NOT_AUTHORIZED', 'message', 'Only the requester may cancel');
  END IF;
  IF r.status = 'CANCELLED' THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'status', 'CANCELLED');
  END IF;
  IF r.status = 'ACCEPTED' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_CLOSED', 'message', 'Already paid');
  END IF;
  IF r.status <> 'PENDING' THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'status', r.status);
  END IF;

  UPDATE public.ghc_transfer_requests
  SET status = 'CANCELLED', resolved_at = now()
  WHERE reference_id = p_reference_id AND status = 'PENDING';

  PERFORM public.ghc_record_notification_event(
    r.payer_id, 'GHC_REQUEST_CANCELLED',
    'Request cancelled',
    'A ' || r.amount::text || ' GHC request was cancelled.',
    r.reference_id, r.reference_id,
    jsonb_build_object('amount', r.amount, 'open', 'requests'),
    r.payer_id || ':GHC_REQUEST_CANCELLED:' || r.reference_id,
    NULL
  );

  RETURN jsonb_build_object('ok', true, 'status', 'CANCELLED', 'referenceId', p_reference_id);
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_expire_request_if_needed(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ghc_create_transfer_request(text, text, numeric, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ghc_accept_transfer_request(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ghc_decline_transfer_request(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ghc_cancel_transfer_request(text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ghc_expire_request_if_needed(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ghc_create_transfer_request(text, text, numeric, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ghc_accept_transfer_request(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ghc_decline_transfer_request(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ghc_cancel_transfer_request(text, text) TO service_role;

ALTER TABLE public.ghc_transfer_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ghc_transfer_requests_no_client_write ON public.ghc_transfer_requests;
CREATE POLICY ghc_transfer_requests_no_client_write ON public.ghc_transfer_requests
  FOR ALL USING (false) WITH CHECK (false);
