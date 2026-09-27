-- PROMPT #25 — Durable Pi payment intents (additive, non-destructive)
-- Supports multi-instance Vercel; no process-memory authority for production.

CREATE TABLE IF NOT EXISTS public.ghc_payment_intents (
  id                    text PRIMARY KEY,
  user_id               text NOT NULL,
  provider              text NOT NULL DEFAULT 'pi',
  provider_payment_id   text,
  purpose               text NOT NULL,
  amount                numeric(18, 8) NOT NULL CHECK (amount > 0),
  currency              text NOT NULL DEFAULT 'PI',
  status                text NOT NULL DEFAULT 'CREATED'
    CHECK (status IN (
      'CREATED','APPROVAL_PENDING','APPROVED','USER_SUBMITTED',
      'COMPLETION_PENDING','COMPLETED','FULFILLED','FAILED',
      'CANCELLED','REFUNDED','INCOMPLETE'
    )),
  reference_id          text NOT NULL,
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
  txid                  text,
  last_error            text,
  idempotency_key       text,
  audit                 jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  approved_at           timestamptz,
  submitted_at          timestamptz,
  completed_at          timestamptz,
  fulfilled_at          timestamptz,
  cancelled_at          timestamptz,
  refunded_at           timestamptz,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ghc_payment_intents_provider_payment
  ON public.ghc_payment_intents (provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ghc_payment_intents_idempotency
  ON public.ghc_payment_intents (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ghc_payment_intents_txid
  ON public.ghc_payment_intents (txid)
  WHERE txid IS NOT NULL AND status IN ('COMPLETED','FULFILLED');

CREATE INDEX IF NOT EXISTS idx_ghc_payment_intents_user_created
  ON public.ghc_payment_intents (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ghc_payment_intents_status
  ON public.ghc_payment_intents (status)
  WHERE status NOT IN ('FULFILLED','CANCELLED','REFUNDED');

ALTER TABLE public.ghc_payment_intents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ghc_payment_intents_no_client ON public.ghc_payment_intents;
CREATE POLICY ghc_payment_intents_no_client ON public.ghc_payment_intents
  FOR ALL USING (false) WITH CHECK (false);

-- Upsert intent (service_role only)
CREATE OR REPLACE FUNCTION public.ghc_payment_intent_upsert(p_row jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text := p_row->>'id';
BEGIN
  IF v_id IS NULL OR length(trim(v_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_ID');
  END IF;

  INSERT INTO public.ghc_payment_intents (
    id, user_id, provider, provider_payment_id, purpose, amount, currency,
    status, reference_id, metadata, txid, last_error, idempotency_key, audit,
    created_at, approved_at, submitted_at, completed_at, fulfilled_at,
    cancelled_at, refunded_at, updated_at
  ) VALUES (
    v_id,
    p_row->>'userId',
    COALESCE(p_row->>'provider', 'pi'),
    NULLIF(p_row->>'providerPaymentId', ''),
    p_row->>'purpose',
    (p_row->>'amount')::numeric,
    COALESCE(p_row->>'currency', 'PI'),
    COALESCE(p_row->>'status', 'CREATED'),
    p_row->>'referenceId',
    COALESCE(p_row->'metadata', '{}'::jsonb),
    NULLIF(p_row->>'txid', ''),
    NULLIF(p_row->>'lastError', ''),
    NULLIF(p_row->>'idempotencyKey', ''),
    COALESCE(p_row->'audit', '[]'::jsonb),
    COALESCE(to_timestamp(((p_row->>'createdAt')::bigint)/1000.0), now()),
    CASE WHEN p_row->>'approvedAt' IS NOT NULL THEN to_timestamp(((p_row->>'approvedAt')::bigint)/1000.0) END,
    CASE WHEN p_row->>'submittedAt' IS NOT NULL THEN to_timestamp(((p_row->>'submittedAt')::bigint)/1000.0) END,
    CASE WHEN p_row->>'completedAt' IS NOT NULL THEN to_timestamp(((p_row->>'completedAt')::bigint)/1000.0) END,
    CASE WHEN p_row->>'fulfilledAt' IS NOT NULL THEN to_timestamp(((p_row->>'fulfilledAt')::bigint)/1000.0) END,
    CASE WHEN p_row->>'cancelledAt' IS NOT NULL THEN to_timestamp(((p_row->>'cancelledAt')::bigint)/1000.0) END,
    CASE WHEN p_row->>'refundedAt' IS NOT NULL THEN to_timestamp(((p_row->>'refundedAt')::bigint)/1000.0) END,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    provider_payment_id = COALESCE(EXCLUDED.provider_payment_id, ghc_payment_intents.provider_payment_id),
    status = EXCLUDED.status,
    metadata = EXCLUDED.metadata,
    txid = COALESCE(EXCLUDED.txid, ghc_payment_intents.txid),
    last_error = EXCLUDED.last_error,
    audit = EXCLUDED.audit,
    approved_at = COALESCE(EXCLUDED.approved_at, ghc_payment_intents.approved_at),
    submitted_at = COALESCE(EXCLUDED.submitted_at, ghc_payment_intents.submitted_at),
    completed_at = COALESCE(EXCLUDED.completed_at, ghc_payment_intents.completed_at),
    fulfilled_at = COALESCE(EXCLUDED.fulfilled_at, ghc_payment_intents.fulfilled_at),
    cancelled_at = COALESCE(EXCLUDED.cancelled_at, ghc_payment_intents.cancelled_at),
    refunded_at = COALESCE(EXCLUDED.refunded_at, ghc_payment_intents.refunded_at),
    updated_at = now();

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.ghc_payment_intent_get(p_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row public.ghc_payment_intents%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.ghc_payment_intents WHERE id = p_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'id', v_row.id,
    'userId', v_row.user_id,
    'provider', v_row.provider,
    'providerPaymentId', v_row.provider_payment_id,
    'purpose', v_row.purpose,
    'amount', v_row.amount,
    'currency', v_row.currency,
    'status', v_row.status,
    'referenceId', v_row.reference_id,
    'metadata', v_row.metadata,
    'txid', v_row.txid,
    'lastError', v_row.last_error,
    'idempotencyKey', v_row.idempotency_key,
    'audit', v_row.audit,
    'createdAt', (extract(epoch from v_row.created_at)*1000)::bigint,
    'approvedAt', CASE WHEN v_row.approved_at IS NOT NULL THEN (extract(epoch from v_row.approved_at)*1000)::bigint END,
    'submittedAt', CASE WHEN v_row.submitted_at IS NOT NULL THEN (extract(epoch from v_row.submitted_at)*1000)::bigint END,
    'completedAt', CASE WHEN v_row.completed_at IS NOT NULL THEN (extract(epoch from v_row.completed_at)*1000)::bigint END,
    'fulfilledAt', CASE WHEN v_row.fulfilled_at IS NOT NULL THEN (extract(epoch from v_row.fulfilled_at)*1000)::bigint END,
    'cancelledAt', CASE WHEN v_row.cancelled_at IS NOT NULL THEN (extract(epoch from v_row.cancelled_at)*1000)::bigint END,
    'refundedAt', CASE WHEN v_row.refunded_at IS NOT NULL THEN (extract(epoch from v_row.refunded_at)*1000)::bigint END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ghc_payment_intent_by_provider(p_provider_payment_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id text;
BEGIN
  SELECT id INTO v_id FROM public.ghc_payment_intents
  WHERE provider_payment_id = p_provider_payment_id LIMIT 1;
  IF v_id IS NULL THEN RETURN NULL; END IF;
  RETURN public.ghc_payment_intent_get(v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ghc_payment_intent_upsert(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.ghc_payment_intent_get(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ghc_payment_intent_by_provider(text) TO service_role;
