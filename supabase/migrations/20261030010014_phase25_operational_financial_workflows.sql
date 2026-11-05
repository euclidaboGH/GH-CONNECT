-- Phase 25: controlled operational workflow foundations.
-- REVIEW_REQUIRED. This is not a provider adapter and must not be applied until validated
-- against a disposable PostgreSQL instance and the existing provider verification paths.
-- Canonical orders, adjustments, payment intents, and membership entitlements remain authoritative.

CREATE TABLE IF NOT EXISTS public.gh_marketplace_refund_operations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id text NOT NULL REFERENCES public.gh_marketplace_orders(id) ON DELETE RESTRICT,
  currency text NOT NULL CHECK(currency IN ('PI','GHC')),
  provider text NOT NULL CHECK(provider IN ('pi','ghc')),
  provider_refund_id text NOT NULL,
  provider_payment_ref text NOT NULL,
  gross_amount numeric(18,8) NOT NULL CHECK(gross_amount > 0),
  seller_net_reduction numeric(18,8) NOT NULL CHECK(seller_net_reduction >= 0 AND seller_net_reduction <= gross_amount),
  provider_status text NOT NULL CHECK(provider_status IN ('confirmed','failed')),
  evidence_fingerprint text NOT NULL CHECK(length(evidence_fingerprint) BETWEEN 16 AND 256),
  adjustment_id bigint REFERENCES public.gh_marketplace_order_adjustments(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL,
  actor_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(metadata)='object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_refund_provider_ref_unique UNIQUE(provider,provider_refund_id),
  CONSTRAINT gh_refund_idempotency_unique UNIQUE(order_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_gh_refund_operations_order ON public.gh_marketplace_refund_operations(order_id,created_at DESC);
ALTER TABLE public.gh_marketplace_refund_operations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_marketplace_refund_operations_no_client ON public.gh_marketplace_refund_operations;
CREATE POLICY gh_marketplace_refund_operations_no_client ON public.gh_marketplace_refund_operations FOR ALL USING(false) WITH CHECK(false);
REVOKE ALL ON public.gh_marketplace_refund_operations FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE IF NOT EXISTS public.gh_marketplace_dispute_decisions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id text NOT NULL REFERENCES public.gh_marketplace_orders(id) ON DELETE RESTRICT,
  case_ref text NOT NULL,
  decision text NOT NULL CHECK(decision IN ('buyer_award','seller_award','partial_award','dismissed','appeal_opened','appeal_decided')),
  reason_code text NOT NULL,
  evidence_fingerprint text NOT NULL CHECK(length(evidence_fingerprint) BETWEEN 16 AND 256),
  buyer_amount numeric(18,8) NOT NULL DEFAULT 0 CHECK(buyer_amount>=0),
  seller_net_reduction numeric(18,8) NOT NULL DEFAULT 0 CHECK(seller_net_reduction>=0),
  currency text NOT NULL CHECK(currency IN ('PI','GHC')),
  actor_id text NOT NULL,
  approval_ref text NOT NULL,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_dispute_decision_idempotency UNIQUE(case_ref,idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_gh_dispute_decisions_order ON public.gh_marketplace_dispute_decisions(order_id,created_at DESC);
ALTER TABLE public.gh_marketplace_dispute_decisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_marketplace_dispute_decisions_no_client ON public.gh_marketplace_dispute_decisions;
CREATE POLICY gh_marketplace_dispute_decisions_no_client ON public.gh_marketplace_dispute_decisions FOR ALL USING(false) WITH CHECK(false);
REVOKE ALL ON public.gh_marketplace_dispute_decisions FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE IF NOT EXISTS public.gh_seller_payout_correction_approvals (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  payout_request_id text NOT NULL REFERENCES public.gh_seller_payout_requests(id) ON DELETE RESTRICT,
  order_id text NOT NULL REFERENCES public.gh_marketplace_orders(id) ON DELETE RESTRICT,
  currency text NOT NULL CHECK(currency IN ('PI','GHC')),
  correction_type text NOT NULL CHECK(correction_type IN ('release_reservation','settlement_evidence_correction','allocation_reversal')),
  amount numeric(18,8) NOT NULL CHECK(amount>0),
  evidence_fingerprint text NOT NULL CHECK(length(evidence_fingerprint) BETWEEN 16 AND 256),
  approval_ref text NOT NULL,
  approved_by text NOT NULL,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_payout_correction_idempotency UNIQUE(payout_request_id,idempotency_key)
);
ALTER TABLE public.gh_seller_payout_correction_approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_seller_payout_correction_approvals_no_client ON public.gh_seller_payout_correction_approvals;
CREATE POLICY gh_seller_payout_correction_approvals_no_client ON public.gh_seller_payout_correction_approvals FOR ALL USING(false) WITH CHECK(false);
REVOKE ALL ON public.gh_seller_payout_correction_approvals FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.gh_marketplace_record_provider_refund(
  p_order_id text,p_provider text,p_provider_refund_id text,p_provider_payment_ref text,
  p_gross_amount numeric,p_seller_net_reduction numeric,p_provider_status text,
  p_evidence_fingerprint text,p_idempotency_key text,p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE o public.gh_marketplace_orders%ROWTYPE; r public.gh_marketplace_refund_operations%ROWTYPE; a jsonb; v_adj_id bigint; v_currency text;
BEGIN
 IF coalesce(trim(p_order_id),'')='' OR p_provider NOT IN ('pi','ghc') OR coalesce(trim(p_provider_refund_id),'')='' OR coalesce(trim(p_provider_payment_ref),'')=''
   OR p_gross_amount IS NULL OR p_gross_amount<=0 OR p_seller_net_reduction IS NULL OR p_seller_net_reduction<0 OR p_seller_net_reduction>p_gross_amount
   OR p_provider_status NOT IN ('confirmed','failed') OR length(coalesce(trim(p_evidence_fingerprint),'')) NOT BETWEEN 16 AND 256
   OR length(coalesce(trim(p_idempotency_key),'')) NOT BETWEEN 8 AND 160 OR jsonb_typeof(coalesce(p_metadata,'{}'::jsonb))<>'object'
 THEN RETURN jsonb_build_object('ok',false,'error','INVALID_REFUND_EVIDENCE'); END IF;
 SELECT * INTO o FROM public.gh_marketplace_orders WHERE id=trim(p_order_id) FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','ORDER_NOT_FOUND'); END IF;
 v_currency:=upper(o.currency);
 IF (p_provider='pi' AND (v_currency<>'PI' OR o.payment_method<>'pi' OR coalesce(o.payment_id,o.txid,'')<>p_provider_payment_ref))
   OR (p_provider='ghc' AND (v_currency<>'GHC' OR o.payment_method<>'ghc' OR coalesce(o.ghc_spend_ref,'')<>p_provider_payment_ref))
 THEN RETURN jsonb_build_object('ok',false,'error','PROVIDER_PAYMENT_BINDING_MISMATCH'); END IF;
 SELECT * INTO r FROM public.gh_marketplace_refund_operations WHERE order_id=o.id AND idempotency_key=trim(p_idempotency_key);
 IF FOUND THEN
   IF r.provider_refund_id<>p_provider_refund_id OR r.evidence_fingerprint<>p_evidence_fingerprint OR r.gross_amount<>p_gross_amount OR r.provider_status<>p_provider_status THEN RETURN jsonb_build_object('ok',false,'error','IDEMPOTENCY_PAYLOAD_CONFLICT'); END IF;
   RETURN jsonb_build_object('ok',true,'duplicate',true,'status',r.provider_status,'adjustmentId',r.adjustment_id);
 END IF;
 IF p_provider_status='confirmed' THEN
   a:=public.gh_marketplace_record_adjustment(o.id,'refund',p_gross_amount,p_seller_net_reduction,'refund:'||p_provider||':'||trim(p_provider_refund_id),trim(p_idempotency_key),trim(p_evidence_fingerprint),coalesce(p_metadata,'{}'::jsonb)||jsonb_build_object('providerConfirmed',true,'provider',p_provider));
   IF coalesce((a->>'ok')::boolean,false) IS NOT TRUE THEN RETURN a; END IF;
   v_adj_id:=nullif(a->>'adjustmentId','')::bigint;
   UPDATE public.gh_marketplace_orders SET payment_status='refunded',status='refunded',updated_at=now(),audit=coalesce(audit,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('action','PROVIDER_REFUND_CONFIRMED','provider',p_provider,'providerRefundId',p_provider_refund_id)) WHERE id=o.id;
 END IF;
 INSERT INTO public.gh_marketplace_refund_operations(order_id,currency,provider,provider_refund_id,provider_payment_ref,gross_amount,seller_net_reduction,provider_status,evidence_fingerprint,adjustment_id,idempotency_key,actor_id,metadata)
 VALUES(o.id,v_currency,p_provider,trim(p_provider_refund_id),trim(p_provider_payment_ref),p_gross_amount,p_seller_net_reduction,p_provider_status,trim(p_evidence_fingerprint),v_adj_id,trim(p_idempotency_key),coalesce(current_setting('request.jwt.claim.sub',true),'service_role'),coalesce(p_metadata,'{}'::jsonb)) RETURNING * INTO r;
 RETURN jsonb_build_object('ok',true,'duplicate',false,'status',r.provider_status,'adjustmentId',r.adjustment_id,'orderId',o.id);
END; $$;
REVOKE ALL ON FUNCTION public.gh_marketplace_record_provider_refund(text,text,text,text,numeric,numeric,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_record_provider_refund(text,text,text,text,numeric,numeric,text,text,text,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.ghc_membership_renew_from_verified_intent(p_payment_intent_id text,p_evidence_fingerprint text,p_duration interval)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE i public.ghc_payment_intents%ROWTYPE; e public.ghc_membership_entitlements%ROWTYPE; v_start timestamptz; v_end timestamptz; v_tier text; v_period text; v_fp text;
BEGIN
 IF coalesce(trim(p_payment_intent_id),'')='' OR length(coalesce(trim(p_evidence_fingerprint),'')) NOT BETWEEN 16 AND 256 OR p_duration IS NULL OR p_duration<=interval '0' OR p_duration>interval '2 years'
 THEN RETURN jsonb_build_object('ok',false,'error','INVALID_RENEWAL_INPUT'); END IF;
 SELECT * INTO i FROM public.ghc_payment_intents WHERE id=trim(p_payment_intent_id) FOR UPDATE;
 IF NOT FOUND OR i.status NOT IN ('COMPLETED','FULFILLED') OR coalesce(i.completed_at,i.fulfilled_at) IS NULL
 THEN RETURN jsonb_build_object('ok',false,'error','VERIFIED_COMPLETED_PAYMENT_REQUIRED'); END IF;
 IF i.purpose<>'membership' AND lower(coalesce(i.metadata->>'productId','')) !~ '^membership_(vip|vvip)_(monthly|four_months|eight_months|yearly)$'
 THEN RETURN jsonb_build_object('ok',false,'error','NON_MEMBERSHIP_PAYMENT'); END IF;
 v_tier:=substring(lower(coalesce(i.metadata->>'productId','')) from '^membership_(vip|vvip)_');
 v_period:=substring(lower(coalesce(i.metadata->>'productId','')) from '^membership_(?:vip|vvip)_(monthly|four_months|eight_months|yearly)$');
 IF v_tier IS NULL OR v_period IS NULL OR coalesce(i.metadata->>'catalogPriceVerified','false')<>'true' OR coalesce(i.metadata->>'currencyVerified','false')<>'true'
 THEN RETURN jsonb_build_object('ok',false,'error','CANONICAL_CATALOG_VERIFICATION_REQUIRED'); END IF;
 v_fp:=md5(concat_ws('|',i.id,i.user_id,i.amount::text,upper(i.currency),p_evidence_fingerprint));
 IF EXISTS(SELECT 1 FROM public.ghc_membership_entitlement_events WHERE payment_intent_id=i.id AND event_fingerprint=v_fp) THEN
   SELECT * INTO e FROM public.ghc_membership_entitlements WHERE user_id=i.user_id;
   RETURN jsonb_build_object('ok',true,'duplicate',true,'entitlement',to_jsonb(e));
 END IF;
 PERFORM pg_advisory_xact_lock(hashtext(i.user_id),hashtext('membership-renewal'));
 SELECT * INTO e FROM public.ghc_membership_entitlements WHERE user_id=i.user_id FOR UPDATE;
 IF FOUND AND e.payment_intent_id=i.id THEN RETURN jsonb_build_object('ok',false,'error','PAYMENT_ALREADY_LINKED_TO_ENTITLEMENT'); END IF;
 v_start:=CASE WHEN FOUND AND e.active AND e.tier<>'free' AND e.expires_at>now() THEN e.expires_at ELSE now() END;
 v_end:=v_start+p_duration;
 INSERT INTO public.ghc_membership_entitlements(user_id,tier,active,started_at,expires_at,billing_period,source,purchase_ref,payment_intent_id,updated_at,audit)
 VALUES(i.user_id,v_tier,true,CASE WHEN v_start=now() THEN now() ELSE e.started_at END,v_end,v_period,'verified_payment',i.reference_id,i.id,now(),jsonb_build_array(jsonb_build_object('action','VERIFIED_MEMBERSHIP_RENEWAL','paymentIntentId',i.id,'evidenceFingerprint',p_evidence_fingerprint)))
 ON CONFLICT(user_id) DO UPDATE SET tier=excluded.tier,active=true,started_at=coalesce(ghc_membership_entitlements.started_at,excluded.started_at),expires_at=excluded.expires_at,billing_period=excluded.billing_period,source='verified_payment',purchase_ref=excluded.purchase_ref,payment_intent_id=excluded.payment_intent_id,updated_at=now(),audit=coalesce(ghc_membership_entitlements.audit,'[]'::jsonb)||excluded.audit;
 INSERT INTO public.ghc_membership_entitlement_events(user_id,event_type,tier,source,purchase_ref,payment_intent_id,started_at,expires_at,previous_expires_at,event_fingerprint)
 VALUES(i.user_id,CASE WHEN e.user_id IS NULL OR e.tier='free' THEN 'granted' ELSE 'renewed' END,v_tier,'verified_payment',i.reference_id,i.id,v_start,v_end,e.expires_at,v_fp)
 ON CONFLICT(event_fingerprint) DO NOTHING;
 SELECT * INTO e FROM public.ghc_membership_entitlements WHERE user_id=i.user_id;
 RETURN jsonb_build_object('ok',true,'duplicate',false,'entitlement',to_jsonb(e));
END; $$;
REVOKE ALL ON FUNCTION public.ghc_membership_renew_from_verified_intent(text,text,interval) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ghc_membership_renew_from_verified_intent(text,text,interval) TO service_role;

COMMENT ON TABLE public.gh_marketplace_refund_operations IS 'Immutable provider refund outcomes; a trusted provider adapter must verify evidence before invoking the recording RPC.';
COMMENT ON TABLE public.gh_marketplace_dispute_decisions IS 'Append-only dispute decision journal; decision records do not themselves prove provider settlement.';
COMMENT ON TABLE public.gh_seller_payout_correction_approvals IS 'Approval evidence for historical payout corrections; does not silently mutate existing payout allocations.';
COMMENT ON FUNCTION public.ghc_membership_renew_from_verified_intent(text,text,interval) IS 'Transactionally links a completed canonical payment intent to the canonical entitlement; catalog/currency verification flags must be set by the trusted verifier.';

CREATE OR REPLACE FUNCTION public.gh_operational_financial_journal_reject_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN RAISE EXCEPTION 'FINANCIAL_OPERATION_JOURNAL_IMMUTABLE' USING ERRCODE='55000'; END; $$;
REVOKE ALL ON FUNCTION public.gh_operational_financial_journal_reject_mutation() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS trg_gh_refund_operations_immutable ON public.gh_marketplace_refund_operations;
CREATE TRIGGER trg_gh_refund_operations_immutable BEFORE UPDATE OR DELETE ON public.gh_marketplace_refund_operations FOR EACH ROW EXECUTE FUNCTION public.gh_operational_financial_journal_reject_mutation();
DROP TRIGGER IF EXISTS trg_gh_dispute_decisions_immutable ON public.gh_marketplace_dispute_decisions;
CREATE TRIGGER trg_gh_dispute_decisions_immutable BEFORE UPDATE OR DELETE ON public.gh_marketplace_dispute_decisions FOR EACH ROW EXECUTE FUNCTION public.gh_operational_financial_journal_reject_mutation();
DROP TRIGGER IF EXISTS trg_gh_payout_correction_approvals_immutable ON public.gh_seller_payout_correction_approvals;
CREATE TRIGGER trg_gh_payout_correction_approvals_immutable BEFORE UPDATE OR DELETE ON public.gh_seller_payout_correction_approvals FOR EACH ROW EXECUTE FUNCTION public.gh_operational_financial_journal_reject_mutation();
