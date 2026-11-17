-- Phase D6: notification-oriented fields on economy events + dedupe

ALTER TABLE public.ghc_economy_events
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS body text,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS request_id text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ghc_economy_events_dedupe
  ON public.ghc_economy_events (user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ghc_events_user_unread
  ON public.ghc_economy_events (user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ghc_events_user_type
  ON public.ghc_economy_events (user_id, event_type, created_at DESC);

-- Idempotent insert of a user-facing economy notification event
CREATE OR REPLACE FUNCTION public.ghc_record_notification_event(
  p_user_id text,
  p_event_type text,
  p_title text,
  p_body text,
  p_reference_id text DEFAULT NULL,
  p_request_id text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_dedupe_key text DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing public.ghc_economy_events%ROWTYPE;
  created public.ghc_economy_events%ROWTYPE;
  dkey text;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_USER');
  END IF;
  IF p_event_type IS NULL OR length(trim(p_event_type)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_TYPE');
  END IF;

  dkey := COALESCE(
    NULLIF(trim(p_dedupe_key), ''),
    CASE
      WHEN p_reference_id IS NOT NULL THEN p_user_id || ':' || p_event_type || ':' || p_reference_id
      ELSE NULL
    END
  );

  IF dkey IS NOT NULL THEN
    SELECT * INTO existing
    FROM public.ghc_economy_events
    WHERE user_id = p_user_id AND dedupe_key = dkey
    LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'id', existing.id,
        'eventType', existing.event_type,
        'dedupeKey', existing.dedupe_key
      );
    END IF;
  END IF;

  INSERT INTO public.ghc_economy_events (
    user_id, event_type, payload, reference_id, request_id,
    title, body, dedupe_key, expires_at, delivered
  ) VALUES (
    p_user_id, p_event_type, COALESCE(p_payload, '{}'::jsonb),
    p_reference_id, p_request_id,
    p_title, p_body, dkey, p_expires_at, false
  )
  RETURNING * INTO created;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'id', created.id,
    'eventType', created.event_type,
    'dedupeKey', created.dedupe_key
  );
EXCEPTION WHEN unique_violation THEN
  SELECT * INTO existing
  FROM public.ghc_economy_events
  WHERE user_id = p_user_id AND dedupe_key = dkey
  LIMIT 1;
  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', true,
    'id', existing.id,
    'eventType', existing.event_type,
    'dedupeKey', existing.dedupe_key
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_record_notification_event(text, text, text, text, text, text, jsonb, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_record_notification_event(text, text, text, text, text, text, jsonb, text, timestamptz) TO service_role;
