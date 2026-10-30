-- Phase 8: Durable media asset records (additive).
-- Ownership is always server-derived user_id. No financial columns.

CREATE TABLE IF NOT EXISTS public.gh_media_assets (
  id              text PRIMARY KEY,
  owner_id        text NOT NULL,
  bucket          text NOT NULL DEFAULT 'gh-media',
  storage_path    text NOT NULL,
  media_kind      text NOT NULL
                  CHECK (media_kind IN ('image', 'video', 'file')),
  mime_type       text NOT NULL,
  byte_size       bigint NOT NULL DEFAULT 0 CHECK (byte_size >= 0),
  width           integer,
  height          integer,
  duration_ms     integer,
  status          text NOT NULL DEFAULT 'ready'
                  CHECK (status IN ('pending', 'ready', 'failed', 'deleted')),
  public_url      text,
  thumb_path      text,
  thumb_url       text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  CONSTRAINT gh_media_owner_nonempty CHECK (length(trim(owner_id)) > 0),
  CONSTRAINT gh_media_path_nonempty CHECK (length(trim(storage_path)) > 0),
  CONSTRAINT gh_media_path_owned CHECK (storage_path LIKE owner_id || '/%')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_media_bucket_path
  ON public.gh_media_assets (bucket, storage_path);

CREATE INDEX IF NOT EXISTS idx_gh_media_owner_created
  ON public.gh_media_assets (owner_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_gh_media_status
  ON public.gh_media_assets (status)
  WHERE deleted_at IS NULL;

ALTER TABLE public.gh_media_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_media_assets_no_client ON public.gh_media_assets;
CREATE POLICY gh_media_assets_no_client ON public.gh_media_assets
  FOR ALL USING (false) WITH CHECK (false);

COMMENT ON TABLE public.gh_media_assets IS
  'Durable media references. Owner is session-derived. Path must be under owner_id/. No economy fields.';

/**
 * Insert a media asset. owner_id and storage_path must align.
 */
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
SET search_path = public
AS $$
DECLARE
  v_kind text := lower(trim(COALESCE(p_media_kind, '')));
  v_path text := trim(COALESCE(p_storage_path, ''));
  v_owner text := trim(COALESCE(p_owner_id, ''));
BEGIN
  IF v_owner = '' OR p_id IS NULL OR length(trim(p_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REQUIRED_FIELDS');
  END IF;
  IF v_kind NOT IN ('image', 'video', 'file') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_KIND');
  END IF;
  IF v_path = '' OR position(v_owner || '/' in v_path) <> 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PATH_OWNERSHIP');
  END IF;
  IF COALESCE(p_byte_size, 0) < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_SIZE');
  END IF;

  INSERT INTO public.gh_media_assets (
    id, owner_id, bucket, storage_path, media_kind, mime_type, byte_size,
    width, height, duration_ms, status, public_url, thumb_path, thumb_url, metadata
  ) VALUES (
    trim(p_id),
    v_owner,
    COALESCE(NULLIF(trim(p_bucket), ''), 'gh-media'),
    v_path,
    v_kind,
    COALESCE(NULLIF(trim(p_mime_type), ''), 'application/octet-stream'),
    COALESCE(p_byte_size, 0),
    p_width,
    p_height,
    p_duration_ms,
    'ready',
    NULLIF(trim(COALESCE(p_public_url, '')), ''),
    NULLIF(trim(COALESCE(p_thumb_path, '')), ''),
    NULLIF(trim(COALESCE(p_thumb_url, '')), ''),
    COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN jsonb_build_object(
    'ok', true,
    'id', trim(p_id),
    'ownerId', v_owner,
    'path', v_path
  );
END;
$$;

/**
 * Resolve media assets owned by actor (or public_url only for ready assets by id list).
 * Callers must only request IDs they are allowed to attach; ownership enforced for private use.
 */
CREATE OR REPLACE FUNCTION public.gh_media_assets_resolve(
  p_actor_id text,
  p_ids text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows jsonb;
BEGIN
  IF p_actor_id IS NULL OR length(trim(p_actor_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ACTOR_REQUIRED');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'ownerId', m.owner_id,
    'kind', m.media_kind,
    'mime', m.mime_type,
    'url', COALESCE(m.public_url, ''),
    'thumbUrl', COALESCE(m.thumb_url, ''),
    'width', m.width,
    'height', m.height,
    'status', m.status,
    'owned', (m.owner_id = trim(p_actor_id))
  ) ORDER BY m.created_at), '[]'::jsonb)
  INTO v_rows
  FROM public.gh_media_assets m
  WHERE m.deleted_at IS NULL
    AND m.status = 'ready'
    AND m.id = ANY (COALESCE(p_ids, ARRAY[]::text[]))
    AND (
      m.owner_id = trim(p_actor_id)
      OR (m.public_url IS NOT NULL AND length(m.public_url) > 0)
    );

  RETURN jsonb_build_object('ok', true, 'assets', COALESCE(v_rows, '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.gh_media_asset_create(text, text, text, text, text, text, bigint, integer, integer, integer, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_media_asset_create(text, text, text, text, text, text, bigint, integer, integer, integer, text, text, text, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.gh_media_assets_resolve(text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_media_assets_resolve(text, text[]) TO service_role;
