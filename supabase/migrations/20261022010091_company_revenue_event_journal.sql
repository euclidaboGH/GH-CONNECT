-- GreenHaven company-revenue journal foundation.
-- This is separate from GHC utility ledger, marketplace seller balances, and payout obligations.
-- Do not apply to any live database until migration history/schema review and disposable PostgreSQL tests pass.

CREATE TABLE IF NOT EXISTS public.gh_company_revenue_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  source_provider text NOT NULL CHECK (source_provider IN ('pi', 'paystack', 'manual', 'other')),
  source_event_id text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'marketplace_fee', 'membership_revenue', 'promotion_revenue',
    'digital_service_revenue', 'refund', 'chargeback', 'adjustment'
  )),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  -- All amounts are integer minor units in the provider's currency (e.g. kobo for NGN).
  -- No floating-point accounting amounts are accepted by this journal.
  gross_amount_minor bigint NOT NULL,
  company_revenue_minor bigint NOT NULL,
  provider_fee_minor bigint NOT NULL DEFAULT 0,
  tax_minor bigint NOT NULL DEFAULT 0,
  company_net_minor bigint GENERATED ALWAYS AS (company_revenue_minor - provider_fee_minor - tax_minor) STORED,
  source_reference text NOT NULL,
  verified_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT gh_company_revenue_metadata_object CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT gh_company_revenue_metadata_size CHECK (octet_length(metadata::text) <= 4096),
  CONSTRAINT gh_company_revenue_nonzero_event CHECK (
    gross_amount_minor <> 0 OR company_revenue_minor <> 0 OR provider_fee_minor <> 0 OR tax_minor <> 0
  ),
  CONSTRAINT gh_company_revenue_event_direction CHECK (
    (event_type IN ('refund', 'chargeback') AND gross_amount_minor <= 0 AND company_revenue_minor <= 0)
    OR (event_type NOT IN ('refund', 'chargeback', 'adjustment') AND gross_amount_minor >= 0 AND company_revenue_minor >= 0)
    OR event_type = 'adjustment'
  ),
  CONSTRAINT gh_company_revenue_source_ref_nonempty CHECK (length(trim(source_reference)) > 0),
  CONSTRAINT gh_company_revenue_source_event_nonempty CHECK (length(trim(source_event_id)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_company_revenue_provider_event
  ON public.gh_company_revenue_events(source_provider, source_event_id);
CREATE INDEX IF NOT EXISTS idx_gh_company_revenue_recorded_at
  ON public.gh_company_revenue_events(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_gh_company_revenue_type_currency_date
  ON public.gh_company_revenue_events(event_type, currency, recorded_at DESC);

ALTER TABLE public.gh_company_revenue_events ENABLE ROW LEVEL SECURITY;
-- Keep RLS enabled and grant no table access to API roles. The SECURITY DEFINER RPC
-- runs as the migration owner; FORCE RLS would block its insert without an explicit policy.
REVOKE ALL ON TABLE public.gh_company_revenue_events FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gh_company_revenue_event_append(
  p_idempotency_key text,
  p_source_provider text,
  p_source_event_id text,
  p_event_type text,
  p_currency text,
  p_gross_amount_minor bigint,
  p_company_revenue_minor bigint,
  p_provider_fee_minor bigint DEFAULT 0,
  p_tax_minor bigint DEFAULT 0,
  p_source_reference text DEFAULT NULL,
  p_verified_at timestamptz DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Idempotency retries are accepted only when all economic/source fields match exactly.
  SELECT * INTO v_existing FROM public.gh_company_revenue_events
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
       AND v_existing.source_reference = v_reference THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true, 'eventId', v_existing.id);
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'REVENUE_IDEMPOTENCY_CONFLICT');
  END IF;

  INSERT INTO public.gh_company_revenue_events (
    idempotency_key, source_provider, source_event_id, event_type, currency,
    gross_amount_minor, company_revenue_minor, provider_fee_minor, tax_minor,
    source_reference, verified_at, metadata
  ) VALUES (
    v_key, v_provider, v_event_id, v_type, v_currency,
    p_gross_amount_minor, p_company_revenue_minor, p_provider_fee_minor, p_tax_minor,
    v_reference, p_verified_at, COALESCE(p_metadata, '{}'::jsonb)
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'eventId', v_id);
EXCEPTION WHEN unique_violation THEN
  -- A concurrent retry may win the unique key race; caller retries to read the canonical row.
  RETURN jsonb_build_object('ok', false, 'error', 'REVENUE_CONCURRENT_RETRY');
END;
$$;

REVOKE ALL ON FUNCTION public.gh_company_revenue_event_append(text,text,text,text,text,bigint,bigint,bigint,bigint,text,timestamptz,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_company_revenue_event_append(text,text,text,text,text,bigint,bigint,bigint,bigint,text,timestamptz,jsonb) TO service_role;

COMMENT ON TABLE public.gh_company_revenue_events IS
  'Append-only company revenue evidence journal; not the GHC ledger, not seller payable balance, and not proof of provider settlement unless recorded by a trusted verified integration.';
COMMENT ON COLUMN public.gh_company_revenue_events.company_net_minor IS
  'Generated net company amount: company revenue minus provider fees minus tax, in integer minor units.';


-- Enforce append-only behavior even if a future privileged code path is granted
-- table access accidentally. Corrections must be compensating events, never edits.
CREATE OR REPLACE FUNCTION public.gh_company_revenue_event_reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'GH_COMPANY_REVENUE_JOURNAL_APPEND_ONLY'
    USING ERRCODE = '55000';
END;
$$;

REVOKE ALL ON FUNCTION public.gh_company_revenue_event_reject_mutation() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS gh_company_revenue_events_append_only ON public.gh_company_revenue_events;
CREATE TRIGGER gh_company_revenue_events_append_only
  BEFORE UPDATE OR DELETE ON public.gh_company_revenue_events
  FOR EACH ROW EXECUTE FUNCTION public.gh_company_revenue_event_reject_mutation();
