-- Phase 20: durable, globally serialized Pi A2U execution orchestration.
-- Apply only after comparing the target database migration history. A2U is Testnet-only.
CREATE TABLE IF NOT EXISTS public.gh_pi_a2u_executions (
  id text PRIMARY KEY,
  payout_request_id text NOT NULL UNIQUE REFERENCES public.gh_seller_payout_requests(id) ON DELETE RESTRICT,
  seller_id text NOT NULL,
  recipient_uid text NOT NULL,
  amount numeric(18,8) NOT NULL CHECK (amount > 0),
  network text NOT NULL CHECK (network = 'Pi Testnet'),
  state text NOT NULL DEFAULT 'initiating' CHECK (state IN ('initiating','created','submitted','completed','attention')),
  provider_payment_id text UNIQUE,
  txid text UNIQUE,
  last_error_code text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (state NOT IN ('created','submitted','completed') OR provider_payment_id IS NOT NULL),
  CHECK (state NOT IN ('submitted','completed') OR txid IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_gh_pi_a2u_execution_state ON public.gh_pi_a2u_executions(state, updated_at);
ALTER TABLE public.gh_pi_a2u_executions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_pi_a2u_executions_no_client ON public.gh_pi_a2u_executions;
CREATE POLICY gh_pi_a2u_executions_no_client ON public.gh_pi_a2u_executions FOR ALL USING(false) WITH CHECK(false);

CREATE TABLE IF NOT EXISTS public.gh_pi_a2u_sequence_lease (
  singleton_id smallint PRIMARY KEY CHECK(singleton_id=1),
  lease_token text,
  payout_request_id text,
  lease_expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.gh_pi_a2u_sequence_lease(singleton_id) VALUES(1) ON CONFLICT(singleton_id) DO NOTHING;
ALTER TABLE public.gh_pi_a2u_sequence_lease ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_pi_a2u_sequence_lease_no_client ON public.gh_pi_a2u_sequence_lease;
CREATE POLICY gh_pi_a2u_sequence_lease_no_client ON public.gh_pi_a2u_sequence_lease FOR ALL USING(false) WITH CHECK(false);

CREATE OR REPLACE FUNCTION public.gh_pi_a2u_begin_execution(
 p_request_id text,p_lease_token text,p_recipient_uid text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_req public.gh_seller_payout_requests%ROWTYPE; v_exec public.gh_pi_a2u_executions%ROWTYPE; v_lease public.gh_pi_a2u_sequence_lease%ROWTYPE;
BEGIN
 IF COALESCE(trim(p_request_id),'') !~ '^spr_[a-f0-9]{16,40}$' OR COALESCE(trim(p_lease_token),'')='' OR COALESCE(trim(p_recipient_uid),'')='' THEN
  RETURN jsonb_build_object('ok',false,'error','INVALID_INPUT'); END IF;
 SELECT * INTO v_req FROM public.gh_seller_payout_requests WHERE id=trim(p_request_id) FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_NOT_FOUND'); END IF;
 IF v_req.currency<>'PI' OR v_req.status<>'processing' THEN RETURN jsonb_build_object('ok',false,'error','PI_PAYOUT_MUST_BE_PROCESSING'); END IF;
 -- First perform a non-locking preflight so known attention/binding failures never acquire a lease.
 -- All locking RPC paths then use lease -> execution lock order to avoid retry deadlocks.
 SELECT * INTO v_exec FROM public.gh_pi_a2u_executions WHERE payout_request_id=v_req.id;
 IF FOUND AND (v_exec.seller_id<>v_req.seller_id OR v_exec.amount<>v_req.amount OR v_exec.recipient_uid<>trim(p_recipient_uid)) THEN
  RETURN jsonb_build_object('ok',false,'error','PI_A2U_EXECUTION_BINDING_CONFLICT'); END IF;
 IF FOUND AND v_exec.state='attention' THEN RETURN jsonb_build_object('ok',false,'error','PI_A2U_REQUIRES_OPERATOR_REVIEW','executionId',v_exec.id); END IF;
 SELECT * INTO v_lease FROM public.gh_pi_a2u_sequence_lease WHERE singleton_id=1 FOR UPDATE;
 IF v_lease.lease_expires_at IS NOT NULL AND v_lease.lease_expires_at>now() AND v_lease.lease_token IS DISTINCT FROM trim(p_lease_token) THEN
  RETURN jsonb_build_object('ok',false,'error','PI_A2U_SEQUENCE_BUSY','retryable',true); END IF;
 SELECT * INTO v_exec FROM public.gh_pi_a2u_executions WHERE payout_request_id=v_req.id FOR UPDATE;
 IF FOUND THEN
  IF v_exec.seller_id<>v_req.seller_id OR v_exec.amount<>v_req.amount OR v_exec.recipient_uid<>trim(p_recipient_uid) THEN
   RETURN jsonb_build_object('ok',false,'error','PI_A2U_EXECUTION_BINDING_CONFLICT'); END IF;
  IF v_exec.state='attention' THEN RETURN jsonb_build_object('ok',false,'error','PI_A2U_REQUIRES_OPERATOR_REVIEW','executionId',v_exec.id); END IF;
 END IF;
 UPDATE public.gh_pi_a2u_sequence_lease SET lease_token=trim(p_lease_token),payout_request_id=v_req.id,lease_expires_at=now()+interval '5 minutes',updated_at=now() WHERE singleton_id=1;
 IF v_exec.id IS NOT NULL THEN
  RETURN jsonb_build_object('ok',true,'duplicate',true,'executionId',v_exec.id,'state',v_exec.state,'paymentId',v_exec.provider_payment_id,'txid',v_exec.txid,'sellerId',v_exec.seller_id,'recipientUid',v_exec.recipient_uid,'amount',v_exec.amount,'network',v_exec.network);
 END IF;
 INSERT INTO public.gh_pi_a2u_executions(id,payout_request_id,seller_id,recipient_uid,amount,network,state)
 VALUES('pia2u_'||replace(gen_random_uuid()::text,'-',''),v_req.id,v_req.seller_id,trim(p_recipient_uid),v_req.amount,'Pi Testnet','initiating') RETURNING * INTO v_exec;
 RETURN jsonb_build_object('ok',true,'duplicate',false,'executionId',v_exec.id,'state',v_exec.state,'paymentId',NULL,'txid',NULL,'sellerId',v_exec.seller_id,'recipientUid',v_exec.recipient_uid,'amount',v_exec.amount,'network',v_exec.network);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_pi_a2u_update_execution(
 p_request_id text,p_lease_token text,p_state text,p_payment_id text DEFAULT NULL,p_txid text DEFAULT NULL,p_error_code text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_exec public.gh_pi_a2u_executions%ROWTYPE; v_lease public.gh_pi_a2u_sequence_lease%ROWTYPE;
BEGIN
 IF p_state NOT IN ('initiating','created','submitted','completed','attention') THEN RETURN jsonb_build_object('ok',false,'error','INVALID_STATE'); END IF;
 SELECT * INTO v_lease FROM public.gh_pi_a2u_sequence_lease WHERE singleton_id=1 FOR UPDATE;
 IF v_lease.lease_token IS DISTINCT FROM trim(p_lease_token) OR v_lease.payout_request_id IS DISTINCT FROM trim(p_request_id) OR v_lease.lease_expires_at<=now() THEN
  RETURN jsonb_build_object('ok',false,'error','PI_A2U_LEASE_LOST'); END IF;
 SELECT * INTO v_exec FROM public.gh_pi_a2u_executions WHERE payout_request_id=trim(p_request_id) FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','EXECUTION_NOT_FOUND'); END IF;
 IF v_exec.state='completed' AND p_state<>'completed' THEN RETURN jsonb_build_object('ok',false,'error','EXECUTION_ALREADY_COMPLETED'); END IF;
 IF v_exec.provider_payment_id IS NOT NULL AND p_payment_id IS NOT NULL AND v_exec.provider_payment_id<>trim(p_payment_id) THEN RETURN jsonb_build_object('ok',false,'error','PAYMENT_ID_CONFLICT'); END IF;
 IF v_exec.txid IS NOT NULL AND p_txid IS NOT NULL AND v_exec.txid<>trim(p_txid) THEN RETURN jsonb_build_object('ok',false,'error','TXID_CONFLICT'); END IF;
 UPDATE public.gh_pi_a2u_executions SET state=p_state,provider_payment_id=COALESCE(provider_payment_id,NULLIF(trim(COALESCE(p_payment_id,'')),'')),txid=COALESCE(txid,NULLIF(trim(COALESCE(p_txid,'')),'')),last_error_code=NULLIF(left(trim(COALESCE(p_error_code,'')),120),''),updated_at=now() WHERE payout_request_id=trim(p_request_id) RETURNING * INTO v_exec;
 RETURN jsonb_build_object('ok',true,'state',v_exec.state,'paymentId',v_exec.provider_payment_id,'txid',v_exec.txid,'executionId',v_exec.id);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_pi_a2u_release_sequence_lease(p_lease_token text,p_request_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.gh_pi_a2u_sequence_lease SET lease_token=NULL,payout_request_id=NULL,lease_expires_at=NULL,updated_at=now()
 WHERE singleton_id=1 AND lease_token=trim(p_lease_token) AND payout_request_id=trim(p_request_id);
 RETURN jsonb_build_object('ok',true,'released',FOUND);
END; $$;

REVOKE ALL ON FUNCTION public.gh_pi_a2u_begin_execution(text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_a2u_update_execution(text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_a2u_release_sequence_lease(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_pi_a2u_begin_execution(text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_pi_a2u_update_execution(text,text,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_pi_a2u_release_sequence_lease(text,text) TO service_role;
COMMENT ON TABLE public.gh_pi_a2u_executions IS 'Durable idempotent Pi Testnet A2U execution ledger. A payout is not paid until provider evidence is reconciled.';
COMMENT ON TABLE public.gh_pi_a2u_sequence_lease IS 'Global expiring lease serializing A2U submissions because the Pi app wallet sequence number permits one payment at a time.';
