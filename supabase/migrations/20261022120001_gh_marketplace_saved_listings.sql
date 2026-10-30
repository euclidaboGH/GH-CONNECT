-- GreenHaven Marketplace — durable saved listings.
-- Server-authoritative toggle/list. No client-direct table access.

CREATE TABLE IF NOT EXISTS public.gh_marketplace_saved_listings (
  user_id text NOT NULL,
  listing_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_gh_marketplace_saved_listings_user_created
  ON public.gh_marketplace_saved_listings (user_id, created_at DESC, listing_id DESC);
CREATE INDEX IF NOT EXISTS idx_gh_marketplace_saved_listings_listing
  ON public.gh_marketplace_saved_listings (listing_id);

ALTER TABLE public.gh_marketplace_saved_listings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_marketplace_saved_listings_no_client ON public.gh_marketplace_saved_listings;
CREATE POLICY gh_marketplace_saved_listings_no_client
  ON public.gh_marketplace_saved_listings
  FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.gh_marketplace_saved_listing_toggle(
  p_user_id text,
  p_listing_id text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_user text := trim(coalesce(p_user_id, ''));
  v_listing text := trim(coalesce(p_listing_id, ''));
  v_saved boolean;
BEGIN
  IF v_user = '' OR v_listing = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  -- Serialize concurrent toggles for this exact user/listing pair.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user || ':' || v_listing, 0));

  IF NOT EXISTS (
    SELECT 1 FROM public.gh_marketplace_listings l
    WHERE l.id = v_listing
      AND l.status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'LISTING_NOT_FOUND');
  END IF;

  DELETE FROM public.gh_marketplace_saved_listings
  WHERE user_id = v_user AND listing_id = v_listing;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'saved', false, 'listingId', v_listing);
  END IF;

  INSERT INTO public.gh_marketplace_saved_listings (user_id, listing_id)
  VALUES (v_user, v_listing)
  ON CONFLICT (user_id, listing_id) DO NOTHING;

  v_saved := EXISTS (
    SELECT 1 FROM public.gh_marketplace_saved_listings s
    WHERE s.user_id = v_user AND s.listing_id = v_listing
  );

  RETURN jsonb_build_object('ok', true, 'saved', v_saved, 'listingId', v_listing);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_marketplace_saved_listings_list(
  p_user_id text,
  p_limit integer DEFAULT 50
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_user text := trim(coalesce(p_user_id, ''));
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_rows jsonb;
BEGIN
  IF v_user = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_USER');
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q."createdAt" DESC, q."listingId" DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      s.listing_id AS "listingId",
      (extract(epoch FROM s.created_at) * 1000)::bigint AS "createdAt",
      l.seller_id AS "sellerId",
      l.title,
      l.description,
      l.price,
      l.currency,
      l.availability,
      l.status,
      l.kind,
      l.metadata
    FROM public.gh_marketplace_saved_listings s
    JOIN public.gh_marketplace_listings l ON l.id = s.listing_id
    WHERE s.user_id = v_user
      AND l.status = 'active'
    ORDER BY s.created_at DESC, s.listing_id DESC
    LIMIT v_limit
  ) q;

  RETURN jsonb_build_object('ok', true, 'saved', coalesce(v_rows, '[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_marketplace_saved_listing_status(
  p_user_id text,
  p_listing_id text
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_user text := trim(coalesce(p_user_id, ''));
  v_listing text := trim(coalesce(p_listing_id, ''));
BEGIN
  IF v_user = '' OR v_listing = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'listingId', v_listing,
    'saved', EXISTS (
      SELECT 1 FROM public.gh_marketplace_saved_listings s
      WHERE s.user_id = v_user AND s.listing_id = v_listing
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_marketplace_saved_listing_toggle(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_marketplace_saved_listings_list(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_marketplace_saved_listing_status(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_saved_listing_toggle(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_saved_listings_list(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_saved_listing_status(text, text) TO service_role;
