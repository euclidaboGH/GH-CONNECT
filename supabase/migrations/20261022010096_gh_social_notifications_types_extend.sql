-- Extend social notification types: reputation_level_up + system.
-- Informational only. No GHC/ledger columns. Service-role RPCs only.

ALTER TABLE public.gh_social_notifications
  DROP CONSTRAINT IF EXISTS gh_social_notifications_notification_type_check;

ALTER TABLE public.gh_social_notifications
  ADD CONSTRAINT gh_social_notifications_notification_type_check
  CHECK (notification_type IN (
    'follow',
    'post_like',
    'post_comment',
    'comment_reply',
    'curation',
    'mention',
    'share',
    'reputation_level_up',
    'system'
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
  -- Self-actions skipped except system/reputation_level_up (no actor or system actor)
  IF v_actor IS NOT NULL AND v_actor = v_recipient
     AND v_type NOT IN ('reputation_level_up', 'system') THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'SELF');
  END IF;
  IF v_type NOT IN (
    'follow', 'post_like', 'post_comment', 'comment_reply',
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
    COALESCE(p_metadata, '{}'::jsonb),
    v_dedupe
  );
  RETURN jsonb_build_object('ok', true, 'id', v_id, 'duplicate', false);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_social_notification_create(text, text, text, text, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_social_notification_create(text, text, text, text, text, text, text, text, jsonb) TO service_role;

COMMENT ON TABLE public.gh_social_notifications IS
  'In-app social/system activity only. No GHC/Pi/ledger. Writes via service_role RPC.';
