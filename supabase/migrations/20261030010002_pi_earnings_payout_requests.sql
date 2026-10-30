-- Phase 4: durable PI earnings payout request/reservation lifecycle foundation.
-- Additive only. No provider transfer is initiated by this migration.
-- Provider execution/receipt verification must be implemented and tested separately.

CREATE TABLE IF NOT EXISTS public.gh_pi_earnings_payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL CHECK (length(trim(user_id)) BETWEEN 1 AND 160),
  idempotency_key text NOT NULL CHECK (length(trim(idempotency_key)) BETWEEN 16 AND 160),
  request_fingerprint text NOT NULL CHECK (length(request_fingerprint) = 64),
  gross_atomic numeric(38,0) NOT NULL CHECK (gross_atomic > 0 AND trunc(gross_atomic) = gross_atomic),
  fee_atomic numeric(38,0) NOT NULL CHECK (fee_atomic >= 0 AND trunc(fee_atomic) = fee_atomic),
  net_atomic numeric(38,0) NOT NULL CHECK (net_atomic > 0 AND trunc(net_atomic) = net_atomic),
  recipient_pi_app_uid text NOT NULL CHECK (length(trim(recipient_pi_app_uid)) BETWEEN 1 AND 200),
  recipient_username text,
  network text NOT NULL CHECK (network IN ('Pi Testnet','Pi Mainnet')),
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN (
    'reserved','processing','uncertain','paid','failed','released'
  )),
  provider_payment_id text,
  provider_txid text,
  provider_receipt jsonb,
  provider_verified_at timestamptz,
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz,
  CONSTRAINT gh_pi_earnings_payout_amounts CHECK (gross_atomic = fee_atomic + net_atomic),
  CONSTRAINT gh_pi_earnings_payout_receipt_pair CHECK (
    (status <> 'paid') OR (provider_payment_id IS NOT NULL AND provider_txid IS NOT NULL AND provider_verified_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_pi_earnings_payout_idempotency
  ON public.gh_pi_earnings_payout_requests(user_id, idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_pi_earnings_payout_provider_payment
  ON public.gh_pi_earnings_payout_requests(provider_payment_id) WHERE provider_payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_pi_earnings_payout_provider_txid
  ON public.gh_pi_earnings_payout_requests(provider_txid) WHERE provider_txid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gh_pi_earnings_payout_user_status
  ON public.gh_pi_earnings_payout_requests(user_id, status, created_at DESC);

ALTER TABLE public.gh_pi_earnings_payout_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_pi_earnings_payout_no_client ON public.gh_pi_earnings_payout_requests;
CREATE POLICY gh_pi_earnings_payout_no_client ON public.gh_pi_earnings_payout_requests
  FOR ALL USING (false) WITH CHECK (false);
REVOKE ALL ON TABLE public.gh_pi_earnings_payout_requests FROM PUBLIC, anon, authenticated, service_role;

-- Creates the durable request and gross reservation in one transaction.
-- Caller supplies a SHA-256 fingerprint of the normalized request payload; retries
-- with the same key but a different payload are rejected, never treated as success.
CREATE OR REPLACE FUNCTION public.gh_pi_earnings_payout_create(
  p_user_id text,
  p_idempotency_key text,
  p_request_fingerprint text,
  p_gross_atomic numeric,
  p_fee_atomic numeric,
  p_net_atomic numeric,
  p_network text DEFAULT 'Pi Testnet'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user text := NULLIF(trim(COALESCE(p_user_id,'')), '');
  v_key text := NULLIF(trim(COALESCE(p_idempotency_key,'')), '');
  v_fp text := lower(COALESCE(p_request_fingerprint,''));
  v_map public.gh_pi_identities%ROWTYPE;
  v_row public.gh_pi_earnings_payout_requests%ROWTYPE;
  v_reserve jsonb;
BEGIN
  IF v_user IS NULL OR length(v_user)>160 OR v_key IS NULL OR length(v_key)<16 OR length(v_key)>160
     OR v_fp !~ '^[0-9a-f]{64}$' OR p_gross_atomic IS NULL OR p_fee_atomic IS NULL OR p_net_atomic IS NULL
     OR trunc(p_gross_atomic)<>p_gross_atomic OR trunc(p_fee_atomic)<>p_fee_atomic OR trunc(p_net_atomic)<>p_net_atomic
     OR p_gross_atomic<=0 OR p_fee_atomic<0 OR p_net_atomic<=0
     OR p_gross_atomic<>p_fee_atomic+p_net_atomic OR p_network IS DISTINCT FROM 'Pi Testnet' THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_INPUT');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pi_earnings_payout:'||v_user,0));
  SELECT * INTO v_row FROM public.gh_pi_earnings_payout_requests
    WHERE user_id=v_user AND idempotency_key=v_key FOR UPDATE;
  IF FOUND THEN
    IF v_row.request_fingerprint<>v_fp OR v_row.gross_atomic<>p_gross_atomic
       OR v_row.fee_atomic<>p_fee_atomic OR v_row.net_atomic<>p_net_atomic OR v_row.network<>p_network THEN
      RETURN jsonb_build_object('ok',false,'error','IDEMPOTENCY_CONFLICT');
    END IF;
    RETURN jsonb_build_object('ok',true,'duplicate',true,'requestId',v_row.id,'status',v_row.status,
      'grossAtomic',v_row.gross_atomic,'feeAtomic',v_row.fee_atomic,'netAtomic',v_row.net_atomic);
  END IF;

  SELECT * INTO v_map FROM public.gh_pi_identities WHERE gh_user_id=v_user LIMIT 1;
  IF NOT FOUND OR NULLIF(trim(COALESCE(v_map.pi_app_uid,'')),'') IS NULL THEN
    RETURN jsonb_build_object('ok',false,'error','LINKED_PI_IDENTITY_REQUIRED');
  END IF;

  INSERT INTO public.gh_pi_earnings_payout_requests(
    user_id,idempotency_key,request_fingerprint,gross_atomic,fee_atomic,net_atomic,
    recipient_pi_app_uid,recipient_username,network,status
  ) VALUES (
    v_user,v_key,v_fp,p_gross_atomic,p_fee_atomic,p_net_atomic,
    v_map.pi_app_uid,v_map.pi_username,p_network,'reserved'
  ) RETURNING * INTO v_row;

  v_reserve := public.gh_earnings_reserve(v_user,p_gross_atomic,
    'pi_earnings_payout:reserve:'||v_row.id::text,v_row.id::text,'withdrawal','PI earnings payout reservation');
  IF COALESCE((v_reserve->>'ok')::boolean,false) IS NOT TRUE OR COALESCE((v_reserve->>'duplicate')::boolean,false) THEN
    RAISE EXCEPTION 'PI earnings payout reservation failed: %',COALESCE(v_reserve->>'error','RESERVATION_CONFLICT');
  END IF;
  RETURN jsonb_build_object('ok',true,'duplicate',false,'requestId',v_row.id,'status','reserved',
    'grossAtomic',v_row.gross_atomic,'feeAtomic',v_row.fee_atomic,'netAtomic',v_row.net_atomic,
    'recipientPiAppUid',v_row.recipient_pi_app_uid,'network',v_row.network);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok',false,'error','IDEMPOTENCY_RACE_RETRY');
END;
$$;

-- A timeout after contacting Pi is NOT proof of failure. Preserve the reservation
-- and move to uncertain; only an authoritative provider reconciliation may release it.
CREATE OR REPLACE FUNCTION public.gh_pi_earnings_payout_mark_uncertain(
  p_request_id uuid, p_failure_code text DEFAULT 'PROVIDER_OUTCOME_UNKNOWN'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_row public.gh_pi_earnings_payout_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.gh_pi_earnings_payout_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','REQUEST_NOT_FOUND'); END IF;
  IF v_row.status='paid' THEN RETURN jsonb_build_object('ok',false,'error','ALREADY_PAID'); END IF;
  IF v_row.status IN ('failed','released') THEN RETURN jsonb_build_object('ok',false,'error','TERMINAL_REQUEST'); END IF;
  UPDATE public.gh_pi_earnings_payout_requests SET status='uncertain',
    failure_code=left(COALESCE(p_failure_code,'PROVIDER_OUTCOME_UNKNOWN'),120),updated_at=now()
    WHERE id=p_request_id;
  RETURN jsonb_build_object('ok',true,'status','uncertain','reservationRetained',true);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_pi_earnings_payout_create(text,text,text,numeric,numeric,numeric,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_earnings_payout_mark_uncertain(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_pi_earnings_payout_create(text,text,text,numeric,numeric,numeric,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_pi_earnings_payout_mark_uncertain(uuid,text) TO service_role;
COMMENT ON TABLE public.gh_pi_earnings_payout_requests IS
  'Durable PI earnings payout requests. Paid requires provider-verified payment ID, txid and verification timestamp; no client table access.';
