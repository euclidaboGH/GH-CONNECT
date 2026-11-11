-- Phase 9.4: durable seller fulfilment, buyer tracking and immutable order activity.
-- Additive only. Does not settle payments, release escrow, issue refunds or mutate inventory.

ALTER TABLE public.gh_marketplace_orders
  ADD COLUMN IF NOT EXISTS fulfilment_method text,
  ADD COLUMN IF NOT EXISTS shipping_carrier text,
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS tracking_url text,
  ADD COLUMN IF NOT EXISTS estimated_delivery_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispatched_at timestamptz;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='gh_marketplace_orders_fulfilment_method_check') THEN
    ALTER TABLE public.gh_marketplace_orders ADD CONSTRAINT gh_marketplace_orders_fulfilment_method_check
      CHECK (fulfilment_method IS NULL OR fulfilment_method IN ('shipping','pickup','digital'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='gh_marketplace_orders_tracking_url_https_check') THEN
    ALTER TABLE public.gh_marketplace_orders ADD CONSTRAINT gh_marketplace_orders_tracking_url_https_check
      CHECK (tracking_url IS NULL OR (length(tracking_url)<=500 AND tracking_url ~ '^https://'));
  END IF;
END $$;

-- Phase 21 already created the canonical immutable order-event journal.
-- Reuse its existing actor_source/before_state/after_state contract; do not
-- create a second incompatible event-table shape or a duplicate event trigger.
DO $$ BEGIN
  IF to_regclass('public.gh_marketplace_order_events') IS NULL THEN
    RAISE EXCEPTION 'MARKETPLACE_ORDER_EVENT_JOURNAL_MISSING: apply Phase 21 journal migration first';
  END IF;
END $$;

ALTER TABLE public.gh_marketplace_order_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_marketplace_order_events_no_client ON public.gh_marketplace_order_events;
CREATE POLICY gh_marketplace_order_events_no_client ON public.gh_marketplace_order_events
  FOR ALL USING (false) WITH CHECK (false);
REVOKE ALL ON public.gh_marketplace_order_events FROM PUBLIC, anon, authenticated, service_role;

-- Extend the existing database-authored event capture to include fulfilment
-- details while preserving its original allowed event_type and actor_source values.
CREATE OR REPLACE FUNCTION public.gh_marketplace_record_order_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_before jsonb;
  v_after jsonb;
  v_actor text;
  v_source text;
  v_type text;
BEGIN
  IF TG_OP='INSERT' THEN
    v_before := '{}'::jsonb;
    v_after := jsonb_build_object(
      'status',NEW.status,'payment_status',NEW.payment_status,'escrow_status',NEW.escrow_status,
      'delivery_status',NEW.delivery_status,'currency',NEW.currency,'total_amount',NEW.total_amount,
      'variant_id',NEW.variant_id,'variant_sku',NEW.variant_sku,'variant_label',NEW.variant_label,
      'fulfilment_method',NEW.fulfilment_method,'shipping_carrier',NEW.shipping_carrier,
      'tracking_number',NEW.tracking_number,'tracking_url',NEW.tracking_url,
      'estimated_delivery_at',NEW.estimated_delivery_at,'dispatched_at',NEW.dispatched_at
    );
    v_type := 'ORDER_CREATED';
  ELSE
    v_before := jsonb_build_object(
      'status',OLD.status,'payment_status',OLD.payment_status,'escrow_status',OLD.escrow_status,
      'delivery_status',OLD.delivery_status,'fulfilment_method',OLD.fulfilment_method,
      'shipping_carrier',OLD.shipping_carrier,'tracking_number',OLD.tracking_number,
      'tracking_url',OLD.tracking_url,'estimated_delivery_at',OLD.estimated_delivery_at,
      'dispatched_at',OLD.dispatched_at,'delivered_at',OLD.delivered_at,
      'buyer_note',OLD.buyer_note,'seller_note',OLD.seller_note,
      'dispute_reason',OLD.dispute_reason,'cancellation_reason',OLD.cancellation_reason
    );
    v_after := jsonb_build_object(
      'status',NEW.status,'payment_status',NEW.payment_status,'escrow_status',NEW.escrow_status,
      'delivery_status',NEW.delivery_status,'fulfilment_method',NEW.fulfilment_method,
      'shipping_carrier',NEW.shipping_carrier,'tracking_number',NEW.tracking_number,
      'tracking_url',NEW.tracking_url,'estimated_delivery_at',NEW.estimated_delivery_at,
      'dispatched_at',NEW.dispatched_at,'delivered_at',NEW.delivered_at,
      'buyer_note',NEW.buyer_note,'seller_note',NEW.seller_note,
      'dispute_reason',NEW.dispute_reason,'cancellation_reason',NEW.cancellation_reason
    );
    IF v_before=v_after THEN RETURN NEW; END IF;
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status='disputed' THEN
      v_type := 'DISPUTE_OPENED';
    ELSIF OLD.status IS DISTINCT FROM NEW.status AND NEW.status='completed' THEN
      v_type := 'ORDER_COMPLETED';
    ELSIF OLD.status IS DISTINCT FROM NEW.status AND NEW.status='cancelled' THEN
      v_type := 'ORDER_CANCELLED';
    ELSIF OLD.status IS DISTINCT FROM NEW.status AND (OLD.status='disputed' OR NEW.status='disputed') THEN
      v_type := 'DISPUTE_STATE_CHANGED';
    ELSIF OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
      v_type := 'PAYMENT_STATE_CHANGED';
    ELSIF OLD.delivery_status IS DISTINCT FROM NEW.delivery_status
       OR OLD.fulfilment_method IS DISTINCT FROM NEW.fulfilment_method
       OR OLD.shipping_carrier IS DISTINCT FROM NEW.shipping_carrier
       OR OLD.tracking_number IS DISTINCT FROM NEW.tracking_number
       OR OLD.tracking_url IS DISTINCT FROM NEW.tracking_url
       OR OLD.estimated_delivery_at IS DISTINCT FROM NEW.estimated_delivery_at
       OR OLD.dispatched_at IS DISTINCT FROM NEW.dispatched_at THEN
      v_type := 'DELIVERY_STATE_CHANGED';
    ELSIF OLD.escrow_status IS DISTINCT FROM NEW.escrow_status THEN
      v_type := 'ESCROW_STATE_CHANGED';
    ELSE
      v_type := 'ORDER_STATE_CHANGED';
    END IF;
  END IF;

  v_actor := NULLIF(current_setting('gh.marketplace_actor_id',true),'');
  IF v_actor IS NOT NULL THEN
    v_source := 'service_context';
  ELSE
    v_actor := NULLIF(current_setting('request.jwt.claim.sub',true),'');
    IF v_actor IS NOT NULL THEN
      v_source := 'authenticated_claim';
    ELSIF current_user='service_role' OR session_user='service_role' THEN
      v_actor := 'service_role';
      v_source := 'service_context';
    ELSE
      v_source := 'unknown';
    END IF;
  END IF;

  INSERT INTO public.gh_marketplace_order_events(
    order_id,event_type,actor_id,actor_source,before_state,after_state
  ) VALUES (NEW.id,v_type,v_actor,v_source,v_before,v_after);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.gh_marketplace_record_order_event() FROM PUBLIC, anon, authenticated, service_role;

-- Keep the existing INSERT trigger and replace the UPDATE trigger with a wider
-- column list so fulfilment-only changes are also captured.
DROP TRIGGER IF EXISTS trg_gh_marketplace_order_event_update ON public.gh_marketplace_orders;
CREATE TRIGGER trg_gh_marketplace_order_event_update
AFTER UPDATE OF status,payment_status,escrow_status,delivery_status,fulfilment_method,
  shipping_carrier,tracking_number,tracking_url,estimated_delivery_at,dispatched_at
ON public.gh_marketplace_orders
FOR EACH ROW EXECUTE FUNCTION public.gh_marketplace_record_order_event();

-- Import legacy audit entries into the existing immutable journal without
-- inventing buyer/seller attribution or introducing new event_type values.
INSERT INTO public.gh_marketplace_order_events(order_id,actor_id,actor_source,event_type,before_state,after_state,created_at)
SELECT o.id,'system:legacy-audit-import','service_context','ORDER_STATE_CHANGED','{}'::jsonb,
       jsonb_build_object('legacyAudit',true,'legacyAuditAction',left(coalesce(entry->>'action','historical_update'),64),
         'legacyAuditDetail',left(coalesce(entry->>'detail',''),500)),
       CASE WHEN coalesce(entry->>'at','') ~ '^[0-9]+(\.[0-9]+)?$' AND length(entry->>'at')<=16 AND (entry->>'at')::numeric BETWEEN 0 AND 32503680000000
            THEN to_timestamp((entry->>'at')::numeric/1000) ELSE o.created_at END
FROM public.gh_marketplace_orders o
CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(o.audit)='array' THEN o.audit ELSE '[]'::jsonb END) AS items(entry)
WHERE NOT EXISTS (
  SELECT 1 FROM public.gh_marketplace_order_events e
  WHERE e.order_id=o.id AND e.actor_id='system:legacy-audit-import'
    AND e.after_state->>'legacyAudit'='true'
    AND e.after_state->>'legacyAuditAction'=left(coalesce(entry->>'action','historical_update'),64)
    AND e.created_at=CASE WHEN coalesce(entry->>'at','') ~ '^[0-9]+(\.[0-9]+)?$' AND length(entry->>'at')<=16 AND (entry->>'at')::numeric BETWEEN 0 AND 32503680000000
                          THEN to_timestamp((entry->>'at')::numeric/1000) ELSE o.created_at END
);

CREATE OR REPLACE FUNCTION public.gh_marketplace_order_fulfilment_update(
  p_order_id text,
  p_actor_id text,
  p_action text,
  p_note text DEFAULT NULL,
  p_fulfilment_method text DEFAULT NULL,
  p_carrier text DEFAULT NULL,
  p_tracking_number text DEFAULT NULL,
  p_tracking_url text DEFAULT NULL,
  p_estimated_delivery_at timestamptz DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  r public.gh_marketplace_orders%ROWTYPE;
  v_action text:=lower(trim(coalesce(p_action,'')));
  v_method text:=lower(trim(coalesce(p_fulfilment_method,'')));
  v_carrier text:=left(trim(coalesce(p_carrier,'')),80);
  v_tracking text:=left(trim(coalesce(p_tracking_number,'')),120);
  v_url text:=trim(coalesce(p_tracking_url,''));
  v_note text:=left(trim(coalesce(p_note,'')),500);
  v_role text;
BEGIN
  IF trim(coalesce(p_order_id,''))='' OR trim(coalesce(p_actor_id,''))='' THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_INPUT');
  END IF;
  SELECT * INTO r FROM public.gh_marketplace_orders WHERE id=trim(p_order_id) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','NOT_FOUND'); END IF;
  IF r.buyer_id<>p_actor_id AND r.seller_id<>p_actor_id THEN RETURN jsonb_build_object('ok',false,'error','FORBIDDEN'); END IF;
  v_role:=CASE WHEN r.seller_id=p_actor_id THEN 'seller' ELSE 'buyer' END;

  -- Idempotent network retries do not create duplicate events or state changes.
  IF v_action='seller_fulfill' AND v_role='seller' AND r.status='fulfilling'
     AND r.fulfilment_method=lower(trim(coalesce(p_fulfilment_method,'')))
     AND coalesce(r.shipping_carrier,'')=left(trim(coalesce(p_carrier,'')),80)
     AND coalesce(r.tracking_number,'')=left(trim(coalesce(p_tracking_number,'')),120)
     AND coalesce(r.tracking_url,'')=trim(coalesce(p_tracking_url,''))
     AND r.estimated_delivery_at IS NOT DISTINCT FROM p_estimated_delivery_at THEN
    RETURN jsonb_build_object('ok',true,'idempotent',true,'order',public.gh_marketplace_order_get(r.id));
  ELSIF v_action='seller_dispatch' AND v_role='seller' AND r.status='fulfilling' AND r.delivery_status='shipped' THEN
    RETURN jsonb_build_object('ok',true,'idempotent',true,'order',public.gh_marketplace_order_get(r.id));
  ELSIF v_action='seller_mark_delivered' AND v_role='seller' AND r.status='fulfilling' AND r.delivery_status IN ('delivered','service_active') THEN
    RETURN jsonb_build_object('ok',true,'idempotent',true,'order',public.gh_marketplace_order_get(r.id));
  ELSIF v_action='buyer_confirm' AND v_role='buyer' AND r.status='completed' AND r.buyer_confirmed_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok',true,'idempotent',true,'order',public.gh_marketplace_order_get(r.id));
  END IF;

  PERFORM set_config('gh.marketplace_actor_id',p_actor_id,true);

  IF v_action='seller_fulfill' THEN
    IF v_role<>'seller' THEN RETURN jsonb_build_object('ok',false,'error','SELLER_ONLY'); END IF;
    IF r.payment_status<>'verified' OR r.status<>'confirmed' THEN RETURN jsonb_build_object('ok',false,'error','PAYMENT_REQUIRED'); END IF;
    IF v_method NOT IN ('shipping','pickup','digital') THEN RETURN jsonb_build_object('ok',false,'error','INVALID_FULFILMENT_METHOD'); END IF;
    IF v_method='shipping' AND (length(v_carrier)<2 OR length(v_tracking)<3) THEN RETURN jsonb_build_object('ok',false,'error','SHIPPING_DETAILS_REQUIRED'); END IF;
    IF v_method<>'shipping' AND (v_carrier<>'' OR v_tracking<>'' OR v_url<>'') THEN RETURN jsonb_build_object('ok',false,'error','SHIPPING_METADATA_NOT_ALLOWED'); END IF;
    IF v_url<>'' AND (length(v_url)>500 OR v_url !~ '^https://') THEN RETURN jsonb_build_object('ok',false,'error','INVALID_TRACKING_URL'); END IF;
    IF p_estimated_delivery_at IS NOT NULL AND (p_estimated_delivery_at < now()-interval '1 day' OR p_estimated_delivery_at > now()+interval '366 days') THEN
      RETURN jsonb_build_object('ok',false,'error','INVALID_ESTIMATED_DELIVERY');
    END IF;
    UPDATE public.gh_marketplace_orders SET status='fulfilling',delivery_status='processing',fulfilment_method=v_method,
      shipping_carrier=NULLIF(v_carrier,''),tracking_number=NULLIF(v_tracking,''),tracking_url=NULLIF(v_url,''),
      estimated_delivery_at=p_estimated_delivery_at,seller_note=NULLIF(v_note,''),fulfilled_at=now(),updated_at=now(),
      audit=coalesce(audit,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('at',(extract(epoch from now())*1000)::bigint,'action','SELLER_FULFILL','detail',v_note))
      WHERE id=r.id;
  ELSIF v_action='seller_dispatch' THEN
    IF v_role<>'seller' THEN RETURN jsonb_build_object('ok',false,'error','SELLER_ONLY'); END IF;
    IF r.payment_status<>'verified' THEN RETURN jsonb_build_object('ok',false,'error','PAYMENT_REQUIRED'); END IF;
    IF r.status<>'fulfilling' OR r.fulfilment_method<>'shipping' OR r.delivery_status<>'processing' THEN RETURN jsonb_build_object('ok',false,'error','INVALID_STATE'); END IF;
    IF r.shipping_carrier IS NULL OR r.tracking_number IS NULL THEN RETURN jsonb_build_object('ok',false,'error','SHIPPING_DETAILS_REQUIRED'); END IF;
    UPDATE public.gh_marketplace_orders SET delivery_status='shipped',dispatched_at=now(),seller_note=NULLIF(v_note,''),updated_at=now(),
      audit=coalesce(audit,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('at',(extract(epoch from now())*1000)::bigint,'action','SELLER_DISPATCHED','detail',v_note)) WHERE id=r.id;
  ELSIF v_action='seller_mark_delivered' THEN
    IF v_role<>'seller' THEN RETURN jsonb_build_object('ok',false,'error','SELLER_ONLY'); END IF;
    IF r.payment_status<>'verified' THEN RETURN jsonb_build_object('ok',false,'error','PAYMENT_REQUIRED'); END IF;
    IF r.status<>'fulfilling' THEN RETURN jsonb_build_object('ok',false,'error','INVALID_STATE'); END IF;
    IF r.fulfilment_method IS NULL THEN
      -- Legacy orders were created before delivery methods were captured. Preserve
      -- the old completion route without guessing shipping/pickup/digital semantics.
      UPDATE public.gh_marketplace_orders SET delivery_status='delivered',delivered_at=now(),seller_confirmed_at=now(),
        seller_note=NULLIF(v_note,''),updated_at=now(),
        audit=coalesce(audit,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('at',(extract(epoch from now())*1000)::bigint,'action','SELLER_DELIVERED_LEGACY','detail',v_note)) WHERE id=r.id;
    ELSE
      IF r.fulfilment_method='shipping' AND r.delivery_status<>'shipped' THEN RETURN jsonb_build_object('ok',false,'error','DISPATCH_REQUIRED'); END IF;
      IF r.fulfilment_method NOT IN ('shipping','pickup','digital') THEN RETURN jsonb_build_object('ok',false,'error','FULFILMENT_METHOD_REQUIRED'); END IF;
      UPDATE public.gh_marketplace_orders SET delivery_status=CASE WHEN fulfilment_method='digital' THEN 'service_active' ELSE 'delivered' END,
        delivered_at=now(),seller_confirmed_at=now(),seller_note=NULLIF(v_note,''),updated_at=now(),
        audit=coalesce(audit,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('at',(extract(epoch from now())*1000)::bigint,'action','SELLER_DELIVERED','detail',v_note)) WHERE id=r.id;
    END IF;
  ELSIF v_action='buyer_confirm' THEN
    IF v_role<>'buyer' THEN RETURN jsonb_build_object('ok',false,'error','BUYER_ONLY'); END IF;
    IF r.payment_status<>'verified' OR r.status<>'fulfilling' OR r.delivery_status NOT IN ('delivered','service_active') THEN RETURN jsonb_build_object('ok',false,'error','DELIVERY_NOT_CONFIRMED'); END IF;
    UPDATE public.gh_marketplace_orders SET status='completed',delivery_status='completed',buyer_confirmed_at=now(),completed_at=now(),
      buyer_note=NULLIF(v_note,''),updated_at=now(),
      audit=coalesce(audit,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('at',(extract(epoch from now())*1000)::bigint,'action','BUYER_CONFIRMED','detail',v_note)) WHERE id=r.id;
  ELSE
    RETURN jsonb_build_object('ok',false,'error','INVALID_ACTION');
  END IF;

  RETURN jsonb_build_object('ok',true,'order',public.gh_marketplace_order_get(r.id));
END $$;

CREATE OR REPLACE FUNCTION public.gh_marketplace_order_timeline(p_order_id text,p_actor_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.gh_marketplace_orders%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.gh_marketplace_orders WHERE id=trim(coalesce(p_order_id,''));
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','NOT_FOUND'); END IF;
  IF r.buyer_id<>trim(coalesce(p_actor_id,'')) AND r.seller_id<>trim(coalesce(p_actor_id,'')) THEN RETURN jsonb_build_object('ok',false,'error','FORBIDDEN'); END IF;
  RETURN jsonb_build_object('ok',true,'events',coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id',e.id,
      'actorRole',CASE WHEN e.actor_id=r.buyer_id THEN 'buyer' WHEN e.actor_id=r.seller_id THEN 'seller' WHEN e.actor_source='service_context' THEN 'system' ELSE 'operator' END,
      'eventType',lower(e.event_type),
      'note',coalesce(e.after_state->>'buyer_note',e.after_state->>'seller_note',e.after_state->>'dispute_reason',e.after_state->>'cancellation_reason'),
      'metadata',jsonb_build_object('actorSource',e.actor_source,'before',e.before_state,'after',e.after_state),
      'createdAt',extract(epoch from e.created_at)*1000
    ) ORDER BY e.created_at,e.id)
    FROM (SELECT * FROM public.gh_marketplace_order_events WHERE order_id=r.id ORDER BY created_at DESC,id DESC LIMIT 200) e
  ),'[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.gh_marketplace_order_get(p_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.gh_marketplace_orders%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.gh_marketplace_orders WHERE id=trim(coalesce(p_id,''));
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'id',r.id,'listingId',r.listing_id,'listingTitle',r.listing_title,'buyerId',r.buyer_id,'sellerId',r.seller_id,
    'quantity',r.quantity,'unitPrice',r.unit_price,'currency',r.currency,'totalAmount',r.total_amount,'status',r.status,
    'paymentMethod',r.payment_method,'paymentStatus',r.payment_status,'paymentIntentId',r.payment_intent_id,
    'paymentId',r.payment_id,'txid',r.txid,'ghcSpendRef',r.ghc_spend_ref,'audit',r.audit,
    'createdAt',extract(epoch from r.created_at)*1000,'updatedAt',extract(epoch from r.updated_at)*1000,
    'confirmedAt',CASE WHEN r.confirmed_at IS NULL THEN NULL ELSE extract(epoch from r.confirmed_at)*1000 END,
    'fulfilledAt',CASE WHEN r.fulfilled_at IS NULL THEN NULL ELSE extract(epoch from r.fulfilled_at)*1000 END,
    'completedAt',CASE WHEN r.completed_at IS NULL THEN NULL ELSE extract(epoch from r.completed_at)*1000 END,
    'cancelledAt',CASE WHEN r.cancelled_at IS NULL THEN NULL ELSE extract(epoch from r.cancelled_at)*1000 END,
    'reservationExpiresAt',CASE WHEN r.reservation_expires_at IS NULL THEN NULL ELSE extract(epoch from r.reservation_expires_at)*1000 END,
    'variantId',r.variant_id,'variantSku',r.variant_sku,'variantLabel',r.variant_label,
    'escrowStatus',r.escrow_status,'deliveryStatus',r.delivery_status,'disputeReason',r.dispute_reason,
    'cancellationReason',r.cancellation_reason,'buyerNote',r.buyer_note,'sellerNote',r.seller_note,
    'deliveredAt',CASE WHEN r.delivered_at IS NULL THEN NULL ELSE extract(epoch from r.delivered_at)*1000 END,
    'buyerConfirmedAt',CASE WHEN r.buyer_confirmed_at IS NULL THEN NULL ELSE extract(epoch from r.buyer_confirmed_at)*1000 END,
    'sellerConfirmedAt',CASE WHEN r.seller_confirmed_at IS NULL THEN NULL ELSE extract(epoch from r.seller_confirmed_at)*1000 END,
    'fulfilmentMethod',r.fulfilment_method,'shippingCarrier',r.shipping_carrier,'trackingNumber',r.tracking_number,'trackingUrl',r.tracking_url,
    'estimatedDeliveryAt',CASE WHEN r.estimated_delivery_at IS NULL THEN NULL ELSE extract(epoch from r.estimated_delivery_at)*1000 END,
    'dispatchedAt',CASE WHEN r.dispatched_at IS NULL THEN NULL ELSE extract(epoch from r.dispatched_at)*1000 END
  );
END $$;

CREATE OR REPLACE FUNCTION public.gh_marketplace_orders_list_for_user(p_user_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_orders jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(public.gh_marketplace_order_get(x.id) ORDER BY x.created_at DESC),'[]'::jsonb)
    INTO v_orders FROM (SELECT id,created_at FROM public.gh_marketplace_orders WHERE buyer_id=p_user_id OR seller_id=p_user_id ORDER BY created_at DESC LIMIT 200) x;
  RETURN v_orders;
END $$;

REVOKE ALL ON FUNCTION public.gh_marketplace_order_fulfilment_update(text,text,text,text,text,text,text,text,timestamptz) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_marketplace_order_timeline(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_order_fulfilment_update(text,text,text,text,text,text,text,text,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_order_timeline(text,text) TO service_role;
REVOKE ALL ON FUNCTION public.gh_marketplace_order_get(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_marketplace_orders_list_for_user(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_order_get(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_orders_list_for_user(text) TO service_role;
