-- Phase 9: Charity & platform utility accounting (segregated from user withdrawable earnings).
-- Withdrawal fees (3%) and charity credits never increase a user's available PI balance.
-- Service-role only. RLS deny-all.

CREATE TABLE IF NOT EXISTS public.gh_platform_utility_entries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_kind        text NOT NULL CHECK (entry_kind IN (
                      'withdrawal_fee',
                      'charity_in',
                      'charity_out',
                      'utility_sink',
                      'adjustment'
                    )),
  asset             text NOT NULL DEFAULT 'PI' CHECK (asset = 'PI'),
  amount_atomic     numeric(38,0) NOT NULL CHECK (amount_atomic > 0),
  -- Optional user attribution (payer of fee, donor, etc.) — never a withdrawable credit
  related_user_id   text,
  unique_ref        text NOT NULL,
  source_table      text,
  source_id         text,
  payout_request_id text,
  reason            text NOT NULL DEFAULT '',
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_platform_util_ref_nonempty CHECK (length(trim(unique_ref)) BETWEEN 1 AND 200),
  CONSTRAINT gh_platform_util_user_len CHECK (
    related_user_id IS NULL OR length(trim(related_user_id)) BETWEEN 1 AND 160
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_platform_utility_ref
  ON public.gh_platform_utility_entries (unique_ref);

CREATE INDEX IF NOT EXISTS idx_gh_platform_utility_kind_created
  ON public.gh_platform_utility_entries (entry_kind, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gh_platform_utility_user
  ON public.gh_platform_utility_entries (related_user_id, created_at DESC)
  WHERE related_user_id IS NOT NULL;

ALTER TABLE public.gh_platform_utility_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_platform_utility_no_client ON public.gh_platform_utility_entries;
CREATE POLICY gh_platform_utility_no_client ON public.gh_platform_utility_entries
  FOR ALL USING (false) WITH CHECK (false);
REVOKE ALL ON TABLE public.gh_platform_utility_entries FROM PUBLIC, anon, authenticated, service_role;

-- User-facing charity contributions (audit of gifts; not withdrawable earnings)
CREATE TABLE IF NOT EXISTS public.gh_charity_contributions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           text NOT NULL,
  amount_atomic     numeric(38,0) NOT NULL CHECK (amount_atomic > 0),
  asset             text NOT NULL DEFAULT 'PI' CHECK (asset = 'PI'),
  unique_ref        text NOT NULL,
  campaign_key      text NOT NULL DEFAULT 'general',
  status            text NOT NULL DEFAULT 'recorded'
                    CHECK (status IN ('recorded', 'voided')),
  platform_entry_id uuid REFERENCES public.gh_platform_utility_entries(id),
  reason            text NOT NULL DEFAULT '',
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_charity_user_nonempty CHECK (length(trim(user_id)) BETWEEN 1 AND 160),
  CONSTRAINT gh_charity_ref_nonempty CHECK (length(trim(unique_ref)) BETWEEN 1 AND 200),
  CONSTRAINT gh_charity_campaign_len CHECK (length(trim(campaign_key)) BETWEEN 1 AND 80)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_charity_user_ref
  ON public.gh_charity_contributions (user_id, unique_ref);

CREATE INDEX IF NOT EXISTS idx_gh_charity_user_created
  ON public.gh_charity_contributions (user_id, created_at DESC);

ALTER TABLE public.gh_charity_contributions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_charity_contributions_no_client ON public.gh_charity_contributions;
CREATE POLICY gh_charity_contributions_no_client ON public.gh_charity_contributions
  FOR ALL USING (false) WITH CHECK (false);
REVOKE ALL ON TABLE public.gh_charity_contributions FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gh_platform_utility_post(
  p_entry_kind text,
  p_amount_atomic numeric,
  p_unique_ref text,
  p_related_user_id text DEFAULT NULL,
  p_source_table text DEFAULT NULL,
  p_source_id text DEFAULT NULL,
  p_payout_request_id text DEFAULT NULL,
  p_reason text DEFAULT '',
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_kind text := NULLIF(trim(COALESCE(p_entry_kind, '')), '');
  v_ref text := NULLIF(trim(COALESCE(p_unique_ref, '')), '');
  v_user text := NULLIF(trim(COALESCE(p_related_user_id, '')), '');
  v_amount numeric(38,0);
  v_existing public.gh_platform_utility_entries%ROWTYPE;
  v_row public.gh_platform_utility_entries%ROWTYPE;
BEGIN
  IF v_kind IS NULL OR v_ref IS NULL OR p_amount_atomic IS NULL OR p_amount_atomic <= 0
     OR trunc(p_amount_atomic) <> p_amount_atomic THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  IF v_kind NOT IN ('withdrawal_fee', 'charity_in', 'charity_out', 'utility_sink', 'adjustment') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_ENTRY_KIND');
  END IF;
  v_amount := trunc(p_amount_atomic);

  SELECT * INTO v_existing FROM public.gh_platform_utility_entries WHERE unique_ref = v_ref;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true, 'duplicate', true, 'entryId', v_existing.id,
      'entryKind', v_existing.entry_kind, 'amountAtomic', v_existing.amount_atomic
    );
  END IF;

  INSERT INTO public.gh_platform_utility_entries (
    entry_kind, asset, amount_atomic, related_user_id, unique_ref,
    source_table, source_id, payout_request_id, reason, metadata
  ) VALUES (
    v_kind, 'PI', v_amount, v_user, v_ref,
    NULLIF(trim(COALESCE(p_source_table, '')), ''),
    NULLIF(trim(COALESCE(p_source_id, '')), ''),
    NULLIF(trim(COALESCE(p_payout_request_id, '')), ''),
    left(COALESCE(p_reason, ''), 240),
    COALESCE(p_metadata, '{}'::jsonb)
  ) RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true, 'duplicate', false, 'entryId', v_row.id,
    'entryKind', v_row.entry_kind, 'amountAtomic', v_row.amount_atomic
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_charity_record_contribution(
  p_user_id text,
  p_amount_atomic numeric,
  p_unique_ref text,
  p_campaign_key text DEFAULT 'general',
  p_reason text DEFAULT 'charity_contribution',
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user text := NULLIF(trim(COALESCE(p_user_id, '')), '');
  v_ref text := NULLIF(trim(COALESCE(p_unique_ref, '')), '');
  v_campaign text := COALESCE(NULLIF(trim(COALESCE(p_campaign_key, '')), ''), 'general');
  v_amount numeric(38,0);
  v_existing public.gh_charity_contributions%ROWTYPE;
  v_platform jsonb;
  v_platform_id uuid;
  v_row public.gh_charity_contributions%ROWTYPE;
BEGIN
  IF v_user IS NULL OR v_ref IS NULL OR p_amount_atomic IS NULL OR p_amount_atomic <= 0
     OR trunc(p_amount_atomic) <> p_amount_atomic THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  v_amount := trunc(p_amount_atomic);

  SELECT * INTO v_existing FROM public.gh_charity_contributions
    WHERE user_id = v_user AND unique_ref = v_ref;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true, 'duplicate', true, 'contributionId', v_existing.id,
      'amountAtomic', v_existing.amount_atomic, 'status', v_existing.status
    );
  END IF;

  v_platform := public.gh_platform_utility_post(
    'charity_in', v_amount, 'charity:' || v_user || ':' || v_ref,
    v_user, 'gh_charity_contributions', v_ref, NULL,
    left(COALESCE(p_reason, ''), 240),
    COALESCE(p_metadata, '{}'::jsonb)
  );
  IF (v_platform->>'ok')::boolean IS NOT TRUE THEN
    RETURN v_platform;
  END IF;
  v_platform_id := NULLIF(v_platform->>'entryId', '')::uuid;

  INSERT INTO public.gh_charity_contributions (
    user_id, amount_atomic, asset, unique_ref, campaign_key, status,
    platform_entry_id, reason, metadata
  ) VALUES (
    v_user, v_amount, 'PI', v_ref, left(v_campaign, 80), 'recorded',
    v_platform_id, left(COALESCE(p_reason, ''), 240), COALESCE(p_metadata, '{}'::jsonb)
  ) RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true, 'duplicate', false, 'contributionId', v_row.id,
    'platformEntryId', v_platform_id, 'amountAtomic', v_row.amount_atomic,
    'status', 'recorded',
    'note', 'Charity is segregated from withdrawable earnings and never credits available balance'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_platform_utility_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(s)::jsonb ORDER BY s.entry_kind), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT entry_kind,
           COUNT(*)::integer AS entry_count,
           COALESCE(SUM(amount_atomic), 0)::numeric(38,0) AS total_atomic
    FROM public.gh_platform_utility_entries
    GROUP BY entry_kind
  ) s;
  RETURN jsonb_build_object(
    'ok', true,
    'asset', 'PI',
    'byKind', COALESCE(v_rows, '[]'::jsonb),
    'segregatedFromUserWithdrawable', true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_charity_user_summary(p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user text := NULLIF(trim(COALESCE(p_user_id, '')), '');
  v_total numeric(38,0);
  v_count integer;
  v_items jsonb;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  SELECT COALESCE(SUM(amount_atomic), 0), COUNT(*)::integer
    INTO v_total, v_count
  FROM public.gh_charity_contributions
  WHERE user_id = v_user AND status = 'recorded';

  SELECT COALESCE(jsonb_agg(row_to_json(c)::jsonb ORDER BY c.created_at DESC), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT id, amount_atomic, campaign_key, status, unique_ref, reason, created_at
    FROM public.gh_charity_contributions
    WHERE user_id = v_user AND status = 'recorded'
    ORDER BY created_at DESC
    LIMIT 20
  ) c;

  RETURN jsonb_build_object(
    'ok', true,
    'userId', v_user,
    'totalAtomic', v_total,
    'total', (v_total / 10000000.0),
    'contributionCount', v_count,
    'items', COALESCE(v_items, '[]'::jsonb),
    'withdrawable', false,
    'note', 'Charity contributions are not part of available PI earnings'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_platform_utility_post(text, numeric, text, text, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_charity_record_contribution(text, numeric, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_platform_utility_summary() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_charity_user_summary(text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.gh_platform_utility_post(text, numeric, text, text, text, text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_charity_record_contribution(text, numeric, text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_platform_utility_summary() TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_charity_user_summary(text) TO service_role;

COMMENT ON TABLE public.gh_platform_utility_entries IS
  'Phase 9 platform utility/charity ledger. Segregated from user gh_earnings_ledger_entries; fees and charity never increase available balances.';
COMMENT ON TABLE public.gh_charity_contributions IS
  'Phase 9 user charity contribution audit. Not withdrawable earnings.';
