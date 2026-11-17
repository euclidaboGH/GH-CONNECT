-- =============================================================================
-- GREENHAVEN — Feed engagement batch V2
-- Phase 37: collapse feed engagement hydration into one service-role RPC.
-- No new client authority; viewer identity is supplied by the authenticated API.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.gh_post_feed_engagement_batch(
  p_post_ids text[],
  p_viewer_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids text[] := ARRAY(
    SELECT DISTINCT trim(x)
    FROM unnest(COALESCE(p_post_ids, ARRAY[]::text[])) x
    WHERE trim(x) <> ''
    LIMIT 50
  );
  v_viewer text := trim(COALESCE(p_viewer_id, ''));
  v_result jsonb := '[]'::jsonb;
BEGIN
  IF cardinality(v_ids) = 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  IF v_viewer = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ACTOR_REQUIRED');
  END IF;

  WITH ranked_comments AS (
    SELECT
      c.id, c.post_id, c.author_id, c.author_name, c.author_photo, c.text,
      c.parent_id, c.created_at, c.media, c.is_edited, c.edited_at,
      c.is_pinned, c.pinned_at,
      row_number() OVER (PARTITION BY c.post_id ORDER BY c.created_at DESC, c.id DESC) AS rn
    FROM public.gh_post_comments c
    WHERE c.post_id = ANY(v_ids)
      AND c.deleted_at IS NULL
  ),
  preview_comments AS (
    SELECT * FROM ranked_comments WHERE rn <= 3
  ),
  comment_reactions AS (
    SELECT
      r.comment_id,
      jsonb_object_agg(r.emoji, r.cnt) AS counts,
      COALESCE(
        jsonb_agg(r.emoji) FILTER (WHERE r.viewer_has),
        '[]'::jsonb
      ) AS viewer_reactions
    FROM (
      SELECT
        cr.comment_id,
        cr.emoji,
        count(*)::int AS cnt,
        bool_or(cr.user_id = v_viewer) AS viewer_has
      FROM public.gh_comment_reactions cr
      WHERE cr.comment_id IN (SELECT id FROM preview_comments)
      GROUP BY cr.comment_id, cr.emoji
    ) r
    GROUP BY r.comment_id
  ),
  comments_by_post AS (
    SELECT
      pc.post_id,
      jsonb_agg(
        jsonb_strip_nulls(jsonb_build_object(
          'id', pc.id,
          'authorId', pc.author_id,
          'authorName', pc.author_name,
          'authorPhoto', pc.author_photo,
          'text', pc.text,
          'createdAt', extract(epoch FROM pc.created_at) * 1000,
          'replyTo', pc.parent_id,
          'mediaAttachments', COALESCE(pc.media, '[]'::jsonb),
          'isEdited', pc.is_edited,
          'editedAt', CASE WHEN pc.edited_at IS NULL THEN NULL ELSE extract(epoch FROM pc.edited_at) * 1000 END,
          'isPinned', pc.is_pinned,
          'pinnedAt', CASE WHEN pc.pinned_at IS NULL THEN NULL ELSE extract(epoch FROM pc.pinned_at) * 1000 END,
          'reactionCounts', COALESCE(cr.counts, '{}'::jsonb),
          'viewerReactions', COALESCE(cr.viewer_reactions, '[]'::jsonb)
        )) ORDER BY pc.created_at DESC, pc.id DESC
      ) AS comments
    FROM preview_comments pc
    LEFT JOIN comment_reactions cr ON cr.comment_id = pc.id
    GROUP BY pc.post_id
  ),
  reaction_rows AS (
    SELECT
      pr.post_id,
      pr.reaction,
      count(*)::int AS cnt,
      bool_or(pr.user_id = v_viewer) AS viewer_has
    FROM public.gh_post_reactions pr
    WHERE pr.post_id = ANY(v_ids)
    GROUP BY pr.post_id, pr.reaction
  ),
  reactions_by_post AS (
    SELECT
      post_id,
      jsonb_object_agg(reaction, cnt) AS reaction_counts,
      COALESCE(jsonb_agg(reaction) FILTER (WHERE viewer_has), '[]'::jsonb) AS viewer_reactions
    FROM reaction_rows
    GROUP BY post_id
  ),
  curation_rows AS (
    SELECT
      pc.post_id,
      count(*) FILTER (WHERE pc.choice = 'upvote')::int AS upvotes,
      count(*) FILTER (WHERE pc.choice = 'downvote')::int AS downvotes,
      max(pc.choice) FILTER (WHERE pc.user_id = v_viewer) AS viewer_choice
    FROM public.gh_post_curations pc
    WHERE pc.post_id = ANY(v_ids)
    GROUP BY pc.post_id
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'postId', i.post_id,
      'comments', COALESCE(cb.comments, '[]'::jsonb),
      'reactionCounts', COALESCE(rb.reaction_counts, '{}'::jsonb),
      'viewerReactions', COALESCE(rb.viewer_reactions, '[]'::jsonb),
      'upvoteCount', COALESCE(cr.upvotes, 0),
      'downvoteCount', COALESCE(cr.downvotes, 0),
      'viewerCurationChoice', CASE
        WHEN cr.viewer_choice IN ('upvote', 'downvote') THEN cr.viewer_choice
        ELSE NULL
      END
    )
  ), '[]'::jsonb)
  INTO v_result
  FROM unnest(v_ids) AS i(post_id)
  LEFT JOIN comments_by_post cb ON cb.post_id = i.post_id
  LEFT JOIN reactions_by_post rb ON rb.post_id = i.post_id
  LEFT JOIN curation_rows cr ON cr.post_id = i.post_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.gh_post_feed_engagement_batch(text[], text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_post_feed_engagement_batch(text[], text) TO service_role;

COMMENT ON FUNCTION public.gh_post_feed_engagement_batch(text[], text) IS
  'Phase 37: one server-side engagement hydration query for up to 50 feed posts; no client authority or financial data.';
