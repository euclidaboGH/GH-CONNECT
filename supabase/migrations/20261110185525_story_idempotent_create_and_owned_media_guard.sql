-- Run #271 — idempotent story creation and owned-media enforcement.
-- Applied only to GH Connect Testnet under generated history version 20261110185525.
-- No existing story rows, view rows, reaction rows, or storage objects are rewritten.

CREATE OR REPLACE FUNCTION public.gh_story_create(p_row jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id text := btrim(coalesce(p_row->>'id', ''));
  v_owner_id text := btrim(coalesce(p_row->>'ownerId', ''));
  v_existing_owner text;
  v_owner_name text := left(btrim(coalesce(p_row->>'ownerName', p_row->>'name', 'Member')), 120);
  v_owner_photo text := left(coalesce(p_row->>'ownerPhoto', p_row->>'photo', ''), 2000);
  v_text text := coalesce(p_row->>'text', '');
  v_media_type text := nullif(lower(btrim(coalesce(p_row->>'mediaType', ''))), '');
  v_media_url text := nullif(btrim(coalesce(p_row->>'mediaUrl', '')), '');
  v_media_id text;
  v_asset_owner text;
  v_asset_kind text;
  v_asset_status text;
  v_audience text := coalesce(p_row->>'audience', 'everyone');
  v_expires timestamptz;
  v_background text := nullif(p_row->>'background', '');
  v_inserted integer;
BEGIN
  IF v_id !~ '^story_[a-z0-9_-]{8,100}$' OR v_owner_id = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_STORY_IDENTITY');
  END IF;
  IF length(v_text) > 500 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'STORY_TOO_LONG');
  END IF;
  IF v_audience NOT IN ('everyone', 'followers', 'friends', 'matches-only', 'private') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AUDIENCE');
  END IF;
  IF v_media_type IS NOT NULL AND v_media_type NOT IN ('image', 'video') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_MEDIA_TYPE');
  END IF;
  IF v_media_url IS NOT NULL THEN
    IF v_media_url ~ '^/api/media/(media_[a-z0-9]+_[a-z0-9]+)/content$' THEN
      v_media_id := substring(v_media_url from '^/api/media/(media_[a-z0-9]+_[a-z0-9]+)/content$');
      SELECT owner_id, media_kind, status
        INTO v_asset_owner, v_asset_kind, v_asset_status
      FROM public.gh_media_assets
      WHERE id = v_media_id AND deleted_at IS NULL;
      IF v_asset_owner IS DISTINCT FROM v_owner_id OR v_asset_status IS DISTINCT FROM 'ready'
         OR v_asset_kind NOT IN ('image', 'video') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'MEDIA_NOT_OWNED_OR_READY');
      END IF;
      IF v_media_type IS NOT NULL AND v_media_type IS DISTINCT FROM v_asset_kind THEN
        RETURN jsonb_build_object('ok', false, 'error', 'MEDIA_TYPE_MISMATCH');
      END IF;
      v_media_type := v_asset_kind;
    ELSIF v_media_url ~ '^data:image/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$'
      AND length(v_media_url) <= 524288 THEN
      IF v_media_type IS NOT NULL AND v_media_type <> 'image' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'MEDIA_TYPE_MISMATCH');
      END IF;
      v_media_type := 'image';
    ELSE
      RETURN jsonb_build_object('ok', false, 'error', 'INVALID_MEDIA_URL');
    END IF;
  ELSIF v_media_type IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'MEDIA_URL_REQUIRED');
  END IF;
  IF v_background IS NOT NULL AND length(v_background) > 180 THEN
    v_background := NULL;
  END IF;

  -- Stable client request IDs make a retry safe after a lost HTTP response.
  SELECT owner_id INTO v_existing_owner
  FROM public.gh_stories
  WHERE id = v_id
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing_owner IS DISTINCT FROM v_owner_id THEN
      RETURN jsonb_build_object('ok', false, 'error', 'ID_CONFLICT');
    END IF;
    RETURN jsonb_build_object('ok', true, 'id', v_id, 'duplicate', true);
  END IF;

  v_expires := CASE
    WHEN nullif(p_row->>'expiresAt', '') IS NOT NULL
      THEN least(to_timestamp((p_row->>'expiresAt')::bigint / 1000.0), now() + interval '24 hours')
    ELSE now() + interval '24 hours'
  END;
  IF v_expires <= now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_EXPIRY');
  END IF;

  INSERT INTO public.gh_stories (
    id, owner_id, owner_name, owner_photo, text, media_type, media_url,
    audience, status, expires_at, created_at, background
  ) VALUES (
    v_id, v_owner_id, v_owner_name, v_owner_photo, v_text, v_media_type, v_media_url,
    v_audience, 'published', v_expires, now(), v_background
  )
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    SELECT owner_id INTO v_existing_owner FROM public.gh_stories WHERE id = v_id;
    IF v_existing_owner IS DISTINCT FROM v_owner_id THEN
      RETURN jsonb_build_object('ok', false, 'error', 'ID_CONFLICT');
    END IF;
    RETURN jsonb_build_object('ok', true, 'id', v_id, 'duplicate', true);
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'duplicate', false);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_story_create(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_story_create(jsonb) TO service_role;

ALTER FUNCTION public.gh_story_list_active(text) SET search_path = pg_catalog, public;
ALTER FUNCTION public.gh_story_view_authorized_v2(text, text) SET search_path = pg_catalog, public;
ALTER FUNCTION public.gh_story_reaction_toggle(text, text, text) SET search_path = pg_catalog, public;
ALTER FUNCTION public.gh_list_story_viewers(text, text, integer) SET search_path = pg_catalog, public;

COMMENT ON FUNCTION public.gh_story_create(jsonb) IS
  'Creates a story idempotently per stable story ID, derives owner identity server-side, and accepts only small inline images or owner-verified durable media facade assets.';
