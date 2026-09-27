-- Durable marketplace orders (additive). Service-role only; no client RLS access.

CREATE TABLE IF NOT EXISTS public.gh_marketplace_orders (
  id                  text PRIMARY KEY,
  listing_id          text NOT NULL,
  listing_title       text NOT NULL DEFAULT '',
  buyer_id            text NOT NULL,
  seller_id           text NOT NULL,
  quantity            integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price          numeric(18, 8) NOT NULL CHECK (unit_price >= 0),
  currency            text NOT NULL DEFAULT 'GHC',
  total_amount        numeric(18, 8) NOT NULL CHECK (total_amount >= 0),
  status              text NOT NULL DEFAULT 'created'
    CHECK (status IN (
      'created','payment_pending','payment_verified','confirmed',
      'fulfilling','completed','cancelled','refunded','disputed'
    )),
  payment_method      text NOT NULL DEFAULT 'none'
    CHECK (payment_method IN ('ghc','pi','none')),
  payment_status      text NOT NULL DEFAULT 'none'
    CHECK (payment_status IN ('none','pending','verified','failed','refunded')),
  payment_intent_id   text,
  payment_id          text,
  txid                text,
  ghc_spend_ref       text,
  audit               jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  confirmed_at        timestamptz,
  fulfilled_at        timestamptz,
  completed_at        timestamptz,
  cancelled_at        timestamptz
);

CREATE INDEX IF NOT EXISTS idx_gh_market_orders_buyer ON public.gh_marketplace_orders (buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gh_market_orders_seller ON public.gh_marketplace_orders (seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gh_market_orders_status ON public.gh_marketplace_orders (status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_market_orders_ghc_spend_ref
  ON public.gh_marketplace_orders (ghc_spend_ref)
  WHERE ghc_spend_ref IS NOT NULL;

ALTER TABLE public.gh_marketplace_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gh_marketplace_orders_no_client ON public.gh_marketplace_orders;
CREATE POLICY gh_marketplace_orders_no_client ON public.gh_marketplace_orders
  FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.gh_marketplace_order_upsert(p_row jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text := p_row->>'id';
BEGIN
  IF v_id IS NULL OR length(trim(v_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_ID');
  END IF;

  INSERT INTO public.gh_marketplace_orders (
    id, listing_id, listing_title, buyer_id, seller_id, quantity, unit_price,
    currency, total_amount, status, payment_method, payment_status,
    payment_intent_id, payment_id, txid, ghc_spend_ref, audit,
    created_at, updated_at, confirmed_at, fulfilled_at, completed_at, cancelled_at
  ) VALUES (
    v_id,
    COALESCE(p_row->>'listingId', ''),
    COALESCE(p_row->>'listingTitle', ''),
    COALESCE(p_row->>'buyerId', ''),
    COALESCE(p_row->>'sellerId', ''),
    GREATEST(1, COALESCE((p_row->>'quantity')::int, 1)),
    COALESCE((p_row->>'unitPrice')::numeric, 0),
    COALESCE(p_row->>'currency', 'GHC'),
    COALESCE((p_row->>'totalAmount')::numeric, 0),
    COALESCE(p_row->>'status', 'created'),
    COALESCE(p_row->>'paymentMethod', 'none'),
    COALESCE(p_row->>'paymentStatus', 'none'),
    p_row->>'paymentIntentId',
    p_row->>'paymentId',
    p_row->>'txid',
    p_row->>'ghcSpendRef',
    COALESCE(p_row->'audit', '[]'::jsonb),
    COALESCE((p_row->>'createdAt')::timestamptz, now()),
    now(),
    (p_row->>'confirmedAt')::timestamptz,
    (p_row->>'fulfilledAt')::timestamptz,
    (p_row->>'completedAt')::timestamptz,
    (p_row->>'cancelledAt')::timestamptz
  )
  ON CONFLICT (id) DO UPDATE SET
    listing_title = EXCLUDED.listing_title,
    quantity = EXCLUDED.quantity,
    unit_price = EXCLUDED.unit_price,
    total_amount = EXCLUDED.total_amount,
    status = EXCLUDED.status,
    payment_method = EXCLUDED.payment_method,
    payment_status = EXCLUDED.payment_status,
    payment_intent_id = EXCLUDED.payment_intent_id,
    payment_id = EXCLUDED.payment_id,
    txid = EXCLUDED.txid,
    ghc_spend_ref = EXCLUDED.ghc_spend_ref,
    audit = EXCLUDED.audit,
    updated_at = now(),
    confirmed_at = EXCLUDED.confirmed_at,
    fulfilled_at = EXCLUDED.fulfilled_at,
    completed_at = EXCLUDED.completed_at,
    cancelled_at = EXCLUDED.cancelled_at;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_marketplace_order_get(p_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.gh_marketplace_orders%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.gh_marketplace_orders WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object(
    'id', r.id,
    'listingId', r.listing_id,
    'listingTitle', r.listing_title,
    'buyerId', r.buyer_id,
    'sellerId', r.seller_id,
    'quantity', r.quantity,
    'unitPrice', r.unit_price,
    'currency', r.currency,
    'totalAmount', r.total_amount,
    'status', r.status,
    'paymentMethod', r.payment_method,
    'paymentStatus', r.payment_status,
    'paymentIntentId', r.payment_intent_id,
    'paymentId', r.payment_id,
    'txid', r.txid,
    'ghcSpendRef', r.ghc_spend_ref,
    'audit', r.audit,
    'createdAt', extract(epoch from r.created_at) * 1000,
    'updatedAt', extract(epoch from r.updated_at) * 1000,
    'confirmedAt', CASE WHEN r.confirmed_at IS NULL THEN NULL ELSE extract(epoch from r.confirmed_at) * 1000 END,
    'fulfilledAt', CASE WHEN r.fulfilled_at IS NULL THEN NULL ELSE extract(epoch from r.fulfilled_at) * 1000 END,
    'completedAt', CASE WHEN r.completed_at IS NULL THEN NULL ELSE extract(epoch from r.completed_at) * 1000 END,
    'cancelledAt', CASE WHEN r.cancelled_at IS NULL THEN NULL ELSE extract(epoch from r.cancelled_at) * 1000 END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_marketplace_order_upsert(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_marketplace_order_get(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_order_upsert(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_order_get(text) TO service_role;
