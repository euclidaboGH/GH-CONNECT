-- Phase 24: detailed, read-only evidence reconciliation for legacy payouts and membership grants.
-- REVIEW_REQUIRED. No historical financial or entitlement records are rewritten.

CREATE OR REPLACE FUNCTION public.gh_treasury_payout_reconciliation_detail(p_limit integer DEFAULT 250)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_rows jsonb;
BEGIN
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC),'[]'::jsonb) INTO v_rows
 FROM (
   SELECT r.id AS payout_request_id, r.seller_id, upper(r.currency) AS currency,
     r.amount AS requested_amount, r.status AS payout_status, r.created_at,
     a.order_id, a.amount AS allocated_amount,
     p.gross_amount AS verified_gross, p.platform_commission, p.seller_net AS snapshot_seller_net,
     coalesce(adj.gross_adjusted,0) AS gross_adjustments,
     coalesce(adj.net_adjusted,0) AS seller_net_adjustments,
     greatest(0,coalesce(p.seller_net,0)-coalesce(adj.net_adjusted,0)) AS current_net_after_adjustments,
     CASE
       WHEN p.order_id IS NULL THEN 'MISSING_PROCEEDS_SNAPSHOT'
       WHEN p.seller_id<>a.seller_id OR p.currency<>upper(a.currency) THEN 'SELLER_OR_CURRENCY_MISMATCH'
       WHEN a.amount<>greatest(0,p.seller_net-coalesce(adj.net_adjusted,0)) THEN 'ALLOCATION_DIFFERS_FROM_CURRENT_NET'
       WHEN r.status='paid' AND coalesce(a.amount,0)<=0 THEN 'INVALID_SETTLEMENT_ALLOCATION'
       ELSE 'MATCHES_CURRENT_SNAPSHOT'
     END AS reconciliation_status
   FROM public.gh_seller_payout_allocations a
   JOIN public.gh_seller_payout_requests r ON r.id=a.payout_request_id
   LEFT JOIN public.gh_marketplace_order_proceeds p ON p.order_id=a.order_id
   LEFT JOIN LATERAL (
     SELECT sum(gross_amount) AS gross_adjusted,sum(seller_net_reduction) AS net_adjusted
     FROM public.gh_marketplace_order_adjustments z WHERE z.order_id=a.order_id
   ) adj ON true
   ORDER BY r.created_at DESC,a.order_id LIMIT least(1000,greatest(1,coalesce(p_limit,250)))
 ) x;
 RETURN jsonb_build_object('ok',true,'items',v_rows,'readOnly',true,'historicalRowsRewritten',false,
   'note','Current adjustment comparison is diagnostic only; it does not prove historical provider settlement or authorize automatic correction.');
END; $$;
REVOKE ALL ON FUNCTION public.gh_treasury_payout_reconciliation_detail(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_treasury_payout_reconciliation_detail(integer) TO service_role;
COMMENT ON FUNCTION public.gh_treasury_payout_reconciliation_detail(integer) IS 'Read-only, bounded per-allocation evidence report. It never mutates historical payouts or authorizes corrections.';

CREATE OR REPLACE FUNCTION public.ghc_membership_payment_exception_detail(p_limit integer DEFAULT 250)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_rows jsonb;
BEGIN
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.payment_time DESC),'[]'::jsonb) INTO v_rows
 FROM (
   SELECT i.id AS payment_intent_id,i.user_id AS payment_user_id,upper(i.currency) AS payment_currency,
     i.amount AS payment_amount,i.status AS payment_status,i.purpose,i.metadata->>'productId' AS product_id,
     coalesce(i.completed_at,i.fulfilled_at,i.created_at) AS payment_time,
     e.user_id AS entitlement_user_id,e.tier AS entitlement_tier,e.active AS entitlement_active,
     e.expires_at AS entitlement_expires_at,
     CASE
       WHEN i.purpose IS DISTINCT FROM 'membership' AND lower(coalesce(i.metadata->>'productId','')) !~ '^membership_(vip|vvip)_(monthly|four_months|eight_months|yearly)$' THEN 'PURPOSE_OR_PRODUCT_NOT_CANONICAL'
       WHEN i.user_id IS NULL OR btrim(i.user_id)='' THEN 'PAYMENT_USER_MISSING'
       WHEN e.user_id IS NULL THEN 'MISSING_ENTITLEMENT'
       WHEN e.user_id<>i.user_id THEN 'ENTITLEMENT_USER_MISMATCH'
       WHEN e.payment_intent_id IS DISTINCT FROM i.id THEN 'ENTITLEMENT_PAYMENT_LINK_MISMATCH'
       WHEN i.status NOT IN ('COMPLETED','FULFILLED') THEN 'PAYMENT_NOT_COMPLETED'
       WHEN e.expires_at IS NOT NULL AND e.expires_at<=now() AND e.tier<>'free' THEN 'PAID_ENTITLEMENT_EXPIRED'
       ELSE 'LINKED_REQUIRES_PROVIDER_EVIDENCE_REVIEW'
     END AS reconciliation_status
   FROM public.ghc_payment_intents i
   LEFT JOIN public.ghc_membership_entitlements e ON e.payment_intent_id=i.id
   WHERE i.purpose='membership' OR lower(coalesce(i.metadata->>'productId','')) ~ '^membership_(vip|vvip)_(monthly|four_months|eight_months|yearly)$'
   ORDER BY coalesce(i.completed_at,i.fulfilled_at,i.created_at) DESC LIMIT least(1000,greatest(1,coalesce(p_limit,250)))
 ) x;
 RETURN jsonb_build_object('ok',true,'items',v_rows,'readOnly',true,'grantsAccess',false,
   'note','A linked intent is not independent proof of provider settlement. Verify provider evidence and catalog price before granting or correcting access.');
END; $$;
REVOKE ALL ON FUNCTION public.ghc_membership_payment_exception_detail(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ghc_membership_payment_exception_detail(integer) TO service_role;
COMMENT ON FUNCTION public.ghc_membership_payment_exception_detail(integer) IS 'Read-only, bounded membership payment-to-entitlement diagnostics. Does not grant or renew access.';
