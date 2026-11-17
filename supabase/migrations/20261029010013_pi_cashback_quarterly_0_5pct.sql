-- Policy change: Pi cashback = 0.5% of eligible user PI spend, claimable quarterly (UTC).
-- Quarters: Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec. Rate: 50 bps.
-- Additive / replace functions. Service-role only.

-- Allow new rate on entitlements (keep historical rows readable)
ALTER TABLE public.gh_pi_cashback_entitlements
  DROP CONSTRAINT IF EXISTS gh_pi_cashback_entitlements_cashback_rate_bps_check;

ALTER TABLE public.gh_pi_cashback_entitlements
  ADD CONSTRAINT gh_pi_cashback_entitlements_cashback_rate_bps_check
  CHECK (cashback_rate_bps IN (50, 300));

COMMENT ON COLUMN public.gh_pi_cashback_entitlements.cashback_rate_bps IS
  'Cashback rate in basis points. Policy phase13+: 50 (0.5% of eligible spend). Legacy 300 retained for historical rows only.';

-- Quarterly close: 0.5% of eligible attributable gross PI spend (user spend), net of refunds/chargebacks.
CREATE OR REPLACE FUNCTION public.gh_pi_cashback_period_close_unchecked(
  p_period_id text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_policy_version text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_period public.gh_pi_cashback_periods%ROWTYPE;
  v_existing_id text;
  v_users integer := 0;
  v_total_spend numeric(38,0) := 0;
  v_total_cashback numeric(38,0) := 0;
  v_rate_bps integer := 50;
BEGIN
  IF COALESCE(trim(p_period_id), '') = '' OR length(trim(p_period_id)) > 100
     OR COALESCE(trim(p_policy_version), '') = '' OR length(trim(p_policy_version)) > 80
     OR p_starts_at IS NULL OR p_ends_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_PERIOD');
  END IF;
  IF p_ends_at > now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PERIOD_NOT_ENDED');
  END IF;
  -- Fixed UTC quarterly windows starting on day 1 of Jan, Apr, Jul, or Oct
  IF (p_starts_at AT TIME ZONE 'UTC') <> date_trunc('day', p_starts_at AT TIME ZONE 'UTC')
     OR extract(month FROM (p_starts_at AT TIME ZONE 'UTC')) NOT IN (1, 4, 7, 10)
     OR extract(day FROM (p_starts_at AT TIME ZONE 'UTC')) <> 1
     OR (p_ends_at AT TIME ZONE 'UTC') <> ((p_starts_at AT TIME ZONE 'UTC') + interval '3 months') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PERIOD_MUST_BE_FIXED_QUARTERLY_UTC_WINDOW');
  END IF;

  SELECT id INTO v_existing_id FROM public.gh_pi_cashback_periods
  WHERE starts_at = p_starts_at AND ends_at = p_ends_at
  LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    SELECT * INTO v_period FROM public.gh_pi_cashback_periods WHERE id = v_existing_id;
    IF v_existing_id <> trim(p_period_id) OR v_period.policy_version <> trim(p_policy_version) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'PERIOD_ID_OR_POLICY_CONFLICT');
    END IF;
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'periodId', v_period.id,
      'status', v_period.status, 'userCount', v_period.user_count,
      'totalNetRevenueAtomic', v_period.total_net_revenue_atomic,
      'totalCashbackAtomic', v_period.total_cashback_atomic,
      'cashbackRateBps', v_rate_bps, 'cadence', 'quarterly');
  END IF;

  INSERT INTO public.gh_pi_cashback_periods (
    id, starts_at, ends_at, policy_version, status,
    user_count, total_net_revenue_atomic, total_cashback_atomic, finalized_at
  ) VALUES (
    trim(p_period_id), p_starts_at, p_ends_at, trim(p_policy_version), 'closed',
    0, 0, 0, now()
  );

  -- Eligible user spend: sum of gross_amount_minor on cashback-eligible PI events
  -- (purchases positive; refunds/chargebacks negative). Floor cashback at 0 per user.
  WITH spend AS (
    SELECT
      paying_user_id AS user_id,
      COALESCE(SUM(gross_amount_minor), 0)::numeric(38,0) AS spend_atomic,
      COUNT(*)::integer AS event_count
    FROM public.gh_company_revenue_events
    WHERE source_provider = 'pi'
      AND currency = 'PI'
      AND cashback_eligible = true
      AND paying_user_id IS NOT NULL
      AND verified_at >= p_starts_at
      AND verified_at < p_ends_at
      AND event_type IN (
        'marketplace_fee', 'membership_revenue', 'promotion_revenue',
        'digital_service_revenue', 'creator_tip_revenue', 'refund', 'chargeback'
      )
    GROUP BY paying_user_id
  ),
  calculated AS (
    SELECT
      user_id,
      spend_atomic,
      event_count,
      GREATEST(0, trunc(GREATEST(spend_atomic, 0) * v_rate_bps / 10000))::numeric(38,0) AS cashback_atomic
    FROM spend
    WHERE event_count >= 1 AND spend_atomic > 0
  ),
  inserted AS (
    INSERT INTO public.gh_pi_cashback_entitlements (
      period_id, user_id, policy_version, currency,
      eligible_net_revenue_atomic, cashback_rate_bps, cashback_amount_atomic,
      eligible_event_count, status
    )
    SELECT
      trim(p_period_id), user_id, trim(p_policy_version), 'PI',
      spend_atomic, v_rate_bps, cashback_atomic, event_count, 'calculated'
    FROM calculated
    ON CONFLICT (user_id, period_id, policy_version) DO NOTHING
    RETURNING eligible_net_revenue_atomic, cashback_amount_atomic
  )
  SELECT COUNT(*)::integer,
    COALESCE(SUM(GREATEST(eligible_net_revenue_atomic, 0)), 0)::numeric(38,0),
    COALESCE(SUM(cashback_amount_atomic), 0)::numeric(38,0)
  INTO v_users, v_total_spend, v_total_cashback FROM inserted;

  UPDATE public.gh_pi_cashback_periods
  SET user_count = v_users,
      total_net_revenue_atomic = v_total_spend,
      total_cashback_atomic = v_total_cashback,
      finalized_at = now()
  WHERE id = trim(p_period_id)
  RETURNING * INTO v_period;

  RETURN jsonb_build_object(
    'ok', true, 'duplicate', false, 'periodId', v_period.id,
    'status', v_period.status, 'userCount', v_period.user_count,
    'totalEligibleSpendAtomic', v_period.total_net_revenue_atomic,
    'totalCashbackAtomic', v_period.total_cashback_atomic,
    'cashbackRateBps', v_rate_bps,
    'cadence', 'quarterly',
    'policy', '0.5% of eligible PI user spend per UTC quarter'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_pi_cashback_period_close(
  p_period_id text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_policy_version text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- Seven-day post-quarter reconciliation grace before immutable calculation
  IF now() < p_ends_at + interval '7 days' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'PERIOD_RECONCILIATION_WINDOW_OPEN',
      'reconciliationAvailableAt', p_ends_at + interval '7 days',
      'cadence', 'quarterly'
    );
  END IF;
  RETURN public.gh_pi_cashback_period_close_unchecked(
    p_period_id, p_starts_at, p_ends_at, p_policy_version
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_pi_cashback_period_close_unchecked(text, timestamptz, timestamptz, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_cashback_period_close(text, timestamptz, timestamptz, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_pi_cashback_period_close_unchecked(text, timestamptz, timestamptz, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_pi_cashback_period_close(text, timestamptz, timestamptz, text)
  TO service_role;

COMMENT ON FUNCTION public.gh_pi_cashback_period_close(text, timestamptz, timestamptz, text) IS
  'Quarterly Pi cashback close: 0.5% (50 bps) of eligible user PI spend; 7-day post-period grace; service_role only.';

-- Align reconcile expected liability with 50 bps when recreated callers use feeBps from app
-- (gh_pi_cashback_reconcile_period still documents rate; patch expected liability math)
CREATE OR REPLACE FUNCTION public.gh_pi_cashback_reconcile_period(
  p_starts_at timestamptz,
  p_ends_at timestamptz
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_by_source jsonb;
  v_net_atomic numeric(38,0) := 0;
  v_positive_atomic numeric(38,0) := 0;
  v_compensation_atomic numeric(38,0) := 0;
  v_liability_atomic numeric(38,0) := 0;
  v_reserved_atomic numeric(38,0) := 0;
  v_paid_atomic numeric(38,0) := 0;
  v_attention_atomic numeric(38,0) := 0;
  v_period public.gh_pi_cashback_periods%ROWTYPE;
  v_rate_bps integer := 50;
BEGIN
  IF p_starts_at IS NULL OR p_ends_at IS NULL OR p_ends_at <= p_starts_at THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_WINDOW');
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(s)::jsonb ORDER BY s.event_type), '[]'::jsonb)
  INTO v_by_source
  FROM (
    SELECT event_type, COUNT(*)::integer AS event_count,
           COALESCE(SUM(gross_amount_minor), 0)::numeric(38,0) AS spend_atomic
    FROM public.gh_company_revenue_events
    WHERE source_provider = 'pi' AND currency = 'PI' AND cashback_eligible = true
      AND verified_at >= p_starts_at AND verified_at < p_ends_at
      AND event_type IN (
        'marketplace_fee', 'membership_revenue', 'promotion_revenue',
        'digital_service_revenue', 'creator_tip_revenue', 'refund', 'chargeback'
      )
    GROUP BY event_type
  ) s;

  SELECT
    COALESCE(SUM(gross_amount_minor), 0)::numeric(38,0),
    COALESCE(SUM(CASE WHEN event_type NOT IN ('refund', 'chargeback') THEN gross_amount_minor ELSE 0 END), 0)::numeric(38,0),
    COALESCE(SUM(CASE WHEN event_type IN ('refund', 'chargeback') THEN gross_amount_minor ELSE 0 END), 0)::numeric(38,0)
  INTO v_net_atomic, v_positive_atomic, v_compensation_atomic
  FROM public.gh_company_revenue_events
  WHERE source_provider = 'pi' AND currency = 'PI' AND cashback_eligible = true
    AND verified_at >= p_starts_at AND verified_at < p_ends_at
    AND event_type IN (
      'marketplace_fee', 'membership_revenue', 'promotion_revenue',
      'digital_service_revenue', 'creator_tip_revenue', 'refund', 'chargeback'
    );

  v_liability_atomic := GREATEST(0, trunc(GREATEST(v_net_atomic, 0) * v_rate_bps / 10000));

  SELECT * INTO v_period FROM public.gh_pi_cashback_periods
    WHERE starts_at = p_starts_at AND ends_at = p_ends_at LIMIT 1;

  IF to_regclass('public.gh_pi_cashback_a2u_payouts') IS NOT NULL AND v_period.id IS NOT NULL THEN
    SELECT
      COALESCE(SUM(CASE WHEN status IN ('processing', 'attention') THEN amount_atomic ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN status = 'paid' THEN amount_atomic ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN status = 'attention' THEN amount_atomic ELSE 0 END), 0)
    INTO v_reserved_atomic, v_paid_atomic, v_attention_atomic
    FROM public.gh_pi_cashback_a2u_payouts p
    JOIN public.gh_pi_cashback_entitlements e ON e.id = p.entitlement_id
    WHERE e.period_id = v_period.id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'window', jsonb_build_object('startsAt', p_starts_at, 'endsAt', p_ends_at),
    'bySource', COALESCE(v_by_source, '[]'::jsonb),
    'eligibleSpendAtomic', v_net_atomic,
    'positiveSpendAtomic', v_positive_atomic,
    'compensationAtomic', v_compensation_atomic,
    'expectedCashbackLiabilityAtomic', v_liability_atomic,
    'periodClosed', v_period.id IS NOT NULL,
    'periodId', v_period.id,
    'periodTotalCashbackAtomic', v_period.total_cashback_atomic,
    'payoutReservedAtomic', v_reserved_atomic,
    'payoutPaidAtomic', v_paid_atomic,
    'payoutAttentionAtomic', v_attention_atomic,
    'liabilityCoverageOk',
      (v_period.id IS NULL) OR (COALESCE(v_period.total_cashback_atomic, 0) <= v_liability_atomic + 1),
    'cashbackRateBps', v_rate_bps,
    'cashbackRatePercent', 0.5,
    'cadence', 'quarterly',
    'policy', '0.5% of eligible PI user spend per UTC quarter'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_pi_cashback_reconcile_period(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_pi_cashback_reconcile_period(timestamptz, timestamptz) TO service_role;
