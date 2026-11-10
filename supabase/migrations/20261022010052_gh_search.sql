-- Phase 12: server-authoritative discovery search (no ranking scores, no economy).
-- Parameterized ILIKE only. Visibility + blocks enforced in RPCs.

CREATE INDEX IF NOT EXISTS idx_gh_user_profiles_display_name_trgm
  ON public.gh_user_profiles (lower(display_name));

CREATE INDEX IF NOT EXISTS idx_gh_user_profiles_username_trgm
  ON public.gh_user_profiles (lower(username));

CREATE INDEX IF NOT EXISTS idx_gh_posts_content_created
  ON public.gh_posts (created_at DESC)
  WHERE deleted_at IS NULL;

/**
 * People search — public profile fields only.
 */
CREATE OR REPLACE FUNCTION public.gh_search_people(
  p_actor_id text,
  p_query text,
  p_limit integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q text := lower(trim(COALESCE(p_query, '')));
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 40);
  v_rows jsonb;
BEGIN
  IF length(v_q) < 2 OR length(v_q) > 80 THEN
    RETURN jsonb_build_object('ok', true, 'people', '[]'::jsonb);
  END IF;
  -- Escape LIKE wildcards from user input
  v_q := replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_');

  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      p.gh_user_id AS "userId",
      COALESCE(p.display_name, '') AS "displayName",
      COALESCE(p.username, '') AS "username",
      COALESCE(p.bio, '') AS "bio",
      CASE
        WHEN jsonb_typeof(p.photos) = 'array' AND jsonb_array_length(p.photos) > 0
          THEN p.photos->>0
        ELSE ''
      END AS "avatarUrl",
      EXISTS (
        SELECT 1 FROM public.gh_follows f
        WHERE f.follower_id = trim(COALESCE(p_actor_id, ''))
          AND f.following_id = p.gh_user_id
      ) AS "isFollowing"
    FROM public.gh_user_profiles p
    WHERE p.onboarded IS TRUE
      AND p.gh_user_id IS NOT NULL
      AND (
        lower(COALESCE(p.display_name, '')) LIKE '%' || v_q || '%' ESCAPE '\'
        OR lower(COALESCE(p.username, '')) LIKE '%' || v_q || '%' ESCAPE '\'
      )
      AND (
        p_actor_id IS NULL OR length(trim(p_actor_id)) = 0
        OR p.gh_user_id <> trim(p_actor_id)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.ghc_user_blocks b
        WHERE p_actor_id IS NOT NULL AND length(trim(p_actor_id)) > 0
          AND (
            (b.blocker_id = trim(p_actor_id) AND b.blocked_id = p.gh_user_id)
            OR (b.blocker_id = p.gh_user_id AND b.blocked_id = trim(p_actor_id))
          )
      )
    ORDER BY p.updated_at DESC NULLS LAST
    LIMIT v_limit
  ) q;

  RETURN jsonb_build_object('ok', true, 'people', COALESCE(v_rows, '[]'::jsonb));
END;
$$;

/**
 * Post search — public + visible-to-actor only, non-deleted.
 */
CREATE OR REPLACE FUNCTION public.gh_search_posts(
  p_actor_id text,
  p_query text,
  p_limit integer DEFAULT 20,
  p_video_only boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q text := lower(trim(COALESCE(p_query, '')));
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 40);
  v_rows jsonb;
BEGIN
  IF length(v_q) < 2 OR length(v_q) > 80 THEN
    RETURN jsonb_build_object('ok', true, 'posts', '[]'::jsonb);
  END IF;
  v_q := replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_');

  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      p.id,
      p.author_id AS "authorId",
      p.author_name AS "authorName",
      p.author_photo AS "authorPhoto",
      left(p.content, 280) AS "content",
      p.video,
      p.content_type AS "contentType",
      (extract(epoch from p.created_at) * 1000)::bigint AS "createdAt"
    FROM public.gh_posts p
    WHERE p.deleted_at IS NULL
      AND (
        lower(p.content) LIKE '%' || v_q || '%' ESCAPE '\'
        OR lower(COALESCE(p.author_name, '')) LIKE '%' || v_q || '%' ESCAPE '\'
      )
      AND (
        NOT p_video_only
        OR (p.video IS NOT NULL AND length(trim(p.video)) > 0 AND p.video NOT LIKE 'blob:%')
      )
      AND (
        p.visibility = 'public'
        OR p.author_id = trim(COALESCE(p_actor_id, ''))
        OR (
          p.visibility = 'followers'
          AND p_actor_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.gh_follows f
            WHERE f.follower_id = trim(p_actor_id) AND f.following_id = p.author_id
          )
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.ghc_user_blocks b
        WHERE p_actor_id IS NOT NULL AND length(trim(p_actor_id)) > 0
          AND (
            (b.blocker_id = trim(p_actor_id) AND b.blocked_id = p.author_id)
            OR (b.blocker_id = p.author_id AND b.blocked_id = trim(p_actor_id))
          )
      )
    ORDER BY p.created_at DESC
    LIMIT v_limit
  ) q;

  RETURN jsonb_build_object('ok', true, 'posts', COALESCE(v_rows, '[]'::jsonb));
END;
$$;

/**
 * Creator directory search — discoverable creators only.
 */
CREATE OR REPLACE FUNCTION public.gh_search_creators(
  p_actor_id text,
  p_query text,
  p_limit integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q text := lower(trim(COALESCE(p_query, '')));
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 40);
  v_rows jsonb;
BEGIN
  IF length(v_q) < 2 OR length(v_q) > 80 THEN
    RETURN jsonb_build_object('ok', true, 'creators', '[]'::jsonb);
  END IF;
  v_q := replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_');

  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      c.user_id AS "userId",
      COALESCE(c.display_name, up.display_name, '') AS "displayName",
      COALESCE(c.bio, up.bio, '') AS "bio",
      c.tips_enabled AS "tipsEnabled"
    FROM public.gh_creator_profiles c
    LEFT JOIN public.gh_user_profiles up ON up.gh_user_id = c.user_id
    WHERE c.is_enabled IS TRUE
      AND (
        lower(COALESCE(c.display_name, '')) LIKE '%' || v_q || '%' ESCAPE '\'
        OR lower(COALESCE(c.bio, '')) LIKE '%' || v_q || '%' ESCAPE '\'
        OR lower(COALESCE(up.display_name, '')) LIKE '%' || v_q || '%' ESCAPE '\'
        OR lower(COALESCE(up.username, '')) LIKE '%' || v_q || '%' ESCAPE '\'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.ghc_user_blocks b
        WHERE p_actor_id IS NOT NULL AND length(trim(p_actor_id)) > 0
          AND (
            (b.blocker_id = trim(p_actor_id) AND b.blocked_id = c.user_id)
            OR (b.blocker_id = c.user_id AND b.blocked_id = trim(p_actor_id))
          )
      )
    ORDER BY c.updated_at DESC NULLS LAST
    LIMIT v_limit
  ) q;

  RETURN jsonb_build_object('ok', true, 'creators', COALESCE(v_rows, '[]'::jsonb));
EXCEPTION
  WHEN undefined_table THEN
    RETURN jsonb_build_object('ok', true, 'creators', '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_search_people(text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_search_people(text, text, integer) TO service_role;
REVOKE ALL ON FUNCTION public.gh_search_posts(text, text, integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_search_posts(text, text, integer, boolean) TO service_role;
REVOKE ALL ON FUNCTION public.gh_search_creators(text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_search_creators(text, text, integer) TO service_role;
