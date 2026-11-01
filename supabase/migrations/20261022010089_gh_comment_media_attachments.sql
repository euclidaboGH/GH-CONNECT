-- Comment media attachments (additive). Service-role only; client RLS remains deny-all.
-- Media URLs must be durable https storage URLs — never blob:/data:.

ALTER TABLE public.gh_post_comments
  ADD COLUMN IF NOT EXISTS media jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.gh_post_comments.media IS
  'Array of {id,type,url,fileName?} durable media refs. Empty array = text-only comment.';

CREATE OR REPLACE FUNCTION public.gh_comment_create(p_row jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text := COALESCE(p_row->>'id', '');
  v_post text := COALESCE(p_row->>'postId', '');
  v_parent text := NULLIF(p_row->>'parentId', '');
  v_media jsonb := COALESCE(p_row->'media', '[]'::jsonb);
BEGIN
  IF v_id = '' OR v_post = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gh_posts WHERE id = v_post AND deleted_at IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND');
  END IF;
  IF v_parent IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.gh_post_comments WHERE id = v_parent AND post_id = v_post AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PARENT_NOT_FOUND');
  END IF;
  IF jsonb_typeof(v_media) <> 'array' THEN
    v_media := '[]'::jsonb;
  END IF;
  -- Cap at 4 items server-side
  IF jsonb_array_length(v_media) > 4 THEN
    v_media := (
      SELECT COALESCE(jsonb_agg(e), '[]'::jsonb)
      FROM (
        SELECT e FROM jsonb_array_elements(v_media) WITH ORDINALITY AS t(e, ord)
        WHERE ord <= 4
      ) s
    );
  END IF;

  INSERT INTO public.gh_post_comments (
    id, post_id, author_id, author_name, author_photo, text, parent_id, created_at, media
  ) VALUES (
    v_id,
    v_post,
    COALESCE(p_row->>'authorId', ''),
    COALESCE(p_row->>'authorName', ''),
    COALESCE(p_row->>'authorPhoto', ''),
    COALESCE(p_row->>'text', ''),
    v_parent,
    CASE WHEN p_row ? 'createdAt'
      THEN to_timestamp((p_row->>'createdAt')::bigint / 1000.0)
      ELSE now() END,
    v_media
  );
  UPDATE public.gh_posts
    SET comment_count = comment_count + 1, updated_at = now()
    WHERE id = v_post;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', true, 'id', v_id, 'idempotent', true);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_comment_create(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_comment_create(jsonb) TO service_role;

-- Ensure list RPCs expose media when present (extend via SELECT * pattern if function uses row_to_json)
-- Operators: after apply, verify: SELECT media FROM gh_post_comments LIMIT 1;

CREATE OR REPLACE FUNCTION public.gh_comment_list_v2(
  p_post_id text,
  p_viewer_id text DEFAULT NULL,
  p_limit integer DEFAULT 40,
  p_before_ms bigint DEFAULT NULL,
  p_before_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb ORDER BY q."createdAt" DESC, q.id DESC), '[]'::jsonb)
  INTO v_rows FROM (
    SELECT c.id, c.author_id AS "authorId", c.author_name AS "authorName",
      c.author_photo AS "authorPhoto", c.text, c.parent_id AS "replyTo",
      (extract(epoch from c.created_at)*1000)::bigint AS "createdAt",
      COALESCE(c.media, '[]'::jsonb) AS "mediaAttachments"
    FROM public.gh_post_comments c
    WHERE c.post_id = p_post_id AND c.deleted_at IS NULL
      AND (p_before_ms IS NULL OR
        (extract(epoch from c.created_at)*1000)::bigint < p_before_ms OR
        ((extract(epoch from c.created_at)*1000)::bigint = p_before_ms AND c.id < COALESCE(p_before_id, chr(255))))
    ORDER BY c.created_at DESC, c.id DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit,40),1),101)
  ) q;
  RETURN jsonb_build_object('ok', true, 'comments', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_comment_list_v2(text,text,integer,bigint,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_comment_list_v2(text,text,integer,bigint,text) TO service_role;
