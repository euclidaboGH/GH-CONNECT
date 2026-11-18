-- GreenHaven Pi cashback attribution + four-month period ledger foundation.
-- REVIEW_REQUIRED: validate on disposable PostgreSQL and Testnet; never auto-apply.
-- All PI amounts in this migration are integer atomic units (1 unit = 0.0000001 PI).
-- This creates entitlement records only. It does NOT initiate or authorize A2U payments.

ALTER TABLE public.gh_company_revenue_events
  ADD COLUMN IF NOT EXISTS paying_user_id text,
  ADD COLUMN IF NOT EXISTS cashback_eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS related_source_event_id text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gh_company_revenue_paying_user_nonempty' AND conrelid = 'public.gh_company_revenue_events'::regclass) THEN
    ALTER TABLE public.gh_company_revenue_events
      ADD CONSTRAINT gh_company_revenue_paying_user_nonempty
      CHECK (paying_user_id IS NULL OR length(trim(paying_user_id)) BETWEEN 1 AND 160);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_gh_company_revenue_cashback_user_period
  ON public.gh_company_revenue_events(paying_user_id, verified_at)
  WHERE cashback_eligible = true AND currency = 'PI' AND source_provider = 'pi';

COMMENT ON COLUMN public.gh_company_revenue_events.paying_user_id IS
  'Canonical GreenHaven account ID of the paying user, supplied only by a trusted verified payment/revenue integration; not a Pi username or client claim.';
COMMENT ON COLUMN public.gh_company_revenue_events.cashback_eligible IS
  'Explicit finance-policy eligibility flag. Defaults false; only trusted server integrations may set true for verified attributable PI revenue or linked compensating events.';
COMMENT ON COLUMN public.gh_company_revenue_events.related_source_event_id IS
  'Original verified revenue source event for a compensating refund/chargeback; required and ownership-checked before a compensation can affect cashback.';

-- Separate attributed append RPC. The existing un-attributed RPC remains compatible,
-- but its rows default to cashback_eligible=false and cannot enter cashback calculations.
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
  p_paying_user_id text,
  p_related_source_event_id text DEFAULT NULL,
  p_cashback_eligible boolean DEFAULT false,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid;
  v_existing public.gh_company_revenue_events%ROWTYPE;
  v_key text := trim(COALESCE(p_idempotency_key, ''));
  v_provider text := lower(trim(COALESCE(p_source_provider, '')));
  v_event_id text := trim(COALESCE(p_source_event_id, ''));
  v_type text := lower(trim(COALESCE(p_event_type, '')));
  v_currency text := upper(trim(COALESCE(p_currency, '')));
  v_reference text := trim(COALESCE(p_source_reference, ''));
  v_user_id text := NULLIF(trim(COALESCE(p_paying_user_id, '')), '');
  v_related_event_id text := NULLIF(trim(COALESCE(p_related_source_event_id, '')), '');
  v_original_user_id text;
  v_metadata jsonb := COALESCE(p_metadata, '{}'::jsonb);
BEGIN
  IF v_key = '' OR length(v_key) > 200 OR v_event_id = '' OR length(v_event_id) > 240
     OR v_reference = '' OR length(v_reference) > 500 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_REVENUE_SOURCE');
  END IF;
  IF v_provider NOT IN ('pi', 'paystack', 'manual', 'other')
     OR v_type NOT IN ('marketplace_fee', 'membership_revenue', 'promotion_revenue',
       'digital_service_revenue', 'refund', 'chargeback', 'adjustment')
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
    OR v_type NOT IN ('marketplace_fee', 'membership_revenue', 'promotion_revenue',
      'digital_service_revenue', 'refund', 'chargeback')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CASHBACK_ATTRIBUTION_REQUIRED');
  END IF;
  IF v_user_id IS NOT NULL AND length(v_user_id) > 160 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_PAYING_USER');
  END IF;
  IF COALESCE(p_cashback_eligible, false) AND v_type IN ('refund', 'chargeback') THEN
    IF v_related_event_id IS NULL OR length(v_related_event_id) > 240 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'CASHBACK_COMPENSATION_SOURCE_REQUIRED');
    END IF;
    SELECT paying_user_id INTO v_original_user_id
    FROM public.gh_company_revenue_events
    WHERE source_provider = 'pi' AND source_event_id = v_related_event_id
      AND paying_user_id = v_user_id AND cashback_eligible = true
      AND event_type NOT IN ('refund', 'chargeback', 'adjustment')
    LIMIT 1;
    IF v_original_user_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'CASHBACK_COMPENSATION_SOURCE_MISMATCH');
    END IF;
  END IF;

  SELECT * INTO v_existing
  FROM public.gh_company_revenue_events
  WHERE idempotency_key = v_key OR (source_provider = v_provider AND source_event_id = v_event_id)
  LIMIT 1;
  IF FOUND THEN
    IF v_existing.idempotency_key = v_key
       AND v_existing.source_provider = v_provider
       AND v_existing.source_event_id = v_event_id
       AND v_existing.event_type = v_type
       AND v_existing.currency = v_currency
       AND v_existing.gross_amount_minor = p_gross_amount_minor
       AND v_existing.company_revenue_minor = p_company_revenue_minor
       AND v_existing.provider_fee_minor = p_provider_fee_minor
       AND v_existing.tax_minor = p_tax_minor
       AND v_existing.source_reference = v_reference
       AND v_existing.paying_user_id IS NOT DISTINCT FROM v_user_id
       AND v_existing.related_source_event_id IS NOT DISTINCT FROM v_related_event_id
       AND v_existing.cashback_eligible = COALESCE(p_cashback_eligible, false) THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true, 'eventId', v_existing.id);
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'REVENUE_IDEMPOTENCY_CONFLICT');
  END IF;

  INSERT INTO public.gh_company_revenue_events (
    idempotency_key, source_provider, source_event_id, event_type, currency,
    gross_amount_minor, company_revenue_minor, provider_fee_minor, tax_minor,
    source_reference, verified_at, metadata, paying_user_id, cashback_eligible, related_source_event_id
  ) VALUES (
    v_key, v_provider, v_event_id, v_type, v_currency,
    p_gross_amount_minor, p_company_revenue_minor, p_provider_fee_minor, p_tax_minor,
    v_reference, p_verified_at, v_metadata, v_user_id, COALESCE(p_cashback_eligible, false), v_related_event_id
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'eventId', v_id);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', false, 'error', 'REVENUE_CONCURRENT_RETRY');
END;
$$;

REVOKE ALL ON FUNCTION public.gh_company_revenue_event_append_attributed(text,text,text,text,text,bigint,bigint,bigint,bigint,text,timestamptz,text,text,boolean,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_company_revenue_event_append_attributed(text,text,text,text,text,bigint,bigint,bigint,bigint,text,timestamptz,text,text,boolean,jsonb) TO service_role;

CREATE TABLE IF NOT EXISTS public.gh_pi_cashback_periods (
  id text PRIMARY KEY,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  policy_version text NOT NULL,
  status text NOT NULL DEFAULT 'closed' CHECK (status IN ('closed')),
  user_count integer NOT NULL DEFAULT 0 CHECK (user_count >= 0),
  total_net_revenue_atomic numeric(38,0) NOT NULL DEFAULT 0 CHECK (total_net_revenue_atomic >= 0),
  total_cashback_atomic numeric(38,0) NOT NULL DEFAULT 0 CHECK (total_cashback_atomic >= 0),
  finalized_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_pi_cashback_period_window CHECK (ends_at > starts_at),
  CONSTRAINT gh_pi_cashback_period_policy_nonempty CHECK (length(trim(policy_version)) BETWEEN 1 AND 80),
  CONSTRAINT uq_gh_pi_cashback_period_window UNIQUE (starts_at, ends_at)
);

CREATE TABLE IF NOT EXISTS public.gh_pi_cashback_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id text NOT NULL REFERENCES public.gh_pi_cashback_periods(id),
  user_id text NOT NULL CHECK (length(trim(user_id)) BETWEEN 1 AND 160),
  policy_version text NOT NULL,
  currency text NOT NULL DEFAULT 'PI' CHECK (currency = 'PI'),
  eligible_net_revenue_atomic numeric(38,0) NOT NULL,
  cashback_rate_bps integer NOT NULL DEFAULT 300 CHECK (cashback_rate_bps = 300),
  cashback_amount_atomic numeric(38,0) NOT NULL CHECK (cashback_amount_atomic >= 0),
  eligible_event_count integer NOT NULL CHECK (eligible_event_count >= 1),
  status text NOT NULL DEFAULT 'calculated' CHECK (status IN ('calculated', 'needs_review')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_gh_pi_cashback_entitlement_user_period_policy UNIQUE (user_id, period_id, policy_version)
);

CREATE INDEX IF NOT EXISTS idx_gh_pi_cashback_entitlement_user_created
  ON public.gh_pi_cashback_entitlements(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gh_pi_cashback_entitlement_period
  ON public.gh_pi_cashback_entitlements(period_id, user_id);

ALTER TABLE public.gh_pi_cashback_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gh_pi_cashback_entitlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.gh_pi_cashback_periods FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.gh_pi_cashback_entitlements FROM PUBLIC, anon, authenticated, service_role;

-- Periods are fixed four-month UTC windows starting Jan 1, May 1, or Sep 1.
-- The caller supplies a canonical period ID and policy version; this RPC is service-role only.
-- Calculation includes only explicitly eligible, verified PI revenue events attributed to a user.
-- Refund/chargeback events must be attributed to the original payer and explicitly marked eligible.
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
DECLARE
  v_period public.gh_pi_cashback_periods%ROWTYPE;
  v_existing_id text;
  v_users integer := 0;
  v_total_net numeric(38,0) := 0;
  v_total_cashback numeric(38,0) := 0;
BEGIN
  IF COALESCE(trim(p_period_id), '') = '' OR length(trim(p_period_id)) > 100
     OR COALESCE(trim(p_policy_version), '') = '' OR length(trim(p_policy_version)) > 80
     OR p_starts_at IS NULL OR p_ends_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_PERIOD');
  END IF;
  IF p_ends_at > now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PERIOD_NOT_ENDED');
  END IF;
  IF (p_starts_at AT TIME ZONE 'UTC') <> date_trunc('day', p_starts_at AT TIME ZONE 'UTC')
     OR extract(month FROM (p_starts_at AT TIME ZONE 'UTC')) NOT IN (1, 5, 9)
     OR extract(day FROM (p_starts_at AT TIME ZONE 'UTC')) <> 1
     OR (p_ends_at AT TIME ZONE 'UTC') <> ((p_starts_at AT TIME ZONE 'UTC') + interval '4 months') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PERIOD_MUST_BE_FIXED_FOUR_MONTH_UTC_WINDOW');
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
      'totalCashbackAtomic', v_period.total_cashback_atomic);
  END IF;

  -- A single transaction closes the period and writes every entitlement. Unique keys make
  -- accidental repeated source events or user/period calculations unable to double grant.
  BEGIN
    INSERT INTO public.gh_pi_cashback_periods (id, starts_at, ends_at, policy_version, status)
    VALUES (trim(p_period_id), p_starts_at, p_ends_at, trim(p_policy_version), 'closed');
  EXCEPTION WHEN unique_violation THEN
    -- A concurrent close may have committed the same window after our initial read.
    SELECT * INTO v_period FROM public.gh_pi_cashback_periods
    WHERE starts_at = p_starts_at AND ends_at = p_ends_at
    LIMIT 1;
    IF FOUND AND v_period.id = trim(p_period_id) AND v_period.policy_version = trim(p_policy_version) THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true, 'periodId', v_period.id,
        'status', v_period.status, 'userCount', v_period.user_count,
        'totalNetRevenueAtomic', v_period.total_net_revenue_atomic,
        'totalCashbackAtomic', v_period.total_cashback_atomic);
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'PERIOD_ID_OR_POLICY_CONFLICT');
  END;

  WITH per_user AS (
    SELECT paying_user_id AS user_id,
      SUM(company_net_minor)::numeric(38,0) AS net_atomic,
      COUNT(*)::integer AS event_count
    FROM public.gh_company_revenue_events
    WHERE source_provider = 'pi' AND currency = 'PI' AND cashback_eligible = true
      AND paying_user_id IS NOT NULL AND verified_at >= p_starts_at AND verified_at < p_ends_at
    GROUP BY paying_user_id
  ), calculated AS (
    SELECT user_id, net_atomic, event_count,
      FLOOR(GREATEST(0::numeric, net_atomic) * 3 / 100)::numeric(38,0) AS cashback_atomic
    FROM per_user
  ), inserted AS (
    INSERT INTO public.gh_pi_cashback_entitlements (
      period_id, user_id, policy_version, eligible_net_revenue_atomic,
      cashback_rate_bps, cashback_amount_atomic, eligible_event_count, status
    )
    SELECT trim(p_period_id), user_id, trim(p_policy_version), net_atomic, 300,
      cashback_atomic, event_count, 'calculated'
    FROM calculated
    ON CONFLICT (user_id, period_id, policy_version) DO NOTHING
    RETURNING eligible_net_revenue_atomic, cashback_amount_atomic
  )
  SELECT COUNT(*)::integer,
    COALESCE(SUM(GREATEST(eligible_net_revenue_atomic, 0)), 0)::numeric(38,0),
    COALESCE(SUM(cashback_amount_atomic), 0)::numeric(38,0)
  INTO v_users, v_total_net, v_total_cashback FROM inserted;

  UPDATE public.gh_pi_cashback_periods
  SET user_count = v_users, total_net_revenue_atomic = v_total_net,
      total_cashback_atomic = v_total_cashback, finalized_at = now()
  WHERE id = trim(p_period_id)
  RETURNING * INTO v_period;

  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'periodId', v_period.id,
    'status', v_period.status, 'userCount', v_period.user_count,
    'totalNetRevenueAtomic', v_period.total_net_revenue_atomic,
    'totalCashbackAtomic', v_period.total_cashback_atomic);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_pi_cashback_period_close(text,timestamptz,timestamptz,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_pi_cashback_period_close(text,timestamptz,timestamptz,text) TO service_role;

COMMENT ON TABLE public.gh_pi_cashback_periods IS
  'Closed four-month UTC cashback calculations. Calculation records are idempotent and do not prove A2U funding or payout.';
COMMENT ON TABLE public.gh_pi_cashback_entitlements IS
  'Calculated cashback entitlements at 3% of eligible attributed net company revenue, in PI atomic units; not yet withdrawable, not blockchain settlement records, and not directly client-writable.';


CREATE OR REPLACE FUNCTION public.gh_pi_cashback_entitlement_reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'GH_PI_CASHBACK_ENTITLEMENT_APPEND_ONLY'
    USING ERRCODE = '55000';
END;
$$;
REVOKE ALL ON FUNCTION public.gh_pi_cashback_entitlement_reject_mutation() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS gh_pi_cashback_entitlements_append_only ON public.gh_pi_cashback_entitlements;
CREATE TRIGGER gh_pi_cashback_entitlements_append_only
  BEFORE UPDATE OR DELETE ON public.gh_pi_cashback_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.gh_pi_cashback_entitlement_reject_mutation();
