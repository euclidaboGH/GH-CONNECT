-- Phase 3 Marketplace: durable, authenticated listing-report intake.
-- Reports are moderation records only; this migration does not alter commerce,
-- wallet, payment, inventory, payout, or order-settlement authority.

CREATE TABLE IF NOT EXISTS public.gh_marketplace_listing_reports (
  id text PRIMARY KEY,
  listing_id text NOT NULL REFERENCES public.gh_marketplace_listings(id) ON DELETE RESTRICT,
  seller_id text NOT NULL,
  reporter_id text NOT NULL,
  reason text NOT NULL CHECK (reason IN ('scam', 'prohibited', 'misleading', 'counterfeit', 'other')),
  note text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolver_id text,
  CONSTRAINT gh_marketplace_listing_reports_note_length CHECK (note IS NULL OR char_length(note) <= 500),
  CONSTRAINT gh_marketplace_listing_reports_distinct_actor CHECK (reporter_id <> seller_id),
  CONSTRAINT gh_marketplace_listing_reports_one_per_actor UNIQUE (listing_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_gh_marketplace_listing_reports_queue
  ON public.gh_marketplace_listing_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gh_marketplace_listing_reports_seller
  ON public.gh_marketplace_listing_reports (seller_id, created_at DESC);

ALTER TABLE public.gh_marketplace_listing_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_marketplace_listing_reports_no_client ON public.gh_marketplace_listing_reports;
CREATE POLICY gh_marketplace_listing_reports_no_client
  ON public.gh_marketplace_listing_reports
  FOR ALL USING (false) WITH CHECK (false);

REVOKE ALL ON TABLE public.gh_marketplace_listing_reports FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.gh_marketplace_listing_reports TO service_role;

CREATE OR REPLACE FUNCTION public.gh_marketplace_listing_report_create(
  p_listing_id text,
  p_reporter_id text,
  p_reason text,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_listing public.gh_marketplace_listings%ROWTYPE;
  v_report_id text;
  v_status text;
  v_inserted integer;
  v_reason text := lower(trim(coalesce(p_reason, '')));
  v_note text := nullif(left(trim(coalesce(p_note, '')), 500), '');
BEGIN
  IF trim(coalesce(p_listing_id, '')) = '' OR trim(coalesce(p_reporter_id, '')) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  IF v_reason NOT IN ('scam', 'prohibited', 'misleading', 'counterfeit', 'other') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_REASON');
  END IF;

  SELECT * INTO v_listing
    FROM public.gh_marketplace_listings
   WHERE id = trim(p_listing_id)
     AND status <> 'removed';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'LISTING_NOT_FOUND');
  END IF;
  IF v_listing.seller_id = trim(p_reporter_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CANNOT_REPORT_OWN_LISTING');
  END IF;

  INSERT INTO public.gh_marketplace_listing_reports (
    id, listing_id, seller_id, reporter_id, reason, note
  ) VALUES (
    'mlr_' || replace(gen_random_uuid()::text, '-', ''),
    v_listing.id, v_listing.seller_id, trim(p_reporter_id), v_reason, v_note
  )
  ON CONFLICT (listing_id, reporter_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  SELECT id, status INTO v_report_id, v_status
    FROM public.gh_marketplace_listing_reports
   WHERE listing_id = v_listing.id AND reporter_id = trim(p_reporter_id);

  IF v_report_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REPORT_PERSISTENCE_FAILED');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'reportId', v_report_id,
    'status', v_status,
    'duplicate', v_inserted = 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_marketplace_listing_report_create(text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_listing_report_create(text, text, text, text) TO service_role;

COMMENT ON TABLE public.gh_marketplace_listing_reports IS
  'Authenticated buyer/community safety reports for marketplace listings. Service-role write/read boundary; no payment or settlement authority.';
COMMENT ON FUNCTION public.gh_marketplace_listing_report_create(text, text, text, text) IS
  'Idempotent marketplace listing report intake. Actor identity is supplied only by the authenticated server route.';


CREATE OR REPLACE FUNCTION public.gh_marketplace_listing_report_transition(
  p_report_id text,
  p_resolver_id text,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_report public.gh_marketplace_listing_reports%ROWTYPE;
  v_next text := lower(trim(coalesce(p_status, '')));
  v_resolver text := nullif(trim(coalesce(p_resolver_id, '')), '');
BEGIN
  IF trim(coalesce(p_report_id, '')) = '' OR v_resolver IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  IF v_next NOT IN ('reviewing', 'resolved', 'dismissed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_STATUS');
  END IF;

  SELECT * INTO v_report
    FROM public.gh_marketplace_listing_reports
   WHERE id = trim(p_report_id)
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REPORT_NOT_FOUND');
  END IF;
  IF v_report.status = v_next THEN
    RETURN jsonb_build_object('ok', true, 'id', v_report.id, 'status', v_report.status, 'idempotent', true);
  END IF;
  IF v_report.status IN ('resolved', 'dismissed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REPORT_ALREADY_CLOSED');
  END IF;

  UPDATE public.gh_marketplace_listing_reports
     SET status = v_next,
         resolver_id = CASE WHEN v_next IN ('resolved', 'dismissed') THEN v_resolver ELSE resolver_id END,
         resolved_at = CASE WHEN v_next IN ('resolved', 'dismissed') THEN now() ELSE NULL END,
         updated_at = now()
   WHERE id = v_report.id;

  RETURN jsonb_build_object('ok', true, 'id', v_report.id, 'status', v_next, 'idempotent', false);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_marketplace_listing_report_transition(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_listing_report_transition(text, text, text) TO service_role;
