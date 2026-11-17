-- Phase 1: canonical community post feed.
-- Community board reads use the same gh_posts records and curation ledger as Feed/Profile.
-- This RPC is read-only and service-role-only; it does not change membership, votes, or rewards.

CREATE INDEX IF NOT EXISTS idx_gh_posts_community_feed_cursor
  ON public.gh_posts (community_id, created_at DESC, id DESC)
  WHERE deleted_at IS NULL AND archived_at IS NULL AND community_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.gh_community_post_list(
  p_community_id text,
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
  v_community_id text := trim(coalesce(p_community_id, ''));
  v_viewer_id text := trim(coalesce(p_viewer_id, ''));
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 40), 1), 100);
  v_rows jsonb;
BEGIN
  IF v_community_id = '' OR v_viewer_id = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ACTOR_AND_COMMUNITY_REQUIRED');
  END IF;
  IF (p_before_ms IS NULL) <> (p_before_id IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_COMMUNITY_POST_CURSOR');
  END IF;
  -- Do not rely on the UI's membership state. Require an active server-side member.
  IF public.gh_community_platform_role(v_community_id, v_viewer_id) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT COALESCE(
    jsonb_agg(to_jsonb(q) ORDER BY q."createdAt" DESC, q.id DESC),
    '[]'::jsonb
  ) INTO v_rows
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
      p.community_id AS "communityId",
      p.community_name AS "communityName",
      p.content_type AS "contentType",
      COALESCE(p.like_count, 0) AS likes,
      COALESCE(p.comment_count, 0) AS "commentCount",
      COALESCE(p.share_count, 0) AS shares,
      COALESCE(p.upvote_count, 0) AS "upvoteCount",
      COALESCE(p.downvote_count, 0) AS "downvoteCount",
      p.is_edited AS "isEdited",
      (extract(epoch FROM p.created_at) * 1000)::bigint AS "createdAt",
      (SELECT c.choice FROM public.gh_post_curations c
        WHERE c.post_id = p.id AND c.user_id = v_viewer_id LIMIT 1) AS "viewerCurationChoice",
      EXISTS (
        SELECT 1 FROM public.gh_post_reactions r
        WHERE r.post_id = p.id AND r.user_id = v_viewer_id AND r.reaction = 'like'
      ) AS "likedByMe",
      COALESCE((
        SELECT jsonb_object_agg(reaction_totals.reaction, reaction_totals.total)
        FROM (
          SELECT r.reaction, count(*)::integer AS total
          FROM public.gh_post_reactions r
          WHERE r.post_id = p.id
          GROUP BY r.reaction
        ) reaction_totals
      ), '{}'::jsonb) AS "reactionCounts",
      COALESCE((
        SELECT jsonb_agg(r.reaction ORDER BY r.reaction)
        FROM public.gh_post_reactions r
        WHERE r.post_id = p.id AND r.user_id = v_viewer_id
      ), '[]'::jsonb) AS "viewerReactions",
      EXISTS (
        SELECT 1 FROM public.gh_saves s
        WHERE s.post_id = p.id AND s.user_id = v_viewer_id
      ) AS "savedByMe"
    FROM public.gh_posts p
    WHERE p.community_id = v_community_id
      AND p.deleted_at IS NULL
      AND p.archived_at IS NULL
      AND public.gh_post_viewer_can_read(v_viewer_id, p.id)
      AND (
        p_before_ms IS NULL
        OR (extract(epoch FROM p.created_at) * 1000)::bigint < p_before_ms
        OR ((extract(epoch FROM p.created_at) * 1000)::bigint = p_before_ms AND p.id < p_before_id)
      )
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT v_limit
  ) q;

  RETURN jsonb_build_object('ok', true, 'posts', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_community_post_list(text, text, integer, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_community_post_list(text, text, integer, bigint, text) TO service_role;
COMMENT ON FUNCTION public.gh_community_post_list(text, text, integer, bigint, text) IS
  'Lists canonical community posts for an active member with viewer-specific curation state and server-enforced visibility.';
