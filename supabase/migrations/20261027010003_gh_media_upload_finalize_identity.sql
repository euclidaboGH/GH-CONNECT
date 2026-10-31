-- Bind upload-session finalization to the exact media asset identity.
-- A finalized session may be retried only with its original media ID; the asset must
-- match the immutable upload contract before the session can transition to finalized.
CREATE OR REPLACE FUNCTION public.gh_media_upload_session_finalize(
  p_upload_id text, p_owner_id text, p_media_id text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  r public.gh_media_upload_sessions%ROWTYPE;
  a public.gh_media_assets%ROWTYPE;
  v_upload_id text := trim(COALESCE(p_upload_id, ''));
  v_owner_id text := trim(COALESCE(p_owner_id, ''));
  v_media_id text := trim(COALESCE(p_media_id, ''));
BEGIN
  IF v_upload_id !~ '^upload_[a-f0-9]{24,40}$' OR v_owner_id = '' OR v_media_id = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REQUIRED_FIELDS');
  END IF;

  SELECT * INTO r
  FROM public.gh_media_upload_sessions
  WHERE upload_id = v_upload_id AND owner_id = v_owner_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UPLOAD_SESSION_NOT_FOUND');
  END IF;

  IF r.status = 'finalized' AND r.media_id IS NOT NULL THEN
    IF r.media_id <> v_media_id THEN
      RETURN jsonb_build_object('ok', false, 'error', 'UPLOAD_FINALIZE_CONFLICT');
    END IF;
    RETURN jsonb_build_object('ok', true, 'mediaId', r.media_id, 'status', 'finalized', 'idempotent', true);
  END IF;

  IF r.status NOT IN ('issued', 'uploaded') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UPLOAD_SESSION_NOT_FINALIZABLE');
  END IF;
  IF r.expires_at < now() THEN
    UPDATE public.gh_media_upload_sessions
      SET status = 'expired', last_error = 'EXPIRED'
      WHERE upload_id = r.upload_id;
    RETURN jsonb_build_object('ok', false, 'error', 'UPLOAD_SESSION_EXPIRED');
  END IF;

  SELECT * INTO a FROM public.gh_media_assets WHERE id = v_media_id;
  IF NOT FOUND
     OR a.owner_id IS DISTINCT FROM r.owner_id
     OR a.bucket IS DISTINCT FROM r.bucket
     OR a.storage_path IS DISTINCT FROM r.storage_path
     OR a.media_kind IS DISTINCT FROM r.media_kind
     OR a.mime_type IS DISTINCT FROM r.mime_type
     OR a.byte_size IS DISTINCT FROM r.expected_bytes
     OR a.status IS DISTINCT FROM 'ready'
     OR a.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'MEDIA_ASSET_SESSION_MISMATCH');
  END IF;

  UPDATE public.gh_media_upload_sessions
    SET status = 'finalized', media_id = v_media_id, finalized_at = now(),
        attempts = LEAST(attempts + 1, 20), last_error = NULL
    WHERE upload_id = r.upload_id;
  RETURN jsonb_build_object('ok', true, 'mediaId', v_media_id, 'status', 'finalized', 'idempotent', false);
EXCEPTION
  WHEN OTHERS THEN
    -- Keep expected domain failures explicit while preventing SQL details from escaping.
    RETURN jsonb_build_object('ok', false, 'error', 'UPLOAD_SESSION_FINALIZE_FAILED');
END;
$$;
REVOKE ALL ON FUNCTION public.gh_media_upload_session_finalize(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_media_upload_session_finalize(text, text, text) TO service_role;
