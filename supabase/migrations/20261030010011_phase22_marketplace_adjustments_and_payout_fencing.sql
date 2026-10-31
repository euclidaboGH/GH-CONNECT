-- Phase 22: canonical, append-only marketplace financial adjustments and payout fencing.
-- REVIEW_REQUIRED. Does not call PI/GHC providers or execute external refunds/chargebacks.
-- A trusted server must verify provider evidence before invoking the service-role RPC.

CREATE TABLE IF NOT EXISTS public.gh_marketplace_order_adjustments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id text NOT NULL REFERENCES public.gh_marketplace_orders(id) ON DELETE RESTRICT,
  seller_id text NOT NULL,
  buyer_id text NOT NULL,
  currency text NOT NULL CHECK (currency IN ('PI','GHC')),
  adjustment_type text NOT NULL CHECK (adjustment_type IN ('refund','chargeback','dispute_award','dispute_reversal')),
  gross_amount numeric(18,8) NOT NULL CHECK (gross_amount > 0),
  seller_net_reduction numeric(18,8) NOT NULL CHECK (seller_net_reduction >= 0),
  external_reference text NOT NULL,
  idempotency_key text NOT NULL,
  evidence_fingerprint text NOT NULL,
  actor_id text,
  actor_source text NOT NULL CHECK (actor_source IN ('authenticated_claim','service_context','unknown')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata)='object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_marketplace_adjustment_idempotency UNIQUE(order_id,idempotency_key),
  CONSTRAINT gh_marketplace_adjustment_external_ref UNIQUE(currency,external_reference),
  CONSTRAINT gh_marketplace_adjustment_net_le_gross CHECK (seller_net_reduction <= gross_amount)
);
CREATE INDEX IF NOT EXISTS idx_gh_marketplace_adjustments_order ON public.gh_marketplace_order_adjustments(order_id,created_at,id);
CREATE INDEX IF NOT EXISTS idx_gh_marketplace_adjustments_seller_currency ON public.gh_marketplace_order_adjustments(seller_id,currency,created_at);
ALTER TABLE public.gh_marketplace_order_adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_marketplace_order_adjustments_no_client ON public.gh_marketplace_order_adjustments;
CREATE POLICY gh_marketplace_order_adjustments_no_client ON public.gh_marketplace_order_adjustments FOR ALL USING(false) WITH CHECK(false);

CREATE OR REPLACE FUNCTION public.gh_marketplace_adjustment_reject_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN RAISE EXCEPTION 'MARKETPLACE_ADJUSTMENT_IMMUTABLE'; END; $$;
REVOKE ALL ON FUNCTION public.gh_marketplace_adjustment_reject_mutation() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_gh_marketplace_adjustment_immutable ON public.gh_marketplace_order_adjustments;
CREATE TRIGGER trg_gh_marketplace_adjustment_immutable BEFORE UPDATE OR DELETE ON public.gh_marketplace_order_adjustments
FOR EACH ROW EXECUTE FUNCTION public.gh_marketplace_adjustment_reject_mutation();

-- Called only after a server-side provider/refund/dispute decision has been verified.
-- Amounts are explicit because gross refund and seller-net clawback can differ by contract.
CREATE OR REPLACE FUNCTION public.gh_marketplace_record_adjustment(
  p_order_id text,p_type text,p_gross_amount numeric,p_seller_net_reduction numeric,
  p_external_reference text,p_idempotency_key text,p_evidence_fingerprint text,p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order public.gh_marketplace_orders%ROWTYPE; v_existing public.gh_marketplace_order_adjustments%ROWTYPE;
        v_prior_gross numeric(18,8); v_prior_net numeric(18,8); v_actor text; v_source text;
BEGIN
  IF COALESCE(trim(p_order_id),'')='' OR COALESCE(p_type,'') NOT IN ('refund','chargeback','dispute_award','dispute_reversal')
    OR p_gross_amount IS NULL OR p_gross_amount<=0 OR p_seller_net_reduction IS NULL OR p_seller_net_reduction<0
    OR p_seller_net_reduction>p_gross_amount OR COALESCE(trim(p_external_reference),'')=''
    OR length(COALESCE(trim(p_idempotency_key),'')) NOT BETWEEN 8 AND 160 OR length(COALESCE(trim(p_external_reference),''))=0
    OR length(COALESCE(trim(p_evidence_fingerprint),'')) NOT BETWEEN 16 AND 256
    OR p_metadata IS NULL OR jsonb_typeof(p_metadata)<>'object' THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_ADJUSTMENT_INPUT');
  END IF;
  SELECT * INTO v_order FROM public.gh_marketplace_orders WHERE id=trim(p_order_id) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','ORDER_NOT_FOUND'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext(v_order.seller_id),hashtext('seller-payout:'||upper(v_order.currency)));
  SELECT * INTO v_existing FROM public.gh_marketplace_order_adjustments
   WHERE order_id=v_order.id AND idempotency_key=trim(p_idempotency_key);
  IF FOUND THEN
    IF v_existing.adjustment_type<>p_type OR v_existing.gross_amount<>p_gross_amount OR v_existing.seller_net_reduction<>p_seller_net_reduction
      OR v_existing.external_reference<>trim(p_external_reference) OR v_existing.evidence_fingerprint<>trim(p_evidence_fingerprint) THEN
      RETURN jsonb_build_object('ok',false,'error','IDEMPOTENCY_PAYLOAD_CONFLICT');
    END IF;
    RETURN jsonb_build_object('ok',true,'duplicate',true,'adjustmentId',v_existing.id,'orderId',v_order.id);
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.gh_marketplace_order_proceeds p WHERE p.order_id=v_order.id
    AND p.seller_id=v_order.seller_id AND p.buyer_id=v_order.buyer_id AND p.currency=upper(v_order.currency)) THEN
    RETURN jsonb_build_object('ok',false,'error','VERIFIED_PROCEEDS_SNAPSHOT_REQUIRED');
  END IF;
  IF EXISTS(SELECT 1 FROM public.gh_seller_payout_allocations a WHERE a.order_id=v_order.id) THEN
    RETURN jsonb_build_object('ok',false,'error','PAYOUT_ALREADY_RESERVED_RECONCILIATION_REQUIRED');
  END IF;
  SELECT COALESCE(sum(gross_amount),0),COALESCE(sum(seller_net_reduction),0)
    INTO v_prior_gross,v_prior_net FROM public.gh_marketplace_order_adjustments WHERE order_id=v_order.id;
  IF v_prior_gross+p_gross_amount > v_order.total_amount THEN
    RETURN jsonb_build_object('ok',false,'error','GROSS_ADJUSTMENT_EXCEEDS_ORDER_VALUE');
  END IF;
  IF EXISTS(SELECT 1 FROM public.gh_marketplace_order_proceeds p WHERE p.order_id=v_order.id AND v_prior_net+p_seller_net_reduction>p.seller_net) THEN
    RETURN jsonb_build_object('ok',false,'error','SELLER_NET_ADJUSTMENT_EXCEEDS_PROCEEDS');
  END IF;
  v_actor:=NULLIF(current_setting('request.jwt.claim.sub',true),'');
  IF v_actor IS NOT NULL THEN v_source:='authenticated_claim';
  ELSIF current_user='service_role' OR session_user='service_role' THEN v_actor:='service_role'; v_source:='service_context';
  ELSE v_source:='unknown'; END IF;
  INSERT INTO public.gh_marketplace_order_adjustments(order_id,seller_id,buyer_id,currency,adjustment_type,gross_amount,
    seller_net_reduction,external_reference,idempotency_key,evidence_fingerprint,actor_id,actor_source,metadata)
  VALUES(v_order.id,v_order.seller_id,v_order.buyer_id,upper(v_order.currency),p_type,p_gross_amount,p_seller_net_reduction,
    trim(p_external_reference),trim(p_idempotency_key),trim(p_evidence_fingerprint),v_actor,v_source,p_metadata)
  RETURNING * INTO v_existing;
  RETURN jsonb_build_object('ok',true,'duplicate',false,'adjustmentId',v_existing.id,'orderId',v_order.id,
    'grossAdjusted',v_existing.gross_amount,'sellerNetReduced',v_existing.seller_net_reduction,'currency',v_existing.currency,
    'providerRefundExecuted',false,'externalSettlementRequired',true);
END; $$;
REVOKE ALL ON FUNCTION public.gh_marketplace_record_adjustment(text,text,numeric,numeric,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_record_adjustment(text,text,numeric,numeric,text,text,text,jsonb) TO service_role;

-- A single lock namespace serializes order lifecycle changes, adjustments and seller payout reservations.
CREATE OR REPLACE FUNCTION public.gh_marketplace_lock_order_finance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.seller_id),hashtext('seller-payout:'||upper(NEW.currency)));
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.gh_marketplace_lock_order_finance() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_gh_marketplace_order_finance_lock ON public.gh_marketplace_orders;
CREATE TRIGGER trg_gh_marketplace_order_finance_lock BEFORE UPDATE OF status,payment_status,escrow_status ON public.gh_marketplace_orders
FOR EACH ROW EXECUTE FUNCTION public.gh_marketplace_lock_order_finance();

-- Replace Phase 20 request RPC: lock seller lane and candidate orders, then reserve adjusted net only.
CREATE OR REPLACE FUNCTION public.gh_seller_payout_request(p_seller_id text,p_currency text,p_amount numeric,p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id text; v_existing public.gh_seller_payout_requests%ROWTYPE; v_eligible numeric(18,8); v_allocated integer;
BEGIN
 IF p_seller_id IS NULL OR length(trim(p_seller_id))=0 OR p_currency IS NULL OR upper(p_currency) NOT IN ('GHC','PI')
   OR p_amount IS NULL OR p_amount<=0 OR p_amount>100000000 OR p_idempotency_key IS NULL
   OR length(trim(p_idempotency_key)) NOT BETWEEN 8 AND 160 THEN RETURN jsonb_build_object('ok',false,'error','INVALID_INPUT'); END IF;
 PERFORM pg_advisory_xact_lock(hashtext(trim(p_seller_id)),hashtext('seller-payout:'||upper(p_currency)));
 SELECT * INTO v_existing FROM public.gh_seller_payout_requests WHERE seller_id=trim(p_seller_id) AND idempotency_key=trim(p_idempotency_key);
 IF FOUND THEN RETURN jsonb_build_object('ok',true,'duplicate',true,'requestId',v_existing.id,'status',v_existing.status,'amount',v_existing.amount,'currency',v_existing.currency); END IF;
 -- Lock candidate orders in deterministic order before reading totals and creating allocations.
 PERFORM o.id FROM public.gh_marketplace_orders o
  JOIN public.gh_marketplace_order_proceeds p ON p.order_id=o.id
  WHERE p.seller_id=trim(p_seller_id) AND p.currency=upper(p_currency) AND o.status='completed'
    AND o.payment_status='verified' AND o.escrow_status NOT IN ('refund_pending','refunded')
    AND NOT EXISTS(SELECT 1 FROM public.gh_seller_payout_allocations a WHERE a.order_id=o.id)
    AND NOT EXISTS(SELECT 1 FROM public.gh_marketplace_orders d WHERE d.id=o.id AND d.status='disputed')
  ORDER BY o.id FOR UPDATE OF o;
 SELECT COALESCE(sum(p.seller_net-COALESCE(adj.net_reduced,0)),0) INTO v_eligible
 FROM public.gh_marketplace_order_proceeds p JOIN public.gh_marketplace_orders o ON o.id=p.order_id
 LEFT JOIN (SELECT order_id,sum(seller_net_reduction) net_reduced FROM public.gh_marketplace_order_adjustments GROUP BY order_id) adj ON adj.order_id=p.order_id
 WHERE p.seller_id=trim(p_seller_id) AND p.currency=upper(p_currency) AND o.status='completed' AND o.payment_status='verified'
   AND o.escrow_status NOT IN ('refund_pending','refunded','disputed')
   AND NOT EXISTS(SELECT 1 FROM public.gh_seller_payout_allocations a WHERE a.order_id=p.order_id);
 IF v_eligible<=0 THEN RETURN jsonb_build_object('ok',false,'error','NO_ELIGIBLE_NET_PROCEEDS','eligibleAmount',0); END IF;
 IF p_amount<>v_eligible THEN RETURN jsonb_build_object('ok',false,'error','AMOUNT_MUST_MATCH_ELIGIBLE_NET_PROCEEDS','eligibleAmount',v_eligible,'currency',upper(p_currency)); END IF;
 v_id:='spr_'||replace(gen_random_uuid()::text,'-','');
 INSERT INTO public.gh_seller_payout_requests(id,seller_id,currency,amount,status,idempotency_key)
 VALUES(v_id,trim(p_seller_id),upper(p_currency),v_eligible,'requested',trim(p_idempotency_key));
 INSERT INTO public.gh_seller_payout_allocations(payout_request_id,order_id,seller_id,currency,amount)
 SELECT v_id,p.order_id,trim(p_seller_id),upper(p_currency),p.seller_net-COALESCE(adj.net_reduced,0)
 FROM public.gh_marketplace_order_proceeds p JOIN public.gh_marketplace_orders o ON o.id=p.order_id
 LEFT JOIN (SELECT order_id,sum(seller_net_reduction) net_reduced FROM public.gh_marketplace_order_adjustments GROUP BY order_id) adj ON adj.order_id=p.order_id
 WHERE p.seller_id=trim(p_seller_id) AND p.currency=upper(p_currency) AND o.status='completed' AND o.payment_status='verified'
   AND o.escrow_status NOT IN ('refund_pending','refunded','disputed')
   AND NOT EXISTS(SELECT 1 FROM public.gh_seller_payout_allocations a WHERE a.order_id=p.order_id)
   AND p.seller_net-COALESCE(adj.net_reduced,0)>0;
 GET DIAGNOSTICS v_allocated=ROW_COUNT;
 IF v_allocated=0 OR (SELECT COALESCE(sum(a.amount),0) FROM public.gh_seller_payout_allocations a WHERE a.payout_request_id=v_id)<>v_eligible
 THEN RAISE EXCEPTION 'PAYOUT_NET_ALLOCATION_MISMATCH'; END IF;
 RETURN jsonb_build_object('ok',true,'duplicate',false,'requestId',v_id,'status','requested','amount',v_eligible,
   'currency',upper(p_currency),'allocatedOrders',v_allocated,'paid',false,'basis','verified_order_net_less_immutable_adjustments');
END; $$;
REVOKE ALL ON FUNCTION public.gh_seller_payout_request(text,text,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_seller_payout_request(text,text,numeric,text) TO service_role;

COMMENT ON TABLE public.gh_marketplace_order_adjustments IS 'Append-only server-recorded gross refund/chargeback/dispute adjustments and seller-net reductions. Evidence must be verified upstream; this table does not execute provider refunds.';
COMMENT ON FUNCTION public.gh_marketplace_record_adjustment(text,text,numeric,numeric,text,text,text,jsonb) IS 'Service-role-only, idempotent, immutable adjustment intake. Requires verified proceeds and blocks post-allocation changes for separate reconciliation.';
COMMENT ON FUNCTION public.gh_seller_payout_request(text,text,numeric,text) IS 'Serializes payout reservation against order lifecycle changes and immutable seller-net adjustments; reserves only adjusted net proceeds.';
