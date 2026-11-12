-- Phase 22: serialize marketplace order-state transitions in the database.
-- This replaces application read/modify/upsert transitions for durable orders.
-- It does not settle payments, issue refunds, or mutate wallet/ledger balances.

CREATE OR REPLACE FUNCTION public.gh_marketplace_order_get(p_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r public.gh_marketplace_orders%ROWTYPE;
BEGIN
  -- Preserve the prior read contract: expired, unclaimed reservations are
  -- released before the caller receives the current durable order snapshot.
  PERFORM public.gh_marketplace_release_expired_reservations();
  SELECT * INTO r FROM public.gh_marketplace_orders WHERE id = trim(coalesce(p_id, ''));
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
    'reservationExpiresAt', CASE WHEN r.reservation_expires_at IS NULL THEN NULL ELSE extract(epoch from r.reservation_expires_at) * 1000 END,
    'escrowStatus', r.escrow_status, 'deliveryStatus', r.delivery_status,
    'disputeReason', r.dispute_reason, 'cancellationReason', r.cancellation_reason,
    'buyerNote', r.buyer_note, 'sellerNote', r.seller_note,
    'deliveredAt', CASE WHEN r.delivered_at IS NULL THEN NULL ELSE extract(epoch from r.delivered_at) * 1000 END,
    'buyerConfirmedAt', CASE WHEN r.buyer_confirmed_at IS NULL THEN NULL ELSE extract(epoch from r.buyer_confirmed_at) * 1000 END,
    'sellerConfirmedAt', CASE WHEN r.seller_confirmed_at IS NULL THEN NULL ELSE extract(epoch from r.seller_confirmed_at) * 1000 END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_marketplace_order_transition(
  p_order_id text, p_to text, p_actor_id text, p_detail text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.gh_marketplace_orders%ROWTYPE;
  v_to text := lower(trim(coalesce(p_to, '')));
  v_detail text := left(trim(coalesce(p_detail, '')), 240);
  v_allowed boolean := false;
BEGIN
  IF trim(coalesce(p_order_id, '')) = '' OR trim(coalesce(p_actor_id, '')) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  SELECT * INTO r FROM public.gh_marketplace_orders
   WHERE id = trim(p_order_id) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;

  IF r.status = v_to THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'order', public.gh_marketplace_order_get(r.id));
  END IF;

  -- A live payment claim fences cancellation. This closes the race where a
  -- buyer/seller could cancel after the payment worker claimed the reservation
  -- but before the provider/ledger result was persisted.
  IF v_to = 'cancelled' AND r.payment_claimed_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PAYMENT_IN_PROGRESS');
  END IF;
  IF v_to = 'cancelled' AND r.payment_status IN ('verified', 'refunded') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PAID_ORDER_CANCEL_REQUIRES_REFUND');
  END IF;
  IF v_to = 'payment_verified' AND r.payment_status <> 'verified' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PAYMENT_NOT_VERIFIED');
  END IF;
  IF v_to = 'confirmed' AND r.payment_status <> 'verified' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PAYMENT_REQUIRED');
  END IF;
  IF v_to = 'refunded' AND r.payment_status <> 'refunded' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REFUND_NOT_RECONCILED');
  END IF;

  v_allowed := CASE r.status
    WHEN 'created' THEN v_to IN ('payment_pending', 'cancelled')
    WHEN 'payment_pending' THEN v_to IN ('payment_verified', 'cancelled', 'payment_pending')
    WHEN 'payment_verified' THEN v_to IN ('confirmed', 'cancelled', 'refunded')
    WHEN 'confirmed' THEN v_to IN ('fulfilling', 'cancelled', 'disputed')
    WHEN 'fulfilling' THEN v_to IN ('completed', 'disputed')
    WHEN 'completed' THEN v_to = 'refunded'
    WHEN 'disputed' THEN v_to IN ('refunded', 'completed', 'cancelled')
    ELSE false
  END;
  IF NOT v_allowed THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_TRANSITION:' || r.status || '->' || v_to);
  END IF;

  -- A status called payment_verified is only requested by server payment flows
  -- after their authoritative provider/ledger settlement checks. This RPC is
  -- service-role only and deliberately does not create any financial entry.
  UPDATE public.gh_marketplace_orders
     SET status = v_to,
         updated_at = now(),
         confirmed_at = CASE WHEN v_to = 'confirmed' THEN now() ELSE confirmed_at END,
         fulfilled_at = CASE WHEN v_to = 'fulfilling' THEN now() ELSE fulfilled_at END,
         completed_at = CASE WHEN v_to = 'completed' THEN now() ELSE completed_at END,
         cancelled_at = CASE WHEN v_to = 'cancelled' THEN now() ELSE cancelled_at END,
         audit = coalesce(audit, '[]'::jsonb) || jsonb_build_array(
           jsonb_build_object('at', (extract(epoch from now()) * 1000)::bigint,
             'action', upper(v_to), 'detail', left(p_actor_id, 120) || CASE WHEN v_detail = '' THEN '' ELSE ':' || v_detail END)
         )
   WHERE id = r.id;

  RETURN jsonb_build_object('ok', true, 'idempotent', false, 'order', public.gh_marketplace_order_get(r.id));
END;
$$;

-- Preserve the existing commerce workflow while fencing cancellation against
-- active payment claims. Both generic and commerce cancellation paths must agree.
CREATE OR REPLACE FUNCTION public.gh_marketplace_order_commerce_update(
  p_order_id text, p_actor_id text, p_action text, p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.gh_marketplace_orders%ROWTYPE;
  v_action text := lower(trim(coalesce(p_action, '')));
  v_note text := left(trim(coalesce(p_note, '')), 500);
BEGIN
  SELECT * INTO r FROM public.gh_marketplace_orders
   WHERE id = trim(coalesce(p_order_id, '')) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF r.buyer_id <> p_actor_id AND r.seller_id <> p_actor_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF v_action = 'seller_fulfill' THEN
    IF r.seller_id <> p_actor_id THEN RETURN jsonb_build_object('ok', false, 'error', 'SELLER_ONLY'); END IF;
    IF r.payment_status <> 'verified' OR r.status <> 'confirmed' THEN RETURN jsonb_build_object('ok', false, 'error', 'PAYMENT_REQUIRED'); END IF;
    UPDATE public.gh_marketplace_orders SET status='fulfilling', delivery_status='processing', seller_note=NULLIF(v_note,''), fulfilled_at=now(), updated_at=now(), audit=coalesce(audit,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('at',(extract(epoch from now())*1000)::bigint,'action','SELLER_FULFILL','detail',v_note)) WHERE id=r.id;
  ELSIF v_action = 'seller_mark_delivered' THEN
    IF r.seller_id <> p_actor_id THEN RETURN jsonb_build_object('ok', false, 'error', 'SELLER_ONLY'); END IF;
    IF r.status <> 'fulfilling' THEN RETURN jsonb_build_object('ok', false, 'error', 'INVALID_STATE'); END IF;
    UPDATE public.gh_marketplace_orders SET delivery_status='delivered', delivered_at=now(), seller_confirmed_at=now(), seller_note=NULLIF(v_note,''), updated_at=now(), audit=coalesce(audit,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('at',(extract(epoch from now())*1000)::bigint,'action','SELLER_DELIVERED','detail',v_note)) WHERE id=r.id;
  ELSIF v_action = 'buyer_confirm' THEN
    IF r.buyer_id <> p_actor_id THEN RETURN jsonb_build_object('ok', false, 'error', 'BUYER_ONLY'); END IF;
    IF r.payment_status <> 'verified' OR r.status <> 'fulfilling' OR r.delivery_status NOT IN ('delivered','service_active') THEN RETURN jsonb_build_object('ok', false, 'error', 'DELIVERY_NOT_CONFIRMED'); END IF;
    UPDATE public.gh_marketplace_orders SET status='completed', delivery_status='completed', buyer_confirmed_at=now(), completed_at=now(), buyer_note=NULLIF(v_note,''), updated_at=now(), audit=coalesce(audit,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('at',(extract(epoch from now())*1000)::bigint,'action','BUYER_CONFIRMED','detail',v_note)) WHERE id=r.id;
  ELSIF v_action = 'dispute' THEN
    IF r.payment_status <> 'verified' OR r.status NOT IN ('confirmed','fulfilling') THEN RETURN jsonb_build_object('ok', false, 'error', 'INVALID_STATE'); END IF;
    UPDATE public.gh_marketplace_orders SET status='disputed', dispute_reason=NULLIF(v_note,''), updated_at=now(), audit=coalesce(audit,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('at',(extract(epoch from now())*1000)::bigint,'action','DISPUTE_OPENED','detail',v_note)) WHERE id=r.id;
  ELSIF v_action = 'cancel_unpaid' THEN
    IF r.payment_claimed_at IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'PAYMENT_IN_PROGRESS'); END IF;
    IF r.payment_status IN ('verified','refunded') OR r.status NOT IN ('created','payment_pending') THEN RETURN jsonb_build_object('ok', false, 'error', 'PAID_OR_STARTED'); END IF;
    UPDATE public.gh_marketplace_orders SET status='cancelled', cancellation_reason=NULLIF(v_note,''), cancelled_at=now(), updated_at=now(), audit=coalesce(audit,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('at',(extract(epoch from now())*1000)::bigint,'action','CANCEL_UNPAID','detail',v_note)) WHERE id=r.id;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_ACTION');
  END IF;

  SELECT * INTO r FROM public.gh_marketplace_orders WHERE id=r.id;
  RETURN jsonb_build_object('ok', true, 'order', public.gh_marketplace_order_get(r.id));
END;
$$;

REVOKE ALL ON FUNCTION public.gh_marketplace_order_get(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_marketplace_order_transition(text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_marketplace_order_commerce_update(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_order_get(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_order_transition(text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_order_commerce_update(text,text,text,text) TO service_role;
