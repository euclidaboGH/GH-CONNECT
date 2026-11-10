-- Phase 20B: funded GHC marketplace seller payout. This is independent from Pi A2U.
-- Uses the authoritative GHC ledger; never mints GHC. The treasury ID is supplied only by
-- a privileged server route and must identify a funded GreenHaven reserve wallet.
CREATE TABLE IF NOT EXISTS public.gh_seller_payout_ghc_settlements (
  id text PRIMARY KEY,
  payout_request_id text NOT NULL UNIQUE REFERENCES public.gh_seller_payout_requests(id) ON DELETE RESTRICT,
  transfer_reference text NOT NULL UNIQUE,
  treasury_user_id text NOT NULL,
  seller_id text NOT NULL,
  amount numeric(18,4) NOT NULL CHECK(amount>0),
  debit_transaction_id uuid NOT NULL,
  credit_transaction_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'settled' CHECK(status='settled'),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gh_seller_payout_ghc_settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_seller_payout_ghc_settlements_no_client ON public.gh_seller_payout_ghc_settlements;
CREATE POLICY gh_seller_payout_ghc_settlements_no_client ON public.gh_seller_payout_ghc_settlements FOR ALL USING(false) WITH CHECK(false);

CREATE OR REPLACE FUNCTION public.gh_seller_payout_settle_ghc_atomic(
 p_request_id text, p_treasury_user_id text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 v_req public.gh_seller_payout_requests%ROWTYPE;
 v_old public.gh_seller_payout_ghc_settlements%ROWTYPE;
 v_amount numeric(18,4);
 v_available numeric;
 v_reference text;
 v_out public.ghc_transactions%ROWTYPE;
 v_in public.ghc_transactions%ROWTYPE;
 v_out_id uuid;
 v_in_id uuid;
 v_now timestamptz := now();
 v_id text;
BEGIN
 IF COALESCE(trim(p_request_id),'') !~ '^spr_[a-f0-9]{16,40}$' OR COALESCE(trim(p_treasury_user_id),'')='' THEN
  RETURN jsonb_build_object('ok',false,'error','INVALID_INPUT'); END IF;
 SELECT * INTO v_req FROM public.gh_seller_payout_requests WHERE id=trim(p_request_id) FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_NOT_FOUND'); END IF;
 IF v_req.currency<>'GHC' THEN RETURN jsonb_build_object('ok',false,'error','UNSUPPORTED_PAYOUT_RAIL'); END IF;
 IF v_req.seller_id=trim(p_treasury_user_id) THEN RETURN jsonb_build_object('ok',false,'error','TREASURY_CANNOT_BE_SELLER'); END IF;
 SELECT * INTO v_old FROM public.gh_seller_payout_ghc_settlements WHERE payout_request_id=v_req.id;
 IF FOUND THEN
  IF v_old.treasury_user_id<>trim(p_treasury_user_id) OR v_old.seller_id<>v_req.seller_id OR v_old.amount<>v_req.amount THEN
   RETURN jsonb_build_object('ok',false,'error','PAYOUT_SETTLEMENT_CONFLICT'); END IF;
  RETURN jsonb_build_object('ok',true,'idempotent',true,'requestId',v_req.id,'status','paid','paid',true,'transferReference',v_old.transfer_reference,'amount',v_old.amount,'currency','GHC');
 END IF;
 IF v_req.status<>'processing' THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_NOT_PROCESSING'); END IF;
 IF v_req.amount<>round(v_req.amount,4) THEN RETURN jsonb_build_object('ok',false,'error','INVALID_AMOUNT_PRECISION'); END IF;
 -- Payout must still be fully backed by uniquely allocated, completed and verified orders.
 IF NOT EXISTS(SELECT 1 FROM public.gh_seller_payout_allocations a WHERE a.payout_request_id=v_req.id) OR
    (SELECT COALESCE(sum(a.amount),0) FROM public.gh_seller_payout_allocations a WHERE a.payout_request_id=v_req.id)<>v_req.amount OR
    EXISTS(SELECT 1 FROM public.gh_seller_payout_allocations a LEFT JOIN public.gh_marketplace_orders o ON o.id=a.order_id
      WHERE a.payout_request_id=v_req.id AND (o.id IS NULL OR o.seller_id<>v_req.seller_id OR upper(o.currency)<>'GHC' OR o.status<>'completed' OR o.payment_status<>'verified')) THEN
  RETURN jsonb_build_object('ok',false,'error','PAYOUT_ORDER_BACKING_INVALID'); END IF;
 -- Lock both ledger participants in canonical order, sharing the wallet lock namespace.
 IF trim(p_treasury_user_id)<v_req.seller_id THEN
  PERFORM pg_advisory_xact_lock(hashtext('ghc_balance:'||trim(p_treasury_user_id)));
  PERFORM pg_advisory_xact_lock(hashtext('ghc_balance:'||v_req.seller_id));
 ELSE
  PERFORM pg_advisory_xact_lock(hashtext('ghc_balance:'||v_req.seller_id));
  PERFORM pg_advisory_xact_lock(hashtext('ghc_balance:'||trim(p_treasury_user_id)));
 END IF;
 IF EXISTS(SELECT 1 FROM public.ghc_account_flags WHERE user_id=trim(p_treasury_user_id) AND (restricted OR suspended)) THEN
  RETURN jsonb_build_object('ok',false,'error','TREASURY_ACCOUNT_RESTRICTED'); END IF;
 IF EXISTS(SELECT 1 FROM public.ghc_account_flags WHERE user_id=v_req.seller_id AND (restricted OR suspended)) THEN
  RETURN jsonb_build_object('ok',false,'error','SELLER_ACCOUNT_RESTRICTED'); END IF;
 v_amount:=v_req.amount::numeric(18,4);
 v_reference:='seller_payout_'||v_req.id;
 SELECT * INTO v_out FROM public.ghc_transactions WHERE user_id=trim(p_treasury_user_id) AND reference_id=v_reference AND kind='transfer_out' AND status='posted' LIMIT 1;
 IF FOUND THEN
  IF abs(v_out.amount)<>v_amount OR v_out.counterparty_id IS DISTINCT FROM v_req.seller_id THEN RETURN jsonb_build_object('ok',false,'error','IDEMPOTENCY_CONFLICT'); END IF;
  SELECT * INTO v_in FROM public.ghc_transactions WHERE user_id=v_req.seller_id AND reference_id=v_reference AND kind='transfer_in' AND status='posted' AND counterparty_id=trim(p_treasury_user_id) LIMIT 1;
  IF NOT FOUND OR v_in.amount<>v_amount THEN RETURN jsonb_build_object('ok',false,'error','TRANSFER_PAIR_INCOMPLETE'); END IF;
  v_out_id:=v_out.id; v_in_id:=v_in.id;
 ELSE
  v_available:=public.ghc_spendable_balance(trim(p_treasury_user_id));
  IF v_available<v_amount THEN RETURN jsonb_build_object('ok',false,'error','INSUFFICIENT_FUNDED_TREASURY','available',v_available,'required',v_amount); END IF;
  INSERT INTO public.ghc_transactions(user_id,kind,amount,status,reason,source_event,reference_id,counterparty_id,metadata,posted_at)
  VALUES(trim(p_treasury_user_id),'transfer_out',-v_amount,'posted','Marketplace seller payout','MARKETPLACE_SELLER_PAYOUT',v_reference,v_req.seller_id,
    jsonb_build_object('payoutRequestId',v_req.id,'sellerId',v_req.seller_id,'currency','GHC','funded',true),v_now) RETURNING id INTO v_out_id;
  INSERT INTO public.ghc_transactions(user_id,kind,amount,status,reason,source_event,reference_id,counterparty_id,metadata,posted_at)
  VALUES(v_req.seller_id,'transfer_in',v_amount,'posted','Marketplace seller payout received','MARKETPLACE_SELLER_PAYOUT',v_reference,trim(p_treasury_user_id),
    jsonb_build_object('payoutRequestId',v_req.id,'treasuryUserId',trim(p_treasury_user_id),'currency','GHC','funded',true),v_now) RETURNING id INTO v_in_id;
  INSERT INTO public.ghc_economy_events(user_id,event_type,payload,reference_id) VALUES
   (trim(p_treasury_user_id),'GHC_MARKETPLACE_PAYOUT_SENT',jsonb_build_object('amount',v_amount,'sellerId',v_req.seller_id,'requestId',v_req.id),v_reference),
   (v_req.seller_id,'GHC_MARKETPLACE_PAYOUT_RECEIVED',jsonb_build_object('amount',v_amount,'requestId',v_req.id),v_reference);
 END IF;
 v_id:='ghcsp_'||replace(gen_random_uuid()::text,'-','');
 INSERT INTO public.gh_seller_payout_ghc_settlements(id,payout_request_id,transfer_reference,treasury_user_id,seller_id,amount,debit_transaction_id,credit_transaction_id)
 VALUES(v_id,v_req.id,v_reference,trim(p_treasury_user_id),v_req.seller_id,v_amount,v_out_id,v_in_id);
 UPDATE public.gh_seller_payout_requests SET status='paid',payout_reference=v_reference,operator_note='Atomic funded GHC ledger settlement',updated_at=now(),paid_at=now() WHERE id=v_req.id;
 RETURN jsonb_build_object('ok',true,'idempotent',false,'requestId',v_req.id,'settlementId',v_id,'transferReference',v_reference,'debitTransactionId',v_out_id,'creditTransactionId',v_in_id,'amount',v_amount,'currency','GHC','status','paid','paid',true);
END; $$;
REVOKE ALL ON FUNCTION public.gh_seller_payout_settle_ghc_atomic(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_seller_payout_settle_ghc_atomic(text,text) TO service_role;
COMMENT ON FUNCTION public.gh_seller_payout_settle_ghc_atomic IS 'Atomic, funded GHC seller payout from configured treasury: verifies eligible orders, locks both balances, posts paired ledger legs, records settlement and marks request paid in one transaction.';
