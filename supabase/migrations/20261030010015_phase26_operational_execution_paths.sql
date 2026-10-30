-- Phase 26 — Operational execution paths (REVIEW_REQUIRED)
-- Completes trusted server RPCs aligned to Phase 25 table schemas.
-- Canonical records remain sole authority. Journals are append-only.

-- Request-phase column (provider_status remains confirmed|failed only)
ALTER TABLE public.gh_marketplace_refund_operations
  ADD COLUMN IF NOT EXISTS operation_phase text NOT NULL DEFAULT 'confirmed'
  CHECK (operation_phase IN ('requested','processing','confirmed','failed'));

-- Allow payout_correction on adjustment ledger (append-only; not a history rewrite)
ALTER TABLE public.gh_marketplace_order_adjustments
  DROP CONSTRAINT IF EXISTS gh_marketplace_order_adjustments_adjustment_type_check;
ALTER TABLE public.gh_marketplace_order_adjustments
  ADD CONSTRAINT gh_marketplace_order_adjustments_adjustment_type_check
  CHECK (adjustment_type IN ('refund','chargeback','dispute_award','dispute_reversal','payout_correction'));

CREATE OR REPLACE FUNCTION public.gh_marketplace_begin_refund_request(
  p_order_id text, p_provider text, p_provider_payment_ref text,
  p_gross_amount numeric, p_seller_net_reduction numeric,
  p_evidence_fingerprint text, p_idempotency_key text,
  p_actor_id text DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE o public.gh_marketplace_orders%ROWTYPE; r public.gh_marketplace_refund_operations%ROWTYPE; v_currency text;
BEGIN
  IF coalesce(trim(p_order_id),'')='' OR p_provider NOT IN ('pi','ghc')
    OR coalesce(trim(p_provider_payment_ref),'')=''
    OR p_gross_amount IS NULL OR p_gross_amount<=0
    OR p_seller_net_reduction IS NULL OR p_seller_net_reduction<0 OR p_seller_net_reduction>p_gross_amount
    OR length(coalesce(trim(p_evidence_fingerprint),'')) NOT BETWEEN 16 AND 256
    OR length(coalesce(trim(p_idempotency_key),'')) NOT BETWEEN 8 AND 160
    OR jsonb_typeof(coalesce(p_metadata,'{}'::jsonb))<>'object'
  THEN RETURN jsonb_build_object('ok',false,'error','INVALID_REFUND_REQUEST'); END IF;

  SELECT * INTO o FROM public.gh_marketplace_orders WHERE id=trim(p_order_id) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','ORDER_NOT_FOUND'); END IF;
  v_currency:=upper(o.currency);

  SELECT * INTO r FROM public.gh_marketplace_refund_operations WHERE order_id=o.id AND idempotency_key=trim(p_idempotency_key);
  IF FOUND THEN
    RETURN jsonb_build_object('ok',true,'duplicate',true,'phase',r.operation_phase,'status',r.provider_status);
  END IF;

  -- provider_status='failed' placeholder until confirm path runs; phase=requested means NOT completed
  INSERT INTO public.gh_marketplace_refund_operations(
    order_id,currency,provider,provider_refund_id,provider_payment_ref,gross_amount,seller_net_reduction,
    provider_status,operation_phase,evidence_fingerprint,idempotency_key,actor_id,metadata
  ) VALUES (
    o.id,v_currency,p_provider,'pending:'||trim(p_idempotency_key),trim(p_provider_payment_ref),
    p_gross_amount,p_seller_net_reduction,'failed','requested',trim(p_evidence_fingerprint),trim(p_idempotency_key),
    coalesce(nullif(trim(p_actor_id),''),'service_role'),
    coalesce(p_metadata,'{}'::jsonb)||jsonb_build_object('phase','requested','notConfirmed',true)
  ) RETURNING * INTO r;

  RETURN jsonb_build_object('ok',true,'duplicate',false,'phase','requested','status','pending_provider',
    'message','Refund requested — not treated as completed until provider confirmation is recorded');
END; $$;
REVOKE ALL ON FUNCTION public.gh_marketplace_begin_refund_request(text,text,text,numeric,numeric,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_begin_refund_request(text,text,text,numeric,numeric,text,text,text,jsonb) TO service_role;

-- Dispute decision (schema: buyer_award|seller_award|partial_award|dismissed|appeal_*)
CREATE OR REPLACE FUNCTION public.gh_marketplace_record_dispute_decision(
  p_order_id text, p_case_ref text, p_decision text, p_reason_code text,
  p_approval_ref text, p_evidence_fingerprint text, p_idempotency_key text,
  p_actor_id text, p_currency text, p_buyer_amount numeric DEFAULT 0, p_seller_net_reduction numeric DEFAULT 0
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE o public.gh_marketplace_orders%ROWTYPE; d public.gh_marketplace_dispute_decisions%ROWTYPE;
BEGIN
  IF coalesce(trim(p_order_id),'')='' OR length(coalesce(trim(p_case_ref),'')) NOT BETWEEN 4 AND 160
    OR p_decision NOT IN ('buyer_award','seller_award','partial_award','dismissed','appeal_opened','appeal_decided')
    OR length(coalesce(trim(p_reason_code),'')) NOT BETWEEN 2 AND 64
    OR length(coalesce(trim(p_approval_ref),'')) NOT BETWEEN 4 AND 160
    OR length(coalesce(trim(p_evidence_fingerprint),'')) NOT BETWEEN 16 AND 256
    OR length(coalesce(trim(p_idempotency_key),'')) NOT BETWEEN 8 AND 160
    OR length(coalesce(trim(p_actor_id),'')) NOT BETWEEN 2 AND 160
    OR upper(coalesce(p_currency,'')) NOT IN ('PI','GHC')
    OR p_buyer_amount IS NULL OR p_buyer_amount<0 OR p_seller_net_reduction IS NULL OR p_seller_net_reduction<0
  THEN RETURN jsonb_build_object('ok',false,'error','INVALID_DISPUTE_DECISION'); END IF;

  SELECT * INTO o FROM public.gh_marketplace_orders WHERE id=trim(p_order_id) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','ORDER_NOT_FOUND'); END IF;

  SELECT * INTO d FROM public.gh_marketplace_dispute_decisions WHERE case_ref=trim(p_case_ref) AND idempotency_key=trim(p_idempotency_key);
  IF FOUND THEN
    IF d.decision<>p_decision OR d.evidence_fingerprint<>trim(p_evidence_fingerprint) THEN
      RETURN jsonb_build_object('ok',false,'error','IDEMPOTENCY_PAYLOAD_CONFLICT');
    END IF;
    RETURN jsonb_build_object('ok',true,'duplicate',true,'decisionId',d.id,'decision',d.decision);
  END IF;

  INSERT INTO public.gh_marketplace_dispute_decisions(
    order_id,case_ref,decision,reason_code,evidence_fingerprint,buyer_amount,seller_net_reduction,
    currency,actor_id,approval_ref,idempotency_key
  ) VALUES (
    o.id,trim(p_case_ref),p_decision,trim(p_reason_code),trim(p_evidence_fingerprint),
    p_buyer_amount,p_seller_net_reduction,upper(p_currency),trim(p_actor_id),trim(p_approval_ref),trim(p_idempotency_key)
  ) RETURNING * INTO d;

  UPDATE public.gh_marketplace_orders SET
    status = CASE WHEN p_decision IN ('buyer_award','partial_award') AND status NOT IN ('refunded') THEN 'disputed' ELSE status END,
    updated_at=now(),
    audit=coalesce(audit,'[]'::jsonb)||jsonb_build_array(jsonb_build_object(
      'action','DISPUTE_DECISION_RECORDED','decision',p_decision,'caseRef',p_case_ref,'approvalRef',p_approval_ref
    ))
  WHERE id=o.id;

  RETURN jsonb_build_object('ok',true,'duplicate',false,'decisionId',d.id,'decision',d.decision,
    'note','Decision recorded only — does not prove provider refund or payment execution');
END; $$;
REVOKE ALL ON FUNCTION public.gh_marketplace_record_dispute_decision(text,text,text,text,text,text,text,text,text,numeric,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_record_dispute_decision(text,text,text,text,text,text,text,text,text,numeric,numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.gh_marketplace_apply_dispute_adjustment(
  p_order_id text, p_decision_id bigint, p_gross_amount numeric, p_seller_net_reduction numeric,
  p_idempotency_key text, p_evidence_fingerprint text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE o public.gh_marketplace_orders%ROWTYPE; d public.gh_marketplace_dispute_decisions%ROWTYPE; a jsonb;
BEGIN
  IF coalesce(trim(p_order_id),'')='' OR p_decision_id IS NULL OR p_gross_amount IS NULL OR p_gross_amount<=0
    OR p_seller_net_reduction IS NULL OR p_seller_net_reduction<0 OR p_seller_net_reduction>p_gross_amount
    OR length(coalesce(trim(p_idempotency_key),'')) NOT BETWEEN 8 AND 160
    OR length(coalesce(trim(p_evidence_fingerprint),'')) NOT BETWEEN 16 AND 256
  THEN RETURN jsonb_build_object('ok',false,'error','INVALID_DISPUTE_ADJUSTMENT'); END IF;

  SELECT * INTO d FROM public.gh_marketplace_dispute_decisions WHERE id=p_decision_id AND order_id=trim(p_order_id);
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','DISPUTE_DECISION_NOT_FOUND'); END IF;
  IF d.decision NOT IN ('buyer_award','partial_award') THEN
    RETURN jsonb_build_object('ok',false,'error','DECISION_DOES_NOT_REQUIRE_ADJUSTMENT');
  END IF;

  SELECT * INTO o FROM public.gh_marketplace_orders WHERE id=trim(p_order_id) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','ORDER_NOT_FOUND'); END IF;

  a:=public.gh_marketplace_record_adjustment(
    o.id,'dispute_award',p_gross_amount,p_seller_net_reduction,
    'dispute:'||d.case_ref||':'||d.id::text,trim(p_idempotency_key),trim(p_evidence_fingerprint),
    jsonb_build_object('decisionId',d.id,'decision',d.decision,'notProviderRefund',true)
  );
  IF coalesce((a->>'ok')::boolean,false) IS NOT TRUE THEN RETURN a; END IF;
  RETURN jsonb_build_object('ok',true,'adjustmentId',a->>'adjustmentId','decisionId',d.id,
    'note','Adjustment recorded; provider refund still requires gh_marketplace_record_provider_refund');
END; $$;
REVOKE ALL ON FUNCTION public.gh_marketplace_apply_dispute_adjustment(text,bigint,numeric,numeric,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_apply_dispute_adjustment(text,bigint,numeric,numeric,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.gh_seller_payout_correction_record_approval(
  p_payout_request_id text, p_order_id text, p_currency text, p_correction_type text,
  p_amount numeric, p_approved_by text, p_approval_ref text,
  p_evidence_fingerprint text, p_idempotency_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE pr public.gh_seller_payout_requests%ROWTYPE; o public.gh_marketplace_orders%ROWTYPE; a public.gh_seller_payout_correction_approvals%ROWTYPE;
BEGIN
  IF coalesce(trim(p_payout_request_id),'')='' OR coalesce(trim(p_order_id),'')=''
    OR upper(coalesce(p_currency,'')) NOT IN ('PI','GHC')
    OR p_correction_type NOT IN ('release_reservation','settlement_evidence_correction','allocation_reversal')
    OR p_amount IS NULL OR p_amount<=0
    OR length(coalesce(trim(p_approved_by),'')) NOT BETWEEN 2 AND 160
    OR length(coalesce(trim(p_approval_ref),'')) NOT BETWEEN 4 AND 160
    OR length(coalesce(trim(p_evidence_fingerprint),'')) NOT BETWEEN 16 AND 256
    OR length(coalesce(trim(p_idempotency_key),'')) NOT BETWEEN 8 AND 160
  THEN RETURN jsonb_build_object('ok',false,'error','INVALID_CORRECTION_APPROVAL'); END IF;

  SELECT * INTO pr FROM public.gh_seller_payout_requests WHERE id=trim(p_payout_request_id) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_REQUEST_NOT_FOUND'); END IF;
  SELECT * INTO o FROM public.gh_marketplace_orders WHERE id=trim(p_order_id) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','ORDER_NOT_FOUND'); END IF;

  SELECT * INTO a FROM public.gh_seller_payout_correction_approvals
   WHERE payout_request_id=pr.id AND idempotency_key=trim(p_idempotency_key);
  IF FOUND THEN RETURN jsonb_build_object('ok',true,'duplicate',true,'approvalId',a.id); END IF;

  INSERT INTO public.gh_seller_payout_correction_approvals(
    payout_request_id,order_id,currency,correction_type,amount,evidence_fingerprint,approval_ref,approved_by,idempotency_key
  ) VALUES (
    pr.id,o.id,upper(p_currency),p_correction_type,p_amount,trim(p_evidence_fingerprint),
    trim(p_approval_ref),trim(p_approved_by),trim(p_idempotency_key)
  ) RETURNING * INTO a;

  RETURN jsonb_build_object('ok',true,'duplicate',false,'approvalId',a.id,
    'note','Approval recorded only — does not mutate historical payout allocations');
END; $$;
REVOKE ALL ON FUNCTION public.gh_seller_payout_correction_record_approval(text,text,text,text,numeric,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_seller_payout_correction_record_approval(text,text,text,text,numeric,text,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.gh_seller_payout_correction_apply(
  p_approval_id bigint, p_idempotency_key text, p_evidence_fingerprint text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.gh_seller_payout_correction_approvals%ROWTYPE; adj jsonb;
BEGIN
  IF p_approval_id IS NULL OR length(coalesce(trim(p_idempotency_key),'')) NOT BETWEEN 8 AND 160
    OR length(coalesce(trim(p_evidence_fingerprint),'')) NOT BETWEEN 16 AND 256
  THEN RETURN jsonb_build_object('ok',false,'error','INVALID_CORRECTION_APPLY'); END IF;

  SELECT * INTO a FROM public.gh_seller_payout_correction_approvals WHERE id=p_approval_id FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','APPROVAL_NOT_FOUND'); END IF;

  adj:=public.gh_marketplace_record_adjustment(
    a.order_id,'payout_correction',a.amount,
    CASE WHEN a.correction_type='allocation_reversal' THEN a.amount ELSE 0 END,
    'payout_correction:'||a.id::text,trim(p_idempotency_key),trim(p_evidence_fingerprint),
    jsonb_build_object('approvalId',a.id,'payoutRequestId',a.payout_request_id,'correctionType',a.correction_type)
  );
  IF coalesce((adj->>'ok')::boolean,false) IS NOT TRUE THEN RETURN adj; END IF;

  RETURN jsonb_build_object('ok',true,'adjustmentId',adj->>'adjustmentId','approvalId',a.id,
    'note','Correction applied as adjustment only; original payout allocation rows unchanged');
END; $$;
REVOKE ALL ON FUNCTION public.gh_seller_payout_correction_apply(bigint,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_seller_payout_correction_apply(bigint,text,text) TO service_role;

COMMENT ON FUNCTION public.gh_marketplace_begin_refund_request IS
  'Records a refund request phase only. Confirmed provider refunds must use gh_marketplace_record_provider_refund.';
COMMENT ON FUNCTION public.gh_marketplace_record_dispute_decision IS
  'Append-only dispute decision; does not prove provider settlement.';
COMMENT ON FUNCTION public.gh_marketplace_apply_dispute_adjustment IS
  'Links dispute decision to adjustment ledger without recording a provider refund.';
COMMENT ON FUNCTION public.gh_seller_payout_correction_record_approval IS
  'Approval evidence for historical payout correction; does not mutate allocations.';
COMMENT ON FUNCTION public.gh_seller_payout_correction_apply IS
  'Applies approved correction as append-only adjustment; never rewrites payout history.';
