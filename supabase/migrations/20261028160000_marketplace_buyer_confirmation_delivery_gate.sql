-- Phase 10 follow-up: buyer confirmation is only valid after the seller has
-- recorded delivery (physical/digital) or activated a service. This closes the
-- prior path where a buyer could complete a merely confirmed, not-yet-fulfilled order.
-- Apply after 20261022130001_marketplace_commerce_v2.sql.

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
   IF r.payment_status<>'verified' OR r.status<>'fulfilling' OR r.delivery_status NOT IN ('delivered','service_active') THEN RETURN jsonb_build_object('ok',false,'error','DELIVERY_NOT_CONFIRMED'); END IF;
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
