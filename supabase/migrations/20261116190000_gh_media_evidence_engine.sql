-- Research and Field Desk evidence integration over the existing private media pipeline.
-- REVIEW_REQUIRED: additive only; reconcile target migration history before applying.
BEGIN;

ALTER TABLE public.gh_research_evidence
  ADD COLUMN IF NOT EXISTS media_asset_id text NULL REFERENCES public.gh_media_assets(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS reviewed_by text NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS review_note text NULL CHECK (review_note IS NULL OR char_length(review_note) <= 1000);
CREATE UNIQUE INDEX IF NOT EXISTS gh_research_evidence_media_unique_idx
  ON public.gh_research_evidence(media_asset_id) WHERE media_asset_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS gh_research_evidence_review_queue_idx
  ON public.gh_research_evidence(project_id,verification_status,created_at DESC);

CREATE TABLE IF NOT EXISTS public.gh_field_report_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.gh_field_reports(id) ON DELETE CASCADE,
  media_asset_id text NOT NULL REFERENCES public.gh_media_assets(id) ON DELETE RESTRICT,
  uploaded_by text NOT NULL CHECK (char_length(uploaded_by) BETWEEN 1 AND 256),
  caption text NOT NULL DEFAULT '' CHECK (char_length(caption) <= 500),
  verification_status text NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','rejected','quarantined')),
  reviewed_by text NULL,
  reviewed_at timestamptz NULL,
  review_note text NULL CHECK (review_note IS NULL OR char_length(review_note) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(report_id,media_asset_id)
);
CREATE INDEX IF NOT EXISTS gh_field_report_evidence_report_idx
  ON public.gh_field_report_evidence(report_id,created_at DESC);

ALTER TABLE public.gh_field_report_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.gh_field_report_evidence FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.gh_field_report_evidence TO service_role;
REVOKE ALL ON TABLE public.gh_research_evidence FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.gh_research_evidence TO service_role;

COMMENT ON TABLE public.gh_field_report_evidence IS
  'Private evidence references attached to durable Field Desk reports. Media bytes remain in the private gh-media bucket.';
COMMENT ON COLUMN public.gh_research_evidence.media_asset_id IS
  'Reference to a ready, owner-owned gh_media_assets row. Bytes are delivered only through the authorized media facade.';
COMMIT;
