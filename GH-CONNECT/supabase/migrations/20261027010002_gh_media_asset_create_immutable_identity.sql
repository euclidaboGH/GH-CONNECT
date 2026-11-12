-- Prevent an idempotent media-asset create call from reporting success for a different asset.
-- Additive hardening: existing rows are not rewritten and no live database is changed by this file.
CREATE OR REPLACE FUNCTION public.gh_media_asset_create(
  p_id text,
  p_owner_id text,
  p_bucket text,
  p_storage_path text,
  p_media_kind text,
  p_mime_type text,
  p_byte_size bigint,
  p_width integer DEFAULT NULL,
  p_height integer DEFAULT NULL,
  p_duration_ms integer DEFAULT NULL,
  p_public_url text DEFAULT NULL,
  p_thumb_path text DEFAULT NULL,
  p_thumb_url text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_id text := trim(COALESCE(p_id, ''));
  v_owner text := trim(COALESCE(p_owner_id, ''));
  v_bucket text := COALESCE(NULLIF(trim(p_bucket), ''), 'gh-media');
  v_path text := trim(COALESCE(p_storage_path, ''));
  v_kind text := lower(trim(COALESCE(p_media_kind, '')));
  v_mime text := COALESCE(NULLIF(lower(trim(p_mime_type)), ''), 'application/octet-stream');
  v_size bigint := COALESCE(p_byte_size, 0);
  v_metadata jsonb := COALESCE(p_metadata, '{}'::jsonb);
  r public.gh_media_assets%ROWTYPE;
  v_inserted integer := 0;
BEGIN
  IF v_owner = '' OR v_id = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REQUIRED_FIELDS');
  END IF;
  IF v_kind NOT IN ('image', 'video', 'file') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_KIND');
  END IF;
  IF v_path = '' OR position(v_owner || '/' in v_path) <> 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PATH_OWNERSHIP');
  END IF;
  IF v_size <= 0 OR (p_width IS NOT NULL AND p_width <= 0)
     OR (p_height IS NOT NULL AND p_height <= 0)
     OR (p_duration_ms IS NOT NULL AND p_duration_ms < 0) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_SIZE_OR_DIMENSIONS');
  END IF;
  IF jsonb_typeof(v_metadata) <> 'object' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_METADATA');
  END IF;

  INSERT INTO public.gh_media_assets (
    id, owner_id, bucket, storage_path, media_kind, mime_type, byte_size,
    width, height, duration_ms, status, public_url, thumb_path, thumb_url, metadata
  ) VALUES (
    v_id, v_owner, v_bucket, v_path, v_kind, v_mime, v_size,
    p_width, p_height, p_duration_ms, 'ready',
    NULLIF(trim(COALESCE(p_public_url, '')), ''),
    NULLIF(trim(COALESCE(p_thumb_path, '')), ''),
    NULLIF(trim(COALESCE(p_thumb_url, '')), ''), v_metadata
  ) ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  SELECT * INTO r FROM public.gh_media_assets WHERE id = v_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'MEDIA_ID_CONFLICT');
  END IF;

  -- Treat retries as success only if the complete immutable identity matches an active row.
  IF r.owner_id IS DISTINCT FROM v_owner
     OR r.bucket IS DISTINCT FROM v_bucket
     OR r.storage_path IS DISTINCT FROM v_path
     OR r.media_kind IS DISTINCT FROM v_kind
     OR r.mime_type IS DISTINCT FROM v_mime
     OR r.byte_size IS DISTINCT FROM v_size
     OR r.width IS DISTINCT FROM p_width
     OR r.height IS DISTINCT FROM p_height
     OR r.duration_ms IS DISTINCT FROM p_duration_ms
     OR r.public_url IS DISTINCT FROM NULLIF(trim(COALESCE(p_public_url, '')), '')
     OR r.thumb_path IS DISTINCT FROM NULLIF(trim(COALESCE(p_thumb_path, '')), '')
     OR r.thumb_url IS DISTINCT FROM NULLIF(trim(COALESCE(p_thumb_url, '')), '')
     OR r.metadata IS DISTINCT FROM v_metadata
     OR r.status IS DISTINCT FROM 'ready'
     OR r.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'MEDIA_ID_CONFLICT');
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', r.id, 'ownerId', r.owner_id,
    'path', r.storage_path, 'idempotent', v_inserted = 0);
EXCEPTION
  WHEN unique_violation THEN
    -- Covers a different asset ID already claiming the same bucket/path unique key.
    RETURN jsonb_build_object('ok', false, 'error', 'MEDIA_ID_CONFLICT');
END;
$$;
REVOKE ALL ON FUNCTION public.gh_media_asset_create(text, text, text, text, text, text, bigint, integer, integer, integer, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_media_asset_create(text, text, text, text, text, text, bigint, integer, integer, integer, text, text, text, jsonb) TO service_role;
