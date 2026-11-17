-- Fix PostgreSQL 42703: column q.created_at does not exist
-- in gh_notification_inbox_list and gh_social_notifications_list.
--
-- Root cause: inner subquery aliases n.created_at as "createdAt" (quoted camelCase).
-- Outer jsonb_agg ORDER BY referenced q.created_at (unquoted → lowercased identifier),
-- which is a different column name and does not exist on subquery q.
--
-- Same class of bug previously fixed for gh_post_list_feed in
-- 20261022010038_gh_post_list_feed_order_fix.sql.
--
-- Minimal: CREATE OR REPLACE only. Preserves signatures, JSON keys (createdAt),
-- pagination, filters, SECURITY DEFINER, search_path, and service_role grants.
-- Does not mutate notification rows, wallet, earnings, or payout objects.

CREATE OR REPLACE FUNCTION public.gh_notification_inbox_list(
  p_recipient_user_id text,
  p_limit integer DEFAULT 60,
  p_before_created_at timestamptz DEFAULT NULL,
  p_before_id text DEFAULT NULL,
  p_unread_only boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows jsonb;
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 60), 1), 100);
  v_has_more boolean;
BEGIN
  SELECT COALESCE(
    jsonb_agg(row_to_json(q)::jsonb ORDER BY q."createdAt" DESC, q.id DESC),
    '[]'::jsonb
  )
  INTO v_rows
  FROM (
    SELECT
      n.id,
      n.recipient_user_id AS "recipientUserId",
      n.actor_user_id AS "actorUserId",
      n.source_type AS "sourceType",
      n.source_id AS "sourceId",
      n.notification_type AS "type",
      n.title,
      n.body,
      n.metadata,
      n.correlation_id AS "correlationId",
      n.request_id AS "requestId",
      n.read_at AS "readAt",
      n.created_at AS "createdAt",
      n.expires_at AS "expiresAt"
    FROM public.gh_notification_inbox n
    WHERE n.recipient_user_id = trim(p_recipient_user_id)
      AND (NOT p_unread_only OR n.read_at IS NULL)
      AND (
        p_before_created_at IS NULL
        OR n.created_at < p_before_created_at
        OR (
          n.created_at = p_before_created_at
          AND p_before_id IS NOT NULL
          AND n.id < p_before_id
        )
      )
      AND (n.expires_at IS NULL OR n.expires_at > now())
    ORDER BY n.created_at DESC, n.id DESC
    LIMIT v_limit + 1
  ) q;

  v_has_more := jsonb_array_length(v_rows) > v_limit;
  IF v_has_more THEN
    SELECT COALESCE(jsonb_agg(value ORDER BY ord), '[]'::jsonb)
    INTO v_rows
    FROM jsonb_array_elements(v_rows) WITH ORDINALITY AS x(value, ord)
    WHERE ord <= v_limit;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'notifications', v_rows,
    'hasMore', v_has_more
  );
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

  SELECT COALESCE(
    jsonb_agg(row_to_json(q)::jsonb ORDER BY q."createdAt" DESC),
    '[]'::jsonb
  )
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

  RETURN jsonb_build_object(
    'ok', true,
    'notifications', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

-- Preserve privilege model: service_role only (same as original migrations).
REVOKE ALL ON FUNCTION public.gh_notification_inbox_list(text, integer, timestamptz, text, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_notification_inbox_list(text, integer, timestamptz, text, boolean)
  TO service_role;

REVOKE ALL ON FUNCTION public.gh_social_notifications_list(text, integer, bigint, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_social_notifications_list(text, integer, bigint, boolean)
  TO service_role;

COMMENT ON FUNCTION public.gh_notification_inbox_list(text, integer, timestamptz, text, boolean) IS
  'Unified notification inbox list. Outer ORDER BY uses q."createdAt" to match subquery alias (fixes 42703).';

COMMENT ON FUNCTION public.gh_social_notifications_list(text, integer, bigint, boolean) IS
  'Social notification list. Outer ORDER BY uses q."createdAt" to match subquery alias (fixes 42703).';
