-- Phase 4: dedicated general-earnings A2U execution lease and provider binding.
-- The provider call is always outside the database transaction. A lease only serializes workers.
CREATE TABLE IF NOT EXISTS public.gh_pi_a2u_execution_lane (
  lane_key text PRIMARY KEY CHECK (lane_key='global'),
  lease_token uuid NOT NULL, request_id uuid NOT NULL, expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gh_pi_a2u_execution_lane ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_pi_a2u_execution_lane_no_client ON public.gh_pi_a2u_execution_lane;
CREATE POLICY gh_pi_a2u_execution_lane_no_client ON public.gh_pi_a2u_execution_lane FOR ALL USING(false) WITH CHECK(false);
REVOKE ALL ON TABLE public.gh_pi_a2u_execution_lane FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE public.gh_pi_earnings_payout_requests
  ADD COLUMN IF NOT EXISTS execution_lease_token uuid,
  ADD COLUMN IF NOT EXISTS execution_lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS execution_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS execution_attempts integer NOT NULL DEFAULT 0 CHECK (execution_attempts >= 0);

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
    VALUES('global',p_lease_token,p_request_id,now()+interval '3 minutes')
    ON CONFLICT(lane_key) DO UPDATE SET lease_token=EXCLUDED.lease_token,request_id=EXCLUDED.request_id,expires_at=EXCLUDED.expires_at,updated_at=now()
    WHERE public.gh_pi_a2u_execution_lane.expires_at<=now();
  IF NOT EXISTS(SELECT 1 FROM public.gh_pi_a2u_execution_lane WHERE lane_key='global' AND lease_token=p_lease_token AND request_id=p_request_id) THEN
    RETURN jsonb_build_object('ok',false,'error','PI_A2U_GLOBAL_SEQUENCE_BUSY');
  END IF;
  UPDATE public.gh_pi_earnings_payout_requests SET status='processing',execution_lease_token=p_lease_token,
    execution_lease_expires_at=now()+interval '3 minutes',execution_started_at=COALESCE(execution_started_at,now()),
    execution_attempts=execution_attempts+1,updated_at=now() WHERE id=v.id;
  RETURN jsonb_build_object('ok',true,'requestId',v.id,'providerPaymentId',v.provider_payment_id,
    'recipientUid',v.recipient_pi_app_uid,'grossAtomic',v.gross_atomic,'netAtomic',v.net_atomic,
    'netPi',v.net_atomic::numeric/10000000,'network',v.network);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_pi_earnings_payout_bind_provider_payment(p_request_id uuid,p_lease_token uuid,p_provider_payment_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v public.gh_pi_earnings_payout_requests%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.gh_pi_earnings_payout_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND OR v.execution_lease_token IS DISTINCT FROM p_lease_token OR v.execution_lease_expires_at<now()
     OR NOT EXISTS(SELECT 1 FROM public.gh_pi_a2u_execution_lane WHERE lane_key='global' AND lease_token=p_lease_token AND request_id=p_request_id AND expires_at>now()) THEN
    RETURN jsonb_build_object('ok',false,'error','EXECUTION_LEASE_LOST');
  END IF;
  IF p_provider_payment_id IS NULL OR length(p_provider_payment_id) NOT BETWEEN 1 AND 200 THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_PROVIDER_PAYMENT_ID');
  END IF;
  IF v.provider_payment_id IS NOT NULL AND v.provider_payment_id<>p_provider_payment_id THEN
    RETURN jsonb_build_object('ok',false,'error','PROVIDER_PAYMENT_CONFLICT');
  END IF;
  UPDATE public.gh_pi_earnings_payout_requests SET provider_payment_id=p_provider_payment_id,updated_at=now() WHERE id=v.id;
  UPDATE public.gh_pi_a2u_execution_lane SET expires_at=now()+interval '3 minutes',updated_at=now() WHERE lane_key='global' AND lease_token=p_lease_token AND request_id=p_request_id;
  RETURN jsonb_build_object('ok',true);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_pi_earnings_payout_end_execution(p_request_id uuid,p_lease_token uuid,p_uncertain boolean,p_failure_code text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v public.gh_pi_earnings_payout_requests%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.gh_pi_earnings_payout_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND OR v.execution_lease_token IS DISTINCT FROM p_lease_token THEN RETURN jsonb_build_object('ok',false,'error','EXECUTION_LEASE_LOST'); END IF;
  UPDATE public.gh_pi_earnings_payout_requests SET status=CASE WHEN p_uncertain THEN 'uncertain' ELSE status END,
    failure_code=CASE WHEN p_uncertain THEN left(COALESCE(p_failure_code,'PROVIDER_OUTCOME_UNKNOWN'),120) ELSE failure_code END,
    execution_lease_token=NULL,execution_lease_expires_at=NULL,updated_at=now() WHERE id=v.id;
  DELETE FROM public.gh_pi_a2u_execution_lane WHERE lane_key='global' AND lease_token=p_lease_token AND request_id=p_request_id;
  RETURN jsonb_build_object('ok',true,'reservationRetained',true);
END; $$;

REVOKE ALL ON TABLE public.gh_pi_a2u_execution_lane FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.gh_pi_earnings_payout_begin_execution(uuid,text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_earnings_payout_bind_provider_payment(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_earnings_payout_end_execution(uuid,uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_pi_earnings_payout_begin_execution(uuid,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_pi_earnings_payout_bind_provider_payment(uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_pi_earnings_payout_end_execution(uuid,uuid,boolean,text) TO service_role;
