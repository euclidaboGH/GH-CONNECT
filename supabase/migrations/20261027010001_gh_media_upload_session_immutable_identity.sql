-- Prevent upload-session ID reuse from mutating the original owner, storage path, or media contract.
-- Safe to apply after the media platform v2 migration; no existing session rows are rewritten.
CREATE OR REPLACE FUNCTION public.gh_media_upload_session_create(
  p_upload_id text, p_owner_id text, p_bucket text, p_storage_path text,
  p_category text, p_mime_type text, p_media_kind text, p_expected_bytes bigint,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_upload_id text := trim(COALESCE(p_upload_id, ''));
  v_owner_id text := trim(COALESCE(p_owner_id, ''));
  v_bucket text := trim(COALESCE(p_bucket, ''));
  v_storage_path text := trim(COALESCE(p_storage_path, ''));
  v_category text := trim(COALESCE(p_category, ''));
  v_mime_type text := lower(trim(COALESCE(p_mime_type, '')));
  v_media_kind text := trim(COALESCE(p_media_kind, ''));
  v_metadata jsonb := COALESCE(p_metadata, '{}'::jsonb);
  r public.gh_media_upload_sessions%ROWTYPE;
  v_inserted integer := 0;
BEGIN
  IF v_upload_id !~ '^upload_[a-f0-9]{24,40}$'
     OR v_owner_id = '' OR v_bucket = '' OR v_storage_path = ''
     OR v_mime_type = '' OR p_expected_bytes IS NULL OR p_expected_bytes <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REQUIRED_FIELDS');
  END IF;
  IF v_category NOT IN ('avatars','images','videos','audio','documents')
     OR v_media_kind NOT IN ('image','video','file')
     OR v_storage_path NOT LIKE v_owner_id || '/%' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_MEDIA_CONTRACT');
  END IF;
  IF jsonb_typeof(v_metadata) <> 'object' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_METADATA');
  END IF;

  INSERT INTO public.gh_media_upload_sessions(
    upload_id, owner_id, bucket, storage_path, category, mime_type,
    media_kind, expected_bytes, metadata
  ) VALUES (
    v_upload_id, v_owner_id, v_bucket, v_storage_path, v_category,
    v_mime_type, v_media_kind, p_expected_bytes, v_metadata
  ) ON CONFLICT (upload_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  SELECT * INTO r FROM public.gh_media_upload_sessions WHERE upload_id = v_upload_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UPLOAD_SESSION_UNAVAILABLE');
  END IF;

  -- A retry is valid only for the exact original contract. Never transfer ownership or
  -- reset lifecycle state because a caller supplied an existing upload ID.
  IF r.owner_id IS DISTINCT FROM v_owner_id
     OR r.bucket IS DISTINCT FROM v_bucket
     OR r.storage_path IS DISTINCT FROM v_storage_path
     OR r.category IS DISTINCT FROM v_category
     OR r.mime_type IS DISTINCT FROM v_mime_type
     OR r.media_kind IS DISTINCT FROM v_media_kind
     OR r.expected_bytes IS DISTINCT FROM p_expected_bytes
     OR r.metadata IS DISTINCT FROM v_metadata THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UPLOAD_ID_CONFLICT');
  END IF;

  RETURN jsonb_build_object('ok', true, 'uploadId', r.upload_id,
    'expiresAt', r.expires_at, 'status', r.status,
    'idempotent', v_inserted = 0);
END;
$$;
REVOKE ALL ON FUNCTION public.gh_media_upload_session_create(text,text,text,text,text,text,text,bigint,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_media_upload_session_create(text,text,text,text,text,text,text,bigint,jsonb) TO service_role;
