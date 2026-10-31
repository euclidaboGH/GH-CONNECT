-- Phase 7: Shared A2U payout orchestration — review queue + stuck-job detection.
-- Does not mark payments paid without provider verification (app-layer rule).
-- Additive. Service-role only.

CREATE TABLE IF NOT EXISTS public.gh_pi_a2u_review_queue (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_kind       text NOT NULL CHECK (source_kind IN (
                      'cashback', 'seller_marketplace', 'creator', 'other'
                    )),
  source_request_id text NOT NULL,
  user_id           text NOT NULL,
  provider_payment_id text,
  txid              text,
  amount_atomic     numeric(38,0),
  reason_code       text NOT NULL,
  detail            text,
  status            text NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolution_note   text,
  resolved_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_a2u_review_user_nonempty CHECK (length(trim(user_id)) BETWEEN 1 AND 160),
  CONSTRAINT gh_a2u_review_request_nonempty CHECK (length(trim(source_request_id)) BETWEEN 1 AND 80),
  CONSTRAINT gh_a2u_review_reason_nonempty CHECK (length(trim(reason_code)) BETWEEN 1 AND 120)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_pi_a2u_review_open_request
  ON public.gh_pi_a2u_review_queue (source_kind, source_request_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_gh_pi_a2u_review_status
  ON public.gh_pi_a2u_review_queue (status, created_at DESC);

ALTER TABLE public.gh_pi_a2u_review_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_pi_a2u_review_queue_no_client ON public.gh_pi_a2u_review_queue;
CREATE POLICY gh_pi_a2u_review_queue_no_client ON public.gh_pi_a2u_review_queue
  FOR ALL USING (false) WITH CHECK (false);

REVOKE ALL ON TABLE public.gh_pi_a2u_review_queue FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gh_pi_a2u_review_enqueue(
  p_source_kind text,
  p_source_request_id text,
  p_user_id text,
  p_reason_code text,
  p_provider_payment_id text DEFAULT NULL,
  p_txid text DEFAULT NULL,
  p_amount_atomic numeric DEFAULT NULL,
  p_detail text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_kind text := NULLIF(trim(COALESCE(p_source_kind, '')), '');
  v_req text := NULLIF(trim(COALESCE(p_source_request_id, '')), '');
  v_user text := NULLIF(trim(COALESCE(p_user_id, '')), '');
  v_reason text := NULLIF(left(trim(COALESCE(p_reason_code, '')), 120), '');
  v_existing public.gh_pi_a2u_review_queue%ROWTYPE;
  v_row public.gh_pi_a2u_review_queue%ROWTYPE;
BEGIN
  IF v_kind IS NULL OR v_req IS NULL OR v_user IS NULL OR v_reason IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  IF v_kind NOT IN ('cashback', 'seller_marketplace', 'creator', 'other') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_SOURCE_KIND');
  END IF;

  SELECT * INTO v_existing FROM public.gh_pi_a2u_review_queue
    WHERE source_kind = v_kind AND source_request_id = v_req AND status = 'open'
    LIMIT 1;
  IF FOUND THEN
    UPDATE public.gh_pi_a2u_review_queue
      SET provider_payment_id = COALESCE(NULLIF(trim(COALESCE(p_provider_payment_id, '')), ''), provider_payment_id),
          txid = COALESCE(NULLIF(trim(COALESCE(p_txid, '')), ''), txid),
          amount_atomic = COALESCE(p_amount_atomic, amount_atomic),
          detail = COALESCE(NULLIF(left(trim(COALESCE(p_detail, '')), 400), ''), detail),
          reason_code = v_reason,
          updated_at = now()
      WHERE id = v_existing.id
      RETURNING * INTO v_row;
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'reviewId', v_row.id, 'status', v_row.status);
  END IF;

  INSERT INTO public.gh_pi_a2u_review_queue (
    source_kind, source_request_id, user_id, provider_payment_id, txid,
    amount_atomic, reason_code, detail, status
  ) VALUES (
    v_kind, v_req, v_user,
    NULLIF(trim(COALESCE(p_provider_payment_id, '')), ''),
    NULLIF(trim(COALESCE(p_txid, '')), ''),
    p_amount_atomic, v_reason,
    NULLIF(left(trim(COALESCE(p_detail, '')), 400), ''),
    'open'
  ) RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'reviewId', v_row.id, 'status', 'open');
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_pi_a2u_review_resolve(
  p_review_id uuid,
  p_status text,
  p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_status text := NULLIF(trim(COALESCE(p_status, '')), '');
  v_row public.gh_pi_a2u_review_queue%ROWTYPE;
BEGIN
  IF p_review_id IS NULL OR v_status IS NULL OR v_status NOT IN ('resolved', 'dismissed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  UPDATE public.gh_pi_a2u_review_queue
    SET status = v_status,
        resolution_note = NULLIF(left(trim(COALESCE(p_note, '')), 400), ''),
        resolved_at = now(),
        updated_at = now()
    WHERE id = p_review_id AND status = 'open'
    RETURNING * INTO v_row;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REVIEW_NOT_OPEN');
  END IF;
  RETURN jsonb_build_object('ok', true, 'reviewId', v_row.id, 'status', v_row.status);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_pi_a2u_review_list_open(
  p_limit integer DEFAULT 50
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb ORDER BY r.created_at ASC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT id, source_kind, source_request_id, user_id, provider_payment_id, txid,
           amount_atomic, reason_code, detail, status, created_at
    FROM public.gh_pi_a2u_review_queue
    WHERE status = 'open'
    ORDER BY created_at ASC
    LIMIT v_limit
  ) r;
  RETURN jsonb_build_object('ok', true, 'items', COALESCE(v_rows, '[]'::jsonb));
END;
$$;

-- Stuck cashback payouts still processing without progress (operator signal only)
CREATE OR REPLACE FUNCTION public.gh_pi_a2u_list_stuck_jobs(
  p_older_than_minutes integer DEFAULT 30
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_mins integer := LEAST(GREATEST(COALESCE(p_older_than_minutes, 30), 5), 24 * 60);
  v_cashback jsonb := '[]'::jsonb;
  v_seller jsonb := '[]'::jsonb;
BEGIN
  IF to_regclass('public.gh_pi_cashback_a2u_payouts') IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(row_to_json(c)::jsonb), '[]'::jsonb) INTO v_cashback
    FROM (
      SELECT id AS request_id, user_id, status, execution_state, provider_payment_id, txid,
             amount_atomic, last_error_code, updated_at
      FROM public.gh_pi_cashback_a2u_payouts
      WHERE status IN ('processing', 'attention')
        AND updated_at < now() - make_interval(mins => v_mins)
      ORDER BY updated_at ASC
      LIMIT 50
    ) c;
  END IF;

  IF to_regclass('public.gh_pi_a2u_executions') IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(row_to_json(s)::jsonb), '[]'::jsonb) INTO v_seller
    FROM (
      SELECT id AS execution_id, payout_request_id, seller_id, state, provider_payment_id, txid,
             amount, last_error_code, updated_at
      FROM public.gh_pi_a2u_executions
      WHERE state IN ('initiating', 'created', 'submitted', 'attention')
        AND updated_at < now() - make_interval(mins => v_mins)
      ORDER BY updated_at ASC
      LIMIT 50
    ) s;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'olderThanMinutes', v_mins,
    'cashback', COALESCE(v_cashback, '[]'::jsonb),
    'seller', COALESCE(v_seller, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_pi_a2u_review_enqueue(text, text, text, text, text, text, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_a2u_review_resolve(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_a2u_review_list_open(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_a2u_list_stuck_jobs(integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.gh_pi_a2u_review_enqueue(text, text, text, text, text, text, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_pi_a2u_review_resolve(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_pi_a2u_review_list_open(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_pi_a2u_list_stuck_jobs(integer) TO service_role;

COMMENT ON TABLE public.gh_pi_a2u_review_queue IS
  'Phase 7 manual-review queue for A2U payouts that cannot auto-complete. Open items block silent paid transitions.';
