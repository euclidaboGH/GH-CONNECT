-- Phase 5: unify general earnings A2U with the existing seller/cashback Pi app-wallet sequence lane.
-- Pi's app wallet sequence is shared: separate per-domain mutexes are unsafe.
-- This migration only changes server-side coordination; it does not enable Mainnet or execute payments.

CREATE OR REPLACE FUNCTION public.gh_pi_earnings_payout_begin_execution(
  p_request_id uuid,p_user_id text,p_lease_token uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
  v public.gh_pi_earnings_payout_requests%ROWTYPE;
  lane public.gh_pi_a2u_sequence_lease%ROWTYPE;
  v_lane_request text := 'earnings:' || p_request_id::text;
BEGIN
  IF p_request_id IS NULL OR NULLIF(trim(COALESCE(p_user_id,'')),'') IS NULL OR p_lease_token IS NULL THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_INPUT');
  END IF;
  -- Global lock first: consistent with seller/cashback A2U and all Phase 5 worker RPCs.
  SELECT * INTO lane FROM public.gh_pi_a2u_sequence_lease WHERE singleton_id=1 FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','PI_A2U_SEQUENCE_UNAVAILABLE'); END IF;
  SELECT * INTO v FROM public.gh_pi_earnings_payout_requests
    WHERE id=p_request_id AND user_id=trim(p_user_id) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','REQUEST_NOT_FOUND'); END IF;
  IF v.status='paid' THEN RETURN jsonb_build_object('ok',true,'duplicate',true,'status','paid'); END IF;
  IF v.status IN ('released','failed') THEN RETURN jsonb_build_object('ok',false,'error','TERMINAL_REQUEST'); END IF;
  IF v.network<>'Pi Testnet' THEN RETURN jsonb_build_object('ok',false,'error','TESTNET_ONLY'); END IF;
  IF v.execution_lease_expires_at IS NOT NULL AND v.execution_lease_expires_at>now()
     AND v.execution_lease_token IS NOT NULL THEN
    RETURN jsonb_build_object('ok',false,'error','EXECUTION_BUSY','retryable',true);
  END IF;
  IF lane.lease_expires_at IS NOT NULL AND lane.lease_expires_at>now()
     AND (lane.lease_token IS DISTINCT FROM p_lease_token::text OR lane.payout_request_id IS DISTINCT FROM v_lane_request) THEN
    RETURN jsonb_build_object('ok',false,'error','PI_A2U_SEQUENCE_BUSY','retryable',true);
  END IF;
  UPDATE public.gh_pi_a2u_sequence_lease SET lease_token=p_lease_token::text,
    payout_request_id=v_lane_request,lease_expires_at=now()+interval '10 minutes',updated_at=now()
    WHERE singleton_id=1;
  UPDATE public.gh_pi_earnings_payout_requests SET status='processing',execution_lease_token=p_lease_token,
    execution_lease_expires_at=now()+interval '10 minutes',execution_started_at=COALESCE(execution_started_at,now()),
    execution_attempts=execution_attempts+1,updated_at=now() WHERE id=v.id;
  RETURN jsonb_build_object('ok',true,'requestId',v.id,'providerPaymentId',v.provider_payment_id,
    'recipientUid',v.recipient_pi_app_uid,'grossAtomic',v.gross_atomic,'netAtomic',v.net_atomic,
    'netPi',v.net_atomic::numeric/10000000,'network',v.network);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_pi_earnings_payout_heartbeat_execution(p_request_id uuid,p_lease_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE lane public.gh_pi_a2u_sequence_lease%ROWTYPE; v public.gh_pi_earnings_payout_requests%ROWTYPE;
BEGIN
  SELECT * INTO lane FROM public.gh_pi_a2u_sequence_lease WHERE singleton_id=1 FOR UPDATE;
  IF NOT FOUND OR lane.lease_token IS DISTINCT FROM p_lease_token::text
     OR lane.payout_request_id IS DISTINCT FROM ('earnings:'||p_request_id::text)
     OR lane.lease_expires_at IS NULL OR lane.lease_expires_at<=now() THEN
    RETURN jsonb_build_object('ok',false,'error','GLOBAL_EXECUTION_LEASE_LOST');
  END IF;
  SELECT * INTO v FROM public.gh_pi_earnings_payout_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND OR v.execution_lease_token IS DISTINCT FROM p_lease_token
     OR v.execution_lease_expires_at IS NULL OR v.execution_lease_expires_at<=now() OR v.status<>'processing' THEN
    RETURN jsonb_build_object('ok',false,'error','EXECUTION_LEASE_LOST');
  END IF;
  UPDATE public.gh_pi_earnings_payout_requests SET execution_lease_expires_at=now()+interval '10 minutes',updated_at=now() WHERE id=p_request_id;
  UPDATE public.gh_pi_a2u_sequence_lease SET lease_expires_at=now()+interval '10 minutes',updated_at=now() WHERE singleton_id=1;
  RETURN jsonb_build_object('ok',true);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_pi_earnings_payout_bind_provider_payment(p_request_id uuid,p_lease_token uuid,p_provider_payment_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE lane public.gh_pi_a2u_sequence_lease%ROWTYPE; v public.gh_pi_earnings_payout_requests%ROWTYPE;
BEGIN
  SELECT * INTO lane FROM public.gh_pi_a2u_sequence_lease WHERE singleton_id=1 FOR UPDATE;
  IF NOT FOUND OR lane.lease_token IS DISTINCT FROM p_lease_token::text
     OR lane.payout_request_id IS DISTINCT FROM ('earnings:'||p_request_id::text)
     OR lane.lease_expires_at IS NULL OR lane.lease_expires_at<=now() THEN
    RETURN jsonb_build_object('ok',false,'error','EXECUTION_LEASE_LOST');
  END IF;
  SELECT * INTO v FROM public.gh_pi_earnings_payout_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND OR v.execution_lease_token IS DISTINCT FROM p_lease_token
     OR v.execution_lease_expires_at IS NULL OR v.execution_lease_expires_at<=now() OR v.status<>'processing' THEN
    RETURN jsonb_build_object('ok',false,'error','EXECUTION_LEASE_LOST');
  END IF;
  IF p_provider_payment_id IS NULL OR length(p_provider_payment_id) NOT BETWEEN 1 AND 200 THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_PROVIDER_PAYMENT_ID');
  END IF;
  IF v.provider_payment_id IS NOT NULL AND v.provider_payment_id<>p_provider_payment_id THEN
    RETURN jsonb_build_object('ok',false,'error','PROVIDER_PAYMENT_CONFLICT');
  END IF;
  UPDATE public.gh_pi_earnings_payout_requests SET provider_payment_id=p_provider_payment_id,updated_at=now() WHERE id=v.id;
  UPDATE public.gh_pi_a2u_sequence_lease SET lease_expires_at=now()+interval '10 minutes',updated_at=now() WHERE singleton_id=1;
  RETURN jsonb_build_object('ok',true);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_pi_earnings_payout_end_execution(p_request_id uuid,p_lease_token uuid,p_uncertain boolean,p_failure_code text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE lane public.gh_pi_a2u_sequence_lease%ROWTYPE; v public.gh_pi_earnings_payout_requests%ROWTYPE;
BEGIN
  SELECT * INTO lane FROM public.gh_pi_a2u_sequence_lease WHERE singleton_id=1 FOR UPDATE;
  IF NOT FOUND OR lane.lease_token IS DISTINCT FROM p_lease_token::text
     OR lane.payout_request_id IS DISTINCT FROM ('earnings:'||p_request_id::text) THEN
    RETURN jsonb_build_object('ok',false,'error','EXECUTION_LEASE_LOST');
  END IF;
  SELECT * INTO v FROM public.gh_pi_earnings_payout_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND OR v.execution_lease_token IS DISTINCT FROM p_lease_token THEN
    RETURN jsonb_build_object('ok',false,'error','EXECUTION_LEASE_LOST');
  END IF;
  UPDATE public.gh_pi_earnings_payout_requests SET status=CASE WHEN p_uncertain THEN 'uncertain' ELSE status END,
    failure_code=CASE WHEN p_uncertain THEN left(COALESCE(p_failure_code,'PROVIDER_OUTCOME_UNKNOWN'),120) ELSE failure_code END,
    execution_lease_token=NULL,execution_lease_expires_at=NULL,updated_at=now() WHERE id=v.id;
  UPDATE public.gh_pi_a2u_sequence_lease SET lease_token=NULL,payout_request_id=NULL,lease_expires_at=NULL,updated_at=now()
    WHERE singleton_id=1 AND lease_token=p_lease_token::text AND payout_request_id='earnings:'||p_request_id::text;
  RETURN jsonb_build_object('ok',true,'reservationRetained',true);
END; $$;

REVOKE ALL ON FUNCTION public.gh_pi_earnings_payout_begin_execution(uuid,text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_earnings_payout_heartbeat_execution(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_earnings_payout_bind_provider_payment(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_earnings_payout_end_execution(uuid,uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_pi_earnings_payout_begin_execution(uuid,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_pi_earnings_payout_heartbeat_execution(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_pi_earnings_payout_bind_provider_payment(uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_pi_earnings_payout_end_execution(uuid,uuid,boolean,text) TO service_role;

COMMENT ON FUNCTION public.gh_pi_earnings_payout_begin_execution(uuid,text,uuid) IS
  'Phase 5 shared Pi A2U sequence lane: serializes general earnings with seller and cashback payouts using gh_pi_a2u_sequence_lease.';
