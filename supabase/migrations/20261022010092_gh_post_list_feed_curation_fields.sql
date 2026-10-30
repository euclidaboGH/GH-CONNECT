-- Feed must return upvote/downvote totals and the viewer's active curation choice
-- so votes survive reload. Additive; does not change write path.

CREATE OR REPLACE FUNCTION public.gh_post_list_feed_v2(
  p_viewer_id text,
  p_limit integer DEFAULT 40,
  p_before_ms bigint DEFAULT NULL,
  p_before_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 40), 1), 100);
  v_rows jsonb;
BEGIN
  IF (p_before_ms IS NULL) <> (p_before_id IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_FEED_CURSOR');
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb ORDER BY q."createdAt" DESC, q.id DESC), '[]'::jsonb)
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
      COALESCE(p.upvote_count, 0) AS "upvoteCount",
      COALESCE(p.downvote_count, 0) AS "downvoteCount",
      p.is_edited AS "isEdited",
      (extract(epoch from p.created_at)*1000)::bigint AS "createdAt",
      (extract(epoch from p.deleted_at)*1000)::bigint AS "deletedAt",
      EXISTS (
        SELECT 1 FROM public.gh_post_reactions r
        WHERE r.post_id = p.id AND r.user_id = p_viewer_id AND r.reaction = 'like'
      ) AS "likedByMe",
      (
        SELECT c.choice FROM public.gh_post_curations c
        WHERE c.post_id = p.id AND c.user_id = p_viewer_id
        LIMIT 1
      ) AS "viewerCurationChoice"
    FROM public.gh_posts p
    WHERE p.deleted_at IS NULL
      AND (
        p.visibility = 'public'
        OR p.author_id = p_viewer_id
        OR (
          p.visibility = 'followers'
          AND EXISTS (
            SELECT 1 FROM public.gh_follows f
            WHERE f.follower_id = p_viewer_id AND f.following_id = p.author_id
          )
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.ghc_user_blocks b
        WHERE (b.blocker_id = p_viewer_id AND b.blocked_id = p.author_id)
           OR (b.blocker_id = p.author_id AND b.blocked_id = p_viewer_id)
      )
      AND (
        p_before_ms IS NULL
        OR (extract(epoch from p.created_at)*1000)::bigint < p_before_ms
        OR (
          (extract(epoch from p.created_at)*1000)::bigint = p_before_ms
          AND p.id < p_before_id
        )
      )
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT v_limit
  ) q;

  RETURN jsonb_build_object('ok', true, 'posts', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_post_list_feed_v2(text, integer, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_post_list_feed_v2(text, integer, bigint, text) TO service_role;

CREATE OR REPLACE FUNCTION public.gh_post_list_feed(
  p_viewer_id text,
  p_limit integer DEFAULT 40,
  p_before_ms bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 40), 1), 100);
  v_rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb ORDER BY q."createdAt" DESC), '[]'::jsonb)
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
      COALESCE(p.upvote_count, 0) AS "upvoteCount",
      COALESCE(p.downvote_count, 0) AS "downvoteCount",
      p.is_edited AS "isEdited",
      (extract(epoch from p.created_at)*1000)::bigint AS "createdAt",
      (extract(epoch from p.deleted_at)*1000)::bigint AS "deletedAt",
      EXISTS (
        SELECT 1 FROM public.gh_post_reactions r
        WHERE r.post_id = p.id AND r.user_id = p_viewer_id AND r.reaction = 'like'
      ) AS "likedByMe",
      (
        SELECT c.choice FROM public.gh_post_curations c
        WHERE c.post_id = p.id AND c.user_id = p_viewer_id
        LIMIT 1
      ) AS "viewerCurationChoice"
    FROM public.gh_posts p
    WHERE p.deleted_at IS NULL
      AND (
        p.visibility = 'public'
        OR p.author_id = p_viewer_id
        OR (
          p.visibility = 'followers'
          AND EXISTS (
            SELECT 1 FROM public.gh_follows f
            WHERE f.follower_id = p_viewer_id AND f.following_id = p.author_id
          )
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.ghc_user_blocks b
        WHERE (b.blocker_id = p_viewer_id AND b.blocked_id = p.author_id)
           OR (b.blocker_id = p.author_id AND b.blocked_id = p_viewer_id)
      )
      AND (p_before_ms IS NULL OR (extract(epoch from p.created_at)*1000) < p_before_ms)
    ORDER BY p.created_at DESC
    LIMIT v_limit
  ) q;
  RETURN jsonb_build_object('ok', true, 'posts', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_post_list_feed(text, integer, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_post_list_feed(text, integer, bigint) TO service_role;
