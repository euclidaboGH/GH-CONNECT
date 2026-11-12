-- Run #271 — post-create stable-ID ownership and payload guard.
-- Applied only to GH Connect Testnet under generated history version 20261110190531.
-- No existing post rows are rewritten; retries are read-only when the exact payload matches.

CREATE OR REPLACE FUNCTION public.gh_post_create(p_row jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id text := btrim(coalesce(p_row->>'id', ''));
  v_author_id text := btrim(coalesce(p_row->>'authorId', ''));
  v_content text := coalesce(p_row->>'content', '');
  v_images jsonb := coalesce(p_row->'images', '[]'::jsonb);
  v_video text := nullif(p_row->>'video', '');
  v_pdf text := nullif(p_row->>'pdf', '');
  v_pdf_name text := nullif(p_row->>'pdfName', '');
  v_visibility text := coalesce(p_row->>'visibility', 'public');
  v_listing_id text := nullif(p_row->>'listingId', '');
  v_listing_kind text := nullif(p_row->>'listingKind', '');
  v_community_id text := nullif(p_row->>'communityId', '');
  v_community_name text := nullif(p_row->>'communityName', '');
  v_content_type text := coalesce(p_row->>'contentType', 'standard');
  v_existing public.gh_posts%ROWTYPE;
  v_inserted integer;
BEGIN
  IF v_id !~ '^post_[a-zA-Z0-9_-]{6,80}$' OR v_author_id = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_POST_IDENTITY');
  END IF;
  IF length(v_content) > 5000 OR jsonb_typeof(v_images) <> 'array'
     OR jsonb_array_length(v_images) > 10 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_POST_CONTENT_OR_MEDIA');
  END IF;
  IF v_visibility NOT IN ('public', 'followers', 'mutuals', 'private') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_VISIBILITY');
  END IF;
  IF v_content_type NOT IN ('standard', 'status', 'short_video', 'marketplace_listing') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CONTENT_TYPE');
  END IF;
  IF coalesce(v_content, '') = '' AND jsonb_array_length(v_images) = 0
     AND v_video IS NULL AND v_pdf IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'EMPTY_POST');
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_images) item
    WHERE jsonb_typeof(item) <> 'string'
       OR length(item #>> '{}') > 4000
       OR item #>> '{}' LIKE 'blob:%'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_IMAGE_REFERENCE');
  END IF;
  IF coalesce(length(v_video), 0) > 4000 OR coalesce(length(v_pdf), 0) > 4000
     OR coalesce(length(v_pdf_name), 0) > 200
     OR coalesce(v_video, '') LIKE 'blob:%' OR coalesce(v_pdf, '') LIKE 'blob:%' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_ATTACHMENT_REFERENCE');
  END IF;

  SELECT * INTO v_existing
  FROM public.gh_posts
  WHERE id = v_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.author_id IS DISTINCT FROM v_author_id THEN
      RETURN jsonb_build_object('ok', false, 'error', 'ID_CONFLICT');
    END IF;
    IF v_existing.deleted_at IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'ID_RETIRED');
    END IF;
    IF v_existing.content IS DISTINCT FROM v_content
       OR coalesce(v_existing.images, '[]'::jsonb) IS DISTINCT FROM v_images
       OR v_existing.video IS DISTINCT FROM v_video
       OR v_existing.pdf IS DISTINCT FROM v_pdf
       OR v_existing.pdf_name IS DISTINCT FROM v_pdf_name
       OR v_existing.visibility IS DISTINCT FROM v_visibility
       OR v_existing.listing_id IS DISTINCT FROM v_listing_id
       OR v_existing.listing_kind IS DISTINCT FROM v_listing_kind
       OR v_existing.community_id IS DISTINCT FROM v_community_id
       OR v_existing.community_name IS DISTINCT FROM v_community_name
       OR v_existing.content_type IS DISTINCT FROM v_content_type THEN
      RETURN jsonb_build_object('ok', false, 'error', 'ID_CONFLICT');
    END IF;
    RETURN jsonb_build_object('ok', true, 'id', v_id, 'duplicate', true);
  END IF;

  INSERT INTO public.gh_posts (
    id, author_id, author_name, author_photo, content, images, video, pdf, pdf_name,
    visibility, listing_id, listing_kind, community_id, community_name, content_type, created_at
  ) VALUES (
    v_id, v_author_id,
    left(coalesce(p_row->>'authorName', ''), 120),
    left(coalesce(p_row->>'authorPhoto', ''), 2000),
    v_content, v_images, v_video, v_pdf, v_pdf_name,
    v_visibility, v_listing_id, v_listing_kind, v_community_id, v_community_name,
    v_content_type, now()
  )
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    SELECT * INTO v_existing FROM public.gh_posts WHERE id = v_id;
    IF NOT FOUND OR v_existing.author_id IS DISTINCT FROM v_author_id THEN
      RETURN jsonb_build_object('ok', false, 'error', 'ID_CONFLICT');
    END IF;
    IF v_existing.deleted_at IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'ID_RETIRED');
    END IF;
    IF v_existing.content IS DISTINCT FROM v_content
       OR coalesce(v_existing.images, '[]'::jsonb) IS DISTINCT FROM v_images
       OR v_existing.video IS DISTINCT FROM v_video
       OR v_existing.pdf IS DISTINCT FROM v_pdf
       OR v_existing.pdf_name IS DISTINCT FROM v_pdf_name
       OR v_existing.visibility IS DISTINCT FROM v_visibility
       OR v_existing.listing_id IS DISTINCT FROM v_listing_id
       OR v_existing.listing_kind IS DISTINCT FROM v_listing_kind
       OR v_existing.community_id IS DISTINCT FROM v_community_id
       OR v_existing.community_name IS DISTINCT FROM v_community_name
       OR v_existing.content_type IS DISTINCT FROM v_content_type THEN
      RETURN jsonb_build_object('ok', false, 'error', 'ID_CONFLICT');
    END IF;
    RETURN jsonb_build_object('ok', true, 'id', v_id, 'duplicate', true);
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'duplicate', false);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_post_create(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_post_create(jsonb) TO service_role;

COMMENT ON FUNCTION public.gh_post_create(jsonb) IS
  'Creates a post idempotently by stable post ID, verifies the existing author and exact retry payload, rejects retired IDs and pins its security-definer search path.';
