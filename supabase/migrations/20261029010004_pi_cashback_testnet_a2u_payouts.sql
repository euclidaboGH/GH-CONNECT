-- REVIEW_REQUIRED: Testnet-only user cashback A2U. Validate on disposable PostgreSQL and Pi Testnet.
-- This migration creates a distinct cashback payout domain; it does not repurpose seller payout rows.
-- Live execution remains disabled unless server-side Testnet A2U credentials and flags are configured.

CREATE TABLE IF NOT EXISTS public.gh_pi_cashback_a2u_payouts (
  id text PRIMARY KEY CHECK (id ~ '^cbp_[a-f0-9]{32}$'),
  user_id text NOT NULL CHECK (length(trim(user_id)) BETWEEN 1 AND 160),
  entitlement_id uuid NOT NULL UNIQUE REFERENCES public.gh_pi_cashback_entitlements(id) ON DELETE RESTRICT,
  amount_atomic numeric(38,0) NOT NULL CHECK (amount_atomic > 0),
  amount_pi numeric(18,7) NOT NULL CHECK (amount_pi > 0),
  recipient_uid text NOT NULL CHECK (length(trim(recipient_uid)) BETWEEN 1 AND 160),
  network text NOT NULL DEFAULT 'Pi Testnet' CHECK (network = 'Pi Testnet'),
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','paid','attention')),
  execution_state text NOT NULL DEFAULT 'initiating' CHECK (execution_state IN ('initiating','created','submitted','completed','attention')),
  provider_payment_id text UNIQUE,
  txid text UNIQUE,
  last_error_code text,
  provider_evidence_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  CHECK (execution_state NOT IN ('created','submitted','completed') OR provider_payment_id IS NOT NULL),
  CHECK (execution_state NOT IN ('submitted','completed') OR txid IS NOT NULL),
  CHECK (status <> 'paid' OR (execution_state = 'completed' AND provider_payment_id IS NOT NULL AND txid IS NOT NULL AND paid_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_gh_pi_cashback_a2u_user_history
  ON public.gh_pi_cashback_a2u_payouts(user_id, created_at DESC);
ALTER TABLE public.gh_pi_cashback_a2u_payouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_pi_cashback_a2u_payouts_no_client ON public.gh_pi_cashback_a2u_payouts;
CREATE POLICY gh_pi_cashback_a2u_payouts_no_client ON public.gh_pi_cashback_a2u_payouts FOR ALL USING(false) WITH CHECK(false);
REVOKE ALL ON TABLE public.gh_pi_cashback_a2u_payouts FROM PUBLIC, anon, authenticated, service_role;

-- Serializes with seller A2U through the same global app-wallet sequence lease.
-- Chooses the oldest finalized, positive entitlement on the server; client never supplies amount or recipient.
CREATE OR REPLACE FUNCTION public.gh_pi_cashback_a2u_begin(
  p_user_id text, p_recipient_uid text, p_lease_token text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
  v_user text := NULLIF(trim(COALESCE(p_user_id,'')), '');
  v_uid text := NULLIF(trim(COALESCE(p_recipient_uid,'')), '');
  v_token text := NULLIF(trim(COALESCE(p_lease_token,'')), '');
  v_lease public.gh_pi_a2u_sequence_lease%ROWTYPE;
  v_payout public.gh_pi_cashback_a2u_payouts%ROWTYPE;
  v_entitlement public.gh_pi_cashback_entitlements%ROWTYPE;
  v_request_id text;
BEGIN
  IF v_user IS NULL OR length(v_user)>160 OR v_uid IS NULL OR length(v_uid)>160 OR v_token IS NULL THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_INPUT');
  END IF;
  SELECT * INTO v_lease FROM public.gh_pi_a2u_sequence_lease WHERE singleton_id=1 FOR UPDATE;
  IF v_lease.lease_expires_at IS NOT NULL AND v_lease.lease_expires_at>now() AND v_lease.lease_token IS DISTINCT FROM v_token THEN
    RETURN jsonb_build_object('ok',false,'error','PI_A2U_SEQUENCE_BUSY','retryable',true);
  END IF;
  SELECT * INTO v_payout FROM public.gh_pi_cashback_a2u_payouts
    WHERE user_id=v_user AND status='attention' ORDER BY created_at LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('ok',false,'error','CASHBACK_PAYOUT_REQUIRES_OPERATOR_REVIEW');
  END IF;
  SELECT * INTO v_payout FROM public.gh_pi_cashback_a2u_payouts
    WHERE user_id=v_user AND status='processing' ORDER BY created_at LIMIT 1 FOR UPDATE;
  IF FOUND THEN
    IF v_payout.recipient_uid<>v_uid THEN
      RETURN jsonb_build_object('ok',false,'error','CASHBACK_RECIPIENT_CHANGED_REQUIRES_REVIEW');
    END IF;
  ELSE
    SELECT e.* INTO v_entitlement
    FROM public.gh_pi_cashback_entitlements e
    JOIN public.gh_pi_cashback_periods p ON p.id=e.period_id
    WHERE e.user_id=v_user AND e.status='calculated' AND e.cashback_amount_atomic>0
      AND p.finalized_at <= now() AND p.ends_at <= now()
      AND NOT EXISTS (SELECT 1 FROM public.gh_pi_cashback_a2u_payouts x WHERE x.entitlement_id=e.id)
    ORDER BY p.ends_at, e.created_at
    LIMIT 1 FOR UPDATE OF e SKIP LOCKED;
    IF NOT FOUND THEN
      SELECT * INTO v_payout FROM public.gh_pi_cashback_a2u_payouts WHERE user_id=v_user AND status='paid' ORDER BY paid_at DESC LIMIT 1;
      IF FOUND THEN
        RETURN jsonb_build_object('ok',true,'alreadyPaid',true,'requestId',v_payout.id,'status',v_payout.status,
          'amountAtomic',v_payout.amount_atomic,'amount',v_payout.amount_pi,'providerPaymentId',v_payout.provider_payment_id,'txid',v_payout.txid);
      END IF;
      RETURN jsonb_build_object('ok',false,'error','NO_WITHDRAWABLE_CASHBACK');
    END IF;
    v_request_id := 'cbp_' || replace(gen_random_uuid()::text,'-','');
    INSERT INTO public.gh_pi_cashback_a2u_payouts(id,user_id,entitlement_id,amount_atomic,amount_pi,recipient_uid)
      VALUES(v_request_id,v_user,v_entitlement.id,v_entitlement.cashback_amount_atomic,
        (v_entitlement.cashback_amount_atomic::numeric / 10000000)::numeric(18,7),v_uid)
      RETURNING * INTO v_payout;
  END IF;
  UPDATE public.gh_pi_a2u_sequence_lease SET lease_token=v_token,payout_request_id=v_payout.id,
    lease_expires_at=now()+interval '5 minutes',updated_at=now() WHERE singleton_id=1;
  RETURN jsonb_build_object('ok',true,'alreadyPaid',false,'requestId',v_payout.id,'status',v_payout.status,
    'executionState',v_payout.execution_state,'providerPaymentId',v_payout.provider_payment_id,'txid',v_payout.txid,
    'recipientUid',v_payout.recipient_uid,'amountAtomic',v_payout.amount_atomic,'amount',v_payout.amount_pi,'network',v_payout.network);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_pi_cashback_a2u_update(
  p_request_id text,p_lease_token text,p_state text,p_payment_id text DEFAULT NULL,p_txid text DEFAULT NULL,p_error_code text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_lease public.gh_pi_a2u_sequence_lease%ROWTYPE; v_payout public.gh_pi_cashback_a2u_payouts%ROWTYPE;
BEGIN
  IF p_state NOT IN ('initiating','created','submitted','completed','attention') THEN RETURN jsonb_build_object('ok',false,'error','INVALID_STATE'); END IF;
  SELECT * INTO v_lease FROM public.gh_pi_a2u_sequence_lease WHERE singleton_id=1 FOR UPDATE;
  IF v_lease.lease_token IS DISTINCT FROM trim(p_lease_token) OR v_lease.payout_request_id IS DISTINCT FROM trim(p_request_id) OR v_lease.lease_expires_at<=now() THEN
    RETURN jsonb_build_object('ok',false,'error','PI_A2U_LEASE_LOST'); END IF;
  SELECT * INTO v_payout FROM public.gh_pi_cashback_a2u_payouts WHERE id=trim(p_request_id) FOR UPDATE;
  IF NOT FOUND OR v_payout.status<>'processing' THEN RETURN jsonb_build_object('ok',false,'error','CASHBACK_PAYOUT_NOT_PROCESSING'); END IF;
  IF v_payout.execution_state='attention' THEN RETURN jsonb_build_object('ok',false,'error','CASHBACK_PAYOUT_REQUIRES_OPERATOR_REVIEW'); END IF;
  IF (v_payout.execution_state='initiating' AND p_state NOT IN ('initiating','created','attention'))
    OR (v_payout.execution_state='created' AND p_state NOT IN ('created','submitted','completed','attention'))
    OR (v_payout.execution_state='submitted' AND p_state NOT IN ('submitted','completed','attention'))
    OR (v_payout.execution_state='completed' AND p_state<>'completed') THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_PAYOUT_STATE_TRANSITION');
  END IF;
  IF v_payout.provider_payment_id IS NOT NULL AND p_payment_id IS NOT NULL AND v_payout.provider_payment_id<>trim(p_payment_id) THEN RETURN jsonb_build_object('ok',false,'error','PAYMENT_ID_CONFLICT'); END IF;
  IF v_payout.txid IS NOT NULL AND p_txid IS NOT NULL AND v_payout.txid<>trim(p_txid) THEN RETURN jsonb_build_object('ok',false,'error','TXID_CONFLICT'); END IF;
  UPDATE public.gh_pi_cashback_a2u_payouts SET execution_state=p_state,
    status=CASE WHEN p_state='attention' THEN 'attention' ELSE status END,
    provider_payment_id=COALESCE(provider_payment_id,NULLIF(trim(COALESCE(p_payment_id,'')),'')),
    txid=COALESCE(txid,NULLIF(trim(COALESCE(p_txid,'')),'')),
    last_error_code=NULLIF(left(trim(COALESCE(p_error_code,'')),120),''),updated_at=now()
    WHERE id=trim(p_request_id) RETURNING * INTO v_payout;
  RETURN jsonb_build_object('ok',true,'state',v_payout.execution_state,'paymentId',v_payout.provider_payment_id,'txid',v_payout.txid);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_pi_cashback_a2u_settle(
  p_request_id text,p_payment_id text,p_txid text,p_evidence_hash text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_payout public.gh_pi_cashback_a2u_payouts%ROWTYPE;
BEGIN
  IF COALESCE(trim(p_evidence_hash),'') !~ '^[a-f0-9]{64}$' OR COALESCE(trim(p_payment_id),'')='' OR COALESCE(trim(p_txid),'')='' THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_PROVIDER_EVIDENCE'); END IF;
  SELECT * INTO v_payout FROM public.gh_pi_cashback_a2u_payouts WHERE id=trim(p_request_id) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','CASHBACK_PAYOUT_NOT_FOUND'); END IF;
  IF v_payout.status='paid' AND v_payout.provider_payment_id=trim(p_payment_id) AND v_payout.txid=trim(p_txid) THEN
    RETURN jsonb_build_object('ok',true,'duplicate',true,'paid',true,'requestId',v_payout.id); END IF;
  IF v_payout.status<>'processing' OR v_payout.execution_state<>'completed'
    OR v_payout.provider_payment_id IS DISTINCT FROM trim(p_payment_id) OR v_payout.txid IS DISTINCT FROM trim(p_txid) THEN
    RETURN jsonb_build_object('ok',false,'error','CASHBACK_PROVIDER_EVIDENCE_MISMATCH'); END IF;
  UPDATE public.gh_pi_cashback_a2u_payouts SET status='paid',paid_at=now(),updated_at=now(),
    last_error_code=NULL,provider_evidence_hash=trim(p_evidence_hash) WHERE id=trim(p_request_id);
  RETURN jsonb_build_object('ok',true,'duplicate',false,'paid',true,'requestId',trim(p_request_id),'evidenceHash',trim(p_evidence_hash));
END; $$;


CREATE OR REPLACE FUNCTION public.gh_pi_cashback_a2u_user_status(p_user_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
  v_user text := NULLIF(trim(COALESCE(p_user_id,'')), '');
  v_reserved numeric(38,0) := 0;
  v_review numeric(38,0) := 0;
  v_items jsonb := '[]'::jsonb;
BEGIN
  IF v_user IS NULL OR length(v_user)>160 THEN RETURN jsonb_build_object('ok',false,'error','INVALID_USER'); END IF;
  SELECT COALESCE(SUM(CASE WHEN status IN ('processing','paid','attention') THEN amount_atomic ELSE 0 END),0)::numeric(38,0),
         COALESCE(SUM(CASE WHEN status='attention' THEN amount_atomic ELSE 0 END),0)::numeric(38,0),
         COALESCE(jsonb_agg(jsonb_build_object(
           'entitlement_id',entitlement_id,'amount_atomic',amount_atomic::text,'status',status,
           'provider_payment_id',provider_payment_id,'txid',txid,'paid_at',paid_at,'created_at',created_at
         ) ORDER BY created_at DESC) FILTER (WHERE rn<=100),'[]'::jsonb)
  INTO v_reserved,v_review,v_items
  FROM (
    SELECT p.*,row_number() OVER (ORDER BY created_at DESC) AS rn
    FROM public.gh_pi_cashback_a2u_payouts p WHERE user_id=v_user
  ) q;
  RETURN jsonb_build_object('ok',true,'reservedAtomic',v_reserved::text,'reviewAtomic',v_review::text,'items',v_items);
END; $$;

REVOKE ALL ON FUNCTION public.gh_pi_cashback_a2u_user_status(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_pi_cashback_a2u_user_status(text) TO service_role;
REVOKE ALL ON FUNCTION public.gh_pi_cashback_a2u_begin(text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_cashback_a2u_update(text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_cashback_a2u_settle(text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_pi_cashback_a2u_begin(text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_pi_cashback_a2u_update(text,text,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_pi_cashback_a2u_settle(text,text,text,text) TO service_role;
COMMENT ON TABLE public.gh_pi_cashback_a2u_payouts IS 'Distinct Testnet-only A2U cashback payout ledger. Paid requires verified provider completion and exact payout binding; never a Mainnet authorization.';
