-- Scoped evidence intake for public respondents and access-code field agents.
-- Quarantine is fail-closed: no evidence is served until a trusted scanner attests clean.
BEGIN;

-- The append-only chain trigger uses extensions.digest(); declare the dependency explicitly.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.gh_research_evidence
  ADD COLUMN IF NOT EXISTS submission_key text NULL CHECK (submission_key IS NULL OR submission_key ~ '^[A-Za-z0-9_-]{16,80}$'),
  ADD COLUMN IF NOT EXISTS uploader_type text NOT NULL DEFAULT 'owner' CHECK (uploader_type IN ('owner','public_respondent','field_agent','administrator')),
  ADD COLUMN IF NOT EXISTS uploader_session_id uuid NULL,
  ADD COLUMN IF NOT EXISTS scan_status text NOT NULL DEFAULT 'pending' CHECK (scan_status IN ('pending','clean','infected','error')),
  ADD COLUMN IF NOT EXISTS scanner_engine text NULL CHECK (scanner_engine IS NULL OR char_length(scanner_engine)<=80),
  ADD COLUMN IF NOT EXISTS scanned_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS geo_unit_id uuid NULL REFERENCES public.gh_research_geo_units(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS captured_latitude numeric(9,6) NULL CHECK (captured_latitude BETWEEN -90 AND 90),
  ADD COLUMN IF NOT EXISTS captured_longitude numeric(9,6) NULL CHECK (captured_longitude BETWEEN -180 AND 180),
  ADD COLUMN IF NOT EXISTS location_accuracy_m numeric(10,2) NULL CHECK (location_accuracy_m BETWEEN 0 AND 100000);
CREATE INDEX IF NOT EXISTS gh_research_evidence_submission_idx
  ON public.gh_research_evidence(project_id,submission_key) WHERE submission_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS gh_research_evidence_scan_queue_idx
  ON public.gh_research_evidence(scan_status,created_at) WHERE scan_status IN ('pending','error');

ALTER TABLE public.gh_field_reports
  ADD COLUMN IF NOT EXISTS field_session_jti text NULL CHECK (field_session_jti IS NULL OR field_session_jti ~ '^[a-f0-9]{32}$');
ALTER TABLE public.gh_field_report_evidence
  ADD COLUMN IF NOT EXISTS sha256 text NULL CHECK (sha256 IS NULL OR sha256 ~ '^[a-f0-9]{64}$'),
  ADD COLUMN IF NOT EXISTS scan_status text NOT NULL DEFAULT 'pending' CHECK (scan_status IN ('pending','clean','infected','error')),
  ADD COLUMN IF NOT EXISTS scanner_engine text NULL CHECK (scanner_engine IS NULL OR char_length(scanner_engine)<=80),
  ADD COLUMN IF NOT EXISTS scanned_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS geo_unit_id uuid NULL REFERENCES public.gh_research_geo_units(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata)='object' AND pg_column_size(metadata)<=8192),
  ADD COLUMN IF NOT EXISTS uploaded_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS gh_field_report_evidence_scan_queue_idx
  ON public.gh_field_report_evidence(scan_status,created_at) WHERE scan_status IN ('pending','error');

CREATE TABLE IF NOT EXISTS public.gh_scoped_evidence_uploads (
  id uuid PRIMARY KEY,
  scope_type text NOT NULL CHECK (scope_type IN ('research_response','field_report')),
  project_id uuid NULL REFERENCES public.gh_research_projects(id) ON DELETE CASCADE,
  report_id uuid NULL REFERENCES public.gh_field_reports(id) ON DELETE CASCADE,
  submission_key text NULL CHECK (submission_key IS NULL OR submission_key ~ '^[A-Za-z0-9_-]{16,80}$'),
  field_session_jti text NULL CHECK (field_session_jti IS NULL OR field_session_jti ~ '^[a-f0-9]{32}$'),
  uploader_label text NOT NULL DEFAULT '' CHECK (char_length(uploader_label)<=40),
  geo_unit_id uuid NULL REFERENCES public.gh_research_geo_units(id) ON DELETE RESTRICT,
  owner_media_id text NOT NULL CHECK (char_length(owner_media_id) BETWEEN 1 AND 256),
  bucket text NOT NULL CHECK (bucket ~ '^[a-z0-9_-]{1,100}$'),
  storage_path text NOT NULL CHECK (char_length(storage_path) BETWEEN 1 AND 1024),
  mime_type text NOT NULL CHECK (char_length(mime_type) BETWEEN 3 AND 160),
  byte_size bigint NOT NULL CHECK (byte_size BETWEEN 1 AND 104857600),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  media_asset_id text NULL REFERENCES public.gh_media_assets(id) ON DELETE RESTRICT,
  sha256 text NULL CHECK (sha256 IS NULL OR sha256 ~ '^[a-f0-9]{64}$'),
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','quarantined','attached','failed','expired')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata)='object' AND pg_column_size(metadata)<=8192),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  completed_at timestamptz NULL,
  CHECK ((scope_type='research_response' AND project_id IS NOT NULL AND report_id IS NULL AND submission_key IS NOT NULL AND field_session_jti IS NULL)
      OR (scope_type='field_report' AND report_id IS NOT NULL AND project_id IS NULL AND submission_key IS NULL AND field_session_jti IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS gh_scoped_evidence_upload_path_unique
  ON public.gh_scoped_evidence_uploads(bucket,storage_path);
CREATE INDEX IF NOT EXISTS gh_scoped_evidence_upload_expiry_idx
  ON public.gh_scoped_evidence_uploads(status,expires_at);
CREATE INDEX IF NOT EXISTS gh_scoped_evidence_upload_scope_idx
  ON public.gh_scoped_evidence_uploads(scope_type,project_id,submission_key,created_at DESC);
ALTER TABLE public.gh_scoped_evidence_uploads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.gh_scoped_evidence_uploads FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.gh_scoped_evidence_uploads TO service_role;

-- Append-only cryptographic event chain for evidence creation, scanner outcomes and reviews.
CREATE TABLE IF NOT EXISTS public.gh_evidence_chain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_table text NOT NULL CHECK (evidence_table IN ('gh_research_evidence','gh_field_report_evidence')),
  evidence_id uuid NOT NULL,
  sequence_no integer NOT NULL CHECK (sequence_no>0),
  event_type text NOT NULL CHECK (char_length(event_type) BETWEEN 1 AND 80),
  actor_ref text NOT NULL DEFAULT 'system' CHECK (char_length(actor_ref)<=256),
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload)='object' AND pg_column_size(payload)<=16384),
  previous_hash text NULL CHECK (previous_hash IS NULL OR previous_hash ~ '^[a-f0-9]{64}$'),
  event_hash text NOT NULL CHECK (event_hash ~ '^[a-f0-9]{64}$'),
  UNIQUE(evidence_table,evidence_id,sequence_no)
);
CREATE INDEX IF NOT EXISTS gh_evidence_chain_lookup_idx
  ON public.gh_evidence_chain_events(evidence_table,evidence_id,sequence_no);
ALTER TABLE public.gh_evidence_chain_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.gh_evidence_chain_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.gh_evidence_chain_events TO service_role;
REVOKE INSERT,UPDATE,DELETE ON TABLE public.gh_evidence_chain_events FROM service_role;

CREATE OR REPLACE FUNCTION public.gh_evidence_chain_append_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_row jsonb := to_jsonb(NEW);
  v_id uuid := (to_jsonb(NEW)->>'id')::uuid;
  v_previous text;
  v_sequence integer;
  v_payload jsonb;
  v_hash text;
  v_actor text;
  v_event text;
BEGIN
  -- Serialize per-evidence chain appends so concurrent scanner/review updates
  -- cannot select the same next sequence number or fork the hash chain.
  PERFORM pg_advisory_xact_lock(hashtextextended(TG_TABLE_NAME || ':' || v_id::text, 0));

  SELECT event_hash, sequence_no INTO v_previous, v_sequence
  FROM public.gh_evidence_chain_events
  WHERE evidence_table=TG_TABLE_NAME AND evidence_id=v_id
  ORDER BY sequence_no DESC LIMIT 1;
  v_sequence := COALESCE(v_sequence,0)+1;
  v_actor := COALESCE(v_row->>'reviewed_by',v_row->>'uploaded_by','system');
  v_event := CASE WHEN TG_OP='INSERT' THEN 'evidence.created'
    WHEN (to_jsonb(OLD)->>'verification_status') IS DISTINCT FROM (v_row->>'verification_status') THEN 'evidence.reviewed'
    WHEN (to_jsonb(OLD)->>'scan_status') IS DISTINCT FROM (v_row->>'scan_status') THEN 'evidence.scan_result'
    ELSE 'evidence.updated' END;
  v_payload := jsonb_build_object('table',TG_TABLE_NAME,'id',v_id,'operation',TG_OP,'event',v_event,'occurred_at',clock_timestamp(),'row',v_row);
  v_hash := encode(extensions.digest(convert_to(COALESCE(v_previous,'') || v_payload::text,'UTF8'),'sha256'),'hex');
  INSERT INTO public.gh_evidence_chain_events(evidence_table,evidence_id,sequence_no,event_type,actor_ref,payload,previous_hash,event_hash)
  VALUES (TG_TABLE_NAME,v_id,v_sequence,v_event,LEFT(v_actor,256),v_payload,v_previous,v_hash);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.gh_evidence_chain_append_trigger() FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS gh_research_evidence_chain_append ON public.gh_research_evidence;
CREATE TRIGGER gh_research_evidence_chain_append AFTER INSERT OR UPDATE ON public.gh_research_evidence
FOR EACH ROW EXECUTE FUNCTION public.gh_evidence_chain_append_trigger();
DROP TRIGGER IF EXISTS gh_field_evidence_chain_append ON public.gh_field_report_evidence;
CREATE TRIGGER gh_field_evidence_chain_append AFTER INSERT OR UPDATE ON public.gh_field_report_evidence
FOR EACH ROW EXECUTE FUNCTION public.gh_evidence_chain_append_trigger();

-- Keep the original service-only RPC contract while recording the opaque field-session JTI.
CREATE OR REPLACE FUNCTION public.gh_field_report_append_scoped(
  p_id uuid,p_kind text,p_body text,p_label text DEFAULT NULL,p_location_hint text DEFAULT NULL,
  p_survey_id text DEFAULT NULL,p_admin_user_id text DEFAULT NULL,p_field_session_jti text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF p_field_session_jti IS NULL OR p_field_session_jti !~ '^[a-f0-9]{32}$' THEN
    RETURN jsonb_build_object('ok',false,'error','FIELD_SESSION_REQUIRED');
  END IF;
  INSERT INTO public.gh_field_reports(id,kind,body,label,location_hint,survey_id,admin_user_id,field_session_jti)
  VALUES(p_id,p_kind,p_body,p_label,p_location_hint,p_survey_id,p_admin_user_id,p_field_session_jti);
  RETURN jsonb_build_object('ok',true,'id',p_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok',false,'error','FIELD_REPORT_PERSIST_FAILED');
END;
$$;
REVOKE ALL ON FUNCTION public.gh_field_report_append_scoped(uuid,text,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_field_report_append_scoped(uuid,text,text,text,text,text,text,text) TO service_role;

COMMIT;
