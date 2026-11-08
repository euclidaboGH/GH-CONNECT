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

CREATE TABLE IF NOT EXISTS public.gh_marketplace_order_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id text NOT NULL REFERENCES public.gh_marketplace_orders(id) ON DELETE RESTRICT,
  actor_id text NOT NULL,
  actor_role text NOT NULL CHECK (actor_role IN ('buyer','seller','system','operator')),
  event_type text NOT NULL CHECK (length(event_type) BETWEEN 1 AND 64),
  note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata)='object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gh_marketplace_order_events_timeline
  ON public.gh_marketplace_order_events(order_id, created_at ASC, id ASC);
ALTER TABLE public.gh_marketplace_order_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_marketplace_order_events_no_client ON public.gh_marketplace_order_events;
CREATE POLICY gh_marketplace_order_events_no_client ON public.gh_marketplace_order_events
  FOR ALL USING (false) WITH CHECK (false);
REVOKE ALL ON public.gh_marketplace_order_events FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gh_marketplace_order_events_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  RAISE EXCEPTION 'MARKETPLACE_ORDER_EVENTS_APPEND_ONLY';
END $$;
DROP TRIGGER IF EXISTS gh_marketplace_order_events_immutable ON public.gh_marketplace_order_events;
CREATE TRIGGER gh_marketplace_order_events_immutable
  BEFORE UPDATE OR DELETE ON public.gh_marketplace_order_events
  FOR EACH ROW EXECUTE FUNCTION public.gh_marketplace_order_events_immutable();
REVOKE ALL ON FUNCTION public.gh_marketplace_order_events_immutable() FROM PUBLIC, anon, authenticated, service_role;

-- Capture new order creation and subsequent payment/order/delivery state changes,
-- including state updates performed by existing payment RPCs.
CREATE OR REPLACE FUNCTION public.gh_marketplace_order_event_capture()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_actor text:=NULLIF(current_setting('gh.marketplace_actor_id',true),'');
  v_role text:='system';
  v_note text;
BEGIN
  IF TG_OP='INSERT' THEN
    v_actor:=coalesce(v_actor,NEW.buyer_id);
    v_role:=CASE WHEN v_actor=NEW.buyer_id THEN 'buyer' WHEN v_actor=NEW.seller_id THEN 'seller' ELSE 'system' END;
    INSERT INTO public.gh_marketplace_order_events(order_id,actor_id,actor_role,event_type,metadata)
      VALUES(NEW.id,v_actor,v_role,'order_created',jsonb_build_object('listingId',NEW.listing_id,'variantSku',NEW.variant_sku,'quantity',NEW.quantity,'currency',NEW.currency,'totalAmount',NEW.total_amount));
    RETURN NEW;
  END IF;

  v_actor:=coalesce(v_actor,'system:marketplace-state-change');
  v_role:=CASE WHEN v_actor=NEW.buyer_id THEN 'buyer' WHEN v_actor=NEW.seller_id THEN 'seller' ELSE 'system' END;
  v_note:=coalesce(NULLIF(NEW.buyer_note,''),NULLIF(NEW.seller_note,''),NULLIF(NEW.dispute_reason,''),NULLIF(NEW.cancellation_reason,''));

  IF OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
    INSERT INTO public.gh_marketplace_order_events(order_id,actor_id,actor_role,event_type,note,metadata)
      VALUES(NEW.id,v_actor,v_role,'payment_'||left(coalesce(NEW.payment_status,'unknown'),48),NULL,jsonb_build_object('method',NEW.payment_method,'currency',NEW.currency,'totalAmount',NEW.total_amount));
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.gh_marketplace_order_events(order_id,actor_id,actor_role,event_type,note,metadata)
      VALUES(NEW.id,v_actor,v_role,
        CASE WHEN NEW.status='fulfilling' THEN 'fulfilment_started' WHEN NEW.status='completed' THEN 'order_completed' WHEN NEW.status='cancelled' THEN 'order_cancelled' WHEN NEW.status='disputed' THEN 'dispute_opened' ELSE 'order_'||left(coalesce(NEW.status,'updated'),48) END,
        v_note,jsonb_build_object('paymentStatus',NEW.payment_status));
  END IF;
  IF OLD.delivery_status IS DISTINCT FROM NEW.delivery_status THEN
    INSERT INTO public.gh_marketplace_order_events(order_id,actor_id,actor_role,event_type,note,metadata)
      VALUES(NEW.id,v_actor,v_role,
        CASE WHEN NEW.delivery_status='processing' THEN 'fulfilment_processing' WHEN NEW.delivery_status='shipped' THEN 'dispatched' WHEN NEW.delivery_status='delivered' THEN 'delivered' WHEN NEW.delivery_status='service_active' THEN 'service_activated' WHEN NEW.delivery_status='completed' THEN 'delivery_completed' ELSE 'delivery_'||left(coalesce(NEW.delivery_status,'updated'),40) END,
        v_note,jsonb_build_object('method',NEW.fulfilment_method,'carrier',NEW.shipping_carrier,'trackingNumber',NEW.tracking_number,'trackingUrl',NEW.tracking_url,'estimatedDeliveryAt',NEW.estimated_delivery_at,'dispatchedAt',NEW.dispatched_at));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS gh_marketplace_order_event_capture ON public.gh_marketplace_orders;
CREATE TRIGGER gh_marketplace_order_event_capture
  AFTER INSERT OR UPDATE OF status,payment_status,delivery_status ON public.gh_marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION public.gh_marketplace_order_event_capture();
REVOKE ALL ON FUNCTION public.gh_marketplace_order_event_capture() FROM PUBLIC, anon, authenticated, service_role;

-- Import legacy audit rows as system history; do not invent buyer/seller attribution.
INSERT INTO public.gh_marketplace_order_events(order_id,actor_id,actor_role,event_type,note,metadata,created_at)
SELECT o.id,'system:legacy-audit-import','system',
       left(coalesce(nullif(regexp_replace(lower(coalesce(entry->>'action','')), '[^a-z0-9_]+', '_', 'g'), ''), 'historical_update'),64),
       NULLIF(left(coalesce(entry->>'detail',''),500),''),
       jsonb_build_object('legacyAudit',true),
       CASE WHEN coalesce(entry->>'at','') ~ '^[0-9]+(\.[0-9]+)?$' AND length(entry->>'at')<=16 AND (entry->>'at')::numeric BETWEEN 0 AND 32503680000000
            THEN to_timestamp((entry->>'at')::numeric/1000) ELSE o.created_at END
FROM public.gh_marketplace_orders o
CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(o.audit)='array' THEN o.audit ELSE '[]'::jsonb END) AS items(entry)
WHERE NOT EXISTS (
  SELECT 1 FROM public.gh_marketplace_order_events e
  WHERE e.order_id=o.id AND e.actor_id='system:legacy-audit-import' AND e.metadata->>'legacyAudit'='true'
    AND e.event_type=left(coalesce(nullif(regexp_replace(lower(coalesce(entry->>'action','')), '[^a-z0-9_]+', '_', 'g'), ''), 'historical_update'),64)
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
    SELECT jsonb_agg(jsonb_build_object('id',e.id,'actorRole',e.actor_role,'eventType',e.event_type,'note',e.note,'metadata',e.metadata,'createdAt',extract(epoch from e.created_at)*1000) ORDER BY e.created_at,e.id)
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
