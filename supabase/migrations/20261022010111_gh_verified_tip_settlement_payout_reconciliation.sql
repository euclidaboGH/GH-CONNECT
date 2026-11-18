-- GH-CONNECT 0.61.7: provider-verified PI tip settlement and payout reconciliation.
-- Tip settlement records verified funds received and a creator payable; it does NOT
-- claim the creator has been paid. GHC wallet/issuance paths are unchanged.

ALTER TABLE public.gh_tip_intents ADD COLUMN IF NOT EXISTS payment_intent_id text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_tip_payment_intent
 ON public.gh_tip_intents(payment_intent_id) WHERE payment_intent_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.gh_tip_settlements (
  id text PRIMARY KEY,
  tip_intent_id text NOT NULL UNIQUE REFERENCES public.gh_tip_intents(id) ON DELETE RESTRICT,
  payment_intent_id text NOT NULL UNIQUE,
  tipper_id text NOT NULL,
  creator_id text NOT NULL,
  currency text NOT NULL CHECK(currency='PI'),
  gross_amount numeric(18,8) NOT NULL CHECK(gross_amount>0),
  provider_payment_id text NOT NULL UNIQUE,
  txid text NOT NULL,
  status text NOT NULL DEFAULT 'collected' CHECK(status IN ('collected','payable','paid','refunded','disputed')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  collected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(tipper_id<>creator_id)
);
CREATE INDEX IF NOT EXISTS idx_gh_tip_settlements_creator_status ON public.gh_tip_settlements(creator_id,status,collected_at DESC);
ALTER TABLE public.gh_tip_settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_tip_settlements_no_client ON public.gh_tip_settlements;
CREATE POLICY gh_tip_settlements_no_client ON public.gh_tip_settlements FOR ALL USING(false) WITH CHECK(false);

CREATE OR REPLACE FUNCTION public.gh_tip_intent_bind_payment_intent(p_tipper_id text,p_tip_intent_id text,p_payment_intent_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_tip public.gh_tip_intents%ROWTYPE;
BEGIN
 IF COALESCE(trim(p_tipper_id),'')='' OR COALESCE(trim(p_tip_intent_id),'')='' OR COALESCE(trim(p_payment_intent_id),'')='' THEN
  RETURN jsonb_build_object('ok',false,'error','INVALID_INPUT'); END IF;
 SELECT * INTO v_tip FROM public.gh_tip_intents WHERE id=trim(p_tip_intent_id) AND tipper_id=trim(p_tipper_id) FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','TIP_NOT_FOUND'); END IF;
 IF v_tip.currency<>'PI' OR v_tip.amount_units IS NULL OR v_tip.amount_units<=0 THEN
  RETURN jsonb_build_object('ok',false,'error','TIP_NOT_SETTLEABLE'); END IF;
 IF v_tip.status IN ('cancelled','failed') THEN RETURN jsonb_build_object('ok',false,'error','TIP_TERMINAL'); END IF;
 IF v_tip.payment_intent_id IS NOT NULL AND v_tip.payment_intent_id<>trim(p_payment_intent_id) THEN
  RETURN jsonb_build_object('ok',false,'error','PAYMENT_INTENT_ALREADY_BOUND'); END IF;
 UPDATE public.gh_tip_intents SET payment_intent_id=trim(p_payment_intent_id),status='awaiting_payment',updated_at=now() WHERE id=v_tip.id;
 RETURN jsonb_build_object('ok',true,'tipIntentId',v_tip.id,'paymentIntentId',trim(p_payment_intent_id));
END; $$;

-- Called only after the Pi server API has confirmed payment amount, transaction and completion.
-- Idempotent across retries; this records a creator payable, not a payout/disbursement.
CREATE OR REPLACE FUNCTION public.gh_tip_intent_get_for_tipper(p_tipper_id text,p_tip_intent_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_tip public.gh_tip_intents%ROWTYPE;
BEGIN
 SELECT * INTO v_tip FROM public.gh_tip_intents
  WHERE id=trim(COALESCE(p_tip_intent_id,'')) AND tipper_id=trim(COALESCE(p_tipper_id,''));
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','TIP_NOT_FOUND'); END IF;
 RETURN jsonb_build_object('ok',true,'intentId',v_tip.id,'status',v_tip.status,
   'currency',v_tip.currency,'amount',v_tip.amount_units,'paymentIntentId',v_tip.payment_intent_id,
   'recipientId',v_tip.recipient_id);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_tip_settle_verified(
 p_tip_intent_id text,p_tipper_id text,p_payment_intent_id text,
 p_provider_payment_id text,p_txid text,p_verified_amount numeric,p_provider_completed boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_tip public.gh_tip_intents%ROWTYPE; v_existing public.gh_tip_settlements%ROWTYPE; v_id text;
BEGIN
 IF COALESCE(trim(p_tip_intent_id),'')='' OR COALESCE(trim(p_tipper_id),'')='' OR
    COALESCE(trim(p_payment_intent_id),'')='' OR COALESCE(trim(p_provider_payment_id),'')='' OR
    COALESCE(trim(p_txid),'')='' OR p_provider_completed IS DISTINCT FROM true OR
    p_verified_amount IS NULL OR p_verified_amount<=0 THEN
  RETURN jsonb_build_object('ok',false,'error','VERIFIED_PAYMENT_REQUIRED'); END IF;
 SELECT * INTO v_tip FROM public.gh_tip_intents WHERE id=trim(p_tip_intent_id) FOR UPDATE;
 IF NOT FOUND OR v_tip.tipper_id<>trim(p_tipper_id) OR v_tip.payment_intent_id<>trim(p_payment_intent_id) THEN
  RETURN jsonb_build_object('ok',false,'error','TIP_BINDING_MISMATCH'); END IF;
 IF v_tip.currency<>'PI' OR v_tip.amount_units IS NULL OR v_tip.amount_units<>p_verified_amount THEN
  RETURN jsonb_build_object('ok',false,'error','TIP_AMOUNT_MISMATCH'); END IF;
 IF v_tip.tipper_id=v_tip.recipient_id OR v_tip.status IN ('cancelled','failed') THEN
  RETURN jsonb_build_object('ok',false,'error','TIP_NOT_SETTLEABLE'); END IF;
 SELECT * INTO v_existing FROM public.gh_tip_settlements WHERE tip_intent_id=v_tip.id;
 IF FOUND THEN
  IF v_existing.payment_intent_id<>trim(p_payment_intent_id) OR v_existing.provider_payment_id<>trim(p_provider_payment_id) OR v_existing.txid<>trim(p_txid) THEN
   RETURN jsonb_build_object('ok',false,'error','SETTLEMENT_CONFLICT'); END IF;
  RETURN jsonb_build_object('ok',true,'idempotent',true,'settlementId',v_existing.id,'status',v_existing.status,'creatorPaid',v_existing.status='paid');
 END IF;
 v_id := 'tips_'||replace(gen_random_uuid()::text,'-','');
 INSERT INTO public.gh_tip_settlements(id,tip_intent_id,payment_intent_id,tipper_id,creator_id,currency,gross_amount,provider_payment_id,txid,status,metadata)
 VALUES(v_id,v_tip.id,trim(p_payment_intent_id),v_tip.tipper_id,v_tip.recipient_id,'PI',p_verified_amount,trim(p_provider_payment_id),trim(p_txid),'payable',jsonb_build_object('provider','pi','verified',true));
 UPDATE public.gh_tip_intents SET status='settled',updated_at=now(),metadata=metadata||jsonb_build_object('settlementId',v_id,'settlementStatus','payable') WHERE id=v_tip.id;
 RETURN jsonb_build_object('ok',true,'idempotent',false,'settlementId',v_id,'status','payable','creatorPaid',false,'amount',p_verified_amount,'currency','PI');
EXCEPTION WHEN unique_violation THEN
 RETURN jsonb_build_object('ok',false,'error','PROVIDER_PAYMENT_ALREADY_USED');
END; $$;
REVOKE ALL ON FUNCTION public.gh_tip_intent_bind_payment_intent(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_tip_intent_bind_payment_intent(text,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.gh_tip_intent_get_for_tipper(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_tip_intent_get_for_tipper(text,text) TO service_role;
REVOKE ALL ON FUNCTION public.gh_tip_settle_verified(text,text,text,text,text,numeric,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_tip_settle_verified(text,text,text,text,text,numeric,boolean) TO service_role;

-- Provider-confirmed seller payout evidence. Only PI A2U is automated here; GHC and bank rails
-- remain pending until their own verified adapters/reconciliation are implemented.
CREATE TABLE IF NOT EXISTS public.gh_seller_payout_reconciliations (
 id text PRIMARY KEY,
 payout_request_id text NOT NULL UNIQUE REFERENCES public.gh_seller_payout_requests(id) ON DELETE RESTRICT,
 provider text NOT NULL CHECK(provider IN ('pi_a2u')),
 provider_payment_id text NOT NULL UNIQUE,
 txid text NOT NULL,
 currency text NOT NULL CHECK(currency='PI'),
 amount numeric(18,8) NOT NULL CHECK(amount>0),
 provider_status text NOT NULL CHECK(provider_status='developer_completed'),
 transaction_verified boolean NOT NULL CHECK(transaction_verified=true),
 evidence_hash text NOT NULL,
 status text NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed','reversed','disputed')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gh_seller_payout_reconciliations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_seller_payout_reconciliations_no_client ON public.gh_seller_payout_reconciliations;
CREATE POLICY gh_seller_payout_reconciliations_no_client ON public.gh_seller_payout_reconciliations FOR ALL USING(false) WITH CHECK(false);

CREATE OR REPLACE FUNCTION public.gh_seller_payout_record_pi_confirmation(
 p_request_id text,p_provider_payment_id text,p_txid text,p_currency text,p_amount numeric,
 p_provider_status text,p_transaction_verified boolean,p_evidence_hash text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_req public.gh_seller_payout_requests%ROWTYPE; v_existing public.gh_seller_payout_reconciliations%ROWTYPE; v_id text;
BEGIN
 IF COALESCE(trim(p_request_id),'')='' OR COALESCE(trim(p_provider_payment_id),'')='' OR COALESCE(trim(p_txid),'')='' OR
    upper(COALESCE(p_currency,''))<>'PI' OR p_amount IS NULL OR p_amount<=0 OR
    p_provider_status<>'developer_completed' OR p_transaction_verified IS DISTINCT FROM true OR
    COALESCE(trim(p_evidence_hash),'')='' THEN RETURN jsonb_build_object('ok',false,'error','VERIFIED_PI_PAYOUT_REQUIRED'); END IF;
 SELECT * INTO v_req FROM public.gh_seller_payout_requests WHERE id=trim(p_request_id) FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_NOT_FOUND'); END IF;
 IF v_req.currency<>'PI' OR v_req.amount<>p_amount THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_AMOUNT_CURRENCY_MISMATCH'); END IF;
 IF v_req.status NOT IN ('processing','paid') THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_NOT_PROCESSING'); END IF;
 SELECT * INTO v_existing FROM public.gh_seller_payout_reconciliations WHERE payout_request_id=v_req.id;
 IF FOUND THEN
  IF v_existing.provider_payment_id=trim(p_provider_payment_id) AND v_existing.txid=trim(p_txid) AND v_existing.amount=p_amount AND v_existing.status='confirmed' THEN
   RETURN jsonb_build_object('ok',true,'idempotent',true,'reconciliationId',v_existing.id,'status',v_existing.status);
  END IF;
  RETURN jsonb_build_object('ok',false,'error','PAYOUT_RECONCILIATION_CONFLICT');
 END IF;
 v_id:='sprc_'||replace(gen_random_uuid()::text,'-','');
 INSERT INTO public.gh_seller_payout_reconciliations(id,payout_request_id,provider,provider_payment_id,txid,currency,amount,provider_status,transaction_verified,evidence_hash,status)
 VALUES(v_id,v_req.id,'pi_a2u',trim(p_provider_payment_id),trim(p_txid),'PI',p_amount,'developer_completed',true,trim(p_evidence_hash),'confirmed');
 RETURN jsonb_build_object('ok',true,'idempotent',false,'reconciliationId',v_id,'status','confirmed');
EXCEPTION WHEN unique_violation THEN RETURN jsonb_build_object('ok',false,'error','PROVIDER_REFERENCE_ALREADY_USED');
END; $$;

-- Tighten the existing transition so a free-form payout reference can never mark a payout paid.
CREATE OR REPLACE FUNCTION public.gh_seller_payout_transition(p_request_id text,p_next_status text,p_operator_note text DEFAULT NULL,p_payout_reference text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_request public.gh_seller_payout_requests%ROWTYPE; v_recon public.gh_seller_payout_reconciliations%ROWTYPE;
BEGIN
 IF p_request_id IS NULL OR p_next_status IS NULL OR p_next_status NOT IN ('under_review','approved','processing','paid','rejected','failed','cancelled') THEN RETURN jsonb_build_object('ok',false,'error','INVALID_TRANSITION'); END IF;
 SELECT * INTO v_request FROM public.gh_seller_payout_requests WHERE id=trim(p_request_id) FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','NOT_FOUND'); END IF;
 IF v_request.status IN ('paid','rejected','failed','cancelled') THEN
  IF v_request.status='paid' AND p_next_status='paid' THEN RETURN jsonb_build_object('ok',true,'idempotent',true,'requestId',v_request.id,'status','paid','paid',true); END IF;
  RETURN jsonb_build_object('ok',false,'error','TERMINAL_STATUS'); END IF;
 IF p_next_status='under_review' AND v_request.status<>'requested' THEN RETURN jsonb_build_object('ok',false,'error','INVALID_TRANSITION'); END IF;
 IF p_next_status='approved' AND v_request.status NOT IN ('requested','under_review') THEN RETURN jsonb_build_object('ok',false,'error','INVALID_TRANSITION'); END IF;
 IF p_next_status='processing' AND v_request.status<>'approved' THEN RETURN jsonb_build_object('ok',false,'error','INVALID_TRANSITION'); END IF;
 IF p_next_status='paid' THEN
  SELECT * INTO v_recon FROM public.gh_seller_payout_reconciliations WHERE payout_request_id=v_request.id AND status='confirmed' FOR UPDATE;
  IF NOT FOUND OR v_recon.amount<>v_request.amount OR v_recon.currency<>v_request.currency OR v_recon.provider_payment_id<>trim(COALESCE(p_payout_reference,'')) THEN
   RETURN jsonb_build_object('ok',false,'error','VERIFIED_PAYOUT_RECONCILIATION_REQUIRED'); END IF;
  IF v_request.status<>'processing' THEN RETURN jsonb_build_object('ok',false,'error','INVALID_TRANSITION'); END IF;
 END IF;
 UPDATE public.gh_seller_payout_requests SET status=p_next_status,operator_note=NULLIF(left(trim(COALESCE(p_operator_note,'')),1000),''),payout_reference=CASE WHEN p_next_status='paid' THEN trim(p_payout_reference) ELSE payout_reference END,updated_at=now(),paid_at=CASE WHEN p_next_status='paid' THEN now() ELSE paid_at END WHERE id=v_request.id;
 IF p_next_status IN ('rejected','failed','cancelled') THEN DELETE FROM public.gh_seller_payout_allocations WHERE payout_request_id=v_request.id; END IF;
 RETURN jsonb_build_object('ok',true,'requestId',v_request.id,'status',p_next_status,'paid',p_next_status='paid');
END; $$;
REVOKE ALL ON FUNCTION public.gh_seller_payout_record_pi_confirmation(text,text,text,text,numeric,text,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_seller_payout_record_pi_confirmation(text,text,text,text,numeric,text,boolean,text) TO service_role;
REVOKE ALL ON FUNCTION public.gh_seller_payout_transition(text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_seller_payout_transition(text,text,text,text) TO service_role;

COMMENT ON TABLE public.gh_tip_settlements IS 'Provider-verified Pi tip receipts and creator payable liabilities. A payable row does not imply creator disbursement.';
COMMENT ON TABLE public.gh_seller_payout_reconciliations IS 'Immutable-ish provider evidence required before a seller payout may transition to paid.';
