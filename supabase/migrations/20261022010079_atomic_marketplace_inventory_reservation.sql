-- Atomic marketplace inventory reservation and idempotent order creation.
-- Apply only after reconciling this migration against the target environment.

ALTER TABLE public.gh_marketplace_orders
  ADD COLUMN IF NOT EXISTS client_request_id text,
  ADD COLUMN IF NOT EXISTS stock_reserved integer NOT NULL DEFAULT 0 CHECK (stock_reserved >= 0),
  ADD COLUMN IF NOT EXISTS reservation_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_claimed_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_market_orders_buyer_request
  ON public.gh_marketplace_orders (buyer_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

-- A completed Pi intent may settle at most one marketplace order.
CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_market_orders_payment_intent
  ON public.gh_marketplace_orders (payment_intent_id)
  WHERE payment_intent_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.gh_marketplace_order_stock_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelled' AND COALESCE(OLD.stock_reserved, 0) > 0 THEN
    UPDATE public.gh_marketplace_listings
       SET availability = availability + OLD.stock_reserved,
           status = CASE WHEN status = 'sold_out' THEN 'active' ELSE status END,
           updated_at = now()
     WHERE id = OLD.listing_id;
    NEW.stock_reserved := 0;
    NEW.audit := COALESCE(NEW.audit, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object('at', (extract(epoch from now()) * 1000)::bigint, 'action', 'STOCK_RESERVATION_RELEASED', 'detail', 'order_cancelled')
    );
  ELSIF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'payment_verified' AND COALESCE(OLD.stock_reserved, 0) > 0 THEN
    -- Payment has been verified: stock is committed to this order, not released.
    NEW.stock_reserved := 0;
    NEW.reservation_expires_at := NULL;
    NEW.payment_claimed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gh_marketplace_order_stock_transition ON public.gh_marketplace_orders;
CREATE TRIGGER trg_gh_marketplace_order_stock_transition
BEFORE UPDATE OF status ON public.gh_marketplace_orders
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.gh_marketplace_order_stock_transition();

CREATE OR REPLACE FUNCTION public.gh_marketplace_release_expired_reservations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.gh_marketplace_orders
     SET status = 'cancelled',
         payment_status = 'failed',
         updated_at = now(),
         cancelled_at = now(),
         audit = COALESCE(audit, '[]'::jsonb) || jsonb_build_array(
           jsonb_build_object('at', (extract(epoch from now()) * 1000)::bigint, 'action', 'RESERVATION_EXPIRED')
         )
   WHERE status IN ('created', 'payment_pending')
     AND payment_status IN ('none', 'pending')
     AND stock_reserved > 0
     AND payment_claimed_at IS NULL
     AND reservation_expires_at IS NOT NULL
     AND reservation_expires_at <= now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'releasedOrders', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_marketplace_order_create_reserved(
  p_row jsonb,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text := trim(COALESCE(p_row->>'id', ''));
  v_listing_id text := trim(COALESCE(p_row->>'listingId', ''));
  v_buyer text := trim(COALESCE(p_row->>'buyerId', ''));
  v_key text := trim(COALESCE(p_idempotency_key, ''));
  v_qty integer := COALESCE((p_row->>'quantity')::integer, 0);
  v_listing public.gh_marketplace_listings%ROWTYPE;
  v_existing public.gh_marketplace_orders%ROWTYPE;
  v_order public.gh_marketplace_orders%ROWTYPE;
  v_total numeric(18,8);
BEGIN
  IF v_id = '' OR v_listing_id = '' OR v_buyer = '' OR length(v_key) < 8 OR length(v_key) > 128
     OR v_key !~ '^[A-Za-z0-9._:-]+$' OR v_qty < 1 OR v_qty > 99 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  PERFORM public.gh_marketplace_release_expired_reservations();

  SELECT * INTO v_existing
    FROM public.gh_marketplace_orders
   WHERE buyer_id = v_buyer AND client_request_id = v_key;
  IF FOUND THEN
    IF v_existing.listing_id <> v_listing_id OR v_existing.quantity <> v_qty THEN
      RETURN jsonb_build_object('ok', false, 'error', 'IDEMPOTENCY_CONFLICT');
    END IF;
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'order', jsonb_build_object(
      'id', v_existing.id, 'listingId', v_existing.listing_id, 'listingTitle', v_existing.listing_title,
      'buyerId', v_existing.buyer_id, 'sellerId', v_existing.seller_id, 'quantity', v_existing.quantity,
      'unitPrice', v_existing.unit_price, 'currency', v_existing.currency, 'totalAmount', v_existing.total_amount,
      'status', v_existing.status, 'paymentMethod', v_existing.payment_method, 'paymentStatus', v_existing.payment_status,
      'paymentIntentId', v_existing.payment_intent_id, 'paymentId', v_existing.payment_id, 'txid', v_existing.txid,
      'ghcSpendRef', v_existing.ghc_spend_ref, 'audit', v_existing.audit,
      'createdAt', extract(epoch from v_existing.created_at) * 1000,
      'updatedAt', extract(epoch from v_existing.updated_at) * 1000,
      'confirmedAt', CASE WHEN v_existing.confirmed_at IS NULL THEN NULL ELSE extract(epoch from v_existing.confirmed_at) * 1000 END,
      'fulfilledAt', CASE WHEN v_existing.fulfilled_at IS NULL THEN NULL ELSE extract(epoch from v_existing.fulfilled_at) * 1000 END,
      'completedAt', CASE WHEN v_existing.completed_at IS NULL THEN NULL ELSE extract(epoch from v_existing.completed_at) * 1000 END,
      'cancelledAt', CASE WHEN v_existing.cancelled_at IS NULL THEN NULL ELSE extract(epoch from v_existing.cancelled_at) * 1000 END,
      'reservationExpiresAt', CASE WHEN v_existing.reservation_expires_at IS NULL THEN NULL ELSE extract(epoch from v_existing.reservation_expires_at) * 1000 END
    ));
  END IF;

  SELECT * INTO v_listing FROM public.gh_marketplace_listings WHERE id = v_listing_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'LISTING_NOT_FOUND'); END IF;
  IF v_listing.status <> 'active' THEN RETURN jsonb_build_object('ok', false, 'error', 'LISTING_UNAVAILABLE'); END IF;
  IF upper(v_listing.currency) NOT IN ('GHC', 'PI') THEN RETURN jsonb_build_object('ok', false, 'error', 'UNSUPPORTED_CURRENCY'); END IF;
  IF v_listing.seller_id = v_buyer THEN RETURN jsonb_build_object('ok', false, 'error', 'CANNOT_BUY_OWN'); END IF;
  IF v_listing.availability < v_qty THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_STOCK', 'available', v_listing.availability);
  END IF;
  IF v_listing.price < 0 OR v_listing.price IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'INVALID_LISTING_PRICE'); END IF;

  v_total := round(v_listing.price * v_qty, 8);
  UPDATE public.gh_marketplace_listings
     SET availability = availability - v_qty,
         status = CASE WHEN availability - v_qty = 0 THEN 'sold_out' ELSE status END,
         updated_at = now()
   WHERE id = v_listing_id;

  INSERT INTO public.gh_marketplace_orders (
    id, listing_id, listing_title, buyer_id, seller_id, quantity, unit_price, currency, total_amount,
    status, payment_method, payment_status, audit, created_at, updated_at, client_request_id,
    stock_reserved, reservation_expires_at
  ) VALUES (
    v_id, v_listing.id, left(v_listing.title, 200), v_buyer, v_listing.seller_id, v_qty,
    v_listing.price, upper(v_listing.currency), v_total, 'payment_pending', 'none', 'pending',
    jsonb_build_array(jsonb_build_object('at', (extract(epoch from now()) * 1000)::bigint, 'action', 'CREATED_AND_STOCK_RESERVED', 'detail', v_buyer)),
    now(), now(), v_key, v_qty, now() + interval '15 minutes'
  ) RETURNING * INTO v_order;

  RETURN jsonb_build_object('ok', true, 'idempotent', false, 'order', jsonb_build_object(
    'id', v_order.id, 'listingId', v_order.listing_id, 'listingTitle', v_order.listing_title,
    'buyerId', v_order.buyer_id, 'sellerId', v_order.seller_id, 'quantity', v_order.quantity,
    'unitPrice', v_order.unit_price, 'currency', v_order.currency, 'totalAmount', v_order.total_amount,
    'status', v_order.status, 'paymentMethod', v_order.payment_method, 'paymentStatus', v_order.payment_status,
    'audit', v_order.audit, 'createdAt', extract(epoch from v_order.created_at) * 1000,
    'updatedAt', extract(epoch from v_order.updated_at) * 1000,
    'reservationExpiresAt', extract(epoch from v_order.reservation_expires_at) * 1000
  ));
EXCEPTION WHEN unique_violation THEN
  SELECT * INTO v_existing FROM public.gh_marketplace_orders WHERE buyer_id = v_buyer AND client_request_id = v_key;
  IF FOUND AND v_existing.listing_id = v_listing_id AND v_existing.quantity = v_qty THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'order', jsonb_build_object(
      'id', v_existing.id, 'listingId', v_existing.listing_id, 'listingTitle', v_existing.listing_title,
      'buyerId', v_existing.buyer_id, 'sellerId', v_existing.seller_id, 'quantity', v_existing.quantity,
      'unitPrice', v_existing.unit_price, 'currency', v_existing.currency, 'totalAmount', v_existing.total_amount,
      'status', v_existing.status, 'paymentMethod', v_existing.payment_method, 'paymentStatus', v_existing.payment_status,
      'audit', v_existing.audit, 'createdAt', extract(epoch from v_existing.created_at) * 1000,
      'updatedAt', extract(epoch from v_existing.updated_at) * 1000,
      'reservationExpiresAt', CASE WHEN v_existing.reservation_expires_at IS NULL THEN NULL ELSE extract(epoch from v_existing.reservation_expires_at) * 1000 END
    ));
  END IF;
  RETURN jsonb_build_object('ok', false, 'error', 'IDEMPOTENCY_CONFLICT');
END;
$$;

-- Claim a live reservation before any external or ledger payment operation.
-- A claimed reservation is excluded from automatic expiry until payment succeeds or
-- the application explicitly releases the claim after a definite payment failure.
CREATE OR REPLACE FUNCTION public.gh_marketplace_order_claim_payment(
  p_order_id text,
  p_buyer_id text,
  p_method text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.gh_marketplace_orders%ROWTYPE;
  v_method text := lower(trim(COALESCE(p_method, '')));
BEGIN
  IF trim(COALESCE(p_order_id, '')) = '' OR trim(COALESCE(p_buyer_id, '')) = ''
     OR v_method NOT IN ('ghc', 'pi') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  PERFORM public.gh_marketplace_release_expired_reservations();
  SELECT * INTO r FROM public.gh_marketplace_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF r.buyer_id <> p_buyer_id THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
  IF upper(r.currency) <> upper(v_method) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PAYMENT_CURRENCY_MISMATCH');
  END IF;
  IF r.status NOT IN ('created', 'payment_pending') OR r.payment_status NOT IN ('none', 'pending')
     OR COALESCE(r.stock_reserved, 0) < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_PAYABLE');
  END IF;
  IF r.reservation_expires_at IS NULL OR r.reservation_expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'RESERVATION_EXPIRED');
  END IF;
  IF r.payment_claimed_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PAYMENT_IN_PROGRESS');
  END IF;

  UPDATE public.gh_marketplace_orders
     SET payment_claimed_at = now(), updated_at = now(),
         audit = COALESCE(audit, '[]'::jsonb) || jsonb_build_array(
           jsonb_build_object('at', (extract(epoch from now()) * 1000)::bigint, 'action', 'PAYMENT_CLAIMED', 'detail', v_method)
         )
   WHERE id = p_order_id;
  RETURN jsonb_build_object('ok', true, 'claimed', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_marketplace_order_release_payment_claim(
  p_order_id text,
  p_buyer_id text,
  p_detail text DEFAULT 'payment_failed'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.gh_marketplace_orders
     SET payment_claimed_at = NULL, updated_at = now(),
         audit = COALESCE(audit, '[]'::jsonb) || jsonb_build_array(
           jsonb_build_object('at', (extract(epoch from now()) * 1000)::bigint, 'action', 'PAYMENT_CLAIM_RELEASED', 'detail', left(COALESCE(p_detail, 'payment_failed'), 120))
         )
   WHERE id = p_order_id AND buyer_id = p_buyer_id
     AND status IN ('created', 'payment_pending')
     AND payment_status IN ('none', 'pending')
     AND payment_claimed_at IS NOT NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'CLAIM_NOT_FOUND'); END IF;
  RETURN jsonb_build_object('ok', true, 'released', true);
END;
$$;

-- Order reads also release expired holds before returning current durable state.
CREATE OR REPLACE FUNCTION public.gh_marketplace_order_get(p_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r public.gh_marketplace_orders%ROWTYPE;
BEGIN
  PERFORM public.gh_marketplace_release_expired_reservations();
  SELECT * INTO r FROM public.gh_marketplace_orders WHERE id = p_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'id', r.id, 'listingId', r.listing_id, 'listingTitle', r.listing_title,
    'buyerId', r.buyer_id, 'sellerId', r.seller_id, 'quantity', r.quantity,
    'unitPrice', r.unit_price, 'currency', r.currency, 'totalAmount', r.total_amount,
    'status', r.status, 'paymentMethod', r.payment_method, 'paymentStatus', r.payment_status,
    'paymentIntentId', r.payment_intent_id, 'paymentId', r.payment_id, 'txid', r.txid,
    'ghcSpendRef', r.ghc_spend_ref, 'audit', r.audit,
    'createdAt', extract(epoch from r.created_at) * 1000,
    'updatedAt', extract(epoch from r.updated_at) * 1000,
    'confirmedAt', CASE WHEN r.confirmed_at IS NULL THEN NULL ELSE extract(epoch from r.confirmed_at) * 1000 END,
    'fulfilledAt', CASE WHEN r.fulfilled_at IS NULL THEN NULL ELSE extract(epoch from r.fulfilled_at) * 1000 END,
    'completedAt', CASE WHEN r.completed_at IS NULL THEN NULL ELSE extract(epoch from r.completed_at) * 1000 END,
    'cancelledAt', CASE WHEN r.cancelled_at IS NULL THEN NULL ELSE extract(epoch from r.cancelled_at) * 1000 END,
    'reservationExpiresAt', CASE WHEN r.reservation_expires_at IS NULL THEN NULL ELSE extract(epoch from r.reservation_expires_at) * 1000 END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_marketplace_order_stock_transition() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_marketplace_release_expired_reservations() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_marketplace_order_create_reserved(jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_marketplace_order_claim_payment(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_marketplace_order_release_payment_claim(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_release_expired_reservations() TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_order_create_reserved(jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_order_claim_payment(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_order_release_payment_claim(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_order_get(text) TO service_role;
