-- Durable notifications when people a user follows publish a new post.
-- Informational only: no GHC/Pi/economy state is changed.

ALTER TABLE public.gh_social_notifications
  DROP CONSTRAINT IF EXISTS gh_social_notifications_notification_type_check;

ALTER TABLE public.gh_social_notifications
  ADD CONSTRAINT gh_social_notifications_notification_type_check
  CHECK (notification_type IN (
    'follow', 'post_created', 'post_like', 'post_comment', 'comment_reply',
    'curation', 'mention', 'share', 'reputation_level_up', 'system'
  ));

CREATE OR REPLACE FUNCTION public.gh_social_notification_create(
  p_recipient_id text,
  p_actor_id text,
  p_type text,
  p_entity_type text,
  p_entity_id text,
  p_title text,
  p_body text,
  p_dedupe_key text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text;
  v_type text := lower(trim(COALESCE(p_type, '')));
  v_entity text := lower(trim(COALESCE(p_entity_type, 'none')));
  v_recipient text := trim(COALESCE(p_recipient_id, ''));
  v_actor text := NULLIF(trim(COALESCE(p_actor_id, '')), '');
  v_dedupe text := trim(COALESCE(p_dedupe_key, ''));
  v_existing text;
BEGIN
  IF v_recipient = '' OR v_dedupe = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REQUIRED');
  END IF;
  IF v_actor IS NOT NULL AND v_actor = v_recipient
     AND v_type NOT IN ('reputation_level_up', 'system') THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'SELF');
  END IF;
  IF v_type NOT IN (
    'follow', 'post_created', 'post_like', 'post_comment', 'comment_reply',
    'curation', 'mention', 'share', 'reputation_level_up', 'system'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_TYPE');
  END IF;
  IF v_entity NOT IN ('none', 'user', 'post', 'comment') THEN
    v_entity := 'none';
  END IF;
  IF v_actor IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.ghc_user_blocks b
    WHERE (b.blocker_id = v_recipient AND b.blocked_id = v_actor)
       OR (b.blocker_id = v_actor AND b.blocked_id = v_recipient)
  ) THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'BLOCKED');
  END IF;
  SELECT id INTO v_existing FROM public.gh_social_notifications
  WHERE recipient_user_id = v_recipient AND dedupe_key = v_dedupe LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'id', v_existing);
  END IF;
  v_id := 'snotif_' || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.gh_social_notifications (
    id, recipient_user_id, actor_user_id, notification_type,
    entity_type, entity_id, title, body, metadata, dedupe_key
  ) VALUES (
    v_id, v_recipient, v_actor, v_type, v_entity,
    NULLIF(trim(COALESCE(p_entity_id, '')), ''),
    COALESCE(left(trim(COALESCE(p_title, '')), 200), ''),
    COALESCE(left(trim(COALESCE(p_body, '')), 500), ''),
    COALESCE(p_metadata, '{}'::jsonb), v_dedupe
  );
  RETURN jsonb_build_object('ok', true, 'id', v_id, 'duplicate', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_social_notify_post_followers(
  p_author_id text,
  p_post_id text,
  p_body text,
  p_dedupe_key text,
  p_visibility text DEFAULT 'public'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author text := trim(COALESCE(p_author_id, ''));
  v_post text := trim(COALESCE(p_post_id, ''));
  v_visibility text := lower(trim(COALESCE(p_visibility, 'public')));
  v_created integer := 0;
BEGIN
  IF v_author = '' OR v_post = '' OR trim(COALESCE(p_dedupe_key, '')) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REQUIRED');
  END IF;
  IF v_visibility NOT IN ('public', 'followers', 'mutuals') THEN
    RETURN jsonb_build_object('ok', true, 'created', 0, 'skipped', true);
  END IF;

  INSERT INTO public.gh_social_notifications (
    id, recipient_user_id, actor_user_id, notification_type,
    entity_type, entity_id, title, body, metadata, dedupe_key
  )
  SELECT
    'snotif_' || replace(gen_random_uuid()::text, '-', ''),
    f.follower_id,
    v_author,
    'post_created',
    'post',
    v_post,
    'New post from someone you follow',
    COALESCE(NULLIF(left(trim(COALESCE(p_body, '')), 500), ''), 'Shared a new post'),
    jsonb_build_object('open', 'home', 'tab', 'home', 'entityId', v_post, 'entityType', 'post'),
    trim(p_dedupe_key) || ':' || f.follower_id
  FROM public.gh_follows f
  WHERE f.following_id = v_author
    AND f.follower_id <> v_author
    AND (
      v_visibility <> 'mutuals'
      OR EXISTS (
        SELECT 1 FROM public.gh_follows mutual
        WHERE mutual.follower_id = v_author AND mutual.following_id = f.follower_id
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.ghc_user_blocks b
      WHERE (b.blocker_id = f.follower_id AND b.blocked_id = v_author)
         OR (b.blocker_id = v_author AND b.blocked_id = f.follower_id)
    )
  ON CONFLICT (recipient_user_id, dedupe_key) DO NOTHING;
  GET DIAGNOSTICS v_created = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'created', v_created);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_social_notification_create(text, text, text, text, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_social_notification_create(text, text, text, text, text, text, text, text, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.gh_social_notify_post_followers(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_social_notify_post_followers(text, text, text, text, text) TO service_role;


CREATE OR REPLACE FUNCTION public.gh_social_notify_message_members(
  p_sender_id text,
  p_conversation_id text,
  p_message_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender text := trim(COALESCE(p_sender_id, ''));
  v_conversation text := trim(COALESCE(p_conversation_id, ''));
  v_message text := trim(COALESCE(p_message_id, ''));
  v_created integer := 0;
BEGIN
  IF v_sender = '' OR v_conversation = '' OR v_message = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REQUIRED');
  END IF;

  INSERT INTO public.gh_social_notifications (
    id, recipient_user_id, actor_user_id, notification_type,
    entity_type, entity_id, title, body, metadata, dedupe_key
  )
  SELECT
    'snotif_' || replace(gen_random_uuid()::text, '-', ''),
    m.gh_user_id,
    v_sender,
    'system',
    'none',
    v_conversation,
    'New message',
    'You received a new message.',
    jsonb_build_object(
      'category', 'messages', 'open', 'messages', 'tab', 'messages',
      'conversationId', v_conversation, 'messageId', v_message
    ),
    'message:' || v_message || ':' || m.gh_user_id
  FROM public.gh_conversation_members m
  WHERE m.conversation_id = v_conversation
    AND m.left_at IS NULL
    AND m.gh_user_id <> v_sender
    AND NOT EXISTS (
      SELECT 1 FROM public.ghc_user_blocks b
      WHERE (b.blocker_id = m.gh_user_id AND b.blocked_id = v_sender)
         OR (b.blocker_id = v_sender AND b.blocked_id = m.gh_user_id)
    )
  ON CONFLICT (recipient_user_id, dedupe_key) DO NOTHING;
  GET DIAGNOSTICS v_created = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'created', v_created);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_social_notify_message_members(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_social_notify_message_members(text, text, text) TO service_role;
