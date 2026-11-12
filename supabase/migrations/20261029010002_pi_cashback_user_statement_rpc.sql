-- User-scoped read API for calculated Pi cashback statements.
-- REVIEW_REQUIRED: validate with the prior cashback migration on disposable PostgreSQL.
-- This exposes calculated entitlements only; it never makes them withdrawable or sends Pi.

CREATE OR REPLACE FUNCTION public.gh_pi_cashback_user_statement(
  p_user_id text,
  p_limit integer DEFAULT 12
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id text := NULLIF(trim(COALESCE(p_user_id, '')), '');
  v_limit integer := LEAST(50, GREATEST(1, COALESCE(p_limit, 12)));
  v_items jsonb := '[]'::jsonb;
  v_calculated numeric(38,0) := 0;
  v_review numeric(38,0) := 0;
BEGIN
  IF v_user_id IS NULL OR length(v_user_id) > 160 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_USER');
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN status = 'calculated' THEN cashback_amount_atomic ELSE 0 END), 0)::numeric(38,0),
    COALESCE(SUM(CASE WHEN status = 'needs_review' THEN cashback_amount_atomic ELSE 0 END), 0)::numeric(38,0)
  INTO v_calculated, v_review
  FROM public.gh_pi_cashback_entitlements
  WHERE user_id = v_user_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(rows) ORDER BY rows.ends_at DESC, rows.created_at DESC), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT e.id::text AS entitlement_id, e.period_id, p.starts_at, p.ends_at,
      e.policy_version, e.currency, e.eligible_net_revenue_atomic::text AS eligible_net_revenue_atomic,
      e.cashback_rate_bps, e.cashback_amount_atomic::text AS cashback_amount_atomic,
      e.eligible_event_count, e.status, e.created_at,
      'calculated_not_withdrawable'::text AS financial_state
    FROM public.gh_pi_cashback_entitlements e
    JOIN public.gh_pi_cashback_periods p ON p.id = e.period_id
    WHERE e.user_id = v_user_id
    ORDER BY p.ends_at DESC, e.created_at DESC
    LIMIT v_limit
  ) AS rows;

  RETURN jsonb_build_object(
    'ok', true,
    'featureAvailable', true,
    'currency', 'PI',
    'atomicUnitsPerPi', 10000000,
    'calculatedAtomic', v_calculated::text,
    'needsReviewAtomic', v_review::text,
    'withdrawalEnabled', false,
    'items', v_items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_pi_cashback_user_statement(text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_pi_cashback_user_statement(text,integer) TO service_role;
COMMENT ON FUNCTION public.gh_pi_cashback_user_statement(text,integer) IS
  'Returns only the specified user’s calculated Pi cashback statement. Must be called server-side with the canonical authenticated user ID; does not expose table access or authorize withdrawals.';
