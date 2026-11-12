-- Stage 2.1 — Stale marketplace payment-claim recovery (operator / service_role only).
-- Does NOT complete payments. Does NOT mint GHC.
-- Allows releasing a payment claim that has been held too long so expiry can proceed
-- after human/ops confirmation that payment failed or was never captured.

-- List stuck claims (read-only inspection)
CREATE OR REPLACE FUNCTION public.gh_marketplace_list_stale_payment_claims(
  p_older_than_minutes integer DEFAULT 60,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_minutes integer := LEAST(GREATEST(COALESCE(p_older_than_minutes, 60), 5), 10080);
  v_rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb ORDER BY q."claimedAt" ASC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      o.id AS "orderId",
      o.buyer_id AS "buyerId",
      o.listing_id AS "listingId",
      o.status,
      o.payment_status AS "paymentStatus",
      o.currency,
      (extract(epoch from o.payment_claimed_at) * 1000)::bigint AS "claimedAt",
      (extract(epoch from o.reservation_expires_at) * 1000)::bigint AS "reservationExpiresAt",
      o.stock_reserved AS "stockReserved"
    FROM public.gh_marketplace_orders o
    WHERE o.payment_claimed_at IS NOT NULL
      AND o.payment_claimed_at <= now() - make_interval(mins => v_minutes)
      AND o.status IN ('created', 'payment_pending')
      AND COALESCE(o.stock_reserved, 0) > 0
    ORDER BY o.payment_claimed_at ASC
    LIMIT v_limit
  ) q;

  RETURN jsonb_build_object(
    'ok', true,
    'olderThanMinutes', v_minutes,
    'orders', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_marketplace_list_stale_payment_claims(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_list_stale_payment_claims(integer, integer) TO service_role;

-- Force-release a single stale claim after ops confirmed payment is not in flight.
-- Requires claim age >= p_min_age_minutes (default 60).
CREATE OR REPLACE FUNCTION public.gh_marketplace_force_release_stale_payment_claim(
  p_order_id text,
  p_operator_note text DEFAULT 'ops_stale_claim_release',
  p_min_age_minutes integer DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.gh_marketplace_orders%ROWTYPE;
  v_min integer := LEAST(GREATEST(COALESCE(p_min_age_minutes, 60), 5), 10080);
  v_note text := left(trim(COALESCE(p_operator_note, 'ops_stale_claim_release')), 160);
BEGIN
  IF trim(COALESCE(p_order_id, '')) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_ORDER');
  END IF;

  SELECT * INTO r FROM public.gh_marketplace_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF r.payment_claimed_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NO_ACTIVE_CLAIM');
  END IF;
  IF r.payment_claimed_at > now() - make_interval(mins => v_min) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'CLAIM_TOO_RECENT',
      'minAgeMinutes', v_min
    );
  END IF;
  -- Do not touch paid / fulfilled orders
  IF r.payment_status IN ('paid', 'completed') OR r.status IN ('paid', 'fulfilled', 'completed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ORDER_ALREADY_SETTLED');
  END IF;

  UPDATE public.gh_marketplace_orders
     SET payment_claimed_at = NULL,
         updated_at = now(),
         audit = COALESCE(audit, '[]'::jsonb) || jsonb_build_array(
           jsonb_build_object(
             'at', (extract(epoch from now()) * 1000)::bigint,
             'action', 'STALE_PAYMENT_CLAIM_FORCE_RELEASE',
             'detail', v_note
           )
         )
   WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'ok', true,
    'orderId', p_order_id,
    'released', true,
    'note', v_note
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_marketplace_force_release_stale_payment_claim(text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_force_release_stale_payment_claim(text, text, integer) TO service_role;

COMMENT ON FUNCTION public.gh_marketplace_force_release_stale_payment_claim IS
  'Ops-only: clear stale payment_claimed_at after min age. Does not mark paid or release stock by itself; expiry worker may run after.';
