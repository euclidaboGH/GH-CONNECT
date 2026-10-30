-- Phase 5: Expand cashback-eligible revenue sources + period reconciliation report.
-- Additive. Does not auto-mark events eligible. Service-role only.

-- 1) Expand event_type to include creator tips (PI tips settled as company-attributed revenue)
ALTER TABLE public.gh_company_revenue_events
  DROP CONSTRAINT IF EXISTS gh_company_revenue_events_event_type_check;

ALTER TABLE public.gh_company_revenue_events
  ADD CONSTRAINT gh_company_revenue_events_event_type_check
  CHECK (event_type IN (
    'marketplace_fee',
    'membership_revenue',
    'promotion_revenue',
    'digital_service_revenue',
    'creator_tip_revenue',
    'refund',
    'chargeback',
    'adjustment'
  ));

-- 2) Replace attributed append to accept creator_tip_revenue for cashback eligibility
CREATE OR REPLACE FUNCTION public.gh_company_revenue_event_append_attributed(
  p_idempotency_key text,
  p_source_provider text,
  p_source_event_id text,
  p_event_type text,
  p_currency text,
  p_gross_amount_minor bigint,
  p_company_revenue_minor bigint,
  p_provider_fee_minor bigint,
  p_tax_minor bigint,
  p_source_reference text,
  p_verified_at timestamptz,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_paying_user_id text DEFAULT NULL,
  p_related_source_event_id text DEFAULT NULL,
  p_cashback_eligible boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_existing public.gh_company_revenue_events%ROWTYPE;
  v_row public.gh_company_revenue_events%ROWTYPE;
  v_key text := trim(COALESCE(p_idempotency_key, ''));
  v_provider text := lower(trim(COALESCE(p_source_provider, '')));
  v_event_id text := trim(COALESCE(p_source_event_id, ''));
  v_type text := lower(trim(COALESCE(p_event_type, '')));
  v_currency text := upper(trim(COALESCE(p_currency, '')));
  v_reference text := trim(COALESCE(p_source_reference, ''));
  v_user_id text := NULLIF(trim(COALESCE(p_paying_user_id, '')), '');
  v_related_event_id text := NULLIF(trim(COALESCE(p_related_source_event_id, '')), '');
  v_metadata jsonb := COALESCE(p_metadata, '{}'::jsonb);
  v_related public.gh_company_revenue_events%ROWTYPE;
BEGIN
  IF v_key = '' OR length(v_key) > 200 OR v_event_id = '' OR length(v_event_id) > 240
     OR v_reference = '' OR length(v_reference) > 500 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_REVENUE_SOURCE');
  END IF;
  IF v_provider NOT IN ('pi', 'paystack', 'manual', 'other')
     OR v_type NOT IN (
       'marketplace_fee', 'membership_revenue', 'promotion_revenue',
       'digital_service_revenue', 'creator_tip_revenue',
       'refund', 'chargeback', 'adjustment'
     )
     OR v_currency !~ '^[A-Z]{3}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_REVENUE_CLASSIFICATION');
  END IF;
  IF p_verified_at IS NULL OR p_verified_at > now() + interval '5 minutes' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'VERIFIED_SOURCE_REQUIRED');
  END IF;
  IF p_gross_amount_minor IS NULL OR p_company_revenue_minor IS NULL
     OR p_provider_fee_minor IS NULL OR p_tax_minor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_REVENUE_AMOUNTS');
  END IF;
  IF NOT (
    (v_type IN ('refund', 'chargeback') AND p_gross_amount_minor <= 0 AND p_company_revenue_minor <= 0)
    OR (v_type NOT IN ('refund', 'chargeback', 'adjustment') AND p_gross_amount_minor >= 0 AND p_company_revenue_minor >= 0)
    OR v_type = 'adjustment'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REVENUE_DIRECTION_MISMATCH');
  END IF;
  IF p_gross_amount_minor = 0 AND p_company_revenue_minor = 0
     AND p_provider_fee_minor = 0 AND p_tax_minor = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ZERO_VALUE_EVENT');
  END IF;
  IF v_type NOT IN ('refund', 'chargeback', 'adjustment')
     AND (p_provider_fee_minor < 0 OR p_tax_minor < 0) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_REVENUE_COSTS');
  END IF;
  IF v_related_event_id IS NOT NULL AND length(v_related_event_id) > 240 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_RELATED_SOURCE_EVENT');
  END IF;
  IF jsonb_typeof(v_metadata) <> 'object' OR octet_length(v_metadata::text) > 4096 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_REVENUE_METADATA');
  END IF;
  IF COALESCE(p_cashback_eligible, false) AND (
    v_provider <> 'pi' OR v_currency <> 'PI' OR v_user_id IS NULL
    OR v_type NOT IN (
      'marketplace_fee', 'membership_revenue', 'promotion_revenue',
      'digital_service_revenue', 'creator_tip_revenue', 'refund', 'chargeback'
    )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CASHBACK_ATTRIBUTION_REQUIRED');
  END IF;
  IF COALESCE(p_cashback_eligible, false) AND v_type IN ('refund', 'chargeback') THEN
    IF v_related_event_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'RELATED_SOURCE_REQUIRED_FOR_COMPENSATION');
    END IF;
    SELECT * INTO v_related FROM public.gh_company_revenue_events
      WHERE source_provider = 'pi' AND currency = 'PI' AND source_event_id = v_related_event_id
        AND paying_user_id = v_user_id AND cashback_eligible = true
        AND event_type NOT IN ('refund', 'chargeback', 'adjustment')
      LIMIT 1;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'RELATED_ELIGIBLE_REVENUE_NOT_FOUND');
    END IF;
  END IF;

  SELECT * INTO v_existing FROM public.gh_company_revenue_events WHERE idempotency_key = v_key;
  IF FOUND THEN
    IF v_existing.source_provider = v_provider
       AND v_existing.source_event_id = v_event_id
       AND v_existing.event_type = v_type
       AND v_existing.currency = v_currency
       AND v_existing.gross_amount_minor = p_gross_amount_minor
       AND v_existing.company_revenue_minor = p_company_revenue_minor
       AND v_existing.cashback_eligible = COALESCE(p_cashback_eligible, false) THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true, 'eventId', v_existing.id);
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'IDEMPOTENCY_CONFLICT');
  END IF;

  INSERT INTO public.gh_company_revenue_events (
    idempotency_key, source_provider, source_event_id, event_type, currency,
    gross_amount_minor, company_revenue_minor, provider_fee_minor, tax_minor,
    source_reference, verified_at, metadata, paying_user_id, cashback_eligible, related_source_event_id
  ) VALUES (
    v_key, v_provider, v_event_id, v_type, v_currency,
    p_gross_amount_minor, p_company_revenue_minor, COALESCE(p_provider_fee_minor, 0), COALESCE(p_tax_minor, 0),
    v_reference, p_verified_at, v_metadata, v_user_id, COALESCE(p_cashback_eligible, false), v_related_event_id
  ) RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'eventId', v_row.id);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_company_revenue_event_append_attributed(
  text, text, text, text, text, bigint, bigint, bigint, bigint, text, timestamptz, jsonb, text, text, boolean
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_company_revenue_event_append_attributed(
  text, text, text, text, text, bigint, bigint, bigint, bigint, text, timestamptz, jsonb, text, text, boolean
) TO service_role;

-- 3) Reconciliation report: revenue by source vs cashback liabilities vs payouts
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
BEGIN
  IF p_starts_at IS NULL OR p_ends_at IS NULL OR p_ends_at <= p_starts_at THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_WINDOW');
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(s)::jsonb ORDER BY s.event_type), '[]'::jsonb)
  INTO v_by_source
  FROM (
    SELECT
      event_type,
      COUNT(*)::integer AS event_count,
      COALESCE(SUM(company_net_minor), 0)::numeric(38,0) AS net_atomic
    FROM public.gh_company_revenue_events
    WHERE source_provider = 'pi'
      AND currency = 'PI'
      AND cashback_eligible = true
      AND verified_at >= p_starts_at
      AND verified_at < p_ends_at
      AND event_type IN (
        'marketplace_fee', 'membership_revenue', 'promotion_revenue',
        'digital_service_revenue', 'creator_tip_revenue', 'refund', 'chargeback'
      )
    GROUP BY event_type
  ) s;

  SELECT
    COALESCE(SUM(company_net_minor), 0)::numeric(38,0),
    COALESCE(SUM(CASE WHEN event_type NOT IN ('refund', 'chargeback') THEN company_net_minor ELSE 0 END), 0)::numeric(38,0),
    COALESCE(SUM(CASE WHEN event_type IN ('refund', 'chargeback') THEN company_net_minor ELSE 0 END), 0)::numeric(38,0)
  INTO v_net_atomic, v_positive_atomic, v_compensation_atomic
  FROM public.gh_company_revenue_events
  WHERE source_provider = 'pi' AND currency = 'PI' AND cashback_eligible = true
    AND verified_at >= p_starts_at AND verified_at < p_ends_at
    AND event_type IN (
      'marketplace_fee', 'membership_revenue', 'promotion_revenue',
      'digital_service_revenue', 'creator_tip_revenue', 'refund', 'chargeback'
    );

  -- Expected liability at 300 bps of net (floor at 0)
  v_liability_atomic := GREATEST(0, trunc(v_net_atomic * 300 / 10000));

  SELECT * INTO v_period FROM public.gh_pi_cashback_periods
    WHERE starts_at = p_starts_at AND ends_at = p_ends_at
    LIMIT 1;

  IF to_regclass('public.gh_pi_cashback_a2u_payouts') IS NOT NULL THEN
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
    'eligibleNetRevenueAtomic', v_net_atomic,
    'positiveRevenueAtomic', v_positive_atomic,
    'compensationAtomic', v_compensation_atomic,
    'expectedCashbackLiabilityAtomic', v_liability_atomic,
    'periodClosed', v_period.id IS NOT NULL,
    'periodId', v_period.id,
    'periodTotalCashbackAtomic', v_period.total_cashback_atomic,
    'payoutReservedAtomic', v_reserved_atomic,
    'payoutPaidAtomic', v_paid_atomic,
    'payoutAttentionAtomic', v_attention_atomic,
    'liabilityCoverageOk',
      (v_period.id IS NULL)
      OR (COALESCE(v_period.total_cashback_atomic, 0) <= v_liability_atomic + 1),
    'supportedSources', jsonb_build_array(
      'marketplace_fee', 'membership_revenue', 'promotion_revenue',
      'digital_service_revenue', 'creator_tip_revenue', 'refund', 'chargeback'
    ),
    'cashbackRateBps', 300
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_pi_cashback_reconcile_period(timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_pi_cashback_reconcile_period(timestamptz, timestamptz)
  TO service_role;

COMMENT ON FUNCTION public.gh_pi_cashback_reconcile_period(timestamptz, timestamptz) IS
  'Phase 5: source-level cashback reconciliation. Compares eligible PI revenue to expected 3% liability and payout states. Not a payout.';
