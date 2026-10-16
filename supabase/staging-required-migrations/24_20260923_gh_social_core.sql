-- PASS 2 — GreenHaven social core (additive, non-destructive)
-- Posts, comments, reactions, stories, follows, saves.
-- Reuses: ghc_user_blocks, ghc_connection_requests, ghc_connection_contexts.
-- Service-role / SECURITY DEFINER only — no broad client write policies.

-- ---------------------------------------------------------------------------
-- Posts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gh_posts (
  id              text PRIMARY KEY,
  author_id       text NOT NULL,
  author_name     text NOT NULL DEFAULT '',
  author_photo    text NOT NULL DEFAULT '',
  content         text NOT NULL DEFAULT '',
  images          jsonb NOT NULL DEFAULT '[]'::jsonb,
  video           text,
  pdf             text,
  pdf_name        text,
  visibility      text NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'followers', 'mutuals', 'private')),
  listing_id      text,
  listing_kind    text,
  community_id    text,
  community_name  text,
  content_type    text NOT NULL DEFAULT 'standard',
  like_count      integer NOT NULL DEFAULT 0 CHECK (like_count >= 0),
  comment_count   integer NOT NULL DEFAULT 0 CHECK (comment_count >= 0),
  share_count     integer NOT NULL DEFAULT 0 CHECK (share_count >= 0),
  is_edited       boolean NOT NULL DEFAULT false,
  edited_at       timestamptz,
  deleted_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gh_posts_author_created
  ON public.gh_posts (author_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_gh_posts_feed
  ON public.gh_posts (created_at DESC)
  WHERE deleted_at IS NULL AND visibility = 'public';

ALTER TABLE public.gh_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_posts_no_client ON public.gh_posts;
CREATE POLICY gh_posts_no_client ON public.gh_posts
  FOR ALL USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gh_post_comments (
  id              text PRIMARY KEY,
  post_id         text NOT NULL REFERENCES public.gh_posts(id) ON DELETE CASCADE,
  author_id       text NOT NULL,
  author_name     text NOT NULL DEFAULT '',
  author_photo    text NOT NULL DEFAULT '',
  text            text NOT NULL,
  parent_id       text REFERENCES public.gh_post_comments(id) ON DELETE CASCADE,
  deleted_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gh_post_comments_post
  ON public.gh_post_comments (post_id, created_at ASC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.gh_post_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_post_comments_no_client ON public.gh_post_comments;
CREATE POLICY gh_post_comments_no_client ON public.gh_post_comments
  FOR ALL USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Reactions (likes) — one row per actor per post
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gh_post_reactions (
  post_id         text NOT NULL REFERENCES public.gh_posts(id) ON DELETE CASCADE,
  user_id         text NOT NULL,
  reaction        text NOT NULL DEFAULT 'like',
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id, reaction)
);

CREATE INDEX IF NOT EXISTS idx_gh_post_reactions_user
  ON public.gh_post_reactions (user_id, created_at DESC);

ALTER TABLE public.gh_post_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_post_reactions_no_client ON public.gh_post_reactions;
CREATE POLICY gh_post_reactions_no_client ON public.gh_post_reactions
  FOR ALL USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Stories (server-authoritative expiry)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gh_stories (
  id              text PRIMARY KEY,
  owner_id        text NOT NULL,
  owner_name      text NOT NULL DEFAULT '',
  owner_photo     text NOT NULL DEFAULT '',
  text            text NOT NULL DEFAULT '',
  media_type      text,
  media_url       text,
  audience        text NOT NULL DEFAULT 'everyone'
    CHECK (audience IN ('everyone', 'followers', 'friends', 'matches-only', 'private')),
  status          text NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'published', 'expired', 'archived', 'highlight')),
  expires_at      timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gh_stories_active
  ON public.gh_stories (expires_at ASC)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_gh_stories_owner
  ON public.gh_stories (owner_id, created_at DESC);

ALTER TABLE public.gh_stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_stories_no_client ON public.gh_stories;
CREATE POLICY gh_stories_no_client ON public.gh_stories
  FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.gh_story_views (
  story_id        text NOT NULL REFERENCES public.gh_stories(id) ON DELETE CASCADE,
  viewer_id       text NOT NULL,
  viewed_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, viewer_id)
);

ALTER TABLE public.gh_story_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_story_views_no_client ON public.gh_story_views;
CREATE POLICY gh_story_views_no_client ON public.gh_story_views
  FOR ALL USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Follows
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gh_follows (
  follower_id     text NOT NULL,
  following_id    text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT gh_follows_no_self CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS idx_gh_follows_following
  ON public.gh_follows (following_id, created_at DESC);

ALTER TABLE public.gh_follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_follows_no_client ON public.gh_follows;
CREATE POLICY gh_follows_no_client ON public.gh_follows
  FOR ALL USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Saves / bookmarks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gh_saves (
  user_id         text NOT NULL,
  post_id         text NOT NULL REFERENCES public.gh_posts(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_gh_saves_user
  ON public.gh_saves (user_id, created_at DESC);

ALTER TABLE public.gh_saves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_saves_no_client ON public.gh_saves;
CREATE POLICY gh_saves_no_client ON public.gh_saves
  FOR ALL USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- RPCs (SECURITY DEFINER, service_role only)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.gh_post_create(p_row jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text := COALESCE(p_row->>'id', '');
BEGIN
  IF v_id = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ID_REQUIRED');
  END IF;
  INSERT INTO public.gh_posts (
    id, author_id, author_name, author_photo, content, images, video, pdf, pdf_name,
    visibility, listing_id, listing_kind, community_id, community_name, content_type, created_at
  ) VALUES (
    v_id,
    COALESCE(p_row->>'authorId', ''),
    COALESCE(p_row->>'authorName', ''),
    COALESCE(p_row->>'authorPhoto', ''),
    COALESCE(p_row->>'content', ''),
    COALESCE(p_row->'images', '[]'::jsonb),
    NULLIF(p_row->>'video', ''),
    NULLIF(p_row->>'pdf', ''),
    NULLIF(p_row->>'pdfName', ''),
    COALESCE(p_row->>'visibility', 'public'),
    NULLIF(p_row->>'listingId', ''),
    NULLIF(p_row->>'listingKind', ''),
    NULLIF(p_row->>'communityId', ''),
    NULLIF(p_row->>'communityName', ''),
    COALESCE(p_row->>'contentType', 'standard'),
    CASE WHEN p_row ? 'createdAt'
      THEN to_timestamp((p_row->>'createdAt')::bigint / 1000.0)
      ELSE now() END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_post_soft_delete(p_post_id text, p_actor_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_author text;
BEGIN
  SELECT author_id INTO v_author FROM public.gh_posts WHERE id = p_post_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_author <> p_actor_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  UPDATE public.gh_posts
    SET deleted_at = now(), updated_at = now()
    WHERE id = p_post_id AND deleted_at IS NULL;
  RETURN jsonb_build_object('ok', true, 'id', p_post_id);
END;
$$;

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
  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb ORDER BY q.created_at DESC), '[]'::jsonb)
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
      (extract(epoch from p.created_at)*1000)::bigint AS "createdAt",
      (extract(epoch from p.deleted_at)*1000)::bigint AS "deletedAt",
      EXISTS (
        SELECT 1 FROM public.gh_post_reactions r
        WHERE r.post_id = p.id AND r.user_id = p_viewer_id AND r.reaction = 'like'
      ) AS "likedByMe"
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

CREATE OR REPLACE FUNCTION public.gh_reaction_toggle(
  p_post_id text,
  p_user_id text,
  p_reaction text DEFAULT 'like'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
  v_count integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.gh_posts WHERE id = p_post_id AND deleted_at IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.gh_post_reactions
    WHERE post_id = p_post_id AND user_id = p_user_id AND reaction = p_reaction
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM public.gh_post_reactions
    WHERE post_id = p_post_id AND user_id = p_user_id AND reaction = p_reaction;
    UPDATE public.gh_posts
      SET like_count = GREATEST(like_count - 1, 0), updated_at = now()
      WHERE id = p_post_id AND p_reaction = 'like';
  ELSE
    INSERT INTO public.gh_post_reactions (post_id, user_id, reaction)
    VALUES (p_post_id, p_user_id, p_reaction)
    ON CONFLICT DO NOTHING;
    UPDATE public.gh_posts
      SET like_count = like_count + 1, updated_at = now()
      WHERE id = p_post_id AND p_reaction = 'like';
  END IF;

  SELECT like_count INTO v_count FROM public.gh_posts WHERE id = p_post_id;
  RETURN jsonb_build_object(
    'ok', true,
    'liked', NOT v_exists,
    'likeCount', COALESCE(v_count, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_comment_create(p_row jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text := COALESCE(p_row->>'id', '');
  v_post text := COALESCE(p_row->>'postId', '');
BEGIN
  IF v_id = '' OR v_post = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gh_posts WHERE id = v_post AND deleted_at IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND');
  END IF;
  INSERT INTO public.gh_post_comments (
    id, post_id, author_id, author_name, author_photo, text, parent_id, created_at
  ) VALUES (
    v_id,
    v_post,
    COALESCE(p_row->>'authorId', ''),
    COALESCE(p_row->>'authorName', ''),
    COALESCE(p_row->>'authorPhoto', ''),
    COALESCE(p_row->>'text', ''),
    NULLIF(p_row->>'parentId', ''),
    CASE WHEN p_row ? 'createdAt'
      THEN to_timestamp((p_row->>'createdAt')::bigint / 1000.0)
      ELSE now() END
  );
  UPDATE public.gh_posts
    SET comment_count = comment_count + 1, updated_at = now()
    WHERE id = v_post;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_comment_list(p_post_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb ORDER BY q."createdAt" ASC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      c.id,
      c.author_id AS "authorId",
      c.author_name AS "authorName",
      c.author_photo AS "authorPhoto",
      c.text,
      c.parent_id AS "replyTo",
      (extract(epoch from c.created_at)*1000)::bigint AS "createdAt"
    FROM public.gh_post_comments c
    WHERE c.post_id = p_post_id AND c.deleted_at IS NULL
    ORDER BY c.created_at ASC
    LIMIT 500
  ) q;
  RETURN jsonb_build_object('ok', true, 'comments', v_rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_follow_set(
  p_follower_id text,
  p_following_id text,
  p_follow boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_follower_id = p_following_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SELF');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.ghc_user_blocks b
    WHERE (b.blocker_id = p_follower_id AND b.blocked_id = p_following_id)
       OR (b.blocker_id = p_following_id AND b.blocked_id = p_follower_id)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'BLOCKED');
  END IF;
  IF p_follow THEN
    INSERT INTO public.gh_follows (follower_id, following_id)
    VALUES (p_follower_id, p_following_id)
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.gh_follows
    WHERE follower_id = p_follower_id AND following_id = p_following_id;
  END IF;
  RETURN jsonb_build_object('ok', true, 'following', p_follow);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_follow_list(p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_following jsonb;
  v_followers jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(following_id ORDER BY created_at DESC), '[]'::jsonb)
    INTO v_following FROM public.gh_follows WHERE follower_id = p_user_id;
  SELECT COALESCE(jsonb_agg(follower_id ORDER BY created_at DESC), '[]'::jsonb)
    INTO v_followers FROM public.gh_follows WHERE following_id = p_user_id;
  RETURN jsonb_build_object(
    'ok', true,
    'following', v_following,
    'followers', v_followers
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_block_set(
  p_blocker_id text,
  p_blocked_id text,
  p_block boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_blocker_id = p_blocked_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SELF');
  END IF;
  IF p_block THEN
    INSERT INTO public.ghc_user_blocks (blocker_id, blocked_id)
    VALUES (p_blocker_id, p_blocked_id)
    ON CONFLICT DO NOTHING;
    DELETE FROM public.gh_follows
    WHERE (follower_id = p_blocker_id AND following_id = p_blocked_id)
       OR (follower_id = p_blocked_id AND following_id = p_blocker_id);
  ELSE
    DELETE FROM public.ghc_user_blocks
    WHERE blocker_id = p_blocker_id AND blocked_id = p_blocked_id;
  END IF;
  RETURN jsonb_build_object('ok', true, 'blocked', p_block);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_story_create(p_row jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text := COALESCE(p_row->>'id', '');
  v_expires timestamptz;
BEGIN
  IF v_id = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ID_REQUIRED');
  END IF;
  IF p_row ? 'expiresAt' THEN
    v_expires := to_timestamp((p_row->>'expiresAt')::bigint / 1000.0);
  ELSE
    v_expires := now() + interval '24 hours';
  END IF;
  INSERT INTO public.gh_stories (
    id, owner_id, owner_name, owner_photo, text, media_type, media_url,
    audience, status, expires_at, created_at
  ) VALUES (
    v_id,
    COALESCE(p_row->>'ownerId', ''),
    COALESCE(p_row->>'ownerName', p_row->>'name', ''),
    COALESCE(p_row->>'ownerPhoto', p_row->>'photo', ''),
    COALESCE(p_row->>'text', ''),
    NULLIF(p_row->>'mediaType', ''),
    NULLIF(p_row->>'mediaUrl', ''),
    COALESCE(p_row->>'audience', 'everyone'),
    'published',
    v_expires,
    CASE WHEN p_row ? 'createdAt'
      THEN to_timestamp((p_row->>'createdAt')::bigint / 1000.0)
      ELSE now() END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_story_list_active(p_viewer_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rows jsonb;
BEGIN
  -- Expire stale published stories
  UPDATE public.gh_stories
    SET status = 'expired'
    WHERE status = 'published' AND expires_at <= now();

  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb ORDER BY q."createdAt" DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      s.id,
      s.owner_id AS "ownerId",
      s.owner_name AS name,
      s.owner_photo AS photo,
      s.text,
      CASE WHEN s.media_url IS NOT NULL THEN
        jsonb_build_object('type', COALESCE(s.media_type, 'image'), 'url', s.media_url)
      ELSE NULL END AS media,
      s.audience,
      s.status,
      (extract(epoch from s.created_at)*1000)::bigint AS "createdAt",
      (extract(epoch from s.expires_at)*1000)::bigint AS "expiresAt"
    FROM public.gh_stories s
    WHERE s.status = 'published'
      AND s.expires_at > now()
      AND (
        s.audience = 'everyone'
        OR s.owner_id = p_viewer_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.ghc_user_blocks b
        WHERE (b.blocker_id = p_viewer_id AND b.blocked_id = s.owner_id)
           OR (b.blocker_id = s.owner_id AND b.blocked_id = p_viewer_id)
      )
    ORDER BY s.created_at DESC
    LIMIT 100
  ) q;
  RETURN jsonb_build_object('ok', true, 'stories', v_rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_story_view(p_story_id text, p_viewer_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.gh_stories
    WHERE id = p_story_id AND status = 'published' AND expires_at > now()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AVAILABLE');
  END IF;
  INSERT INTO public.gh_story_views (story_id, viewer_id)
  VALUES (p_story_id, p_viewer_id)
  ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_save_toggle(p_user_id text, p_post_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_exists boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.gh_posts WHERE id = p_post_id AND deleted_at IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.gh_saves WHERE user_id = p_user_id AND post_id = p_post_id
  ) INTO v_exists;
  IF v_exists THEN
    DELETE FROM public.gh_saves WHERE user_id = p_user_id AND post_id = p_post_id;
  ELSE
    INSERT INTO public.gh_saves (user_id, post_id) VALUES (p_user_id, p_post_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN jsonb_build_object('ok', true, 'saved', NOT v_exists);
END;
$$;

GRANT EXECUTE ON FUNCTION public.gh_post_create(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_post_soft_delete(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_post_list_feed(text, integer, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_reaction_toggle(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_comment_create(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_comment_list(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_follow_set(text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_follow_list(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_block_set(text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_story_create(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_story_list_active(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_story_view(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_save_toggle(text, text) TO service_role;

-- PASS 5 — durable mute / restrict (soft limits; block remains ghc_user_blocks)

CREATE TABLE IF NOT EXISTS public.gh_user_mutes (
  muter_id   text NOT NULL,
  muted_id   text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (muter_id, muted_id),
  CONSTRAINT gh_user_mutes_no_self CHECK (muter_id <> muted_id)
);

CREATE TABLE IF NOT EXISTS public.gh_user_restricts (
  restrictor_id text NOT NULL,
  restricted_id text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (restrictor_id, restricted_id),
  CONSTRAINT gh_user_restricts_no_self CHECK (restrictor_id <> restricted_id)
);

ALTER TABLE public.gh_user_mutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gh_user_restricts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_user_mutes_no_client ON public.gh_user_mutes;
CREATE POLICY gh_user_mutes_no_client ON public.gh_user_mutes FOR ALL USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS gh_user_restricts_no_client ON public.gh_user_restricts;
CREATE POLICY gh_user_restricts_no_client ON public.gh_user_restricts FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.gh_mute_set(p_muter text, p_muted text, p_mute boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_muter = p_muted THEN RETURN jsonb_build_object('ok', false, 'error', 'SELF'); END IF;
  IF p_mute THEN
    INSERT INTO public.gh_user_mutes (muter_id, muted_id) VALUES (p_muter, p_muted) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.gh_user_mutes WHERE muter_id = p_muter AND muted_id = p_muted;
  END IF;
  RETURN jsonb_build_object('ok', true, 'muted', p_mute);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_restrict_set(p_restrictor text, p_restricted text, p_restrict boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_restrictor = p_restricted THEN RETURN jsonb_build_object('ok', false, 'error', 'SELF'); END IF;
  IF p_restrict THEN
    INSERT INTO public.gh_user_restricts (restrictor_id, restricted_id) VALUES (p_restrictor, p_restricted) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.gh_user_restricts WHERE restrictor_id = p_restrictor AND restricted_id = p_restricted;
  END IF;
  RETURN jsonb_build_object('ok', true, 'restricted', p_restrict);
END; $$;

GRANT EXECUTE ON FUNCTION public.gh_mute_set(text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_restrict_set(text, text, boolean) TO service_role;

-- Minimal durable polls (feed post-linked)

CREATE TABLE IF NOT EXISTS public.gh_polls (
  id         text PRIMARY KEY,
  post_id    text,
  author_id  text NOT NULL,
  question   text NOT NULL,
  options    jsonb NOT NULL DEFAULT '[]'::jsonb,
  closes_at  timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gh_poll_votes (
  poll_id    text NOT NULL REFERENCES public.gh_polls(id) ON DELETE CASCADE,
  user_id    text NOT NULL,
  option_id  text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)
);

ALTER TABLE public.gh_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gh_poll_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_polls_no_client ON public.gh_polls;
CREATE POLICY gh_polls_no_client ON public.gh_polls FOR ALL USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS gh_poll_votes_no_client ON public.gh_poll_votes;
CREATE POLICY gh_poll_votes_no_client ON public.gh_poll_votes FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.gh_poll_create(p_row jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id text := COALESCE(p_row->>'id', '');
BEGIN
  IF v_id = '' OR COALESCE(p_row->>'authorId','') = '' OR COALESCE(p_row->>'question','') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  INSERT INTO public.gh_polls (id, post_id, author_id, question, options, closes_at)
  VALUES (
    v_id,
    NULLIF(p_row->>'postId',''),
    p_row->>'authorId',
    p_row->>'question',
    COALESCE(p_row->'options', '[]'::jsonb),
    CASE WHEN p_row ? 'closesAt' THEN to_timestamp((p_row->>'closesAt')::bigint/1000.0) ELSE NULL END
  ) ON CONFLICT (id) DO NOTHING;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_poll_vote(p_poll_id text, p_user_id text, p_option_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.gh_polls WHERE id = p_poll_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF EXISTS (SELECT 1 FROM public.gh_poll_votes WHERE poll_id = p_poll_id AND user_id = p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_VOTED');
  END IF;
  INSERT INTO public.gh_poll_votes (poll_id, user_id, option_id) VALUES (p_poll_id, p_user_id, p_option_id);
  RETURN jsonb_build_object('ok', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.gh_poll_create(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_poll_vote(text, text, text) TO service_role;
