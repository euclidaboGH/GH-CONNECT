-- Phase 5 hardening: serialize provider binding and payment status transitions.
-- Source-only until reviewed, reconciled and validated on disposable PostgreSQL/Testnet.

CREATE OR REPLACE FUNCTION public.ghc_payment_intent_bind_provider(
  p_id text,
  p_provider_payment_id text,
  p_actor text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.ghc_payment_intents%ROWTYPE;
  v_conflict text;
  v_audit jsonb;
BEGIN
  IF COALESCE(trim(p_id), '') = '' OR COALESCE(trim(p_provider_payment_id), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_BIND_INPUT');
  END IF;

  SELECT * INTO v_row FROM public.ghc_payment_intents WHERE id = trim(p_id) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'INTENT_NOT_FOUND'); END IF;

  IF v_row.provider_payment_id IS NOT NULL AND v_row.provider_payment_id <> trim(p_provider_payment_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PROVIDER_BIND_CONFLICT');
  END IF;

  SELECT id INTO v_conflict
  FROM public.ghc_payment_intents
  WHERE provider_payment_id = trim(p_provider_payment_id) AND id <> trim(p_id)
  LIMIT 1;
  IF v_conflict IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PROVIDER_PAYMENT_ALREADY_BOUND');
  END IF;

  IF v_row.status IN ('COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED', 'FULFILLED') AND v_row.provider_payment_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'TERMINAL_INTENT_CANNOT_BIND');
  END IF;

  IF v_row.provider_payment_id = trim(p_provider_payment_id) AND v_row.status <> 'CREATED' THEN
    RETURN jsonb_build_object('ok', true, 'intent', public.ghc_payment_intent_get(v_row.id), 'idempotent', true);
  END IF;

  v_audit := (CASE WHEN jsonb_typeof(v_row.audit) = 'array' THEN v_row.audit ELSE '[]'::jsonb END) || jsonb_build_array(jsonb_build_object(
    'at', (extract(epoch FROM clock_timestamp()) * 1000)::bigint,
    'action', 'BIND_PROVIDER',
    'actor', p_actor,
    'detail', trim(p_provider_payment_id)
  ));
  SELECT COALESCE(jsonb_agg(value ORDER BY ordinality), '[]'::jsonb) INTO v_audit
  FROM jsonb_array_elements(v_audit) WITH ORDINALITY AS x(value, ordinality)
  WHERE ordinality > GREATEST(jsonb_array_length(v_audit) - 50, 0);

  UPDATE public.ghc_payment_intents
  SET provider_payment_id = trim(p_provider_payment_id),
      status = CASE WHEN status = 'CREATED' THEN 'APPROVAL_PENDING' ELSE status END,
      audit = v_audit,
      updated_at = now()
  WHERE id = v_row.id;

  RETURN jsonb_build_object('ok', true, 'intent', public.ghc_payment_intent_get(v_row.id), 'idempotent', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.ghc_payment_intent_transition(
  p_id text,
  p_next_status text,
  p_actor text DEFAULT NULL,
  p_detail text DEFAULT NULL,
  p_provider_payment_id text DEFAULT NULL,
  p_txid text DEFAULT NULL,
  p_error text DEFAULT NULL,
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.ghc_payment_intents%ROWTYPE;
  v_next text := upper(trim(COALESCE(p_next_status, '')));
  v_conflict text;
  v_allowed boolean := false;
  v_audit jsonb;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF COALESCE(trim(p_id), '') = '' OR v_next NOT IN (
    'CREATED','APPROVAL_PENDING','APPROVED','USER_SUBMITTED','COMPLETION_PENDING',
    'COMPLETED','FULFILLED','FAILED','CANCELLED','REFUNDED','INCOMPLETE'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_TRANSITION_INPUT');
  END IF;

  SELECT * INTO v_row FROM public.ghc_payment_intents WHERE id = trim(p_id) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'INTENT_NOT_FOUND'); END IF;

  IF p_provider_payment_id IS NOT NULL AND trim(p_provider_payment_id) <> '' THEN
    IF v_row.provider_payment_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'PROVIDER_BIND_REQUIRED');
    END IF;
    IF v_row.provider_payment_id <> trim(p_provider_payment_id) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'PROVIDER_BIND_CONFLICT');
    END IF;
    SELECT id INTO v_conflict FROM public.ghc_payment_intents
    WHERE provider_payment_id = trim(p_provider_payment_id) AND id <> v_row.id LIMIT 1;
    IF v_conflict IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'PROVIDER_PAYMENT_ALREADY_BOUND'); END IF;
  END IF;

  IF v_next = v_row.status THEN
    v_audit := (CASE WHEN jsonb_typeof(v_row.audit) = 'array' THEN v_row.audit ELSE '[]'::jsonb END) || jsonb_build_array(jsonb_build_object(
      'at', (extract(epoch FROM v_now) * 1000)::bigint,
      'action', 'STATUS_RETRY_' || v_next,
      'actor', p_actor,
      'detail', p_detail,
      'meta', COALESCE(p_meta, '{}'::jsonb)
    ));
    SELECT COALESCE(jsonb_agg(value ORDER BY ordinality), '[]'::jsonb) INTO v_audit
    FROM jsonb_array_elements(v_audit) WITH ORDINALITY AS x(value, ordinality)
    WHERE ordinality > GREATEST(jsonb_array_length(v_audit) - 50, 0);
    UPDATE public.ghc_payment_intents
    SET txid = COALESCE(NULLIF(trim(p_txid), ''), txid),
        last_error = CASE WHEN p_error IS NULL THEN last_error ELSE NULLIF(trim(p_error), '') END,
        audit = v_audit,
        updated_at = now()
    WHERE id = v_row.id;
    RETURN jsonb_build_object('ok', true, 'intent', public.ghc_payment_intent_get(v_row.id), 'idempotent', true);
  END IF;

  -- Confirmed success and terminal outcomes cannot be downgraded by a late callback.
  IF v_row.status IN ('FULFILLED', 'REFUNDED', 'FAILED', 'CANCELLED') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'TERMINAL_STATUS', 'status', v_row.status);
  END IF;
  IF v_row.status = 'COMPLETED' AND v_next NOT IN ('FULFILLED', 'REFUNDED') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'COMPLETED_STATUS_CANNOT_REGRESS');
  END IF;
  IF v_next = 'FULFILLED' AND v_row.status <> 'COMPLETED' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FULFILLMENT_REQUIRES_COMPLETED');
  END IF;
  IF v_next = 'REFUNDED' AND v_row.status <> 'COMPLETED' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REFUND_REQUIRES_COMPLETED');
  END IF;

  v_allowed := CASE v_next
    WHEN 'APPROVAL_PENDING' THEN v_row.status IN ('CREATED','APPROVAL_PENDING')
    WHEN 'APPROVED' THEN v_row.status IN ('CREATED','APPROVAL_PENDING','APPROVED')
    WHEN 'USER_SUBMITTED' THEN v_row.status IN ('APPROVED','USER_SUBMITTED')
    WHEN 'COMPLETION_PENDING' THEN v_row.status IN ('CREATED','APPROVAL_PENDING','APPROVED','USER_SUBMITTED','COMPLETION_PENDING','INCOMPLETE')
    WHEN 'COMPLETED' THEN v_row.status IN ('CREATED','APPROVAL_PENDING','APPROVED','USER_SUBMITTED','COMPLETION_PENDING','INCOMPLETE')
    WHEN 'INCOMPLETE' THEN v_row.status IN ('CREATED','APPROVAL_PENDING','APPROVED','USER_SUBMITTED','COMPLETION_PENDING','INCOMPLETE')
    WHEN 'FAILED' THEN v_row.status IN ('CREATED','APPROVAL_PENDING','APPROVED','USER_SUBMITTED','COMPLETION_PENDING','INCOMPLETE')
    WHEN 'CANCELLED' THEN v_row.status IN ('CREATED','APPROVAL_PENDING','APPROVED','USER_SUBMITTED','COMPLETION_PENDING','INCOMPLETE')
    WHEN 'FULFILLED' THEN v_row.status = 'COMPLETED'
    WHEN 'REFUNDED' THEN v_row.status = 'COMPLETED'
    ELSE false
  END;
  IF NOT v_allowed THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_STATUS_TRANSITION', 'from', v_row.status, 'to', v_next);
  END IF;

  v_audit := (CASE WHEN jsonb_typeof(v_row.audit) = 'array' THEN v_row.audit ELSE '[]'::jsonb END) || jsonb_build_array(jsonb_build_object(
    'at', (extract(epoch FROM v_now) * 1000)::bigint,
    'action', 'STATUS_' || v_next,
    'actor', p_actor,
    'detail', p_detail,
    'meta', COALESCE(p_meta, '{}'::jsonb)
  ));
  SELECT COALESCE(jsonb_agg(value ORDER BY ordinality), '[]'::jsonb) INTO v_audit
  FROM jsonb_array_elements(v_audit) WITH ORDINALITY AS x(value, ordinality)
  WHERE ordinality > GREATEST(jsonb_array_length(v_audit) - 50, 0);

  UPDATE public.ghc_payment_intents
  SET status = v_next,
      provider_payment_id = COALESCE(NULLIF(trim(p_provider_payment_id), ''), provider_payment_id),
      txid = COALESCE(NULLIF(trim(p_txid), ''), txid),
      last_error = CASE WHEN p_error IS NULL THEN last_error ELSE NULLIF(trim(p_error), '') END,
      audit = v_audit,
      approved_at = CASE WHEN v_next = 'APPROVED' THEN COALESCE(approved_at, v_now) ELSE approved_at END,
      submitted_at = CASE WHEN v_next = 'USER_SUBMITTED' THEN COALESCE(submitted_at, v_now) ELSE submitted_at END,
      completed_at = CASE WHEN v_next = 'COMPLETED' THEN COALESCE(completed_at, v_now) ELSE completed_at END,
      fulfilled_at = CASE WHEN v_next = 'FULFILLED' THEN COALESCE(fulfilled_at, v_now) ELSE fulfilled_at END,
      cancelled_at = CASE WHEN v_next = 'CANCELLED' THEN COALESCE(cancelled_at, v_now) ELSE cancelled_at END,
      refunded_at = CASE WHEN v_next = 'REFUNDED' THEN COALESCE(refunded_at, v_now) ELSE refunded_at END,
      updated_at = now()
  WHERE id = v_row.id;

  RETURN jsonb_build_object('ok', true, 'intent', public.ghc_payment_intent_get(v_row.id), 'idempotent', false);
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_payment_intent_bind_provider(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ghc_payment_intent_bind_provider(text,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.ghc_payment_intent_transition(text,text,text,text,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ghc_payment_intent_transition(text,text,text,text,text,text,text,jsonb) TO service_role;

-- Harden the original SECURITY DEFINER payment-intent RPCs too. Granting service_role
-- without revoking PostgreSQL's default PUBLIC EXECUTE would leave the functions callable
-- by client roles even though the underlying table has RLS enabled.
REVOKE ALL ON FUNCTION public.ghc_payment_intent_upsert(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ghc_payment_intent_upsert(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.ghc_payment_intent_get(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ghc_payment_intent_get(text) TO service_role;
REVOKE ALL ON FUNCTION public.ghc_payment_intent_by_provider(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ghc_payment_intent_by_provider(text) TO service_role;
REVOKE ALL ON FUNCTION public.ghc_payment_intent_by_idempotency(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ghc_payment_intent_by_idempotency(text,text) TO service_role;
