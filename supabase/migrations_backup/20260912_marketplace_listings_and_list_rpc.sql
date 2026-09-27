-- Authoritative marketplace listings + list orders for user (service_role only)

CREATE TABLE IF NOT EXISTS public.gh_marketplace_listings (
  id              text PRIMARY KEY,
  seller_id       text NOT NULL,
  title           text NOT NULL DEFAULT '',
  description     text NOT NULL DEFAULT '',
  price           numeric(18, 8) NOT NULL CHECK (price >= 0),
  currency        text NOT NULL DEFAULT 'GHC',
  availability    integer NOT NULL DEFAULT 1 CHECK (availability >= 0),
  status          text NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft','active','paused','sold_out','removed')),
  kind            text NOT NULL DEFAULT 'product',
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gh_market_listings_seller ON public.gh_marketplace_listings (seller_id);
CREATE INDEX IF NOT EXISTS idx_gh_market_listings_status ON public.gh_marketplace_listings (status);

ALTER TABLE public.gh_marketplace_listings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_marketplace_listings_no_client ON public.gh_marketplace_listings;
CREATE POLICY gh_marketplace_listings_no_client ON public.gh_marketplace_listings
  FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.gh_marketplace_listing_upsert(p_row jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text := trim(COALESCE(p_row->>'id', ''));
  v_seller text := trim(COALESCE(p_row->>'sellerId', ''));
  v_price numeric := COALESCE((p_row->>'price')::numeric, -1);
BEGIN
  IF v_id = '' OR v_seller = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  IF v_price < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_PRICE');
  END IF;

  INSERT INTO public.gh_marketplace_listings (
    id, seller_id, title, description, price, currency, availability, status, kind, metadata, created_at, updated_at
  ) VALUES (
    v_id, v_seller,
    COALESCE(p_row->>'title', ''),
    COALESCE(p_row->>'description', ''),
    v_price,
    COALESCE(p_row->>'currency', 'GHC'),
    GREATEST(0, COALESCE((p_row->>'availability')::int, 1)),
    COALESCE(p_row->>'status', 'active'),
    COALESCE(p_row->>'kind', 'product'),
    COALESCE(p_row->'metadata', '{}'::jsonb),
    now(), now()
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    currency = EXCLUDED.currency,
    availability = EXCLUDED.availability,
    status = EXCLUDED.status,
    kind = EXCLUDED.kind,
    metadata = EXCLUDED.metadata,
    updated_at = now()
  WHERE public.gh_marketplace_listings.seller_id = EXCLUDED.seller_id;

  IF NOT FOUND AND EXISTS (SELECT 1 FROM public.gh_marketplace_listings WHERE id = v_id AND seller_id <> v_seller) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN_SELLER');
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_marketplace_listing_get(p_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r public.gh_marketplace_listings%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.gh_marketplace_listings WHERE id = p_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'id', r.id,
    'sellerId', r.seller_id,
    'title', r.title,
    'description', r.description,
    'price', r.price,
    'currency', r.currency,
    'availability', r.availability,
    'status', r.status,
    'kind', r.kind,
    'metadata', r.metadata,
    'updatedAt', extract(epoch from r.updated_at) * 1000
  );
END;
$$;

-- List orders for user (buyer or seller)
CREATE OR REPLACE FUNCTION public.gh_marketplace_orders_list_for_user(p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(x)::jsonb ORDER BY x.created_at DESC)
    FROM (
      SELECT
        id,
        listing_id AS "listingId",
        listing_title AS "listingTitle",
        buyer_id AS "buyerId",
        seller_id AS "sellerId",
        quantity,
        unit_price AS "unitPrice",
        currency,
        total_amount AS "totalAmount",
        status,
        payment_method AS "paymentMethod",
        payment_status AS "paymentStatus",
        payment_intent_id AS "paymentIntentId",
        payment_id AS "paymentId",
        txid,
        ghc_spend_ref AS "ghcSpendRef",
        audit,
        extract(epoch from created_at) * 1000 AS "createdAt",
        extract(epoch from updated_at) * 1000 AS "updatedAt",
        CASE WHEN confirmed_at IS NULL THEN NULL ELSE extract(epoch from confirmed_at) * 1000 END AS "confirmedAt",
        CASE WHEN fulfilled_at IS NULL THEN NULL ELSE extract(epoch from fulfilled_at) * 1000 END AS "fulfilledAt",
        CASE WHEN completed_at IS NULL THEN NULL ELSE extract(epoch from completed_at) * 1000 END AS "completedAt",
        CASE WHEN cancelled_at IS NULL THEN NULL ELSE extract(epoch from cancelled_at) * 1000 END AS "cancelledAt"
      FROM public.gh_marketplace_orders
      WHERE buyer_id = p_user_id OR seller_id = p_user_id
      ORDER BY created_at DESC
      LIMIT 200
    ) x
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_marketplace_listing_upsert(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_marketplace_listing_get(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_marketplace_orders_list_for_user(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_listing_upsert(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_listing_get(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_orders_list_for_user(text) TO service_role;
