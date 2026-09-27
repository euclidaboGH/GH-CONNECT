-- Phase 11: durable social notifications (informational only — no economy fields).

CREATE TABLE IF NOT EXISTS public.gh_social_notifications (
  id                text PRIMARY KEY,
  recipient_user_id text NOT NULL,
  actor_user_id     text,
  notification_type text NOT NULL
                    CHECK (notification_type IN (
                      'follow',
                      'post_like',
                      'post_comment',
                      'comment_reply',
                      'curation',
                      'mention'
                    )),
  entity_type       text NOT NULL DEFAULT 'none'
                    CHECK (entity_type IN ('none', 'user', 'post', 'comment')),
  entity_id         text,
  title             text NOT NULL DEFAULT '',
  body              text NOT NULL DEFAULT '',
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key        text NOT NULL,
  read_at           timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_social_notif_recipient_nonempty CHECK (length(trim(recipient_user_id)) > 0),
  CONSTRAINT gh_social_notif_dedupe_nonempty CHECK (length(trim(dedupe_key)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_social_notifications_dedupe
  ON public.gh_social_notifications (recipient_user_id, dedupe_key);

CREATE INDEX IF NOT EXISTS idx_gh_social_notifications_recipient_created
  ON public.gh_social_notifications (recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gh_social_notifications_recipient_unread
  ON public.gh_social_notifications (recipient_user_id, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE public.gh_social_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_social_notifications_no_client ON public.gh_social_notifications;
CREATE POLICY gh_social_notifications_no_client ON public.gh_social_notifications
  FOR ALL USING (false) WITH CHECK (false);

COMMENT ON TABLE public.gh_social_notifications IS
  'In-app social activity only. No GHC/Pi/ledger columns. Writes via service_role RPC.';

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
  IF v_actor IS NOT NULL AND v_actor = v_recipient THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'SELF');
  END IF;
  IF v_type NOT IN ('follow', 'post_like', 'post_comment', 'comment_reply', 'curation', 'mention') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_TYPE');
  END IF;
  IF v_entity NOT IN ('none', 'user', 'post', 'comment') THEN
    v_entity := 'none';
  END IF;

  -- Block either direction → no notification
  IF v_actor IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.ghc_user_blocks b
    WHERE (b.blocker_id = v_recipient AND b.blocked_id = v_actor)
       OR (b.blocker_id = v_actor AND b.blocked_id = v_recipient)
  ) THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'BLOCKED');
  END IF;

  SELECT id INTO v_existing
  FROM public.gh_social_notifications
  WHERE recipient_user_id = v_recipient AND dedupe_key = v_dedupe
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'id', v_existing);
  END IF;

  v_id := 'snotif_' || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.gh_social_notifications (
    id, recipient_user_id, actor_user_id, notification_type,
    entity_type, entity_id, title, body, metadata, dedupe_key
  ) VALUES (
    v_id,
    v_recipient,
    v_actor,
    v_type,
    v_entity,
    NULLIF(trim(COALESCE(p_entity_id, '')), ''),
    COALESCE(left(trim(COALESCE(p_title, '')), 200), ''),
    COALESCE(left(trim(COALESCE(p_body, '')), 500), ''),
    COALESCE(p_metadata, '{}'::jsonb),
    v_dedupe
  );

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'duplicate', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_social_notifications_list(
  p_recipient_id text,
  p_limit integer DEFAULT 40,
  p_before_ms bigint DEFAULT NULL,
  p_unread_only boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows jsonb;
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 40), 1), 100);
BEGIN
  IF p_recipient_id IS NULL OR length(trim(p_recipient_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'RECIPIENT_REQUIRED');
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb ORDER BY q.created_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      n.id,
      n.recipient_user_id AS "recipientUserId",
      n.actor_user_id AS "actorUserId",
      n.notification_type AS "type",
      n.entity_type AS "entityType",
      n.entity_id AS "entityId",
      n.title,
      n.body,
      n.metadata,
      n.read_at AS "readAt",
      (extract(epoch from n.created_at) * 1000)::bigint AS "createdAt"
    FROM public.gh_social_notifications n
    WHERE n.recipient_user_id = trim(p_recipient_id)
      AND (NOT p_unread_only OR n.read_at IS NULL)
      AND (
        p_before_ms IS NULL
        OR (extract(epoch from n.created_at) * 1000)::bigint < p_before_ms
      )
    ORDER BY n.created_at DESC
    LIMIT v_limit
  ) q;

  RETURN jsonb_build_object('ok', true, 'notifications', COALESCE(v_rows, '[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_social_notifications_unread_count(p_recipient_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF p_recipient_id IS NULL OR length(trim(p_recipient_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'RECIPIENT_REQUIRED');
  END IF;
  SELECT COUNT(*)::integer INTO v_count
  FROM public.gh_social_notifications
  WHERE recipient_user_id = trim(p_recipient_id) AND read_at IS NULL;
  RETURN jsonb_build_object('ok', true, 'unreadCount', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_social_notifications_mark_read(
  p_recipient_id text,
  p_ids text[] DEFAULT NULL,
  p_all boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  IF p_recipient_id IS NULL OR length(trim(p_recipient_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'RECIPIENT_REQUIRED');
  END IF;

  IF p_all THEN
    UPDATE public.gh_social_notifications
    SET read_at = now()
    WHERE recipient_user_id = trim(p_recipient_id) AND read_at IS NULL;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  ELSIF p_ids IS NOT NULL AND array_length(p_ids, 1) > 0 THEN
    UPDATE public.gh_social_notifications
    SET read_at = now()
    WHERE recipient_user_id = trim(p_recipient_id)
      AND read_at IS NULL
      AND id = ANY (p_ids);
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object('ok', true, 'updated', v_updated);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_social_notification_create(text, text, text, text, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_social_notification_create(text, text, text, text, text, text, text, text, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.gh_social_notifications_list(text, integer, bigint, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_social_notifications_list(text, integer, bigint, boolean) TO service_role;
REVOKE ALL ON FUNCTION public.gh_social_notifications_unread_count(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_social_notifications_unread_count(text) TO service_role;
REVOKE ALL ON FUNCTION public.gh_social_notifications_mark_read(text, text[], boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_social_notifications_mark_read(text, text[], boolean) TO service_role;
