-- Phase 4: durable reputation (trust/quality signal only).
-- NOT financial. No GHC/Pi/rewards/Curation Power/ranking.
-- CURRENT STATE = gh_reputation_state (authoritative).
-- EVENT = gh_reputation_events (auditable inputs).
-- SNAPSHOT = gh_reputation_snapshots (history only).

CREATE TABLE IF NOT EXISTS public.gh_reputation_events (
  id              text PRIMARY KEY,
  user_id         text NOT NULL,
  event_type      text NOT NULL,
  points          integer NOT NULL CHECK (points >= 0 AND points <= 10000),
  source_ref      text,
  idempotency_key text NOT NULL,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_reputation_events_user_nonempty CHECK (length(trim(user_id)) > 0),
  CONSTRAINT gh_reputation_events_type_nonempty CHECK (length(trim(event_type)) > 0),
  CONSTRAINT gh_reputation_events_idem_nonempty CHECK (length(trim(idempotency_key)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_reputation_events_user_idem
  ON public.gh_reputation_events (user_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_gh_reputation_events_user_created
  ON public.gh_reputation_events (user_id, created_at DESC);

ALTER TABLE public.gh_reputation_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_reputation_events_no_client ON public.gh_reputation_events;
CREATE POLICY gh_reputation_events_no_client ON public.gh_reputation_events
  FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.gh_reputation_state (
  user_id         text PRIMARY KEY,
  total_points    integer NOT NULL DEFAULT 0 CHECK (total_points >= 0),
  level           integer NOT NULL DEFAULT 1 CHECK (level >= 1 AND level <= 15),
  event_count     integer NOT NULL DEFAULT 0 CHECK (event_count >= 0),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_reputation_state_user_nonempty CHECK (length(trim(user_id)) > 0)
);

ALTER TABLE public.gh_reputation_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_reputation_state_no_client ON public.gh_reputation_state;
CREATE POLICY gh_reputation_state_no_client ON public.gh_reputation_state
  FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.gh_reputation_snapshots (
  id              text PRIMARY KEY,
  user_id         text NOT NULL,
  total_points    integer NOT NULL CHECK (total_points >= 0),
  level           integer NOT NULL CHECK (level >= 1 AND level <= 15),
  reason          text NOT NULL DEFAULT 'event',
  event_id        text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gh_reputation_snapshots_user_created
  ON public.gh_reputation_snapshots (user_id, created_at DESC);

ALTER TABLE public.gh_reputation_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_reputation_snapshots_no_client ON public.gh_reputation_snapshots;
CREATE POLICY gh_reputation_snapshots_no_client ON public.gh_reputation_snapshots
  FOR ALL USING (false) WITH CHECK (false);

-- Level from points (mirrors lib/social-economy/reputation-levels.ts)
CREATE OR REPLACE FUNCTION public.gh_reputation_level_from_points(p_points integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_points >= 15000 THEN 15
    WHEN p_points >= 10000 THEN 14
    WHEN p_points >= 7000 THEN 13
    WHEN p_points >= 5000 THEN 12
    WHEN p_points >= 3500 THEN 11
    WHEN p_points >= 2500 THEN 10
    WHEN p_points >= 1800 THEN 9
    WHEN p_points >= 1200 THEN 8
    WHEN p_points >= 800 THEN 7
    WHEN p_points >= 500 THEN 6
    WHEN p_points >= 300 THEN 5
    WHEN p_points >= 150 THEN 4
    WHEN p_points >= 75 THEN 3
    WHEN p_points >= 25 THEN 2
    ELSE 1
  END;
$$;

/**
 * Apply one reputation event (idempotent).
 * Points must be server-supplied (never client-trusted amounts).
 * Allowed event_type values are enforced by the application layer; DB accepts vetted types only via CHECK-like allowlist here.
 */
CREATE OR REPLACE FUNCTION public.gh_reputation_apply_event(
  p_user_id text,
  p_event_type text,
  p_points integer,
  p_idempotency_key text,
  p_source_ref text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text := lower(trim(COALESCE(p_event_type, '')));
  v_pts integer := GREATEST(0, LEAST(COALESCE(p_points, 0), 10000));
  v_id text;
  v_existing public.gh_reputation_events%ROWTYPE;
  v_total integer;
  v_level integer;
  v_count integer;
  v_snap_id text;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'USER_REQUIRED');
  END IF;
  IF length(v_type) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'EVENT_TYPE_REQUIRED');
  END IF;
  -- Allowlist: only known non-financial participation signals
  IF v_type NOT IN (
    'profile_complete',
    'first_post',
    'community_join',
    'marketplace_order_complete',
    'report_resolved_helpful',
    'manual_adjustment_credit'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_EVENT_TYPE');
  END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'IDEMPOTENCY_REQUIRED');
  END IF;
  -- manual_adjustment reserved; still non-negative only in this phase
  IF v_type = 'manual_adjustment_credit' AND v_pts = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_POINTS');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('gh_rep:' || trim(p_user_id)));

  SELECT * INTO v_existing
  FROM public.gh_reputation_events
  WHERE user_id = trim(p_user_id) AND idempotency_key = trim(p_idempotency_key)
  LIMIT 1;

  IF FOUND THEN
    SELECT total_points, level, event_count INTO v_total, v_level, v_count
    FROM public.gh_reputation_state WHERE user_id = trim(p_user_id);
    RETURN jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'eventId', v_existing.id,
      'totalPoints', COALESCE(v_total, 0),
      'level', COALESCE(v_level, 1),
      'eventCount', COALESCE(v_count, 0)
    );
  END IF;

  v_id := 're_' || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.gh_reputation_events (
    id, user_id, event_type, points, source_ref, idempotency_key, metadata
  ) VALUES (
    v_id, trim(p_user_id), v_type, v_pts,
    NULLIF(trim(COALESCE(p_source_ref, '')), ''),
    trim(p_idempotency_key),
    COALESCE(p_metadata, '{}'::jsonb)
  );

  INSERT INTO public.gh_reputation_state (user_id, total_points, level, event_count, updated_at)
  VALUES (trim(p_user_id), v_pts, public.gh_reputation_level_from_points(v_pts), 1, now())
  ON CONFLICT (user_id) DO UPDATE SET
    total_points = public.gh_reputation_state.total_points + EXCLUDED.total_points,
    level = public.gh_reputation_level_from_points(
      public.gh_reputation_state.total_points + EXCLUDED.total_points
    ),
    event_count = public.gh_reputation_state.event_count + 1,
    updated_at = now();

  SELECT total_points, level, event_count INTO v_total, v_level, v_count
  FROM public.gh_reputation_state WHERE user_id = trim(p_user_id);

  v_snap_id := 'rs_' || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.gh_reputation_snapshots (
    id, user_id, total_points, level, reason, event_id
  ) VALUES (
    v_snap_id, trim(p_user_id), v_total, v_level, 'event', v_id
  );

  RETURN jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'eventId', v_id,
    'totalPoints', v_total,
    'level', v_level,
    'eventCount', v_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_reputation_apply_event(text, text, integer, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_reputation_apply_event(text, text, integer, text, text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.gh_reputation_get(p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer := 0;
  v_level integer := 1;
  v_count integer := 0;
  v_updated timestamptz;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'USER_REQUIRED');
  END IF;

  SELECT total_points, level, event_count, updated_at
  INTO v_total, v_level, v_count, v_updated
  FROM public.gh_reputation_state
  WHERE user_id = trim(p_user_id);

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'userId', trim(p_user_id),
      'totalPoints', 0,
      'level', 1,
      'eventCount', 0,
      'updatedAt', null
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'userId', trim(p_user_id),
    'totalPoints', v_total,
    'level', v_level,
    'eventCount', v_count,
    'updatedAt', v_updated
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_reputation_get(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_reputation_get(text) TO service_role;

COMMENT ON TABLE public.gh_reputation_state IS
  'Authoritative current reputation. Not GHC balance. Service-role only.';
COMMENT ON TABLE public.gh_reputation_events IS
  'Auditable reputation inputs. Idempotent per user+key. No financial meaning.';
