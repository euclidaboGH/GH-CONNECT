-- Phase 4 hardening: extend the worker lease and keep it alive during slow provider calls.
CREATE OR REPLACE FUNCTION public.gh_pi_earnings_payout_begin_execution(p_request_id uuid,p_user_id text,p_lease_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v public.gh_pi_earnings_payout_requests%ROWTYPE;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pi_earnings_worker_global',0));
  SELECT * INTO v FROM public.gh_pi_earnings_payout_requests WHERE id=p_request_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','REQUEST_NOT_FOUND'); END IF;
  IF v.status='paid' THEN RETURN jsonb_build_object('ok',true,'duplicate',true,'status','paid'); END IF;
  IF v.status IN ('released','failed') THEN RETURN jsonb_build_object('ok',false,'error','TERMINAL_REQUEST'); END IF;
  IF v.network<>'Pi Testnet' THEN RETURN jsonb_build_object('ok',false,'error','TESTNET_ONLY'); END IF;
  IF v.execution_lease_expires_at>now() AND v.execution_lease_token IS NOT NULL THEN
    RETURN jsonb_build_object('ok',false,'error','EXECUTION_BUSY');
  END IF;
  INSERT INTO public.gh_pi_a2u_execution_lane(lane_key,lease_token,request_id,expires_at)
    VALUES('global',p_lease_token,p_request_id,now()+interval '10 minutes')
    ON CONFLICT(lane_key) DO UPDATE SET lease_token=EXCLUDED.lease_token,request_id=EXCLUDED.request_id,expires_at=EXCLUDED.expires_at,updated_at=now()
    WHERE public.gh_pi_a2u_execution_lane.expires_at<=now();
  IF NOT EXISTS(SELECT 1 FROM public.gh_pi_a2u_execution_lane WHERE lane_key='global' AND lease_token=p_lease_token AND request_id=p_request_id) THEN
    RETURN jsonb_build_object('ok',false,'error','PI_A2U_GLOBAL_SEQUENCE_BUSY');
  END IF;
  UPDATE public.gh_pi_earnings_payout_requests SET status='processing',execution_lease_token=p_lease_token,
    execution_lease_expires_at=now()+interval '10 minutes',execution_started_at=COALESCE(execution_started_at,now()),
    execution_attempts=execution_attempts+1,updated_at=now() WHERE id=v.id;
  RETURN jsonb_build_object('ok',true,'requestId',v.id,'providerPaymentId',v.provider_payment_id,
    'recipientUid',v.recipient_pi_app_uid,'grossAtomic',v.gross_atomic,'netAtomic',v.net_atomic,
    'netPi',v.net_atomic::numeric/10000000,'network',v.network);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_pi_earnings_payout_heartbeat_execution(p_request_id uuid,p_lease_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  UPDATE public.gh_pi_earnings_payout_requests SET execution_lease_expires_at=now()+interval '10 minutes',updated_at=now()
    WHERE id=p_request_id AND execution_lease_token=p_lease_token AND execution_lease_expires_at>now()
      AND status='processing';
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','EXECUTION_LEASE_LOST'); END IF;
  UPDATE public.gh_pi_a2u_execution_lane SET expires_at=now()+interval '10 minutes',updated_at=now()
    WHERE lane_key='global' AND lease_token=p_lease_token AND request_id=p_request_id AND expires_at>now();
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','GLOBAL_EXECUTION_LEASE_LOST'); END IF;
  RETURN jsonb_build_object('ok',true);
END; $$;

REVOKE ALL ON FUNCTION public.gh_pi_earnings_payout_heartbeat_execution(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_pi_earnings_payout_heartbeat_execution(uuid,uuid) TO service_role;
