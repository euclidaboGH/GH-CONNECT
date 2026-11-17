-- PROPOSAL: Field Desk public intake (elections, surveys, situation reports)
-- Do not apply without operator review. Service-role write; no public grants.

CREATE TABLE IF NOT EXISTS public.gh_field_reports (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('situation', 'result', 'survey', 'general')),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  label text NULL CHECK (label IS NULL OR char_length(label) <= 40),
  location_hint text NULL CHECK (location_hint IS NULL OR char_length(location_hint) <= 80),
  survey_id text NULL CHECK (survey_id IS NULL OR char_length(survey_id) <= 64),
  admin_user_id text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gh_field_reports_created_at_idx ON public.gh_field_reports (created_at DESC);

ALTER TABLE public.gh_field_reports ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated — service role only.

CREATE OR REPLACE FUNCTION public.gh_field_report_append(
  p_id uuid,
  p_kind text,
  p_body text,
  p_label text DEFAULT NULL,
  p_location_hint text DEFAULT NULL,
  p_survey_id text DEFAULT NULL,
  p_admin_user_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.gh_field_reports (id, kind, body, label, location_hint, survey_id, admin_user_id)
  VALUES (p_id, p_kind, p_body, p_label, p_location_hint, p_survey_id, p_admin_user_id);
  RETURN jsonb_build_object('ok', true, 'id', p_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', 'FIELD_REPORT_PERSIST_FAILED');
END;
$$;

REVOKE ALL ON FUNCTION public.gh_field_report_append FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_field_report_append TO service_role;
