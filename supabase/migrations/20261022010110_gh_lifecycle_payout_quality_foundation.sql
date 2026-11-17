-- Phase 15: account lifecycle, seller payout workflow, creator reward ledger, and quality ranking signals.
-- Additive only. No live account deletion, external payout, or GHC issuance occurs in this migration.
-- All financial actions require separate verified settlement integration.

CREATE TABLE IF NOT EXISTS public.gh_account_lifecycle_requests (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('export','deletion')),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','processing','ready','completed','rejected','failed')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT gh_account_lifecycle_user_nonempty CHECK (length(trim(user_id)) > 0)
);
CREATE INDEX IF NOT EXISTS idx_gh_lifecycle_user_recent ON public.gh_account_lifecycle_requests(user_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_gh_lifecycle_queue ON public.gh_account_lifecycle_requests(request_type, status, requested_at);
ALTER TABLE public.gh_account_lifecycle_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_account_lifecycle_no_client ON public.gh_account_lifecycle_requests;
CREATE POLICY gh_account_lifecycle_no_client ON public.gh_account_lifecycle_requests FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.gh_account_lifecycle_request(p_user_id text, p_request_type text, p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id text; v_existing public.gh_account_lifecycle_requests%ROWTYPE;
BEGIN
 IF p_user_id IS NULL OR length(trim(p_user_id))=0 OR p_request_type IS NULL OR p_request_type NOT IN ('export','deletion') OR p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) NOT BETWEEN 8 AND 160 THEN
  RETURN jsonb_build_object('ok',false,'error','INVALID_INPUT');
 END IF;
 -- Serialize duplicate requests for the same account/type/key.
 PERFORM pg_advisory_xact_lock(hashtext(trim(p_user_id)), hashtext(p_request_type || ':' || trim(p_idempotency_key)));
 SELECT * INTO v_existing FROM public.gh_account_lifecycle_requests
  WHERE user_id=trim(p_user_id) AND request_type=p_request_type AND metadata->>'idempotencyKey'=trim(p_idempotency_key)
  ORDER BY requested_at DESC LIMIT 1;
 IF FOUND THEN RETURN jsonb_build_object('ok',true,'duplicate',true,'requestId',v_existing.id,'status',v_existing.status,'requestType',v_existing.request_type); END IF;
 v_id := 'alr_' || replace(gen_random_uuid()::text,'-','');
 INSERT INTO public.gh_account_lifecycle_requests(id,user_id,request_type,metadata)
 VALUES(v_id,trim(p_user_id),p_request_type,jsonb_build_object('idempotencyKey',trim(p_idempotency_key),'destructiveAction',p_request_type='deletion','requiresOperatorWorkflow',true));
 RETURN jsonb_build_object('ok',true,'duplicate',false,'requestId',v_id,'status','requested','requestType',p_request_type,'deletionExecuted',false);
END; $$;
REVOKE ALL ON FUNCTION public.gh_account_lifecycle_request(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_account_lifecycle_request(text,text,text) TO service_role;

CREATE TABLE IF NOT EXISTS public.gh_seller_payout_requests (
 id text PRIMARY KEY,
 seller_id text NOT NULL,
 currency text NOT NULL CHECK (currency IN ('GHC','PI')),
 amount numeric(18,8) NOT NULL CHECK (amount > 0),
 status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','under_review','approved','processing','paid','rejected','failed','cancelled')),
 idempotency_key text NOT NULL,
 payout_reference text,
 operator_note text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 paid_at timestamptz,
 UNIQUE(seller_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_gh_seller_payout_queue ON public.gh_seller_payout_requests(status,created_at);
CREATE INDEX IF NOT EXISTS idx_gh_seller_payout_seller ON public.gh_seller_payout_requests(seller_id,created_at DESC);
ALTER TABLE public.gh_seller_payout_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_seller_payout_no_client ON public.gh_seller_payout_requests;
CREATE POLICY gh_seller_payout_no_client ON public.gh_seller_payout_requests FOR ALL USING(false) WITH CHECK(false);

CREATE TABLE IF NOT EXISTS public.gh_seller_payout_allocations (
 payout_request_id text NOT NULL REFERENCES public.gh_seller_payout_requests(id) ON DELETE RESTRICT,
 order_id text NOT NULL REFERENCES public.gh_marketplace_orders(id) ON DELETE RESTRICT,
 seller_id text NOT NULL,
 currency text NOT NULL CHECK (currency IN ('GHC','PI')),
 amount numeric(18,8) NOT NULL CHECK (amount>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(payout_request_id,order_id),
 UNIQUE(order_id)
);
ALTER TABLE public.gh_seller_payout_allocations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_seller_payout_allocations_no_client ON public.gh_seller_payout_allocations;
CREATE POLICY gh_seller_payout_allocations_no_client ON public.gh_seller_payout_allocations FOR ALL USING(false) WITH CHECK(false);

CREATE OR REPLACE FUNCTION public.gh_seller_payout_request(p_seller_id text,p_currency text,p_amount numeric,p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id text; v_existing public.gh_seller_payout_requests%ROWTYPE; v_eligible numeric(18,8); v_allocated integer;
BEGIN
 IF p_seller_id IS NULL OR length(trim(p_seller_id))=0 OR p_currency IS NULL OR upper(p_currency) NOT IN ('GHC','PI') OR p_amount IS NULL OR p_amount<=0 OR p_amount>100000000 OR p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) NOT BETWEEN 8 AND 160 THEN
  RETURN jsonb_build_object('ok',false,'error','INVALID_INPUT'); END IF;
 PERFORM pg_advisory_xact_lock(hashtext(trim(p_seller_id)), hashtext('seller-payout:'||upper(p_currency)));
 SELECT * INTO v_existing FROM public.gh_seller_payout_requests WHERE seller_id=trim(p_seller_id) AND idempotency_key=trim(p_idempotency_key);
 IF FOUND THEN RETURN jsonb_build_object('ok',true,'duplicate',true,'requestId',v_existing.id,'status',v_existing.status,'amount',v_existing.amount,'currency',v_existing.currency); END IF;
 SELECT COALESCE(sum(o.total_amount),0) INTO v_eligible FROM public.gh_marketplace_orders o
 WHERE o.seller_id=trim(p_seller_id) AND upper(o.currency)=upper(p_currency)
   AND o.status='completed' AND o.payment_status='verified'
   AND NOT EXISTS (SELECT 1 FROM public.gh_seller_payout_allocations a WHERE a.order_id=o.id);
 IF v_eligible<=0 THEN RETURN jsonb_build_object('ok',false,'error','NO_ELIGIBLE_COMPLETED_ORDERS','eligibleAmount',0); END IF;
 -- Full eligible balance only: no partial-order allocation or double claim. External transfer remains a separate operator action.
 IF p_amount<>v_eligible THEN RETURN jsonb_build_object('ok',false,'error','AMOUNT_MUST_MATCH_ELIGIBLE_BALANCE','eligibleAmount',v_eligible,'currency',upper(p_currency)); END IF;
 v_id := 'spr_'||replace(gen_random_uuid()::text,'-','');
 INSERT INTO public.gh_seller_payout_requests(id,seller_id,currency,amount,status,idempotency_key)
 VALUES(v_id,trim(p_seller_id),upper(p_currency),v_eligible,'requested',trim(p_idempotency_key));
 INSERT INTO public.gh_seller_payout_allocations(payout_request_id,order_id,seller_id,currency,amount)
 SELECT v_id,o.id,trim(p_seller_id),upper(p_currency),o.total_amount FROM public.gh_marketplace_orders o
 WHERE o.seller_id=trim(p_seller_id) AND upper(o.currency)=upper(p_currency)
   AND o.status='completed' AND o.payment_status='verified'
   AND NOT EXISTS (SELECT 1 FROM public.gh_seller_payout_allocations a WHERE a.order_id=o.id);
 GET DIAGNOSTICS v_allocated = ROW_COUNT;
 IF v_allocated=0 THEN RAISE EXCEPTION 'PAYOUT_ALLOCATION_RACE'; END IF;
 RETURN jsonb_build_object('ok',true,'duplicate',false,'requestId',v_id,'status','requested','amount',v_eligible,'currency',upper(p_currency),'allocatedOrders',v_allocated,'paid',false);
END; $$;
REVOKE ALL ON FUNCTION public.gh_seller_payout_request(text,text,numeric,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_seller_payout_request(text,text,numeric,text) TO service_role;

CREATE OR REPLACE FUNCTION public.gh_seller_payout_transition(p_request_id text,p_next_status text,p_operator_note text DEFAULT NULL,p_payout_reference text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_request public.gh_seller_payout_requests%ROWTYPE;
BEGIN
 IF p_request_id IS NULL OR p_next_status IS NULL OR p_next_status NOT IN ('under_review','approved','processing','paid','rejected','failed','cancelled') THEN
  RETURN jsonb_build_object('ok',false,'error','INVALID_TRANSITION'); END IF;
 SELECT * INTO v_request FROM public.gh_seller_payout_requests WHERE id=trim(p_request_id) FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','NOT_FOUND'); END IF;
 IF v_request.status IN ('paid','rejected','failed','cancelled') THEN RETURN jsonb_build_object('ok',false,'error','TERMINAL_STATUS'); END IF;
 IF p_next_status='paid' AND (p_payout_reference IS NULL OR length(trim(p_payout_reference))<6 OR length(trim(p_payout_reference))>200) THEN
  RETURN jsonb_build_object('ok',false,'error','PAYOUT_REFERENCE_REQUIRED'); END IF;
 IF p_next_status='under_review' AND v_request.status<>'requested' THEN RETURN jsonb_build_object('ok',false,'error','INVALID_TRANSITION'); END IF;
 IF p_next_status='approved' AND v_request.status NOT IN ('requested','under_review') THEN RETURN jsonb_build_object('ok',false,'error','INVALID_TRANSITION'); END IF;
 IF p_next_status='processing' AND v_request.status<>'approved' THEN RETURN jsonb_build_object('ok',false,'error','INVALID_TRANSITION'); END IF;
 IF p_next_status='paid' AND v_request.status<>'processing' THEN RETURN jsonb_build_object('ok',false,'error','INVALID_TRANSITION'); END IF;
 UPDATE public.gh_seller_payout_requests SET status=p_next_status,operator_note=NULLIF(left(trim(COALESCE(p_operator_note,'')),1000),''),payout_reference=CASE WHEN p_next_status='paid' THEN trim(p_payout_reference) ELSE payout_reference END,updated_at=now(),paid_at=CASE WHEN p_next_status='paid' THEN now() ELSE paid_at END WHERE id=v_request.id;
 IF p_next_status IN ('rejected','failed','cancelled') THEN DELETE FROM public.gh_seller_payout_allocations WHERE payout_request_id=v_request.id; END IF;
 RETURN jsonb_build_object('ok',true,'requestId',v_request.id,'status',p_next_status,'paid',p_next_status='paid');
END; $$;
REVOKE ALL ON FUNCTION public.gh_seller_payout_transition(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_seller_payout_transition(text,text,text,text) TO service_role;

CREATE TABLE IF NOT EXISTS public.gh_creator_reward_events (
 id text PRIMARY KEY,
 creator_id text NOT NULL,
 content_id text NOT NULL,
 reward_period date NOT NULL,
 quality_score numeric(12,6) NOT NULL CHECK (quality_score>=0),
 proposed_amount numeric(18,8) NOT NULL DEFAULT 0 CHECK (proposed_amount>=0),
 currency text NOT NULL DEFAULT 'GHC' CHECK (currency IN ('GHC','PI')),
 status text NOT NULL DEFAULT 'evaluated' CHECK (status IN ('evaluated','eligible','approved','settled','rejected','held')),
 funding_reference text,
 settlement_reference text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(creator_id,content_id,reward_period)
);
CREATE INDEX IF NOT EXISTS idx_gh_creator_rewards_queue ON public.gh_creator_reward_events(status,reward_period);
ALTER TABLE public.gh_creator_reward_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_creator_reward_events_no_client ON public.gh_creator_reward_events;
CREATE POLICY gh_creator_reward_events_no_client ON public.gh_creator_reward_events FOR ALL USING(false) WITH CHECK(false);
COMMENT ON TABLE public.gh_creator_reward_events IS 'Evaluation ledger only until a funded pool and idempotent economy-ledger settlement are explicitly wired. Never mints GHC by itself.';

CREATE TABLE IF NOT EXISTS public.gh_content_quality_signals (
 content_id text PRIMARY KEY,
 author_id text NOT NULL,
 quality_score numeric(12,6) NOT NULL DEFAULT 0 CHECK (quality_score>=0 AND quality_score<=100),
 confidence numeric(8,6) NOT NULL DEFAULT 0 CHECK (confidence>=0 AND confidence<=1),
 review_status text NOT NULL DEFAULT 'community_review' CHECK (review_status IN ('community_review','trusted_signal','needs_review','restricted')),
 computed_at timestamptz NOT NULL DEFAULT now(),
 model_version text NOT NULL DEFAULT 'rules-v1'
);
CREATE INDEX IF NOT EXISTS idx_gh_quality_feed ON public.gh_content_quality_signals(review_status,quality_score DESC,computed_at DESC);
ALTER TABLE public.gh_content_quality_signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_content_quality_signals_no_client ON public.gh_content_quality_signals;
CREATE POLICY gh_content_quality_signals_no_client ON public.gh_content_quality_signals FOR ALL USING(false) WITH CHECK(false);
COMMENT ON TABLE public.gh_content_quality_signals IS 'Server-computed quality metadata only; not truth labels, not votes, not GHC, and not a sole ranking determinant.';
