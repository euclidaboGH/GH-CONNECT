-- GH Profile Content Library: safe, viewer-authorized post search and pagination.
-- Additive only. Does not alter wallet, reward, membership, or post-write paths.
-- Keep the profile timeline cursor aligned with the active-post query.
CREATE INDEX IF NOT EXISTS idx_gh_posts_profile_library_cursor
  ON public.gh_posts (author_id, created_at DESC, id DESC)
  WHERE deleted_at IS NULL AND archived_at IS NULL;

CREATE OR REPLACE FUNCTION public.gh_post_list_profile_content(
  p_viewer_id text,
  p_profile_id text,
  p_limit integer DEFAULT 40,
  p_before_ms bigint DEFAULT NULL,
  p_before_id text DEFAULT NULL,
  p_query text DEFAULT NULL,
  p_media_kind text DEFAULT 'all'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 40), 1), 50);
  v_query text := left(trim(COALESCE(p_query, '')), 120);
  v_kind text := lower(trim(COALESCE(p_media_kind, 'all')));
  v_rows jsonb;
  v_count integer := 0;
  v_oldest timestamptz;
  v_oldest_id text;
BEGIN
  IF p_viewer_id IS NULL OR length(trim(p_viewer_id)) = 0
     OR p_profile_id IS NULL OR length(trim(p_profile_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ACTOR_REQUIRED');
  END IF;

  IF v_kind NOT IN ('all', 'posts', 'photos', 'videos', 'documents') THEN
    v_kind := 'all';
  END IF;

  -- Mutuals means mutual follows consistently across feed, comments, and profile.

  -- A block in either direction suppresses the entire profile from the viewer.
  IF EXISTS (
    SELECT 1 FROM public.ghc_user_blocks b
    WHERE (b.blocker_id = trim(p_viewer_id) AND b.blocked_id = trim(p_profile_id))
       OR (b.blocker_id = trim(p_profile_id) AND b.blocked_id = trim(p_viewer_id))
  ) THEN
    RETURN jsonb_build_object('ok', true, 'posts', '[]'::jsonb, 'hasMore', false, 'nextBefore', null);
  END IF;

  SELECT count(*)
    INTO v_count
  FROM (
    SELECT p.created_at
    FROM public.gh_posts p
    WHERE p.author_id = trim(p_profile_id)
      AND p.deleted_at IS NULL
      AND p.archived_at IS NULL
      -- Community-bound profile posts require active membership. The author can
      -- always review their own content; other viewers cannot infer private posts.
      AND (
        p.community_id IS NULL
        OR p.author_id = trim(p_viewer_id)
        OR EXISTS (
          SELECT 1 FROM public.gh_community_members cm
          WHERE cm.community_id = p.community_id
            AND cm.gh_user_id = trim(p_viewer_id)
            AND lower(coalesce(cm.status, '')) = 'active'
        )
      )
      AND (
        p_before_ms IS NULL
        OR (extract(epoch from p.created_at) * 1000)::bigint < p_before_ms
        OR (
          (extract(epoch from p.created_at) * 1000)::bigint = p_before_ms
          AND p_before_id IS NOT NULL
          AND p.id < p_before_id
        )
      )
      AND (
        p.author_id = trim(p_viewer_id)
        OR p.visibility = 'public'
        OR (
          p.visibility = 'followers'
          AND EXISTS (
            SELECT 1 FROM public.gh_follows f
            WHERE f.follower_id = trim(p_viewer_id)
              AND f.following_id = trim(p_profile_id)
          )
        )
        OR (
          p.visibility = 'mutuals'
          AND (
            (
              EXISTS (
                SELECT 1 FROM public.gh_follows f1
                WHERE f1.follower_id = trim(p_viewer_id)
                  AND f1.following_id = trim(p_profile_id)
              )
              AND EXISTS (
                SELECT 1 FROM public.gh_follows f2
                WHERE f2.follower_id = trim(p_profile_id)
                  AND f2.following_id = trim(p_viewer_id)
              )
            )
          )
        )
      )
      AND (
        v_query = ''
        OR position(lower(v_query) in lower(coalesce(p.content, '') || ' ' || coalesce(p.pdf_name, ''))) > 0
      )
      AND (
        v_kind = 'all'
        OR (v_kind = 'posts' AND (CASE WHEN jsonb_typeof(p.images) = 'array' THEN jsonb_array_length(p.images) ELSE 0 END) = 0 AND p.video IS NULL AND p.pdf IS NULL)
        OR (v_kind = 'photos' AND (CASE WHEN jsonb_typeof(p.images) = 'array' THEN jsonb_array_length(p.images) ELSE 0 END) > 0)
        OR (v_kind = 'videos' AND p.video IS NOT NULL AND length(trim(p.video)) > 0)
        OR (v_kind = 'documents' AND p.pdf IS NOT NULL AND length(trim(p.pdf)) > 0)
      )
    ORDER BY (extract(epoch from p.created_at) * 1000)::bigint DESC, p.id DESC
    LIMIT v_limit + 1
  ) q;

  SELECT COALESCE(jsonb_agg((to_jsonb(page_row) - 'created_at' - 'sort_id') ORDER BY page_row."createdAt" DESC, page_row.id DESC), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT
      p.id,
      p.author_id AS "authorId",
      p.author_name AS "authorName",
      p.author_photo AS "authorPhoto",
      p.content,
      p.images,
      p.video,
      p.pdf,
      p.pdf_name AS "pdfName",
      p.visibility,
      p.like_count AS likes,
      p.comment_count AS "commentCount",
      p.share_count AS shares,
      p.is_edited AS "isEdited",
      (extract(epoch from p.created_at) * 1000)::bigint AS "createdAt",
      p.created_at,
      p.id AS sort_id
    FROM public.gh_posts p
    WHERE p.author_id = trim(p_profile_id)
      AND p.deleted_at IS NULL
      AND p.archived_at IS NULL
      -- Community-bound profile posts require active membership. The author can
      -- always review their own content; other viewers cannot infer private posts.
      AND (
        p.community_id IS NULL
        OR p.author_id = trim(p_viewer_id)
        OR EXISTS (
          SELECT 1 FROM public.gh_community_members cm
          WHERE cm.community_id = p.community_id
            AND cm.gh_user_id = trim(p_viewer_id)
            AND lower(coalesce(cm.status, '')) = 'active'
        )
      )
      AND (
        p_before_ms IS NULL
        OR (extract(epoch from p.created_at) * 1000)::bigint < p_before_ms
        OR (
          (extract(epoch from p.created_at) * 1000)::bigint = p_before_ms
          AND p_before_id IS NOT NULL
          AND p.id < p_before_id
        )
      )
      AND (
        p.author_id = trim(p_viewer_id)
        OR p.visibility = 'public'
        OR (
          p.visibility = 'followers'
          AND EXISTS (SELECT 1 FROM public.gh_follows f WHERE f.follower_id = trim(p_viewer_id) AND f.following_id = trim(p_profile_id))
        )
        OR (
          p.visibility = 'mutuals'
          AND (
            (
              EXISTS (SELECT 1 FROM public.gh_follows f1 WHERE f1.follower_id = trim(p_viewer_id) AND f1.following_id = trim(p_profile_id))
              AND EXISTS (SELECT 1 FROM public.gh_follows f2 WHERE f2.follower_id = trim(p_profile_id) AND f2.following_id = trim(p_viewer_id))
            )
          )
        )
      )
      AND (v_query = '' OR position(lower(v_query) in lower(coalesce(p.content, '') || ' ' || coalesce(p.pdf_name, ''))) > 0)
      AND (
        v_kind = 'all'
        OR (v_kind = 'posts' AND (CASE WHEN jsonb_typeof(p.images) = 'array' THEN jsonb_array_length(p.images) ELSE 0 END) = 0 AND p.video IS NULL AND p.pdf IS NULL)
        OR (v_kind = 'photos' AND (CASE WHEN jsonb_typeof(p.images) = 'array' THEN jsonb_array_length(p.images) ELSE 0 END) > 0)
        OR (v_kind = 'videos' AND p.video IS NOT NULL AND length(trim(p.video)) > 0)
        OR (v_kind = 'documents' AND p.pdf IS NOT NULL AND length(trim(p.pdf)) > 0)
      )
    ORDER BY (extract(epoch from p.created_at) * 1000)::bigint DESC, p.id DESC
    LIMIT v_limit
  ) page_row;

  -- Recalculate the cursor from the returned page, not the look-ahead row.
  SELECT p.created_at, p.id INTO v_oldest, v_oldest_id
  FROM public.gh_posts p
  WHERE p.id IN (
    SELECT value->>'id' FROM jsonb_array_elements(COALESCE(v_rows, '[]'::jsonb)) value
  )
  ORDER BY (extract(epoch from p.created_at) * 1000)::bigint ASC, p.id ASC
  LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'posts', COALESCE(v_rows, '[]'::jsonb),
    'hasMore', v_count > v_limit,
    'nextBefore', CASE WHEN v_oldest IS NULL THEN NULL ELSE (extract(epoch from v_oldest) * 1000)::bigint END,
    'nextBeforeId', v_oldest_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_post_list_profile_content(text, text, integer, bigint, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_post_list_profile_content(text, text, integer, bigint, text, text, text) TO service_role;
