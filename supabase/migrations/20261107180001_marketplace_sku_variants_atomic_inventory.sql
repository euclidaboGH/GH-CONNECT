-- Phase 9.3: durable SKU variants and atomic per-variant inventory.
-- Additive and service-role only. Existing non-variant listings retain the legacy stock path.

CREATE TABLE IF NOT EXISTS public.gh_marketplace_variants (
  id text PRIMARY KEY,
  listing_id text NOT NULL REFERENCES public.gh_marketplace_listings(id) ON DELETE RESTRICT,
  seller_id text NOT NULL,
  sku text NOT NULL,
  label text NOT NULL,
  price numeric(18,8) NOT NULL CHECK (price >= 0),
  currency text NOT NULL CHECK (upper(currency) IN ('GHC','PI')),
  stock_on_hand integer NOT NULL DEFAULT 0 CHECK (stock_on_hand >= 0),
  stock_reserved integer NOT NULL DEFAULT 0 CHECK (stock_reserved >= 0 AND stock_reserved <= stock_on_hand),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_marketplace_variants_sku_nonempty CHECK (length(trim(sku)) BETWEEN 1 AND 64),
  CONSTRAINT gh_marketplace_variants_label_nonempty CHECK (length(trim(label)) BETWEEN 1 AND 120)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_marketplace_variants_seller_sku
  ON public.gh_marketplace_variants (seller_id, lower(sku));
CREATE INDEX IF NOT EXISTS idx_gh_marketplace_variants_listing_active
  ON public.gh_marketplace_variants (listing_id, active, lower(sku));
ALTER TABLE public.gh_marketplace_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_marketplace_variants_no_client ON public.gh_marketplace_variants;
CREATE POLICY gh_marketplace_variants_no_client ON public.gh_marketplace_variants
  FOR ALL USING (false) WITH CHECK (false);

ALTER TABLE public.gh_marketplace_orders
  ADD COLUMN IF NOT EXISTS variant_id text,
  ADD COLUMN IF NOT EXISTS variant_sku text,
  ADD COLUMN IF NOT EXISTS variant_label text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gh_marketplace_orders_variant_fk') THEN
    ALTER TABLE public.gh_marketplace_orders
      ADD CONSTRAINT gh_marketplace_orders_variant_fk
      FOREIGN KEY (variant_id) REFERENCES public.gh_marketplace_variants(id) ON DELETE RESTRICT;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_gh_marketplace_orders_variant
  ON public.gh_marketplace_orders (variant_id, created_at DESC) WHERE variant_id IS NOT NULL;

-- Seller replacement is one transaction. Existing reserved stock is protected:
-- the seller cannot reduce on-hand below already reserved units. Omitted variants
-- become inactive (never deleted), preserving order references and audit history.
CREATE OR REPLACE FUNCTION public.gh_marketplace_variants_replace(
  p_listing_id text, p_seller_id text, p_variants jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  l public.gh_marketplace_listings%ROWTYPE;
  v jsonb;
  v_id text; v_sku text; v_label text; v_price numeric; v_currency text; v_stock integer;
  v_seen text[] := ARRAY[]::text[];
  v_seen_ids text[] := ARRAY[]::text[];
  v_count integer := 0;
BEGIN
  IF trim(coalesce(p_listing_id,'')) = '' OR trim(coalesce(p_seller_id,'')) = '' OR
     jsonb_typeof(p_variants) IS DISTINCT FROM 'array' OR CASE WHEN jsonb_typeof(p_variants)='array' THEN jsonb_array_length(p_variants) ELSE 101 END > 100 THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_INPUT');
  END IF;
  SELECT * INTO l FROM public.gh_marketplace_listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','LISTING_NOT_FOUND'); END IF;
  IF l.seller_id <> p_seller_id THEN RETURN jsonb_build_object('ok',false,'error','FORBIDDEN'); END IF;
  IF l.kind <> 'product' THEN RETURN jsonb_build_object('ok',false,'error','VARIANTS_REQUIRE_PRODUCT_LISTING'); END IF;
  IF EXISTS (SELECT 1 FROM public.gh_marketplace_variants oldv
             WHERE oldv.listing_id=p_listing_id AND oldv.active=true AND oldv.stock_reserved>0
               AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_variants) AS incoming(value)
                               WHERE lower(trim(coalesce(value->>'sku','')))=lower(oldv.sku))) THEN
    RETURN jsonb_build_object('ok',false,'error','VARIANT_HAS_ACTIVE_RESERVATIONS');
  END IF;

  FOR v IN SELECT value FROM jsonb_array_elements(p_variants) LOOP
    v_id := trim(coalesce(v->>'id',''));
    v_sku := trim(coalesce(v->>'sku',''));
    v_label := trim(coalesce(v->>'label',''));
    v_price := CASE WHEN coalesce(v->>'price','') ~ '^([0-9]+)(\.[0-9]{1,8})?$' THEN (v->>'price')::numeric ELSE -1 END;
    v_currency := upper(trim(coalesce(v->>'currency',l.currency)));
    v_stock := CASE WHEN coalesce(v->>'stockOnHand','') ~ '^[0-9]{1,7}$' THEN (v->>'stockOnHand')::integer ELSE -1 END;
    IF v_id = '' OR length(v_id) > 80 OR v_sku = '' OR length(v_sku) > 64 OR
       v_label = '' OR length(v_label) > 120 OR v_id ~ '[[:cntrl:]]' OR v_sku ~ '[[:cntrl:]]' OR v_label ~ '[[:cntrl:]]' OR v_price < 0 OR v_price > 1000000 OR
       v_stock < 0 OR v_stock > 1000000 OR v_currency NOT IN ('GHC','PI') OR
       v_currency <> upper(l.currency) OR lower(v_sku) = ANY(v_seen) OR v_id = ANY(v_seen_ids) THEN
      RETURN jsonb_build_object('ok',false,'error','INVALID_VARIANT');
    END IF;
    IF EXISTS (SELECT 1 FROM public.gh_marketplace_variants x
               WHERE x.id = v_id AND (x.listing_id <> p_listing_id OR x.seller_id <> p_seller_id OR lower(x.sku) <> lower(v_sku))) THEN
      RETURN jsonb_build_object('ok',false,'error','VARIANT_ID_CONFLICT');
    END IF;
    IF EXISTS (SELECT 1 FROM public.gh_marketplace_variants x
               WHERE x.seller_id = p_seller_id AND lower(x.sku) = lower(v_sku) AND x.id <> v_id) THEN
      RETURN jsonb_build_object('ok',false,'error','SKU_ALREADY_EXISTS');
    END IF;
    IF EXISTS (SELECT 1 FROM public.gh_marketplace_variants x
               WHERE x.id = v_id AND x.stock_reserved > v_stock) THEN
      RETURN jsonb_build_object('ok',false,'error','STOCK_BELOW_RESERVED','variantId',v_id);
    END IF;
    v_seen := array_append(v_seen,lower(v_sku));
    v_seen_ids := array_append(v_seen_ids,v_id);
  END LOOP;

  -- Validation above is read-only. Apply the full replacement only after every
  -- row passes, so a malformed later row cannot leave a partial catalogue write.
  v_seen := ARRAY[]::text[];
  FOR v IN SELECT value FROM jsonb_array_elements(p_variants) LOOP
    v_id := trim(coalesce(v->>'id',''));
    v_sku := trim(coalesce(v->>'sku',''));
    v_label := trim(coalesce(v->>'label',''));
    v_price := (v->>'price')::numeric;
    v_currency := upper(trim(coalesce(v->>'currency',l.currency)));
    v_stock := (v->>'stockOnHand')::integer;
    INSERT INTO public.gh_marketplace_variants
      (id,listing_id,seller_id,sku,label,price,currency,stock_on_hand,stock_reserved,active,created_at,updated_at)
    VALUES (v_id,p_listing_id,p_seller_id,v_sku,v_label,v_price,v_currency,v_stock,0,coalesce((v->>'active')::boolean,true),now(),now())
    ON CONFLICT (id) DO UPDATE SET sku=EXCLUDED.sku,label=EXCLUDED.label,price=EXCLUDED.price,
      currency=EXCLUDED.currency,stock_on_hand=EXCLUDED.stock_on_hand,active=EXCLUDED.active,updated_at=now()
    WHERE gh_marketplace_variants.listing_id = p_listing_id AND gh_marketplace_variants.seller_id = p_seller_id;
    v_seen := array_append(v_seen,lower(v_sku));
    v_count := v_count + 1;
  END LOOP;

  UPDATE public.gh_marketplace_variants SET active=false,updated_at=now()
   WHERE listing_id=p_listing_id AND NOT (lower(sku)=ANY(v_seen)) AND active=true;
  IF v_count > 0 THEN
    IF EXISTS (SELECT 1 FROM public.gh_marketplace_variants WHERE listing_id=p_listing_id AND active=true) THEN
      UPDATE public.gh_marketplace_listings SET
        availability = (SELECT coalesce(sum(stock_on_hand-stock_reserved),0)::integer FROM public.gh_marketplace_variants WHERE listing_id=p_listing_id AND active=true),
        status = CASE WHEN status IN ('active','sold_out') THEN CASE WHEN (SELECT coalesce(sum(stock_on_hand-stock_reserved),0) FROM public.gh_marketplace_variants WHERE listing_id=p_listing_id AND active=true) <= 0 THEN 'sold_out' ELSE 'active' END ELSE status END,
        updated_at=now() WHERE id=p_listing_id AND status <> 'removed';
    ELSE
      -- No active SKUs means the seller has returned the listing to legacy shared stock.
      UPDATE public.gh_marketplace_listings SET availability=l.availability,status=l.status,updated_at=now()
       WHERE id=p_listing_id AND status <> 'removed';
    END IF;
  END IF;
  RETURN jsonb_build_object('ok',true,'count',v_count);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok',false,'error','SKU_ALREADY_EXISTS');
END $$;

-- Listing row and complete SKU set publish in one database transaction. This
-- prevents a brief active-listing window in which the legacy stock RPC could
-- create an unbound order before the first SKU rows are installed.
CREATE OR REPLACE FUNCTION public.gh_marketplace_listing_upsert_with_variants(p_row jsonb,p_variants jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  listing_result jsonb;
  variant_result jsonb;
BEGIN
  listing_result := public.gh_marketplace_listing_upsert(p_row);
  IF coalesce((listing_result->>'ok')::boolean,false) IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE=coalesce(listing_result->>'error','LISTING_UPSERT_FAILED');
  END IF;
  variant_result := public.gh_marketplace_variants_replace(
    trim(coalesce(p_row->>'id','')), trim(coalesce(p_row->>'sellerId','')), p_variants
  );
  IF coalesce((variant_result->>'ok')::boolean,false) IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE=coalesce(variant_result->>'error','VARIANT_SAVE_FAILED');
  END IF;
  RETURN jsonb_build_object('ok',true,'id',p_row->>'id','variantCount',coalesce((variant_result->>'count')::integer,0));
EXCEPTION WHEN SQLSTATE 'P0001' THEN
  RETURN jsonb_build_object('ok',false,'error',SQLERRM);
END $$;

CREATE OR REPLACE FUNCTION public.gh_marketplace_variants_list(p_listing_id text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'sku',sku,'label',label,'price',price,'currency',currency,
    'stockOnHand',stock_on_hand,'stockReserved',stock_reserved,
    'available',greatest(0,stock_on_hand-stock_reserved),'active',active
  ) ORDER BY lower(sku)), '[]'::jsonb)
  FROM public.gh_marketplace_variants WHERE listing_id=p_listing_id;
$$;

-- Variant-aware inventory release/commit. A cancellation releases only the hold;
-- payment verification commits units by reducing on-hand and reserved together.
CREATE OR REPLACE FUNCTION public.gh_marketplace_order_stock_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status='cancelled' AND coalesce(OLD.stock_reserved,0)>0 THEN
    IF OLD.variant_id IS NOT NULL THEN
      -- Lock listing before variant to match reservation/maintenance lock order.
      PERFORM 1 FROM public.gh_marketplace_listings WHERE id=OLD.listing_id FOR UPDATE;
      UPDATE public.gh_marketplace_variants SET stock_reserved=greatest(0,stock_reserved-OLD.stock_reserved),updated_at=now()
       WHERE id=OLD.variant_id;
      UPDATE public.gh_marketplace_listings SET
        availability=(SELECT coalesce(sum(stock_on_hand-stock_reserved),0)::integer FROM public.gh_marketplace_variants WHERE listing_id=OLD.listing_id AND active=true),
        status=CASE WHEN status IN ('active','sold_out') THEN CASE WHEN (SELECT coalesce(sum(stock_on_hand-stock_reserved),0) FROM public.gh_marketplace_variants WHERE listing_id=OLD.listing_id AND active=true)<=0 THEN 'sold_out' ELSE 'active' END ELSE status END,
        updated_at=now() WHERE id=OLD.listing_id AND status <> 'removed';
    ELSE
      UPDATE public.gh_marketplace_listings SET availability=availability+OLD.stock_reserved,
        status=CASE WHEN status='sold_out' THEN 'active' ELSE status END,updated_at=now() WHERE id=OLD.listing_id;
    END IF;
    NEW.stock_reserved:=0; NEW.reservation_expires_at:=NULL; NEW.payment_claimed_at:=NULL;
    NEW.audit:=coalesce(NEW.audit,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('at',(extract(epoch from now())*1000)::bigint,'action','STOCK_RESERVATION_RELEASED','detail','order_cancelled'));
  ELSIF OLD.status IS DISTINCT FROM NEW.status AND NEW.status='payment_verified' AND coalesce(OLD.stock_reserved,0)>0 THEN
    IF OLD.variant_id IS NOT NULL THEN
      -- Lock listing before variant to match reservation/maintenance lock order.
      PERFORM 1 FROM public.gh_marketplace_listings WHERE id=OLD.listing_id FOR UPDATE;
      UPDATE public.gh_marketplace_variants SET stock_reserved=greatest(0,stock_reserved-OLD.stock_reserved),
        stock_on_hand=greatest(0,stock_on_hand-OLD.stock_reserved),updated_at=now() WHERE id=OLD.variant_id;
      UPDATE public.gh_marketplace_listings SET
        availability=(SELECT coalesce(sum(stock_on_hand-stock_reserved),0)::integer FROM public.gh_marketplace_variants WHERE listing_id=OLD.listing_id AND active=true),
        status=CASE WHEN status IN ('active','sold_out') THEN CASE WHEN (SELECT coalesce(sum(stock_on_hand-stock_reserved),0) FROM public.gh_marketplace_variants WHERE listing_id=OLD.listing_id AND active=true)<=0 THEN 'sold_out' ELSE 'active' END ELSE status END,
        updated_at=now() WHERE id=OLD.listing_id AND status <> 'removed';
    END IF;
    NEW.stock_reserved:=0; NEW.reservation_expires_at:=NULL; NEW.payment_claimed_at:=NULL;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.gh_marketplace_order_create_variant_reserved(
  p_row jsonb, p_idempotency_key text, p_variant_id text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id text:=trim(coalesce(p_row->>'id',''));
  v_listing_id text:=trim(coalesce(p_row->>'listingId',''));
  v_buyer text:=trim(coalesce(p_row->>'buyerId',''));
  v_key text:=trim(coalesce(p_idempotency_key,''));
  v_qty integer:=coalesce((p_row->>'quantity')::integer,0);
  l public.gh_marketplace_listings%ROWTYPE;
  v public.gh_marketplace_variants%ROWTYPE;
  o public.gh_marketplace_orders%ROWTYPE;
  existing public.gh_marketplace_orders%ROWTYPE;
  total numeric(18,8);
BEGIN
  IF v_id='' OR v_listing_id='' OR v_buyer='' OR trim(coalesce(p_variant_id,''))='' OR
     length(v_key)<8 OR length(v_key)>128 OR v_key !~ '^[A-Za-z0-9._:-]+$' OR v_qty<1 OR v_qty>99 THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_INPUT');
  END IF;
  PERFORM public.gh_marketplace_release_expired_reservations();
  SELECT * INTO existing FROM public.gh_marketplace_orders WHERE buyer_id=v_buyer AND client_request_id=v_key;
  IF FOUND THEN
    IF existing.listing_id<>v_listing_id OR existing.quantity<>v_qty OR existing.variant_id<>p_variant_id THEN
      RETURN jsonb_build_object('ok',false,'error','IDEMPOTENCY_CONFLICT');
    END IF;
    RETURN jsonb_build_object('ok',true,'idempotent',true,'order',public.gh_marketplace_order_get(existing.id));
  END IF;
  SELECT * INTO l FROM public.gh_marketplace_listings WHERE id=v_listing_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','LISTING_NOT_FOUND'); END IF;
  IF l.kind<>'product' THEN RETURN jsonb_build_object('ok',false,'error','VARIANTS_REQUIRE_PRODUCT_LISTING'); END IF;
  IF l.status<>'active' THEN RETURN jsonb_build_object('ok',false,'error','LISTING_UNAVAILABLE'); END IF;
  IF l.seller_id=v_buyer THEN RETURN jsonb_build_object('ok',false,'error','CANNOT_BUY_OWN'); END IF;
  SELECT * INTO v FROM public.gh_marketplace_variants WHERE id=p_variant_id AND listing_id=v_listing_id FOR UPDATE;
  IF NOT FOUND OR NOT v.active THEN RETURN jsonb_build_object('ok',false,'error','VARIANT_UNAVAILABLE'); END IF;
  IF upper(v.currency) NOT IN ('GHC','PI') OR upper(v.currency)<>upper(l.currency) THEN RETURN jsonb_build_object('ok',false,'error','UNSUPPORTED_CURRENCY'); END IF;
  IF v.stock_on_hand-v.stock_reserved<v_qty THEN
    RETURN jsonb_build_object('ok',false,'error','INSUFFICIENT_STOCK','available',greatest(0,v.stock_on_hand-v.stock_reserved));
  END IF;
  total:=round(v.price*v_qty,8);
  UPDATE public.gh_marketplace_variants SET stock_reserved=stock_reserved+v_qty,updated_at=now() WHERE id=v.id;
  UPDATE public.gh_marketplace_listings SET
    availability=(SELECT coalesce(sum(stock_on_hand-stock_reserved),0)::integer FROM public.gh_marketplace_variants WHERE listing_id=v_listing_id AND active=true),
    status=CASE WHEN status IN ('active','sold_out') THEN CASE WHEN (SELECT coalesce(sum(stock_on_hand-stock_reserved),0) FROM public.gh_marketplace_variants WHERE listing_id=v_listing_id AND active=true)<=0 THEN 'sold_out' ELSE 'active' END ELSE status END,
    updated_at=now() WHERE id=v_listing_id;
  INSERT INTO public.gh_marketplace_orders (
    id,listing_id,listing_title,buyer_id,seller_id,quantity,unit_price,currency,total_amount,status,payment_method,payment_status,
    audit,created_at,updated_at,client_request_id,stock_reserved,reservation_expires_at,variant_id,variant_sku,variant_label
  ) VALUES (
    v_id,l.id,left(l.title,200),v_buyer,l.seller_id,v_qty,v.price,upper(v.currency),total,'payment_pending','none','pending',
    jsonb_build_array(jsonb_build_object('at',(extract(epoch from now())*1000)::bigint,'action','VARIANT_STOCK_RESERVED','detail',v.sku)),
    now(),now(),v_key,v_qty,now()+interval '15 minutes',v.id,v.sku,v.label
  ) RETURNING * INTO o;
  RETURN jsonb_build_object('ok',true,'idempotent',false,'order',public.gh_marketplace_order_get(o.id));
EXCEPTION WHEN unique_violation THEN
  SELECT * INTO existing FROM public.gh_marketplace_orders WHERE buyer_id=v_buyer AND client_request_id=v_key;
  IF FOUND AND existing.listing_id=v_listing_id AND existing.quantity=v_qty AND existing.variant_id=p_variant_id THEN
    RETURN jsonb_build_object('ok',true,'idempotent',true,'order',public.gh_marketplace_order_get(existing.id));
  END IF;
  RETURN jsonb_build_object('ok',false,'error','IDEMPOTENCY_CONFLICT');
END $$;

-- The legacy reservation RPC must never bypass variant stock for a listing that
-- has active SKUs. Preserve its old behavior only for non-variant listings.
ALTER FUNCTION public.gh_marketplace_order_create_reserved(jsonb,text)
  RENAME TO gh_marketplace_order_create_reserved_pre_variant;
CREATE OR REPLACE FUNCTION public.gh_marketplace_order_create_reserved(p_row jsonb,p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_listing_id text:=trim(coalesce(p_row->>'listingId',''));
  v_buyer text:=trim(coalesce(p_row->>'buyerId',''));
  existing public.gh_marketplace_orders%ROWTYPE;
BEGIN
  SELECT * INTO existing FROM public.gh_marketplace_orders
   WHERE buyer_id=v_buyer AND client_request_id=trim(coalesce(p_idempotency_key,''));
  IF FOUND AND existing.variant_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok',false,'error','IDEMPOTENCY_CONFLICT');
  END IF;
  IF NOT FOUND AND EXISTS (SELECT 1 FROM public.gh_marketplace_variants WHERE listing_id=v_listing_id AND active=true) THEN
    RETURN jsonb_build_object('ok',false,'error','VARIANT_SELECTION_REQUIRED');
  END IF;
  RETURN public.gh_marketplace_order_create_reserved_pre_variant(p_row,p_idempotency_key);
END $$;

-- Expose immutable purchased-variant snapshot to the order reader.
CREATE OR REPLACE FUNCTION public.gh_marketplace_order_get(p_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.gh_marketplace_orders%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.gh_marketplace_orders WHERE id=trim(coalesce(p_id,''));
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'id',r.id,'listingId',r.listing_id,'listingTitle',r.listing_title,'buyerId',r.buyer_id,'sellerId',r.seller_id,
    'quantity',r.quantity,'unitPrice',r.unit_price,'currency',r.currency,'totalAmount',r.total_amount,
    'status',r.status,'paymentMethod',r.payment_method,'paymentStatus',r.payment_status,
    'paymentIntentId',r.payment_intent_id,'paymentId',r.payment_id,'txid',r.txid,'ghcSpendRef',r.ghc_spend_ref,
    'audit',r.audit,'createdAt',extract(epoch from r.created_at)*1000,'updatedAt',extract(epoch from r.updated_at)*1000,
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
    'sellerConfirmedAt',CASE WHEN r.seller_confirmed_at IS NULL THEN NULL ELSE extract(epoch from r.seller_confirmed_at)*1000 END
  );
END $$;

CREATE OR REPLACE FUNCTION public.gh_marketplace_listing_get(p_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.gh_marketplace_listings%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.gh_marketplace_listings WHERE id=p_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('id',r.id,'sellerId',r.seller_id,'title',r.title,'description',r.description,
    'price',r.price,'currency',r.currency,'availability',r.availability,'status',r.status,'kind',r.kind,
    'metadata',r.metadata,'updatedAt',extract(epoch from r.updated_at)*1000,
    'variants',public.gh_marketplace_variants_list(r.id));
END $$;

CREATE OR REPLACE FUNCTION public.gh_marketplace_orders_list_for_user(p_user_id text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(row_to_json(x)::jsonb ORDER BY x."createdAt" DESC),'[]'::jsonb)
  FROM (
    SELECT id,listing_id AS "listingId",listing_title AS "listingTitle",buyer_id AS "buyerId",seller_id AS "sellerId",
      quantity,unit_price AS "unitPrice",currency,total_amount AS "totalAmount",status,
      payment_method AS "paymentMethod",payment_status AS "paymentStatus",payment_intent_id AS "paymentIntentId",
      payment_id AS "paymentId",txid,ghc_spend_ref AS "ghcSpendRef",audit,
      escrow_status AS "escrowStatus",delivery_status AS "deliveryStatus",
      dispute_reason AS "disputeReason",cancellation_reason AS "cancellationReason",
      buyer_note AS "buyerNote",seller_note AS "sellerNote",
      extract(epoch from created_at)*1000 AS "createdAt",extract(epoch from updated_at)*1000 AS "updatedAt",
      CASE WHEN confirmed_at IS NULL THEN NULL ELSE extract(epoch from confirmed_at)*1000 END AS "confirmedAt",
      CASE WHEN fulfilled_at IS NULL THEN NULL ELSE extract(epoch from fulfilled_at)*1000 END AS "fulfilledAt",
      CASE WHEN delivered_at IS NULL THEN NULL ELSE extract(epoch from delivered_at)*1000 END AS "deliveredAt",
      CASE WHEN buyer_confirmed_at IS NULL THEN NULL ELSE extract(epoch from buyer_confirmed_at)*1000 END AS "buyerConfirmedAt",
      CASE WHEN seller_confirmed_at IS NULL THEN NULL ELSE extract(epoch from seller_confirmed_at)*1000 END AS "sellerConfirmedAt",
      CASE WHEN completed_at IS NULL THEN NULL ELSE extract(epoch from completed_at)*1000 END AS "completedAt",
      CASE WHEN cancelled_at IS NULL THEN NULL ELSE extract(epoch from cancelled_at)*1000 END AS "cancelledAt",
      variant_id AS "variantId",variant_sku AS "variantSku",variant_label AS "variantLabel"
    FROM public.gh_marketplace_orders WHERE buyer_id=p_user_id OR seller_id=p_user_id
    ORDER BY created_at DESC LIMIT 200
  ) x;
$$;

REVOKE ALL ON FUNCTION public.gh_marketplace_variants_replace(text,text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_marketplace_listing_upsert_with_variants(jsonb,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_marketplace_variants_list(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_marketplace_order_create_variant_reserved(jsonb,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_marketplace_order_create_reserved_pre_variant(jsonb,text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.gh_marketplace_order_create_reserved(jsonb,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_marketplace_orders_list_for_user(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_variants_replace(text,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_listing_upsert_with_variants(jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_variants_list(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_order_create_variant_reserved(jsonb,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_order_create_reserved(jsonb,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_orders_list_for_user(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_order_get(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_listing_get(text) TO service_role;
