-- GH-CONNECT social engagement write integrity hardening.
-- Review and apply to disposable PostgreSQL/Testnet only after reconciling remote
-- migration history. It does not delete/fabricate source rows; it reconciles cached counters.
-- Fixes: concurrent reaction toggles/counters, curation counter drift, duplicate
-- comment IDs being incorrectly reported as success, and non-atomic comment delete.

-- Serialize curation changes per post and derive vote counters from the durable
-- canonical vote rows. gh_post_curation_set_with_reward continues to wrap this
-- function and the GHPV/reward writes in one PostgreSQL transaction.
CREATE OR REPLACE FUNCTION public.gh_post_curation_set(
  p_post_id text,
  p_user_id text,
  p_choice text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_post_id text := trim(coalesce(p_post_id, ''));
  v_user_id text := trim(coalesce(p_user_id, ''));
  v_choice text := lower(trim(coalesce(p_choice, 'neutral')));
  v_author text;
  v_visibility text;
  v_prev text;
  v_up integer := 0;
  v_down integer := 0;
BEGIN
  IF v_post_id = '' OR length(v_post_id) > 128 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CONTENT_REQUIRED');
  END IF;
  IF v_user_id = '' OR length(v_user_id) > 256 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ACTOR_REQUIRED');
  END IF;
  IF v_choice NOT IN ('upvote', 'downvote', 'neutral') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CHOICE');
  END IF;

  -- A per-post lock prevents two different voters from racing stale counters.
  PERFORM pg_advisory_xact_lock(hashtext('gh_curate_post:' || v_post_id));
  SELECT author_id, visibility INTO v_author, v_visibility
  FROM public.gh_posts WHERE id = v_post_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_author = v_user_id AND v_choice IN ('upvote', 'downvote') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SELF_CURATION_FORBIDDEN');
  END IF;
  IF NOT public.gh_post_viewer_can_read(v_user_id, v_post_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT choice INTO v_prev FROM public.gh_post_curations
  WHERE post_id = v_post_id AND user_id = v_user_id;
  IF v_prev IS NOT NULL AND v_prev = v_choice THEN
    v_choice := 'neutral';
  END IF;

  IF v_choice = 'neutral' THEN
    DELETE FROM public.gh_post_curations WHERE post_id = v_post_id AND user_id = v_user_id;
  ELSE
    INSERT INTO public.gh_post_curations(post_id, user_id, choice, updated_at)
    VALUES (v_post_id, v_user_id, v_choice, now())
    ON CONFLICT (post_id, user_id) DO UPDATE SET choice = EXCLUDED.choice, updated_at = now();
  END IF;

  SELECT count(*) FILTER (WHERE choice = 'upvote')::integer,
         count(*) FILTER (WHERE choice = 'downvote')::integer
    INTO v_up, v_down
  FROM public.gh_post_curations WHERE post_id = v_post_id;
  UPDATE public.gh_posts SET upvote_count = coalesce(v_up, 0),
    downvote_count = coalesce(v_down, 0), updated_at = now()
  WHERE id = v_post_id;

  RETURN jsonb_build_object('ok', true, 'choice', v_choice,
    'upvoteCount', coalesce(v_up, 0), 'downvoteCount', coalesce(v_down, 0));
END; $$;
REVOKE ALL ON FUNCTION public.gh_post_curation_set(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_post_curation_set(text, text, text) TO service_role;

-- Serialize toggles per post so a concurrent request cannot increment like_count
-- when ON CONFLICT did not insert a row. The table remains the source of truth.
CREATE OR REPLACE FUNCTION public.gh_reaction_toggle(
  p_post_id text, p_user_id text, p_reaction text DEFAULT 'like'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_post_id text := trim(coalesce(p_post_id, ''));
  v_user_id text := trim(coalesce(p_user_id, ''));
  v_reaction text := lower(trim(coalesce(p_reaction, 'like')));
  v_author text;
  v_visibility text;
  v_active boolean := false;
  v_liked boolean := false;
  v_count integer := 0;
  v_rows integer := 0;
BEGIN
  IF v_post_id = '' OR v_user_id = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REQUIRED');
  END IF;
  IF v_reaction NOT IN ('like','love','laugh','wow','sad','angry','support','inspire','insight','celebrate') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_REACTION');
  END IF;
  SELECT author_id, visibility INTO v_author, v_visibility
  FROM public.gh_posts WHERE id = v_post_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF NOT public.gh_post_viewer_can_read(v_user_id, v_post_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  DELETE FROM public.gh_post_reactions
  WHERE post_id = v_post_id AND user_id = v_user_id AND reaction = v_reaction;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows > 0 THEN
    v_active := false;
  ELSE
    INSERT INTO public.gh_post_reactions(post_id, user_id, reaction)
    VALUES (v_post_id, v_user_id, v_reaction) ON CONFLICT (post_id, user_id, reaction) DO NOTHING;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_active := v_rows > 0;
  END IF;

  SELECT count(*)::integer INTO v_count FROM public.gh_post_reactions
  WHERE post_id = v_post_id AND reaction = 'like';
  SELECT EXISTS (SELECT 1 FROM public.gh_post_reactions
    WHERE post_id = v_post_id AND user_id = v_user_id AND reaction = 'like') INTO v_liked;
  UPDATE public.gh_posts SET like_count = greatest(0, coalesce(v_count, 0)), updated_at = now()
  WHERE id = v_post_id;

  RETURN jsonb_build_object('ok', true, 'reaction', v_reaction, 'active', v_active,
    'liked', v_liked, 'likeCount', greatest(0, coalesce(v_count, 0)));
END; $$;
REVOKE ALL ON FUNCTION public.gh_reaction_toggle(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_reaction_toggle(text, text, text) TO service_role;

-- Comment creation is idempotent only when a duplicate ID identifies the same
-- author/post/content. A conflicting ID must never be reported as saved.
CREATE OR REPLACE FUNCTION public.gh_comment_create(p_row jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_id text := trim(coalesce(p_row->>'id', ''));
  v_post text := trim(coalesce(p_row->>'postId', ''));
  v_author text := trim(coalesce(p_row->>'authorId', ''));
  v_name text := left(coalesce(p_row->>'authorName', ''), 120);
  v_photo text := left(coalesce(p_row->>'authorPhoto', ''), 2000);
  v_text text := coalesce(p_row->>'text', '');
  v_parent text := nullif(trim(coalesce(p_row->>'parentId', p_row->>'replyTo', '')), '');
  v_media jsonb := coalesce(p_row->'media', '[]'::jsonb);
  v_created timestamptz := now();
  v_inserted_id text;
  v_comment_count integer := 0;
  v_existing record;
BEGIN
  IF v_id = '' OR length(v_id) > 160 OR v_post = '' OR length(v_post) > 128
     OR v_author = '' OR length(v_author) > 256 OR length(v_text) > 2000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gh_posts WHERE id = v_post AND deleted_at IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND');
  END IF;
  IF NOT public.gh_post_viewer_can_read(v_author, v_post) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND');
  END IF;
  IF v_parent IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.gh_post_comments WHERE id = v_parent AND post_id = v_post AND deleted_at IS NULL
  ) THEN RETURN jsonb_build_object('ok', false, 'error', 'PARENT_NOT_FOUND'); END IF;
  IF jsonb_typeof(v_media) <> 'array' THEN v_media := '[]'::jsonb; END IF;
  IF jsonb_array_length(v_media) > 4 THEN
    SELECT coalesce(jsonb_agg(e ORDER BY ord), '[]'::jsonb) INTO v_media
    FROM jsonb_array_elements(v_media) WITH ORDINALITY AS x(e, ord) WHERE ord <= 4;
  END IF;
  IF p_row ? 'createdAt' AND coalesce(p_row->>'createdAt','') ~ '^\d{1,16}$' THEN
    v_created := to_timestamp((p_row->>'createdAt')::numeric / 1000.0);
  END IF;

  INSERT INTO public.gh_post_comments(id, post_id, author_id, author_name, author_photo, text, parent_id, created_at, media)
  VALUES (v_id, v_post, v_author, v_name, v_photo, v_text, v_parent, v_created, v_media)
  ON CONFLICT (id) DO NOTHING RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    SELECT id, post_id, author_id, text, parent_id, media, deleted_at INTO v_existing
    FROM public.gh_post_comments WHERE id = v_id;
    IF FOUND AND v_existing.deleted_at IS NULL AND v_existing.post_id = v_post AND v_existing.author_id = v_author
      AND v_existing.text = v_text AND v_existing.parent_id IS NOT DISTINCT FROM v_parent
      AND coalesce(v_existing.media, '[]'::jsonb) = v_media THEN
      SELECT comment_count INTO v_comment_count FROM public.gh_posts WHERE id = v_post;
      RETURN jsonb_build_object('ok', true, 'id', v_id, 'idempotent', true,
        'commentCount', greatest(0, coalesce(v_comment_count, 0)));
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'COMMENT_ID_CONFLICT');
  END IF;

  UPDATE public.gh_posts SET comment_count = greatest(0, coalesce(comment_count, 0)) + 1, updated_at = now()
  WHERE id = v_post RETURNING comment_count INTO v_comment_count;
  RETURN jsonb_build_object('ok', true, 'id', v_id, 'idempotent', false,
    'commentCount', greatest(0, coalesce(v_comment_count, 0)));
END; $$;
REVOKE ALL ON FUNCTION public.gh_comment_create(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_comment_create(jsonb) TO service_role;

-- Atomic author-only soft delete and counter update. The route no longer does a
-- non-transactional PATCH followed by a no-op comment-list RPC.
CREATE OR REPLACE FUNCTION public.gh_comment_delete(
  p_post_id text, p_comment_id text, p_actor_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_author text;
  v_post_author text;
  v_deleted timestamptz;
  v_comment_count integer := 0;
BEGIN
  IF coalesce(trim(p_post_id), '') = '' OR coalesce(trim(p_comment_id), '') = ''
     OR coalesce(trim(p_actor_id), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  SELECT author_id, comment_count INTO v_post_author, v_comment_count FROM public.gh_posts WHERE id = trim(p_post_id) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND'); END IF;
  IF NOT public.gh_post_viewer_can_read(trim(p_actor_id), trim(p_post_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND');
  END IF;
  SELECT author_id, deleted_at INTO v_author, v_deleted FROM public.gh_post_comments
  WHERE id = trim(p_comment_id) AND post_id = trim(p_post_id) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF v_author <> trim(p_actor_id) AND v_post_author <> trim(p_actor_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_deleted IS NOT NULL THEN RETURN jsonb_build_object('ok', true, 'idempotent', true,
    'commentCount', greatest(0, coalesce(v_comment_count, 0))); END IF;
  UPDATE public.gh_post_comments SET deleted_at = now()
  WHERE id = trim(p_comment_id) AND post_id = trim(p_post_id) AND deleted_at IS NULL;
  IF FOUND THEN
    UPDATE public.gh_posts SET comment_count = greatest(0, coalesce(comment_count, 0) - 1), updated_at = now()
    WHERE id = trim(p_post_id) RETURNING comment_count INTO v_comment_count;
  END IF;
  RETURN jsonb_build_object('ok', true, 'idempotent', false,
    'commentCount', greatest(0, coalesce(v_comment_count, 0)));
END; $$;
REVOKE ALL ON FUNCTION public.gh_comment_delete(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_comment_delete(text, text, text) TO service_role;

-- Serialize comment emoji reactions on the comment row; only durable rows drive
-- returned counts. A repeated request cannot double-toggle due to racing reads.
CREATE OR REPLACE FUNCTION public.gh_comment_reaction_toggle(
  p_post_id text, p_comment_id text, p_user_id text, p_emoji text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_post_id text := trim(coalesce(p_post_id, ''));
  v_comment_id text := trim(coalesce(p_comment_id, ''));
  v_user_id text := trim(coalesce(p_user_id, ''));
  v_emoji text := left(trim(coalesce(p_emoji, '')), 16);
  v_active boolean := false;
  v_rows integer := 0;
  v_counts jsonb := '{}'::jsonb;
BEGIN
  IF v_post_id = '' OR v_comment_id = '' OR v_user_id = '' OR v_emoji = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  PERFORM 1 FROM public.gh_posts WHERE id = v_post_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND'); END IF;
  IF NOT public.gh_post_viewer_can_read(v_user_id, v_post_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND');
  END IF;
  PERFORM 1 FROM public.gh_post_comments
  WHERE id = v_comment_id AND post_id = v_post_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'COMMENT_NOT_FOUND'); END IF;

  DELETE FROM public.gh_comment_reactions
  WHERE comment_id = v_comment_id AND post_id = v_post_id AND user_id = v_user_id AND emoji = v_emoji;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows > 0 THEN
    v_active := false;
  ELSE
    INSERT INTO public.gh_comment_reactions(comment_id, post_id, user_id, emoji)
    VALUES (v_comment_id, v_post_id, v_user_id, v_emoji)
    ON CONFLICT (comment_id, user_id, emoji) DO NOTHING;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_active := v_rows > 0;
  END IF;
  SELECT coalesce(jsonb_object_agg(emoji, cnt), '{}'::jsonb) INTO v_counts
  FROM (SELECT emoji, count(*)::integer AS cnt FROM public.gh_comment_reactions
        WHERE comment_id = v_comment_id GROUP BY emoji) q;
  RETURN jsonb_build_object('ok', true, 'active', v_active, 'emoji', v_emoji, 'counts', coalesce(v_counts, '{}'::jsonb));
END; $$;
REVOKE ALL ON FUNCTION public.gh_comment_reaction_toggle(text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_comment_reaction_toggle(text, text, text, text) TO service_role;

-- Reconcile existing denormalized counters from canonical durable rows once.
-- This changes only cached aggregate columns; it does not create or delete votes.
UPDATE public.gh_posts p SET
  upvote_count = (SELECT count(*)::integer FROM public.gh_post_curations c WHERE c.post_id = p.id AND c.choice = 'upvote'),
  downvote_count = (SELECT count(*)::integer FROM public.gh_post_curations c WHERE c.post_id = p.id AND c.choice = 'downvote'),
  like_count = (SELECT count(*)::integer FROM public.gh_post_reactions r WHERE r.post_id = p.id AND r.reaction = 'like'),
  comment_count = (SELECT count(*)::integer FROM public.gh_post_comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL),
  share_count = (SELECT count(*)::integer FROM public.gh_post_shares s WHERE s.post_id = p.id)
WHERE p.deleted_at IS NULL;

COMMENT ON FUNCTION public.gh_post_curation_set(text, text, text) IS
  'Atomic, serialized durable curation mutation; counters derived from gh_post_curations; service-role only.';
COMMENT ON FUNCTION public.gh_reaction_toggle(text, text, text) IS
  'Serialized durable post reaction toggle; like_count reconciled from gh_post_reactions; service-role only.';
COMMENT ON FUNCTION public.gh_comment_create(jsonb) IS
  'Durable idempotent comment creation; duplicate ID succeeds only for the same author/post/content; service-role only.';
COMMENT ON FUNCTION public.gh_comment_delete(text, text, text) IS
  'Atomic author-only comment soft-delete and post comment_count update; service-role only.';
COMMENT ON FUNCTION public.gh_comment_reaction_toggle(text, text, text, text) IS
  'Serialized durable comment emoji reaction toggle; service-role only.';


-- Save toggles are serialized by the post row and cannot claim a save succeeded
-- if a conflicting request left a different final state. The route separately
-- verifies visibility; this RPC repeats essential visibility/block checks.
CREATE OR REPLACE FUNCTION public.gh_save_toggle(p_user_id text, p_post_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_user text := trim(coalesce(p_user_id, ''));
  v_post text := trim(coalesce(p_post_id, ''));
  v_author text;
  v_visibility text;
  v_community text;
  v_saved boolean;
BEGIN
  IF v_user = '' OR v_post = '' THEN RETURN jsonb_build_object('ok', false, 'error', 'REQUIRED'); END IF;
  SELECT author_id, visibility, community_id INTO v_author, v_visibility, v_community
  FROM public.gh_posts WHERE id = v_post AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF NOT public.gh_post_viewer_can_read(v_user, v_post) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_author <> v_user THEN
    IF EXISTS (SELECT 1 FROM public.ghc_user_blocks b
      WHERE (b.blocker_id = v_user AND b.blocked_id = v_author)
         OR (b.blocker_id = v_author AND b.blocked_id = v_user)) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;
    IF v_visibility = 'followers' AND NOT EXISTS (
      SELECT 1 FROM public.gh_follows WHERE follower_id = v_user AND following_id = v_author
    ) THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
    IF v_visibility = 'mutuals' AND NOT (
      EXISTS (SELECT 1 FROM public.gh_follows WHERE follower_id = v_user AND following_id = v_author)
      AND EXISTS (SELECT 1 FROM public.gh_follows WHERE follower_id = v_author AND following_id = v_user)
    ) THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
    IF v_visibility NOT IN ('public','followers','mutuals') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;
  END IF;
  IF v_community IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.gh_community_members
    WHERE community_id = v_community AND gh_user_id = v_user AND status = 'active'
  ) AND v_author <> v_user THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF EXISTS (SELECT 1 FROM public.gh_saves WHERE user_id = v_user AND post_id = v_post) THEN
    DELETE FROM public.gh_saves WHERE user_id = v_user AND post_id = v_post;
    v_saved := false;
  ELSE
    INSERT INTO public.gh_saves(user_id, post_id) VALUES (v_user, v_post)
    ON CONFLICT (user_id, post_id) DO NOTHING;
    SELECT EXISTS (SELECT 1 FROM public.gh_saves WHERE user_id = v_user AND post_id = v_post) INTO v_saved;
  END IF;
  RETURN jsonb_build_object('ok', true, 'saved', coalesce(v_saved, false));
END; $$;
REVOKE ALL ON FUNCTION public.gh_save_toggle(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_save_toggle(text, text) TO service_role;

-- Share creation is idempotent per (sharer, post), serialized per post, and
-- reports the canonical existing share ID on retries.
CREATE OR REPLACE FUNCTION public.gh_post_share(p_sharer_id text, p_post_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_sharer text := trim(coalesce(p_sharer_id, ''));
  v_post text := trim(coalesce(p_post_id, ''));
  v_author text;
  v_visibility text;
  v_community text;
  v_id text;
  v_count integer := 0;
BEGIN
  IF v_sharer = '' OR v_post = '' THEN RETURN jsonb_build_object('ok', false, 'error', 'REQUIRED'); END IF;
  SELECT author_id, visibility, community_id INTO v_author, v_visibility, v_community
  FROM public.gh_posts WHERE id = v_post AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF NOT public.gh_post_viewer_can_read(v_sharer, v_post) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF EXISTS (SELECT 1 FROM public.ghc_user_blocks b
    WHERE (b.blocker_id = v_sharer AND b.blocked_id = v_author)
       OR (b.blocker_id = v_author AND b.blocked_id = v_sharer)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'BLOCKED');
  END IF;
  IF v_author <> v_sharer THEN
    IF v_visibility = 'followers' AND NOT EXISTS (
      SELECT 1 FROM public.gh_follows WHERE follower_id = v_sharer AND following_id = v_author
    ) THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
    IF v_visibility = 'mutuals' AND NOT (
      EXISTS (SELECT 1 FROM public.gh_follows WHERE follower_id = v_sharer AND following_id = v_author)
      AND EXISTS (SELECT 1 FROM public.gh_follows WHERE follower_id = v_author AND following_id = v_sharer)
    ) THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
    IF v_visibility NOT IN ('public','followers','mutuals') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;
  END IF;
  IF v_community IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.gh_community_members
    WHERE community_id = v_community AND gh_user_id = v_sharer AND status = 'active'
  ) AND v_author <> v_sharer THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT id INTO v_id FROM public.gh_post_shares WHERE sharer_id = v_sharer AND post_id = v_post;
  IF v_id IS NULL THEN
    v_id := 'share_' || replace(gen_random_uuid()::text, '-', '');
    INSERT INTO public.gh_post_shares(id, post_id, sharer_id)
    VALUES (v_id, v_post, v_sharer)
    ON CONFLICT (sharer_id, post_id) DO NOTHING;
    SELECT id INTO v_id FROM public.gh_post_shares WHERE sharer_id = v_sharer AND post_id = v_post;
  END IF;
  SELECT count(*)::integer INTO v_count FROM public.gh_post_shares WHERE post_id = v_post;
  UPDATE public.gh_posts SET share_count = greatest(0, coalesce(v_count, 0)), updated_at = now() WHERE id = v_post;
  RETURN jsonb_build_object('ok', true, 'shareId', v_id, 'postId', v_post, 'authorId', v_author, 'shareCount', greatest(0, coalesce(v_count, 0)));
END; $$;
REVOKE ALL ON FUNCTION public.gh_post_share(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_post_share(text, text) TO service_role;

COMMENT ON FUNCTION public.gh_save_toggle(text, text) IS
  'Serialized durable save toggle with server-side visibility/block checks; service-role only.';
COMMENT ON FUNCTION public.gh_post_share(text, text) IS
  'Idempotent durable share edge with serialized canonical share_count; service-role only.';


-- Durable comment editing and owner-controlled pinning. Older builds updated
-- these fields only in React state, so the change vanished on refresh.
ALTER TABLE public.gh_post_comments
  ADD COLUMN IF NOT EXISTS is_edited boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz,
  ADD COLUMN IF NOT EXISTS pinned_by text;

CREATE OR REPLACE FUNCTION public.gh_comment_edit(
  p_post_id text, p_comment_id text, p_actor_id text, p_text text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_author text; v_deleted timestamptz; v_updated timestamptz;
BEGIN
  IF coalesce(trim(p_post_id),'') = '' OR coalesce(trim(p_comment_id),'') = ''
     OR coalesce(trim(p_actor_id),'') = '' OR coalesce(trim(p_text),'') = '' OR length(trim(p_text)) > 2000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  PERFORM 1 FROM public.gh_posts WHERE id = trim(p_post_id) AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND'); END IF;
  IF NOT public.gh_post_viewer_can_read(trim(p_actor_id), trim(p_post_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND');
  END IF;
  SELECT author_id, deleted_at INTO v_author, v_deleted FROM public.gh_post_comments
    WHERE id = trim(p_comment_id) AND post_id = trim(p_post_id) FOR UPDATE;
  IF NOT FOUND OR v_deleted IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF v_author <> trim(p_actor_id) THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
  UPDATE public.gh_post_comments SET text = trim(p_text), is_edited = true, edited_at = now()
    WHERE id = trim(p_comment_id) AND post_id = trim(p_post_id) RETURNING edited_at INTO v_updated;
  RETURN jsonb_build_object('ok', true, 'text', trim(p_text), 'isEdited', true,
    'editedAt', (extract(epoch FROM v_updated) * 1000)::bigint);
END; $$;
REVOKE ALL ON FUNCTION public.gh_comment_edit(text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_comment_edit(text, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.gh_comment_pin_set(
  p_post_id text, p_comment_id text, p_actor_id text, p_pinned boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_post_author text; v_deleted timestamptz; v_pinned boolean; v_pinned_at timestamptz;
BEGIN
  IF coalesce(trim(p_post_id),'') = '' OR coalesce(trim(p_comment_id),'') = ''
     OR coalesce(trim(p_actor_id),'') = '' OR p_pinned IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  SELECT author_id INTO v_post_author FROM public.gh_posts
    WHERE id = trim(p_post_id) AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND'); END IF;
  IF NOT public.gh_post_viewer_can_read(trim(p_actor_id), trim(p_post_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND');
  END IF;
  IF v_post_author <> trim(p_actor_id) THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
  SELECT deleted_at INTO v_deleted FROM public.gh_post_comments
    WHERE id = trim(p_comment_id) AND post_id = trim(p_post_id) FOR UPDATE;
  IF NOT FOUND OR v_deleted IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  UPDATE public.gh_post_comments SET is_pinned = p_pinned,
    pinned_at = CASE WHEN p_pinned THEN now() ELSE NULL END,
    pinned_by = CASE WHEN p_pinned THEN trim(p_actor_id) ELSE NULL END
    WHERE id = trim(p_comment_id) AND post_id = trim(p_post_id)
    RETURNING is_pinned, pinned_at INTO v_pinned, v_pinned_at;
  RETURN jsonb_build_object('ok', true, 'isPinned', v_pinned,
    'pinnedAt', CASE WHEN v_pinned_at IS NULL THEN NULL ELSE (extract(epoch FROM v_pinned_at) * 1000)::bigint END);
END; $$;
REVOKE ALL ON FUNCTION public.gh_comment_pin_set(text, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_comment_pin_set(text, text, text, boolean) TO service_role;

-- Upgrade the canonical comment-list RPC without changing its signature.
CREATE OR REPLACE FUNCTION public.gh_comment_list_v3(
  p_post_id text,
  p_viewer_id text,
  p_limit integer DEFAULT 40,
  p_before_ms bigint DEFAULT NULL,
  p_before_id text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_rows jsonb; v_limit integer := least(greatest(coalesce(p_limit, 40), 1), 101);
BEGIN
  IF nullif(trim(p_viewer_id), '') IS NULL OR nullif(trim(p_post_id), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ACTOR_REQUIRED');
  END IF;
  IF (p_before_ms IS NULL) <> (p_before_id IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_COMMENT_CURSOR');
  END IF;
  IF NOT public.gh_post_viewer_can_read(trim(p_viewer_id), trim(p_post_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND');
  END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q."createdAt" DESC, q.id DESC), '[]'::jsonb)
    INTO v_rows FROM (
      SELECT c.id, c.author_id AS "authorId", c.author_name AS "authorName",
        c.author_photo AS "authorPhoto", c.text, c.parent_id AS "replyTo",
        (extract(epoch FROM c.created_at) * 1000)::bigint AS "createdAt",
        coalesce(c.media, '[]'::jsonb) AS "mediaAttachments",
        c.is_edited AS "isEdited",
        CASE WHEN c.edited_at IS NULL THEN NULL ELSE (extract(epoch FROM c.edited_at) * 1000)::bigint END AS "editedAt",
        coalesce(c.is_pinned, false) AS "isPinned"
      FROM public.gh_post_comments c
      WHERE c.post_id = trim(p_post_id) AND c.deleted_at IS NULL
        AND (p_before_ms IS NULL
          OR (extract(epoch FROM c.created_at) * 1000)::bigint < p_before_ms
          OR ((extract(epoch FROM c.created_at) * 1000)::bigint = p_before_ms AND c.id < p_before_id))
      ORDER BY c.created_at DESC, c.id DESC LIMIT v_limit
    ) q;
  RETURN jsonb_build_object('ok', true, 'comments', v_rows);
END; $$;
REVOKE ALL ON FUNCTION public.gh_comment_list_v3(text, text, integer, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_comment_list_v3(text, text, integer, bigint, text) TO service_role;

COMMENT ON FUNCTION public.gh_comment_edit(text, text, text, text) IS
  'Durable author-only comment edit with edited timestamp; service-role only.';
COMMENT ON FUNCTION public.gh_comment_pin_set(text, text, text, boolean) IS
  'Durable post-owner-only comment pin state; service-role only.';
