-- Run #258 — repair the durable Marketplace order-list RPC.
-- The prior implementation ordered the outer JSON row by x.created_at even
-- though its SELECT exposed that value as the quoted alias "createdAt".
-- This read-only replacement delegates projection to the existing, narrowly
-- scoped order_get RPC and orders by the real timestamp before aggregation.
BEGIN;

CREATE OR REPLACE FUNCTION public.gh_marketplace_orders_list_for_user(p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_orders jsonb;
  v_user_id text := trim(coalesce(p_user_id, ''));
BEGIN
  IF length(v_user_id) NOT BETWEEN 1 AND 160 THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT coalesce(
    jsonb_agg(public.gh_marketplace_order_get(o.id) ORDER BY o.created_at DESC),
    '[]'::jsonb
  )
    INTO v_orders
    FROM (
      SELECT id, created_at
        FROM public.gh_marketplace_orders
       WHERE buyer_id = v_user_id OR seller_id = v_user_id
       ORDER BY created_at DESC
       LIMIT 200
    ) AS o;

  RETURN coalesce(v_orders, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_marketplace_orders_list_for_user(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_orders_list_for_user(text)
  TO service_role;

COMMENT ON FUNCTION public.gh_marketplace_orders_list_for_user(text) IS
  'Returns up to 200 Marketplace orders for the supplied canonical user ID. Service-role only; read-only projection; timestamp ordering uses the source created_at column.';

COMMIT;
