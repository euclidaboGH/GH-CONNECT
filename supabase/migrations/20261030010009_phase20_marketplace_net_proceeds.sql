-- Phase 20: immutable per-order seller proceeds snapshots and net-funded payout allocation.
-- Additive only. REVIEW_REQUIRED: validate against disposable PostgreSQL + Pi/GHC Testnet before apply.
-- PI and GHC remain separate assets. This migration does not execute external payouts or refunds.

CREATE TABLE IF NOT EXISTS public.gh_marketplace_order_proceeds (
  order_id text PRIMARY KEY REFERENCES public.gh_marketplace_orders(id) ON DELETE RESTRICT,
  seller_id text NOT NULL,
  buyer_id text NOT NULL,
  currency text NOT NULL CHECK (currency IN ('PI','GHC')),
  gross_amount numeric(18,8) NOT NULL CHECK (gross_amount > 0),
  commission_bps integer NOT NULL CHECK (commission_bps BETWEEN 0 AND 10000),
  platform_commission numeric(18,8) NOT NULL CHECK (platform_commission >= 0),
  seller_net numeric(18,8) NOT NULL CHECK (seller_net >= 0),
  payment_method text NOT NULL CHECK (payment_method IN ('pi','ghc')),
  payment_intent_id text,
  provider_payment_id text,
  provider_txid text,
  ghc_spend_ref text,
  payment_evidence_fingerprint text NOT NULL,
  snapshot_version integer NOT NULL DEFAULT 1 CHECK (snapshot_version = 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_marketplace_proceeds_split CHECK (platform_commission + seller_net = gross_amount),
  CONSTRAINT gh_marketplace_proceeds_rail CHECK (
    (currency='PI' AND payment_method='pi' AND payment_intent_id IS NOT NULL AND (provider_payment_id IS NOT NULL OR provider_txid IS NOT NULL) AND ghc_spend_ref IS NULL)
    OR
    (currency='GHC' AND payment_method='ghc' AND ghc_spend_ref IS NOT NULL AND payment_intent_id IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_gh_marketplace_proceeds_seller_currency
  ON public.gh_marketplace_order_proceeds(seller_id,currency,created_at);
ALTER TABLE public.gh_marketplace_order_proceeds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_marketplace_order_proceeds_no_client ON public.gh_marketplace_order_proceeds;
CREATE POLICY gh_marketplace_order_proceeds_no_client ON public.gh_marketplace_order_proceeds FOR ALL USING(false) WITH CHECK(false);

-- Snapshot is created only from a verified payment record; the order row is the durable
-- server-side payment binding established by the existing PI/GHC verification paths.
CREATE OR REPLACE FUNCTION public.gh_marketplace_capture_order_proceeds()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_currency text := upper(trim(NEW.currency));
  v_method text := lower(trim(NEW.payment_method));
  v_bps integer := 500;
  v_commission numeric(18,8);
  v_net numeric(18,8);
  v_evidence text;
BEGIN
  IF NEW.payment_status <> 'verified' THEN RETURN NEW; END IF;
  IF v_currency NOT IN ('PI','GHC') OR NEW.total_amount <= 0 THEN RETURN NEW; END IF;
  IF (v_currency='PI' AND (v_method<>'pi' OR COALESCE(trim(NEW.payment_intent_id),'')='' OR (COALESCE(trim(NEW.payment_id),'')='' AND COALESCE(trim(NEW.txid),'')='')))
     OR (v_currency='GHC' AND (v_method<>'ghc' OR COALESCE(trim(NEW.ghc_spend_ref),'')='')) THEN
    RAISE EXCEPTION 'MARKETPLACE_PAYMENT_EVIDENCE_INCOMPLETE';
  END IF;
  v_commission := floor((NEW.total_amount * v_bps / 10000)::numeric * 100000000) / 100000000;
  v_net := NEW.total_amount - v_commission;
  v_evidence := md5(concat_ws('|',NEW.id,NEW.buyer_id,NEW.seller_id,v_currency,v_method,NEW.total_amount::text,COALESCE(NEW.payment_intent_id,''),COALESCE(NEW.payment_id,''),COALESCE(NEW.txid,''),COALESCE(NEW.ghc_spend_ref,'')));
  INSERT INTO public.gh_marketplace_order_proceeds(
    order_id,seller_id,buyer_id,currency,gross_amount,commission_bps,platform_commission,seller_net,
    payment_method,payment_intent_id,provider_payment_id,provider_txid,ghc_spend_ref,payment_evidence_fingerprint
  ) VALUES (
    NEW.id,NEW.seller_id,NEW.buyer_id,v_currency,NEW.total_amount,v_bps,v_commission,v_net,
    v_method,NULLIF(trim(NEW.payment_intent_id),''),NULLIF(trim(NEW.payment_id),''),NULLIF(trim(NEW.txid),''),NULLIF(trim(NEW.ghc_spend_ref),''),v_evidence
  ) ON CONFLICT(order_id) DO NOTHING;
  IF NOT EXISTS (
    SELECT 1 FROM public.gh_marketplace_order_proceeds p
    WHERE p.order_id=NEW.id AND p.seller_id=NEW.seller_id AND p.buyer_id=NEW.buyer_id
      AND p.currency=v_currency AND p.gross_amount=NEW.total_amount AND p.payment_evidence_fingerprint=v_evidence
  ) THEN RAISE EXCEPTION 'MARKETPLACE_PROCEEDS_SNAPSHOT_CONFLICT'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_gh_marketplace_capture_order_proceeds ON public.gh_marketplace_orders;
CREATE TRIGGER trg_gh_marketplace_capture_order_proceeds
AFTER INSERT OR UPDATE OF payment_status,payment_method,payment_intent_id,payment_id,txid,ghc_spend_ref,total_amount,currency,seller_id,buyer_id
ON public.gh_marketplace_orders FOR EACH ROW EXECUTE FUNCTION public.gh_marketplace_capture_order_proceeds();

-- A proceeds snapshot is append-only. Corrections require a separately audited adjustment workflow.
CREATE OR REPLACE FUNCTION public.gh_marketplace_proceeds_reject_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN RAISE EXCEPTION 'MARKETPLACE_PROCEEDS_IMMUTABLE'; END; $$;
DROP TRIGGER IF EXISTS trg_gh_marketplace_proceeds_immutable ON public.gh_marketplace_order_proceeds;
CREATE TRIGGER trg_gh_marketplace_proceeds_immutable
BEFORE UPDATE OR DELETE ON public.gh_marketplace_order_proceeds
FOR EACH ROW EXECUTE FUNCTION public.gh_marketplace_proceeds_reject_mutation();

-- Replace gross-order payout calculation with verified, immutable seller-net snapshots.
CREATE OR REPLACE FUNCTION public.gh_seller_payout_request(p_seller_id text,p_currency text,p_amount numeric,p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id text; v_existing public.gh_seller_payout_requests%ROWTYPE; v_eligible numeric(18,8); v_allocated integer;
BEGIN
 IF p_seller_id IS NULL OR length(trim(p_seller_id))=0 OR p_currency IS NULL OR upper(p_currency) NOT IN ('GHC','PI') OR p_amount IS NULL OR p_amount<=0 OR p_amount>100000000 OR p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) NOT BETWEEN 8 AND 160 THEN
  RETURN jsonb_build_object('ok',false,'error','INVALID_INPUT'); END IF;
 PERFORM pg_advisory_xact_lock(hashtext(trim(p_seller_id)), hashtext('seller-payout:'||upper(p_currency)));
 SELECT * INTO v_existing FROM public.gh_seller_payout_requests WHERE seller_id=trim(p_seller_id) AND idempotency_key=trim(p_idempotency_key);
 IF FOUND THEN RETURN jsonb_build_object('ok',true,'duplicate',true,'requestId',v_existing.id,'status',v_existing.status,'amount',v_existing.amount,'currency',v_existing.currency); END IF;
 SELECT COALESCE(sum(p.seller_net),0) INTO v_eligible
 FROM public.gh_marketplace_order_proceeds p
 JOIN public.gh_marketplace_orders o ON o.id=p.order_id
 WHERE p.seller_id=trim(p_seller_id) AND p.currency=upper(p_currency)
   AND o.status='completed' AND o.payment_status='verified' AND o.escrow_status NOT IN ('refund_pending','refunded')
   AND NOT EXISTS (SELECT 1 FROM public.gh_seller_payout_allocations a WHERE a.order_id=p.order_id)
   AND NOT EXISTS (SELECT 1 FROM public.gh_marketplace_orders d WHERE d.id=p.order_id AND d.status='disputed');
 IF v_eligible<=0 THEN RETURN jsonb_build_object('ok',false,'error','NO_ELIGIBLE_NET_PROCEEDS','eligibleAmount',0); END IF;
 IF p_amount<>v_eligible THEN RETURN jsonb_build_object('ok',false,'error','AMOUNT_MUST_MATCH_ELIGIBLE_NET_PROCEEDS','eligibleAmount',v_eligible,'currency',upper(p_currency)); END IF;
 v_id := 'spr_'||replace(gen_random_uuid()::text,'-','');
 INSERT INTO public.gh_seller_payout_requests(id,seller_id,currency,amount,status,idempotency_key)
 VALUES(v_id,trim(p_seller_id),upper(p_currency),v_eligible,'requested',trim(p_idempotency_key));
 INSERT INTO public.gh_seller_payout_allocations(payout_request_id,order_id,seller_id,currency,amount)
 SELECT v_id,p.order_id,trim(p_seller_id),upper(p_currency),p.seller_net
 FROM public.gh_marketplace_order_proceeds p JOIN public.gh_marketplace_orders o ON o.id=p.order_id
 WHERE p.seller_id=trim(p_seller_id) AND p.currency=upper(p_currency)
   AND o.status='completed' AND o.payment_status='verified' AND o.escrow_status NOT IN ('refund_pending','refunded')
   AND NOT EXISTS (SELECT 1 FROM public.gh_seller_payout_allocations a WHERE a.order_id=p.order_id)
   AND NOT EXISTS (SELECT 1 FROM public.gh_marketplace_orders d WHERE d.id=p.order_id AND d.status='disputed');
 GET DIAGNOSTICS v_allocated = ROW_COUNT;
 IF v_allocated=0 THEN RAISE EXCEPTION 'PAYOUT_ALLOCATION_RACE'; END IF;
 IF (SELECT COALESCE(sum(a.amount),0) FROM public.gh_seller_payout_allocations a WHERE a.payout_request_id=v_id)<>v_eligible THEN
  RAISE EXCEPTION 'PAYOUT_NET_ALLOCATION_MISMATCH';
 END IF;
 RETURN jsonb_build_object('ok',true,'duplicate',false,'requestId',v_id,'status','requested','amount',v_eligible,'currency',upper(p_currency),'allocatedOrders',v_allocated,'paid',false,'basis','verified_order_seller_net');
END; $$;
REVOKE ALL ON FUNCTION public.gh_marketplace_capture_order_proceeds() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_seller_payout_request(text,text,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_seller_payout_request(text,text,numeric,text) TO service_role;
COMMENT ON TABLE public.gh_marketplace_order_proceeds IS 'Append-only per-order PI/GHC gross, platform commission, seller net and verified payment evidence snapshot. Payouts consume seller_net only.';
COMMENT ON FUNCTION public.gh_seller_payout_request(text,text,numeric,text) IS 'Creates seller payout requests only from immutable, verified per-order seller_net snapshots; never allocates gross order value.';
