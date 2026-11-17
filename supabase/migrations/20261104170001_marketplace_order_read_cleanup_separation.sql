-- Phase 23: keep reservation cleanup out of locked order-transition transactions.
-- A canonical order read is side-effect free. Application reads explicitly run
-- expiry cleanup before fetching the order; transition RPCs can safely return a
-- snapshot without sweeping/locking unrelated expired orders while holding a row.

CREATE OR REPLACE FUNCTION public.gh_marketplace_order_get(p_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r public.gh_marketplace_orders%ROWTYPE;
BEGIN
  SELECT * INTO r
    FROM public.gh_marketplace_orders
   WHERE id = trim(coalesce(p_id, ''));
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

REVOKE ALL ON FUNCTION public.gh_marketplace_order_get(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_order_get(text) TO service_role;
