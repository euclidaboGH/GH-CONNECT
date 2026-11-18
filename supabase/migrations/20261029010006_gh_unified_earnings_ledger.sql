-- Phase 3: Unified earnings ledger (immutable entries, explicit statuses, atomic PI).
-- Balances are derived from entries — never from client counters.
-- Additive only. Service-role RPCs. RLS deny-all.

CREATE TABLE IF NOT EXISTS public.gh_earnings_ledger_entries (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             text NOT NULL,
  asset               text NOT NULL DEFAULT 'PI' CHECK (asset = 'PI'),
  entry_type          text NOT NULL CHECK (entry_type IN (
                        'credit', 'debit', 'reserve', 'release_reserve', 'settle', 'reverse', 'dispute'
                      )),
  source_kind         text NOT NULL CHECK (source_kind IN (
                        'cashback', 'activity_reward', 'creator_earning', 'charity',
                        'adjustment', 'withdrawal', 'system'
                      )),
  -- Positive atomic units only (1 unit = 1e-7 PI for consistency with cashback tables)
  amount_atomic       numeric(38,0) NOT NULL CHECK (amount_atomic > 0),
  status              text NOT NULL CHECK (status IN (
                        'pending', 'available', 'reserved', 'paid', 'reversed', 'disputed'
                      )),
  unique_ref          text NOT NULL,
  source_table        text,
  source_id           text,
  related_entry_id    uuid REFERENCES public.gh_earnings_ledger_entries(id),
  payout_request_id   text,
  reason              text NOT NULL DEFAULT '',
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_earnings_user_nonempty CHECK (length(trim(user_id)) BETWEEN 1 AND 160),
  CONSTRAINT gh_earnings_ref_nonempty CHECK (length(trim(unique_ref)) BETWEEN 1 AND 200),
  CONSTRAINT gh_earnings_source_table_len CHECK (source_table IS NULL OR length(source_table) <= 80),
  CONSTRAINT gh_earnings_source_id_len CHECK (source_id IS NULL OR length(source_id) <= 120)
);

-- Idempotent business references per user
CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_earnings_user_ref
  ON public.gh_earnings_ledger_entries (user_id, unique_ref);

CREATE INDEX IF NOT EXISTS idx_gh_earnings_user_created
  ON public.gh_earnings_ledger_entries (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gh_earnings_user_status
  ON public.gh_earnings_ledger_entries (user_id, status, asset);

CREATE INDEX IF NOT EXISTS idx_gh_earnings_source
  ON public.gh_earnings_ledger_entries (source_kind, source_id)
  WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gh_earnings_payout_request
  ON public.gh_earnings_ledger_entries (payout_request_id)
  WHERE payout_request_id IS NOT NULL;

ALTER TABLE public.gh_earnings_ledger_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_earnings_ledger_no_client ON public.gh_earnings_ledger_entries;
CREATE POLICY gh_earnings_ledger_no_client ON public.gh_earnings_ledger_entries
  FOR ALL USING (false) WITH CHECK (false);

REVOKE ALL ON TABLE public.gh_earnings_ledger_entries FROM PUBLIC, anon, authenticated, service_role;

-- Bucket balances derived from entry types (authoritative).
CREATE OR REPLACE FUNCTION public.gh_earnings_balances(
  p_user_id text,
  p_asset text DEFAULT 'PI'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user text := NULLIF(trim(COALESCE(p_user_id, '')), '');
  v_asset text := COALESCE(NULLIF(trim(COALESCE(p_asset, '')), ''), 'PI');
  v_pending numeric(38,0) := 0;
  v_available numeric(38,0) := 0;
  v_reserved numeric(38,0) := 0;
  v_paid numeric(38,0) := 0;
  v_reversed numeric(38,0) := 0;
  v_disputed numeric(38,0) := 0;
BEGIN
  IF v_user IS NULL OR length(v_user) > 160 OR v_asset <> 'PI' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN entry_type = 'credit' AND status = 'pending' THEN amount_atomic ELSE 0 END), 0),
    COALESCE(SUM(CASE
      WHEN entry_type = 'credit' AND status = 'available' THEN amount_atomic
      WHEN entry_type = 'release_reserve' AND status = 'available' THEN amount_atomic
      WHEN entry_type = 'reverse' AND status = 'available' THEN amount_atomic
      WHEN entry_type = 'debit' AND status = 'available' THEN -amount_atomic
      WHEN entry_type = 'reserve' AND status = 'reserved' THEN -amount_atomic
      ELSE 0 END), 0),
    COALESCE(SUM(CASE
      WHEN entry_type = 'reserve' AND status = 'reserved' THEN amount_atomic
      WHEN entry_type = 'settle' AND status = 'paid' THEN -amount_atomic
      WHEN entry_type = 'release_reserve' AND status = 'available' THEN -amount_atomic
      ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN entry_type = 'settle' AND status = 'paid' THEN amount_atomic ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN entry_type = 'reverse' THEN amount_atomic ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN entry_type = 'dispute' AND status = 'disputed' THEN amount_atomic ELSE 0 END), 0)
  INTO v_pending, v_available, v_reserved, v_paid, v_reversed, v_disputed
  FROM public.gh_earnings_ledger_entries
  WHERE user_id = v_user AND asset = v_asset;

  -- Clamp available at 0 for safety reporting (ledger integrity should keep >= 0)
  IF v_available < 0 THEN v_available := 0; END IF;
  IF v_reserved < 0 THEN v_reserved := 0; END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'userId', v_user,
    'asset', v_asset,
    'pendingAtomic', v_pending,
    'availableAtomic', v_available,
    'reservedAtomic', v_reserved,
    'paidAtomic', v_paid,
    'reversedAtomic', v_reversed,
    'disputedAtomic', v_disputed,
    -- Display helpers (7 decimal places for PI atomic)
    'pending', (v_pending / 10000000.0),
    'available', (v_available / 10000000.0),
    'reserved', (v_reserved / 10000000.0),
    'paid', (v_paid / 10000000.0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_earnings_post_credit(
  p_user_id text,
  p_amount_atomic numeric,
  p_source_kind text,
  p_unique_ref text,
  p_status text DEFAULT 'available',
  p_source_table text DEFAULT NULL,
  p_source_id text DEFAULT NULL,
  p_reason text DEFAULT '',
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user text := NULLIF(trim(COALESCE(p_user_id, '')), '');
  v_ref text := NULLIF(trim(COALESCE(p_unique_ref, '')), '');
  v_kind text := NULLIF(trim(COALESCE(p_source_kind, '')), '');
  v_status text := COALESCE(NULLIF(trim(COALESCE(p_status, '')), ''), 'available');
  v_existing public.gh_earnings_ledger_entries%ROWTYPE;
  v_row public.gh_earnings_ledger_entries%ROWTYPE;
BEGIN
  IF v_user IS NULL OR v_ref IS NULL OR v_kind IS NULL
     OR p_amount_atomic IS NULL OR p_amount_atomic <= 0
     OR trunc(p_amount_atomic) <> p_amount_atomic THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  IF v_status NOT IN ('pending', 'available') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CREDIT_STATUS');
  END IF;
  IF v_kind NOT IN ('cashback', 'activity_reward', 'creator_earning', 'charity', 'adjustment', 'system') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_SOURCE_KIND');
  END IF;

  SELECT * INTO v_existing FROM public.gh_earnings_ledger_entries
    WHERE user_id = v_user AND unique_ref = v_ref;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true, 'duplicate', true, 'entryId', v_existing.id,
      'status', v_existing.status, 'amountAtomic', v_existing.amount_atomic
    );
  END IF;

  INSERT INTO public.gh_earnings_ledger_entries (
    user_id, asset, entry_type, source_kind, amount_atomic, status, unique_ref,
    source_table, source_id, reason, metadata
  ) VALUES (
    v_user, 'PI', 'credit', v_kind, p_amount_atomic, v_status, v_ref,
    NULLIF(trim(COALESCE(p_source_table, '')), ''),
    NULLIF(trim(COALESCE(p_source_id, '')), ''),
    left(COALESCE(p_reason, ''), 240),
    COALESCE(p_metadata, '{}'::jsonb)
  ) RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true, 'duplicate', false, 'entryId', v_row.id,
    'status', v_row.status, 'amountAtomic', v_row.amount_atomic
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_earnings_reserve(
  p_user_id text,
  p_amount_atomic numeric,
  p_unique_ref text,
  p_payout_request_id text,
  p_source_kind text DEFAULT 'withdrawal',
  p_reason text DEFAULT 'payout_reservation'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user text := NULLIF(trim(COALESCE(p_user_id, '')), '');
  v_ref text := NULLIF(trim(COALESCE(p_unique_ref, '')), '');
  v_pay text := NULLIF(trim(COALESCE(p_payout_request_id, '')), '');
  v_bal jsonb;
  v_available numeric(38,0);
  v_existing public.gh_earnings_ledger_entries%ROWTYPE;
  v_row public.gh_earnings_ledger_entries%ROWTYPE;
BEGIN
  IF v_user IS NULL OR v_ref IS NULL OR v_pay IS NULL
     OR p_amount_atomic IS NULL OR p_amount_atomic <= 0
     OR trunc(p_amount_atomic) <> p_amount_atomic THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  SELECT * INTO v_existing FROM public.gh_earnings_ledger_entries
    WHERE user_id = v_user AND unique_ref = v_ref;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true, 'duplicate', true, 'entryId', v_existing.id,
      'status', v_existing.status, 'amountAtomic', v_existing.amount_atomic
    );
  END IF;

  v_bal := public.gh_earnings_balances(v_user, 'PI');
  IF (v_bal->>'ok')::boolean IS NOT TRUE THEN
    RETURN v_bal;
  END IF;
  v_available := (v_bal->>'availableAtomic')::numeric;
  IF v_available < p_amount_atomic THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_AVAILABLE_EARNINGS', 'availableAtomic', v_available);
  END IF;

  INSERT INTO public.gh_earnings_ledger_entries (
    user_id, asset, entry_type, source_kind, amount_atomic, status, unique_ref,
    payout_request_id, reason
  ) VALUES (
    v_user, 'PI', 'reserve', COALESCE(NULLIF(trim(p_source_kind), ''), 'withdrawal'),
    p_amount_atomic, 'reserved', v_ref, v_pay, left(COALESCE(p_reason, ''), 240)
  ) RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true, 'duplicate', false, 'entryId', v_row.id,
    'status', 'reserved', 'amountAtomic', v_row.amount_atomic, 'payoutRequestId', v_pay
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_earnings_settle(
  p_user_id text,
  p_amount_atomic numeric,
  p_unique_ref text,
  p_payout_request_id text,
  p_reason text DEFAULT 'payout_settled'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user text := NULLIF(trim(COALESCE(p_user_id, '')), '');
  v_ref text := NULLIF(trim(COALESCE(p_unique_ref, '')), '');
  v_pay text := NULLIF(trim(COALESCE(p_payout_request_id, '')), '');
  v_existing public.gh_earnings_ledger_entries%ROWTYPE;
  v_row public.gh_earnings_ledger_entries%ROWTYPE;
  v_reserved numeric(38,0);
BEGIN
  IF v_user IS NULL OR v_ref IS NULL OR v_pay IS NULL
     OR p_amount_atomic IS NULL OR p_amount_atomic <= 0
     OR trunc(p_amount_atomic) <> p_amount_atomic THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  SELECT * INTO v_existing FROM public.gh_earnings_ledger_entries
    WHERE user_id = v_user AND unique_ref = v_ref;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true, 'duplicate', true, 'entryId', v_existing.id,
      'status', v_existing.status, 'amountAtomic', v_existing.amount_atomic
    );
  END IF;

  SELECT COALESCE(SUM(CASE
    WHEN entry_type = 'reserve' AND status = 'reserved' AND payout_request_id = v_pay THEN amount_atomic
    WHEN entry_type = 'settle' AND status = 'paid' AND payout_request_id = v_pay THEN -amount_atomic
    ELSE 0 END), 0)
  INTO v_reserved
  FROM public.gh_earnings_ledger_entries
  WHERE user_id = v_user AND asset = 'PI';

  IF v_reserved < p_amount_atomic THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_RESERVED_FOR_PAYOUT', 'reservedAtomic', v_reserved);
  END IF;

  INSERT INTO public.gh_earnings_ledger_entries (
    user_id, asset, entry_type, source_kind, amount_atomic, status, unique_ref,
    payout_request_id, reason
  ) VALUES (
    v_user, 'PI', 'settle', 'withdrawal', p_amount_atomic, 'paid', v_ref, v_pay,
    left(COALESCE(p_reason, ''), 240)
  ) RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true, 'duplicate', false, 'entryId', v_row.id,
    'status', 'paid', 'amountAtomic', v_row.amount_atomic
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_earnings_statement(
  p_user_id text,
  p_limit integer DEFAULT 50
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user text := NULLIF(trim(COALESCE(p_user_id, '')), '');
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_rows jsonb;
  v_bal jsonb;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  v_bal := public.gh_earnings_balances(v_user, 'PI');
  SELECT COALESCE(jsonb_agg(row_to_json(e)::jsonb ORDER BY e.created_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT id, entry_type, source_kind, amount_atomic, status, unique_ref,
           source_table, source_id, payout_request_id, reason, created_at
    FROM public.gh_earnings_ledger_entries
    WHERE user_id = v_user
    ORDER BY created_at DESC
    LIMIT v_limit
  ) e;
  RETURN jsonb_build_object('ok', true, 'balances', v_bal, 'entries', COALESCE(v_rows, '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.gh_earnings_balances(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_earnings_post_credit(text, numeric, text, text, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_earnings_reserve(text, numeric, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_earnings_settle(text, numeric, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_earnings_statement(text, integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.gh_earnings_balances(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_earnings_post_credit(text, numeric, text, text, text, text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_earnings_reserve(text, numeric, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_earnings_settle(text, numeric, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_earnings_statement(text, integer) TO service_role;

COMMENT ON TABLE public.gh_earnings_ledger_entries IS
  'Phase 3 unified earnings ledger. Immutable insert-only financial events; balances are derived. PI atomic units (1e-7 PI).';
