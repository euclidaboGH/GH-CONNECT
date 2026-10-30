-- Phase 30 — Marketplace Commerce V2: durable buyer/seller lifecycle metadata.
ALTER TABLE public.gh_marketplace_orders
  ADD COLUMN IF NOT EXISTS escrow_status text NOT NULL DEFAULT 'none' CHECK (escrow_status IN ('none','held','releasable','released','refund_pending','refunded')),
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'not_started' CHECK (delivery_status IN ('not_started','processing','shipped','delivered','service_active','completed')),
  ADD COLUMN IF NOT EXISTS dispute_reason text,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS buyer_note text,
  ADD COLUMN IF NOT EXISTS seller_note text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS buyer_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS seller_confirmed_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_gh_market_orders_escrow ON public.gh_marketplace_orders (escrow_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_gh_market_orders_delivery ON public.gh_marketplace_orders (delivery_status, updated_at DESC);

CREATE OR REPLACE FUNCTION public.gh_marketplace_order_commerce_update(p_order_id text,p_actor_id text,p_action text,p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.gh_marketplace_orders%ROWTYPE; v_action text:=lower(trim(coalesce(p_action,''))); v_note text:=left(trim(coalesce(p_note,'')),500);
BEGIN
 SELECT * INTO r FROM public.gh_marketplace_orders WHERE id=trim(p_order_id) FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','NOT_FOUND'); END IF;
 IF r.buyer_id<>p_actor_id AND r.seller_id<>p_actor_id THEN RETURN jsonb_build_object('ok',false,'error','FORBIDDEN'); END IF;
 IF v_action='seller_fulfill' THEN
   IF r.seller_id<>p_actor_id THEN RETURN jsonb_build_object('ok',false,'error','SELLER_ONLY'); END IF;
   IF r.payment_status<>'verified' OR r.status<>'confirmed' THEN RETURN jsonb_build_object('ok',false,'error','PAYMENT_REQUIRED'); END IF;
   UPDATE public.gh_marketplace_orders SET status='fulfilling',delivery_status='processing',seller_note=NULLIF(v_note,''),fulfilled_at=now(),updated_at=now(),audit=coalesce(audit,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('at',(extract(epoch from now())*1000)::bigint,'action','SELLER_FULFILL','detail',v_note)) WHERE id=r.id;
 ELSIF v_action='seller_mark_delivered' THEN
   IF r.seller_id<>p_actor_id THEN RETURN jsonb_build_object('ok',false,'error','SELLER_ONLY'); END IF;
   IF r.status<>'fulfilling' THEN RETURN jsonb_build_object('ok',false,'error','INVALID_STATE'); END IF;
   UPDATE public.gh_marketplace_orders SET delivery_status='delivered',delivered_at=now(),seller_confirmed_at=now(),seller_note=NULLIF(v_note,''),updated_at=now(),audit=coalesce(audit,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('at',(extract(epoch from now())*1000)::bigint,'action','SELLER_DELIVERED','detail',v_note)) WHERE id=r.id;
 ELSIF v_action='buyer_confirm' THEN
   IF r.buyer_id<>p_actor_id THEN RETURN jsonb_build_object('ok',false,'error','BUYER_ONLY'); END IF;
   IF r.payment_status<>'verified' OR r.status NOT IN ('fulfilling','confirmed') THEN RETURN jsonb_build_object('ok',false,'error','INVALID_STATE'); END IF;
   UPDATE public.gh_marketplace_orders SET status='completed',delivery_status='completed',buyer_confirmed_at=now(),completed_at=now(),buyer_note=NULLIF(v_note,''),updated_at=now(),audit=coalesce(audit,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('at',(extract(epoch from now())*1000)::bigint,'action','BUYER_CONFIRMED','detail',v_note)) WHERE id=r.id;
 ELSIF v_action='dispute' THEN
   IF r.payment_status<>'verified' OR r.status NOT IN ('confirmed','fulfilling') THEN RETURN jsonb_build_object('ok',false,'error','INVALID_STATE'); END IF;
   UPDATE public.gh_marketplace_orders SET status='disputed',dispute_reason=NULLIF(v_note,''),updated_at=now(),audit=coalesce(audit,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('at',(extract(epoch from now())*1000)::bigint,'action','DISPUTE_OPENED','detail',v_note)) WHERE id=r.id;
 ELSIF v_action='cancel_unpaid' THEN
   IF r.payment_status IN ('verified','refunded') OR r.status NOT IN ('created','payment_pending') THEN RETURN jsonb_build_object('ok',false,'error','PAID_OR_STARTED'); END IF;
   UPDATE public.gh_marketplace_orders SET status='cancelled',cancellation_reason=NULLIF(v_note,''),cancelled_at=now(),updated_at=now(),audit=coalesce(audit,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('at',(extract(epoch from now())*1000)::bigint,'action','CANCEL_UNPAID','detail',v_note)) WHERE id=r.id;
 ELSE RETURN jsonb_build_object('ok',false,'error','INVALID_ACTION'); END IF;
 SELECT * INTO r FROM public.gh_marketplace_orders WHERE id=p_order_id;
 RETURN jsonb_build_object('ok',true,'order',jsonb_build_object('id',r.id,'listingId',r.listing_id,'listingTitle',r.listing_title,'buyerId',r.buyer_id,'sellerId',r.seller_id,'quantity',r.quantity,'unitPrice',r.unit_price,'currency',r.currency,'totalAmount',r.total_amount,'status',r.status,'paymentMethod',r.payment_method,'paymentStatus',r.payment_status,'escrowStatus',r.escrow_status,'deliveryStatus',r.delivery_status,'disputeReason',r.dispute_reason,'cancellationReason',r.cancellation_reason,'buyerNote',r.buyer_note,'sellerNote',r.seller_note,'createdAt',extract(epoch from r.created_at)*1000,'updatedAt',extract(epoch from r.updated_at)*1000,'confirmedAt',CASE WHEN r.confirmed_at IS NULL THEN NULL ELSE extract(epoch from r.confirmed_at)*1000 END,'fulfilledAt',CASE WHEN r.fulfilled_at IS NULL THEN NULL ELSE extract(epoch from r.fulfilled_at)*1000 END,'deliveredAt',CASE WHEN r.delivered_at IS NULL THEN NULL ELSE extract(epoch from r.delivered_at)*1000 END,'buyerConfirmedAt',CASE WHEN r.buyer_confirmed_at IS NULL THEN NULL ELSE extract(epoch from r.buyer_confirmed_at)*1000 END,'sellerConfirmedAt',CASE WHEN r.seller_confirmed_at IS NULL THEN NULL ELSE extract(epoch from r.seller_confirmed_at)*1000 END,'completedAt',CASE WHEN r.completed_at IS NULL THEN NULL ELSE extract(epoch from r.completed_at)*1000 END,'cancelledAt',CASE WHEN r.cancelled_at IS NULL THEN NULL ELSE extract(epoch from r.cancelled_at)*1000 END));
END; $$;
REVOKE ALL ON FUNCTION public.gh_marketplace_order_commerce_update(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_order_commerce_update(text,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.gh_marketplace_order_get(p_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.gh_marketplace_orders%ROWTYPE;
BEGIN SELECT * INTO r FROM public.gh_marketplace_orders WHERE id=p_id; IF NOT FOUND THEN RETURN NULL; END IF;
RETURN jsonb_build_object('id',r.id,'listingId',r.listing_id,'listingTitle',r.listing_title,'buyerId',r.buyer_id,'sellerId',r.seller_id,'quantity',r.quantity,'unitPrice',r.unit_price,'currency',r.currency,'totalAmount',r.total_amount,'status',r.status,'paymentMethod',r.payment_method,'paymentStatus',r.payment_status,'paymentIntentId',r.payment_intent_id,'paymentId',r.payment_id,'txid',r.txid,'ghcSpendRef',r.ghc_spend_ref,'audit',r.audit,'escrowStatus',r.escrow_status,'deliveryStatus',r.delivery_status,'disputeReason',r.dispute_reason,'cancellationReason',r.cancellation_reason,'buyerNote',r.buyer_note,'sellerNote',r.seller_note,'createdAt',extract(epoch from r.created_at)*1000,'updatedAt',extract(epoch from r.updated_at)*1000,'confirmedAt',CASE WHEN r.confirmed_at IS NULL THEN NULL ELSE extract(epoch from r.confirmed_at)*1000 END,'fulfilledAt',CASE WHEN r.fulfilled_at IS NULL THEN NULL ELSE extract(epoch from r.fulfilled_at)*1000 END,'deliveredAt',CASE WHEN r.delivered_at IS NULL THEN NULL ELSE extract(epoch from r.delivered_at)*1000 END,'buyerConfirmedAt',CASE WHEN r.buyer_confirmed_at IS NULL THEN NULL ELSE extract(epoch from r.buyer_confirmed_at)*1000 END,'sellerConfirmedAt',CASE WHEN r.seller_confirmed_at IS NULL THEN NULL ELSE extract(epoch from r.seller_confirmed_at)*1000 END,'completedAt',CASE WHEN r.completed_at IS NULL THEN NULL ELSE extract(epoch from r.completed_at)*1000 END,'cancelledAt',CASE WHEN r.cancelled_at IS NULL THEN NULL ELSE extract(epoch from r.cancelled_at)*1000 END); END; $$;
CREATE OR REPLACE FUNCTION public.gh_marketplace_orders_list_for_user(p_user_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN RETURN COALESCE((SELECT jsonb_agg(row_to_json(x)::jsonb ORDER BY x.created_at DESC) FROM (SELECT id,listing_id AS "listingId",listing_title AS "listingTitle",buyer_id AS "buyerId",seller_id AS "sellerId",quantity,unit_price AS "unitPrice",currency,total_amount AS "totalAmount",status,payment_method AS "paymentMethod",payment_status AS "paymentStatus",payment_intent_id AS "paymentIntentId",payment_id AS "paymentId",txid,ghc_spend_ref AS "ghcSpendRef",audit,escrow_status AS "escrowStatus",delivery_status AS "deliveryStatus",dispute_reason AS "disputeReason",cancellation_reason AS "cancellationReason",buyer_note AS "buyerNote",seller_note AS "sellerNote",extract(epoch from created_at)*1000 AS "createdAt",extract(epoch from updated_at)*1000 AS "updatedAt",CASE WHEN confirmed_at IS NULL THEN NULL ELSE extract(epoch from confirmed_at)*1000 END AS "confirmedAt",CASE WHEN fulfilled_at IS NULL THEN NULL ELSE extract(epoch from fulfilled_at)*1000 END AS "fulfilledAt",CASE WHEN delivered_at IS NULL THEN NULL ELSE extract(epoch from delivered_at)*1000 END AS "deliveredAt",CASE WHEN completed_at IS NULL THEN NULL ELSE extract(epoch from completed_at)*1000 END AS "completedAt",CASE WHEN cancelled_at IS NULL THEN NULL ELSE extract(epoch from cancelled_at)*1000 END AS "cancelledAt" FROM public.gh_marketplace_orders WHERE buyer_id=p_user_id OR seller_id=p_user_id ORDER BY created_at DESC LIMIT 200) x),'[]'::jsonb); END; $$;
REVOKE ALL ON FUNCTION public.gh_marketplace_order_get(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_marketplace_orders_list_for_user(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_order_get(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_orders_list_for_user(text) TO service_role;
COMMENT ON TABLE public.gh_marketplace_orders IS 'GreenHaven durable marketplace commerce authority: reservation, payment, fulfillment, delivery, disputes and buyer/seller lifecycle.';
