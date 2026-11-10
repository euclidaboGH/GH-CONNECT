-- GH-CONNECT social visibility v3.
-- Additive RPCs: canonical viewer-aware visibility, mutual-follow support,
-- community membership enforcement, and stable keyset pagination.
-- Do not apply until Testnet/Mainnet migration history has been reconciled.

CREATE INDEX IF NOT EXISTS idx_gh_follows_follower_following_visibility
  ON public.gh_follows (follower_id, following_id);
CREATE INDEX IF NOT EXISTS idx_gh_follows_following_follower_visibility
  ON public.gh_follows (following_id, follower_id);
CREATE INDEX IF NOT EXISTS idx_ghc_user_blocks_blocker_blocked_visibility
  ON public.ghc_user_blocks (blocker_id, blocked_id);
CREATE INDEX IF NOT EXISTS idx_ghc_user_blocks_blocked_blocker_visibility
  ON public.ghc_user_blocks (blocked_id, blocker_id);
CREATE INDEX IF NOT EXISTS idx_gh_community_members_visibility
  ON public.gh_community_members (community_id, gh_user_id, status);
CREATE INDEX IF NOT EXISTS idx_gh_posts_feed_visibility_cursor
  ON public.gh_posts (created_at DESC, id DESC)
  WHERE deleted_at IS NULL AND archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_gh_post_comments_visibility_cursor
  ON public.gh_post_comments (post_id, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.gh_post_viewer_can_read(
  p_viewer_id text,
  p_post_id text
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_post public.gh_posts%ROWTYPE;
  v_viewer_follows_author boolean := false;
  v_author_follows_viewer boolean := false;
BEGIN
  IF NULLIF(trim(p_viewer_id), '') IS NULL OR NULLIF(trim(p_post_id), '') IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_post
  FROM public.gh_posts p
  WHERE p.id = trim(p_post_id)
    AND p.deleted_at IS NULL
    AND p.archived_at IS NULL;
  IF NOT FOUND THEN RETURN false; END IF;

  IF v_post.author_id = trim(p_viewer_id) THEN RETURN true; END IF;

  IF EXISTS (
    SELECT 1 FROM public.ghc_user_blocks b
    WHERE (b.blocker_id = trim(p_viewer_id) AND b.blocked_id = v_post.author_id)
       OR (b.blocker_id = v_post.author_id AND b.blocked_id = trim(p_viewer_id))
  ) THEN RETURN false; END IF;

  -- Community-bound posts are visible only to active members, even if the
  -- post visibility flag is public/followers/mutuals.
  IF v_post.community_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.gh_community_members cm
    WHERE cm.community_id = v_post.community_id
      AND cm.gh_user_id = trim(p_viewer_id)
      AND lower(coalesce(cm.status, '')) = 'active'
  ) THEN RETURN false; END IF;

  v_viewer_follows_author := EXISTS (
    SELECT 1 FROM public.gh_follows f
    WHERE f.follower_id = trim(p_viewer_id) AND f.following_id = v_post.author_id
  );
  IF lower(coalesce(v_post.visibility, 'public')) = 'public' THEN RETURN true; END IF;
  IF lower(coalesce(v_post.visibility, 'public')) = 'followers' THEN
    RETURN v_viewer_follows_author;
  END IF;
  IF lower(coalesce(v_post.visibility, 'public')) = 'mutuals' THEN
    v_author_follows_viewer := EXISTS (
      SELECT 1 FROM public.gh_follows f
      WHERE f.follower_id = v_post.author_id AND f.following_id = trim(p_viewer_id)
    );
    RETURN v_viewer_follows_author AND v_author_follows_viewer;
  END IF;
  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.gh_post_viewer_can_read(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_post_viewer_can_read(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.gh_post_list_feed_v3(
  p_viewer_id text,
  p_limit integer DEFAULT 40,
  p_before_ms bigint DEFAULT NULL,
  p_before_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 40), 1), 100);
  v_rows jsonb;
BEGIN
  IF NULLIF(trim(p_viewer_id), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'VIEWER_REQUIRED');
  END IF;
  IF (p_before_ms IS NULL) <> (p_before_id IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_FEED_CURSOR');
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q."createdAt" DESC, q.id DESC), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT p.id,
      p.author_id AS "authorId",
      p.author_name AS "authorName",
      p.author_photo AS "authorPhoto",
      p.content, p.images, p.video, p.pdf,
      p.pdf_name AS "pdfName",
      p.visibility,
      p.community_id AS "communityId",
      p.community_name AS "communityName",
      p.content_type AS "contentType",
      p.like_count AS likes,
      p.comment_count AS "commentCount",
      p.share_count AS shares,
      COALESCE(p.upvote_count, 0) AS "upvoteCount",
      COALESCE(p.downvote_count, 0) AS "downvoteCount",
      p.is_edited AS "isEdited",
      (extract(epoch FROM p.created_at) * 1000)::bigint AS "createdAt",
      (extract(epoch FROM p.deleted_at) * 1000)::bigint AS "deletedAt",
      EXISTS (SELECT 1 FROM public.gh_post_reactions r
              WHERE r.post_id = p.id AND r.user_id = trim(p_viewer_id) AND r.reaction = 'like') AS "likedByMe",
      (SELECT c.choice FROM public.gh_post_curations c
       WHERE c.post_id = p.id AND c.user_id = trim(p_viewer_id) LIMIT 1) AS "viewerCurationChoice"
    FROM public.gh_posts p
    WHERE p.deleted_at IS NULL
      AND p.archived_at IS NULL
      AND public.gh_post_viewer_can_read(trim(p_viewer_id), p.id)
      AND (p_before_ms IS NULL
        OR (extract(epoch FROM p.created_at) * 1000)::bigint < p_before_ms
        OR ((extract(epoch FROM p.created_at) * 1000)::bigint = p_before_ms AND p.id < p_before_id))
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT v_limit
  ) q;
  RETURN jsonb_build_object('ok', true, 'posts', v_rows);
END;
$$;
REVOKE ALL ON FUNCTION public.gh_post_list_feed_v3(text, integer, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_post_list_feed_v3(text, integer, bigint, text) TO service_role;

CREATE OR REPLACE FUNCTION public.gh_comment_list_v3(
  p_post_id text,
  p_viewer_id text,
  p_limit integer DEFAULT 40,
  p_before_ms bigint DEFAULT NULL,
  p_before_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_rows jsonb;
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 40), 1), 101);
BEGIN
  IF NULLIF(trim(p_viewer_id), '') IS NULL OR NULLIF(trim(p_post_id), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ACTOR_REQUIRED');
  END IF;
  IF (p_before_ms IS NULL) <> (p_before_id IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_COMMENT_CURSOR');
  END IF;
  IF NOT public.gh_post_viewer_can_read(trim(p_viewer_id), trim(p_post_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND');
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q."createdAt" DESC, q.id DESC), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT c.id, c.author_id AS "authorId", c.author_name AS "authorName",
      c.author_photo AS "authorPhoto", c.text, c.parent_id AS "replyTo",
      (extract(epoch FROM c.created_at) * 1000)::bigint AS "createdAt"
    FROM public.gh_post_comments c
    WHERE c.post_id = trim(p_post_id) AND c.deleted_at IS NULL
      AND (p_before_ms IS NULL
        OR (extract(epoch FROM c.created_at) * 1000)::bigint < p_before_ms
        OR ((extract(epoch FROM c.created_at) * 1000)::bigint = p_before_ms AND c.id < p_before_id))
    ORDER BY c.created_at DESC, c.id DESC
    LIMIT v_limit
  ) q;
  RETURN jsonb_build_object('ok', true, 'comments', v_rows);
END;
$$;
REVOKE ALL ON FUNCTION public.gh_comment_list_v3(text, text, integer, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_comment_list_v3(text, text, integer, bigint, text) TO service_role;
