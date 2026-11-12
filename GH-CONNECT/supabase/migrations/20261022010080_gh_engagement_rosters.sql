-- Engagement rosters: who reacted / voted / viewed posts & stories.
-- Owner-gated for views & curation; authenticated readers for like roster when post is visible.
-- No economy / GHC minting.

-- ---------------------------------------------------------------------------
-- Reactions roster (gh_post_reactions)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gh_list_post_reactions(
  p_actor_id text,
  p_post_id text,
  p_reaction text DEFAULT 'like',
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_reaction text := lower(trim(COALESCE(p_reaction, 'like')));
  v_author text;
  v_visibility text;
  v_actor text := trim(COALESCE(p_actor_id, ''));
  v_rows jsonb;
BEGIN
  IF p_post_id IS NULL OR length(trim(p_post_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_POST');
  END IF;
  IF v_actor = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ACTOR_REQUIRED');
  END IF;
  SELECT author_id, visibility INTO v_author, v_visibility
  FROM public.gh_posts
  WHERE id = trim(p_post_id) AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  -- Keep the roster no more visible than the post itself.
  IF EXISTS (
    SELECT 1 FROM public.ghc_user_blocks b
    WHERE (b.blocker_id = v_actor AND b.blocked_id = v_author)
       OR (b.blocker_id = v_author AND b.blocked_id = v_actor)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_visibility = 'public' OR v_author = v_actor THEN
    NULL;
  ELSIF v_visibility = 'followers' AND EXISTS (
    SELECT 1 FROM public.gh_follows f
    WHERE f.follower_id = v_actor AND f.following_id = v_author
  ) THEN
    NULL;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb ORDER BY q."createdAt" DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      r.user_id AS "userId",
      COALESCE(pr.display_name, pr.username, 'Member') AS "displayName",
      CASE
        WHEN jsonb_typeof(pr.photos) = 'array' AND jsonb_array_length(pr.photos) > 0
          THEN pr.photos->>0
        ELSE ''
      END AS "avatarUrl",
      r.reaction AS "reaction",
      (extract(epoch from r.created_at)*1000)::bigint AS "createdAt"
    FROM public.gh_post_reactions r
    LEFT JOIN public.gh_user_profiles pr ON pr.gh_user_id = r.user_id
    WHERE r.post_id = p_post_id
      AND (v_reaction = '' OR r.reaction = v_reaction)
    ORDER BY r.created_at DESC
    LIMIT v_limit
  ) q;

  RETURN jsonb_build_object(
    'ok', true,
    'postId', p_post_id,
    'reaction', v_reaction,
    'users', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_list_post_reactions(text, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_list_post_reactions(text, text, text, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- Curation votes roster (owner only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gh_list_post_votes(
  p_actor_id text,
  p_post_id text,
  p_choice text DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_choice text := lower(trim(COALESCE(p_choice, '')));
  v_author text;
  v_rows jsonb;
BEGIN
  IF p_post_id IS NULL OR length(trim(p_post_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_POST');
  END IF;
  SELECT author_id INTO v_author FROM public.gh_posts WHERE id = p_post_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  -- Owner-only: who upvoted/downvoted is sensitive curation signal
  IF v_author IS DISTINCT FROM trim(COALESCE(p_actor_id, '')) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'gh_post_curations'
  ) THEN
    RETURN jsonb_build_object('ok', true, 'users', '[]'::jsonb, 'message', 'CURATION_TABLE_MISSING');
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb ORDER BY q."createdAt" DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      v.user_id AS "userId",
      COALESCE(pr.display_name, pr.username, 'Member') AS "displayName",
      CASE
        WHEN jsonb_typeof(pr.photos) = 'array' AND jsonb_array_length(pr.photos) > 0
          THEN pr.photos->>0
        ELSE ''
      END AS "avatarUrl",
      v.choice AS "choice",
      (extract(epoch from v.updated_at)*1000)::bigint AS "createdAt"
    FROM public.gh_post_curations v
    LEFT JOIN public.gh_user_profiles pr ON pr.gh_user_id = v.user_id
    WHERE v.post_id = p_post_id
      AND v.choice IN ('upvote', 'downvote')
      AND (v_choice = '' OR v.choice = v_choice)
    ORDER BY v.updated_at DESC
    LIMIT v_limit
  ) q;

  RETURN jsonb_build_object(
    'ok', true,
    'postId', p_post_id,
    'choice', NULLIF(v_choice, ''),
    'users', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_list_post_votes(text, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_list_post_votes(text, text, text, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- Post viewers (owner only) — from gh_content_events
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gh_list_post_viewers(
  p_actor_id text,
  p_post_id text,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_author text;
  v_rows jsonb;
BEGIN
  IF p_post_id IS NULL OR length(trim(p_post_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_POST');
  END IF;
  SELECT author_id INTO v_author FROM public.gh_posts WHERE id = p_post_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_author IS DISTINCT FROM trim(COALESCE(p_actor_id, '')) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'gh_content_events'
  ) THEN
    RETURN jsonb_build_object('ok', true, 'users', '[]'::jsonb, 'message', 'EVENTS_TABLE_MISSING');
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb ORDER BY q."lastViewedAt" DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      e.actor_id AS "userId",
      COALESCE(pr.display_name, pr.username, 'Member') AS "displayName",
      CASE
        WHEN jsonb_typeof(pr.photos) = 'array' AND jsonb_array_length(pr.photos) > 0
          THEN pr.photos->>0
        ELSE ''
      END AS "avatarUrl",
      (extract(epoch from max(e.created_at))*1000)::bigint AS "lastViewedAt",
      count(*)::int AS "viewEvents"
    FROM public.gh_content_events e
    LEFT JOIN public.gh_user_profiles pr ON pr.gh_user_id = e.actor_id
    WHERE e.content_id = p_post_id
      AND e.content_kind = 'post'
      AND e.event_type IN ('view', 'qualified_view')
      AND e.actor_id IS DISTINCT FROM v_author
    GROUP BY e.actor_id, pr.display_name, pr.username, pr.photos
    ORDER BY max(e.created_at) DESC
    LIMIT v_limit
  ) q;

  RETURN jsonb_build_object(
    'ok', true,
    'postId', p_post_id,
    'users', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_list_post_viewers(text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_list_post_viewers(text, text, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- Story viewers (owner only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gh_list_story_viewers(
  p_actor_id text,
  p_story_id text,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_owner text;
  v_rows jsonb;
BEGIN
  IF p_story_id IS NULL OR length(trim(p_story_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_STORY');
  END IF;
  SELECT owner_id INTO v_owner FROM public.gh_stories WHERE id = p_story_id;
  IF NOT FOUND THEN
    -- try alternate column names
    BEGIN
      SELECT user_id INTO v_owner FROM public.gh_stories WHERE id = p_story_id;
    EXCEPTION WHEN undefined_column THEN
      v_owner := NULL;
    END;
  END IF;
  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_owner IS DISTINCT FROM trim(COALESCE(p_actor_id, '')) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'gh_story_views'
  ) THEN
    RETURN jsonb_build_object('ok', true, 'users', '[]'::jsonb, 'message', 'STORY_VIEWS_MISSING');
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb ORDER BY q."viewedAt" DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      sv.viewer_id AS "userId",
      COALESCE(pr.display_name, pr.username, 'Member') AS "displayName",
      CASE
        WHEN jsonb_typeof(pr.photos) = 'array' AND jsonb_array_length(pr.photos) > 0
          THEN pr.photos->>0
        ELSE ''
      END AS "avatarUrl",
      (extract(epoch from sv.viewed_at)*1000)::bigint AS "viewedAt"
    FROM public.gh_story_views sv
    LEFT JOIN public.gh_user_profiles pr ON pr.gh_user_id = sv.viewer_id
    WHERE sv.story_id = p_story_id
    ORDER BY sv.viewed_at DESC
    LIMIT v_limit
  ) q;

  RETURN jsonb_build_object(
    'ok', true,
    'storyId', p_story_id,
    'users', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_list_story_viewers(text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_list_story_viewers(text, text, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- Comment emoji reactions (cross-account)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gh_comment_reactions (
  comment_id   text NOT NULL,
  post_id      text NOT NULL,
  user_id      text NOT NULL,
  emoji        text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_gh_comment_reactions_post
  ON public.gh_comment_reactions (post_id, created_at DESC);

ALTER TABLE public.gh_comment_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_comment_reactions_no_client ON public.gh_comment_reactions;
CREATE POLICY gh_comment_reactions_no_client ON public.gh_comment_reactions
  FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.gh_comment_reaction_toggle(
  p_post_id text,
  p_comment_id text,
  p_user_id text,
  p_emoji text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emoji text := left(trim(COALESCE(p_emoji, '')), 16);
  v_active boolean;
  v_counts jsonb;
BEGIN
  IF p_post_id IS NULL OR p_comment_id IS NULL OR p_user_id IS NULL OR v_emoji = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.gh_post_comments
    WHERE id = p_comment_id AND post_id = p_post_id AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'COMMENT_NOT_FOUND');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.gh_comment_reactions
    WHERE comment_id = p_comment_id AND user_id = p_user_id AND emoji = v_emoji
  ) THEN
    DELETE FROM public.gh_comment_reactions
    WHERE comment_id = p_comment_id AND user_id = p_user_id AND emoji = v_emoji;
    v_active := false;
  ELSE
    INSERT INTO public.gh_comment_reactions (comment_id, post_id, user_id, emoji)
    VALUES (p_comment_id, p_post_id, p_user_id, v_emoji)
    ON CONFLICT DO NOTHING;
    v_active := true;
  END IF;

  SELECT COALESCE(jsonb_object_agg(emoji, cnt), '{}'::jsonb)
  INTO v_counts
  FROM (
    SELECT emoji, count(*)::int AS cnt
    FROM public.gh_comment_reactions
    WHERE comment_id = p_comment_id
    GROUP BY emoji
  ) s;

  RETURN jsonb_build_object(
    'ok', true,
    'active', v_active,
    'emoji', v_emoji,
    'counts', v_counts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_comment_reaction_toggle(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_comment_reaction_toggle(text, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.gh_comment_reaction_list(
  p_comment_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT emoji, user_id AS "userId"
    FROM public.gh_comment_reactions
    WHERE comment_id = p_comment_id
  ) q;
  RETURN jsonb_build_object('ok', true, 'reactions', COALESCE(v_rows, '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.gh_comment_reaction_list(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_comment_reaction_list(text) TO service_role;
